import { useCallback, useEffect, useState } from "react";
import "./styles.css";

type StartupStage = "booting" | "waking" | "preSpeak" | "speaking" | "postSpeak" | "done";

const STARTUP_GREETING = "Hello, I am NEIA your edge intelligence agent. Welcome to Nexus.";
const HOLD_ON_STARTUP_SCREEN_FOR_TESTING = false;
const STARTUP_API_MOUTH_DELAY_MS = 0;
const STARTUP_BOOTING_MS = 450;
const STARTUP_WAKING_MS = 600;
const SELECTED_SUBJECT_STORAGE_KEY = 'neia_selected_subject_context';
const SELECTED_SESSION_CONFIG_STORAGE_KEY = 'neia_selected_session_config';
let startupSequenceDone = false;
let startupGreetingSpoken = false;

type AppManifest = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  app_type?: string | null;
  developer?: string | null;
  icon?: string | null;
  entry_ui?: string | null;
  style?: string | null;
  mount?: string | null;
  layout_mode?: string | null;
  dev_entry_ui?: string | null;
  dev_mount?: string | null;
};

type AppInfo = {
  manifest: AppManifest;
  installed: boolean;
  resolved_entry_ui?: string | null;
  resolved_mount?: string | null;
};

type SubjectRecord = {
  subject_id: string;
  display_name: string;
  subject_type?: string | null;
};

type SubjectGroup = {
  group_id?: string | null;
  label?: string | null;
  subjects: SubjectRecord[];
};

type SessionConfigRecord = {
  session_config_id: string;
  name: string;
  deployed?: boolean;
  app_id?: string | null;
  app_name?: string | null;
  subject_group_id?: string | null;
  subject_group_name?: string | null;
  subject_ids?: string[];
  activity?: string | null;
  workflow?: Record<string, unknown>;
  subjects?: SubjectRecord[];
  init_payload?: Record<string, unknown>;
};

type ControlCenterCatalog = {
  customer_id?: string | null;
  site_id?: string | null;
  groups?: SubjectGroup[];
  session_configs?: SessionConfigRecord[];
};

type RemoteOperationState = {
  active: boolean;
  device_name?: string | null;
  site_name?: string | null;
  operator_username?: string | null;
};

type GatewayTargetSettings = {
  gateway: string;
  site?: string | null;
  target_host: string;
  cmd_port: number;
  event_port: number;
  amqp_url?: string | null;
};

type AppsSnapshot = {
  installed: AppInfo[];
  available: AppInfo[];
};

let cachedAppsSnapshot: AppsSnapshot | null = null;
let appsSnapshotInFlight: Promise<AppsSnapshot> | null = null;

function normalizeSubjectRecord(subject: unknown): SubjectRecord | null {
  if (!subject || typeof subject !== "object") {
    return null;
  }
  const candidate = subject as Record<string, unknown>;
  const subjectId = typeof candidate.subject_id === "string" ? candidate.subject_id.trim() : "";
  if (!subjectId) {
    return null;
  }
  return {
    subject_id: subjectId,
    display_name:
      typeof candidate.display_name === "string" && candidate.display_name.trim()
        ? candidate.display_name
        : subjectId,
    subject_type: typeof candidate.subject_type === "string" ? candidate.subject_type : null,
  };
}

function mergeSubjectGroups(
  groups: SubjectGroup[] | undefined,
  sessionConfigs: SessionConfigRecord[] | undefined,
): SubjectGroup[] {
  const baseGroups = Array.isArray(groups)
    ? groups.map((group) => ({
        group_id: group.group_id ?? null,
        label: group.label ?? null,
        subjects: Array.isArray(group.subjects)
          ? group.subjects
              .map((subject) => normalizeSubjectRecord(subject))
              .filter((subject): subject is SubjectRecord => Boolean(subject))
          : [],
      }))
    : [];

  const seenSubjectIds = new Set(
    baseGroups.flatMap((group) => group.subjects.map((subject) => subject.subject_id)),
  );
  const derivedGroups = new Map<string, SubjectGroup>();

  for (const config of Array.isArray(sessionConfigs) ? sessionConfigs : []) {
    const groupId = config.subject_group_id || `session-config:${config.session_config_id}`;
    const label = config.subject_group_name || config.name || "Session Config Subjects";
    for (const subject of Array.isArray(config.subjects) ? config.subjects : []) {
      const normalizedSubject = normalizeSubjectRecord(subject);
      if (!normalizedSubject || seenSubjectIds.has(normalizedSubject.subject_id)) {
        continue;
      }
      const existing = derivedGroups.get(groupId) ?? {
        group_id: groupId,
        label,
        subjects: [],
      };
      existing.subjects.push(normalizedSubject);
      derivedGroups.set(groupId, existing);
      seenSubjectIds.add(normalizedSubject.subject_id);
    }
  }

  return [...baseGroups, ...Array.from(derivedGroups.values()).filter((group) => group.subjects.length > 0)];
}

const launchButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: "none",
  background: "var(--accent)",
  color: "#ffffff",
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontWeight: 600,
  letterSpacing: "0.01em",
  textTransform: "none",
};

const uninstallButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: "none",
  background: "#e5e0fb",
  color: "#3d2f7a",
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontWeight: 600,
  letterSpacing: "0.01em",
  textTransform: "none",
};

function readSelectedSessionConfigId(): string | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { session_config_id?: unknown };
    return typeof parsed.session_config_id === "string" && parsed.session_config_id.trim()
      ? parsed.session_config_id
      : null;
  } catch {
    return null;
  }
}

function useApps() {
  const [installed, setInstalled] = useState<AppInfo[]>([]);
  const [available, setAvailable] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(cachedAppsSnapshot === null);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (cachedAppsSnapshot && !options?.force) {
      setInstalled(cachedAppsSnapshot.installed);
      setAvailable(cachedAppsSnapshot.available);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (!appsSnapshotInFlight || options?.force) {
      appsSnapshotInFlight = (async () => {
        const [installedResp, availableResp] = await Promise.all([
          fetch("/api/v1/apps/installed"),
          fetch("/api/v1/apps/available")
        ]);
        const [installedData, availableData] = await Promise.all([
          installedResp.json(),
          availableResp.json()
        ]);
        const snapshot = {
          installed: installedData as AppInfo[],
          available: availableData as AppInfo[],
        };
        cachedAppsSnapshot = snapshot;
        return snapshot;
      })().finally(() => {
        appsSnapshotInFlight = null;
      });
    }

    const snapshot = await appsSnapshotInFlight;
    setInstalled(snapshot.installed);
    setAvailable(snapshot.available);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { installed, available, loading, refresh };
}

function useControlCenterCatalog() {
  const [catalog, setCatalog] = useState<ControlCenterCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  const updateCatalog = useCallback((nextCatalog: ControlCenterCatalog | null) => {
    setCatalog((prev) => (JSON.stringify(prev) === JSON.stringify(nextCatalog) ? prev : nextCatalog));
  }, []);

  const mergeCatalog = useCallback((updater: (prev: ControlCenterCatalog | null) => ControlCenterCatalog | null) => {
    setCatalog((prev) => {
      const nextCatalog = updater(prev);
      return JSON.stringify(prev) === JSON.stringify(nextCatalog) ? prev : nextCatalog;
    });
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const resp = await fetch("/api/v1/control-center/catalog");
      if (!resp.ok) {
        throw new Error("Failed to load catalog");
      }
      const data = await resp.json();
      updateCatalog(data);
    } catch {
      updateCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [updateCatalog]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyMessage = useCallback((message: { type?: string; payload?: Record<string, unknown> }) => {
    const messageType = typeof message?.type === "string" ? message.type : "";
    const payload = message?.payload;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (messageType === "subject_catalog_update") {
      mergeCatalog((prev) => ({
        customer_id: typeof payload.customer_id === "string" ? payload.customer_id : prev?.customer_id,
        site_id: typeof payload.site_id === "string" ? payload.site_id : prev?.site_id,
        groups: Array.isArray(payload.groups) ? (payload.groups as SubjectGroup[]) : [],
        session_configs: prev?.session_configs ?? [],
      }));
      setLoading(false);
      return;
    }

    if (messageType === "session_config_update") {
      const nextSessionConfigs = Array.isArray(payload.session_configs)
        ? (payload.session_configs as SessionConfigRecord[])
        : [];
      mergeCatalog((prev) => ({
        customer_id: typeof payload.customer_id === "string" ? payload.customer_id : prev?.customer_id,
        site_id: typeof payload.site_id === "string" ? payload.site_id : prev?.site_id,
        groups: mergeSubjectGroups(prev?.groups, nextSessionConfigs),
        session_configs: nextSessionConfigs,
      }));
      setLoading(false);
    }
  }, [mergeCatalog]);

  return { catalog, loading, refresh, applyMessage };
}

function useHashRoute() {
  const getRoute = () => window.location.hash.replace(/^#/, "");
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

function useHostServerStatus() {
  const [serverReady, setServerReady] = useState(false);
  const [siteName, setSiteName] = useState("Site unavailable");
  const [retrying, setRetrying] = useState(false);
  const [usbPresent, setUsbPresent] = useState(false);
  const [usbBusy, setUsbBusy] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);

  const sendReadyCheck = async () => {
    await fetch("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "is_server_ready", payload: {} })
    });
  };

  const sendUsbStatusCheck = async () => {
    await fetch("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_usb_status", payload: {} })
    });
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setServerReady(false);
      void sendReadyCheck().catch(() => {
        setServerReady(false);
      });
      void sendUsbStatusCheck().catch(() => {
        setUsbBusy(false);
      });
    };

    ws.onclose = () => {
      setServerReady(false);
      setUsbBusy(false);
    };

    ws.onerror = () => {
      setServerReady(false);
      setUsbBusy(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "server_ready") {
          setServerReady(true);
          const site = msg?.payload?.site;
          if (typeof site === "string" && site.trim()) {
            setSiteName(site);
          }
          return;
        }
        if (msg?.type === "usb_status") {
          setUsbPresent(Boolean(msg?.payload?.present));
          setUsbBusy(false);
          const error = msg?.payload?.error;
          setUsbError(typeof error === "string" && error.trim() ? error : null);
          return;
        }
        if (msg?.type === "usb_disk_inserted") {
          setUsbPresent(true);
          setUsbBusy(false);
          setUsbError(null);
          return;
        }
        if (msg?.type === "usb_disk_removed") {
          setUsbPresent(false);
          setUsbBusy(false);
          setUsbError(null);
        }
      } catch {
        // ignore malformed gateway events
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const retryServer = async () => {
    setRetrying(true);
    setServerReady(false);
    try {
      await Promise.all([sendReadyCheck(), sendUsbStatusCheck()]);
    } finally {
      setRetrying(false);
    }
  };

  const sendUsbCommand = async (action: "mount" | "unmount") => {
    setUsbBusy(true);
    setUsbError(null);
    try {
      await fetch("/api/v1/gateway/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action === "mount" ? "usb_mount" : "usb_safe_unmount",
          payload: {},
        }),
      });
    } catch {
      setUsbBusy(false);
      setUsbError("Failed to send USB command");
    }
  };

  return { serverReady, siteName, retrying, retryServer, usbPresent, usbBusy, usbError, sendUsbCommand };
}

function useGatewayTargetSettings() {
  const [settings, setSettings] = useState<GatewayTargetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/settings/gateway");
      if (!resp.ok) {
        throw new Error("Failed to load gateway settings");
      }
      const data = (await resp.json()) as GatewayTargetSettings;
      setSettings(data);
    } catch {
      setError("Failed to load gateway settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (nextHost: string) => {
    if (!settings) {
      throw new Error("Gateway settings are unavailable");
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/settings/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_host: nextHost,
          cmd_port: settings.cmd_port,
          event_port: settings.event_port,
        }),
      });
      if (!resp.ok) {
        throw new Error("Failed to save gateway settings");
      }
      const data = (await resp.json()) as GatewayTargetSettings;
      setSettings(data);
      return data;
    } catch {
      setError("Failed to update gateway target.");
      throw new Error("Failed to update gateway target");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  return { settings, loading, saving, error, refresh, save };
}

function getAssetUrl(appId: string, assetPath?: string | null) {
  if (!assetPath) return null;
  if (assetPath.startsWith("http")) return assetPath;
  return `/api/v1/apps/${appId}/asset/${assetPath}`;
}

function appendCacheBust(url: string, token: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_neia=${encodeURIComponent(token)}`;
}

function getViteDevStyleKeys() {
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>("style[data-vite-dev-id], link[data-vite-dev-id]"))
      .map((node) => node.dataset.viteDevId)
      .filter((value): value is string => Boolean(value))
  );
}

function removeNewViteDevStyles(previousKeys: Set<string>) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("style[data-vite-dev-id], link[data-vite-dev-id]"));
  for (const node of nodes) {
    const key = node.dataset.viteDevId;
    if (key && !previousKeys.has(key)) {
      node.remove();
    }
  }
}

function getAppType(manifest: AppManifest) {
  const type = manifest.app_type ? manifest.app_type.toLowerCase() : "";
  if (type === "demo") return "demo";
  if (type === "workflow") return "workflow";
  return "app";
}

function getDeveloper(manifest: AppManifest) {
  return manifest.developer || "Unknown developer";
}

function getLayoutMode(manifest?: AppManifest | null) {
  return manifest?.layout_mode === "framed" ? "framed" : "takeover";
}

function loadScript(src: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.type = "module";
    script.dataset.neiaAppAsset = "script";
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(script);
  });
}

function loadStyle(href: string): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.neiaAppAsset = "style";
  document.head.appendChild(link);
  return link;
}

async function fetchApp(appId: string): Promise<AppInfo> {
  const resp = await fetch(`/api/v1/apps/${appId}`);
  if (!resp.ok) {
    throw new Error("App not found");
  }
  return resp.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function speakInBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("Browser speech synthesis is unavailable"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    const cleanup = () => {
      utterance.onend = null;
      utterance.onerror = null;
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 12000);
    utterance.onend = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve();
    };
    utterance.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("Browser speech synthesis failed"));
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

type StartupSpeechMode = "api" | "browser" | "none";

async function speakStartupGreeting(): Promise<StartupSpeechMode> {
  if (startupGreetingSpoken) {
    return "none";
  }
  startupGreetingSpoken = true;
  try {
    const resp = await fetch("/api/v1/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: STARTUP_GREETING, wait: false })
    });
    if (!resp.ok) {
      throw new Error("Failed to speak startup greeting");
    }
    return "api";
  } catch (_error) {
    // Cloud/remote API may not have local speakers; use client-side speech fallback.
  }
  try {
    await speakInBrowser(STARTUP_GREETING);
    return "browser";
  } catch (_error) {
    // The intro should continue even if all speech options are unavailable.
  }
  return "none";
}

async function readApiSpeaking(): Promise<boolean | null> {
  try {
    const resp = await fetch("/api/v1/voice/status");
    if (!resp.ok) return null;
    const data = await resp.json();
    return !!data?.is_speaking;
  } catch (_error) {
    return null;
  }
}

async function disableVoicePipeline(): Promise<void> {
  try {
    await fetch("/api/v1/voice/deactivate", { method: "POST" });
  } catch (_error) {
    // best effort
  }
  try {
    await fetch("/api/v1/voice/disable", { method: "POST" });
  } catch (_error) {
    // best effort
  }
}

async function waitForApiSpeaking(target: boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const speaking = await readApiSpeaking();
    if (speaking === target) {
      return true;
    }
    await sleep(120);
  }
  return false;
}

function StartupSequence({ stage, exiting }: { stage: StartupStage; exiting: boolean }) {
  const statusText =
    stage === "booting"
      ? "Initializing edge systems..."
      : stage === "waking"
        ? "NEIA waking up..."
        : stage === "preSpeak" || stage === "speaking"
          ? "Voice online."
          : "Welcome to Nexus.";
  return (
    <div className={`startup-overlay stage-${stage}${exiting ? " exiting" : ""}`}>
      <div className="startup-robot" aria-hidden="true">
        <div className="robot-head">
          <div className="robot-eyes">
            <span className="robot-eye" />
            <span className="robot-eye" />
          </div>
          <div className="robot-mouth" />
        </div>
      </div>
      <p className="startup-status">{statusText}</p>
    </div>
  );
}

function SubjectCarousel({
  currentIndex,
  total,
  title,
  onPrev,
  onNext,
}: {
  currentIndex: number;
  total: number;
  title: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="subject-carousel">
      <button className="subject-carousel-btn" onClick={onPrev} disabled={currentIndex === 0} aria-label="Previous subject">
        <span aria-hidden="true">‹</span>
      </button>
      <div className="subject-carousel-copy">
        <span className="subject-carousel-title">{title}</span>
        <span className="subject-carousel-count">
          {currentIndex + 1} / {total}
        </span>
      </div>
      <button
        className="subject-carousel-btn"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        aria-label="Next subject"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

function RemoteOperationOverlay({ state }: { state: RemoteOperationState }) {
  return (
    <div className="remote-operation-overlay">
      <div className="remote-operation-card">
        <p className="remote-operation-kicker">Remote Session</p>
        <h1>NEIA is being remotely operated</h1>
        <p className="remote-operation-copy">
          Control has been transferred to the Nexus Control Center.
        </p>
        <div className="remote-operation-meta">
          <span>
            Device: {state.device_name || "Unknown device"}
          </span>
          <span>
            Site: {state.site_name || "Unknown site"}
          </span>
          <span>
            Operator: {state.operator_username || "Unknown operator"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { installed, available, loading, refresh: refreshApps } = useApps();
  const {
    catalog: controlCenterCatalog,
    loading: catalogLoading,
    refresh: refreshCatalog,
    applyMessage,
  } = useControlCenterCatalog();
  const { serverReady, siteName, retrying, retryServer, usbPresent, usbBusy, usbError, sendUsbCommand } = useHostServerStatus();
  const {
    settings: gatewaySettings,
    loading: gatewaySettingsLoading,
    saving: gatewaySettingsSaving,
    error: gatewaySettingsError,
    save: saveGatewaySettings,
  } = useGatewayTargetSettings();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [appView, setAppView] = useState<AppInfo | null>(null);
  const [appViewError, setAppViewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"installed" | "available">("installed");
  const [activeCategory, setActiveCategory] = useState<"apps" | "workflows" | "demos">("apps");
  const route = useHashRoute();
  const isAppRoute = /^\/app\/[^/]+$/.test(route);
  const [startupStage, setStartupStage] = useState<StartupStage>(
    startupSequenceDone || isAppRoute ? "done" : "booting"
  );
  const [showStartup, setShowStartup] = useState(!startupSequenceDone && !isAppRoute);
  const [startupExiting, setStartupExiting] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [showSessionConfigScreen, setShowSessionConfigScreen] = useState(false);
  const [remoteOperation, setRemoteOperation] = useState<RemoteOperationState>({ active: false });
  const [showGatewaySettings, setShowGatewaySettings] = useState(false);
  const [gatewayHostDraft, setGatewayHostDraft] = useState("localhost");
  const [gatewaySaveError, setGatewaySaveError] = useState<string | null>(null);

  useEffect(() => {
    if (gatewaySettings?.target_host) {
      setGatewayHostDraft(gatewaySettings.target_host);
    }
  }, [gatewaySettings?.target_host]);

  const install = async (appId: string) => {
    await fetch(`/api/v1/apps/install/${appId}`, { method: "POST" });
    cachedAppsSnapshot = null;
    await refreshApps({ force: true });
  };

  const uninstall = async (appId: string) => {
    await fetch(`/api/v1/apps/uninstall/${appId}`, { method: "POST" });
    cachedAppsSnapshot = null;
    await refreshApps({ force: true });
  };

  const launch = (appInfo: AppInfo) => {
    window.location.hash = `/app/${appInfo.manifest.id}`;
  };

  const backToDashboard = async () => {
    if (appView?.manifest.id === "neia_voice_assistant") {
      await disableVoicePipeline();
    }
    setSelectedSubjectId(null);
    setShowSessionConfigScreen(false);
    setSubjectIndex(0);
    window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
    window.location.hash = "/";
  };

  useEffect(() => {
    const match = route.match(/^\/app\/([^/]+)$/);
    if (!match) {
      setAppView(null);
      setAppViewError(null);
      setLaunchError(null);
      return;
    }
    const appId = match[1];
    setAppViewError(null);
    setLaunchError(null);
    void fetchApp(appId)
      .then((info) => setAppView(info))
      .catch(() => {
        setAppView(null);
        setAppViewError("App not found or not installed.");
      });
  }, [route]);

  useEffect(() => {
    if (isAppRoute || startupSequenceDone) {
      setStartupStage("done");
      setShowStartup(false);
      setStartupExiting(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setShowStartup(true);
      setStartupExiting(false);
      setStartupStage("booting");
      await sleep(STARTUP_BOOTING_MS);
      if (cancelled) return;

      setStartupStage("waking");
      await sleep(STARTUP_WAKING_MS);
      if (cancelled) return;

      setStartupStage("preSpeak");
      const speechMode = await speakStartupGreeting();
      if (cancelled) return;
      if (speechMode === "api") {
        if (STARTUP_API_MOUTH_DELAY_MS > 0) {
          await sleep(STARTUP_API_MOUTH_DELAY_MS);
          if (cancelled) return;
        }
        const started = await waitForApiSpeaking(true, 5000);
        if (cancelled) return;
        setStartupStage("speaking");
        if (started) {
          await waitForApiSpeaking(false, 18000);
        } else {
          await sleep(900);
        }
      } else if (speechMode === "browser") {
        setStartupStage("speaking");
        await sleep(300);
      } else {
        setStartupStage("speaking");
        await sleep(900);
      }
      if (cancelled) return;
      setStartupStage("postSpeak");
      await sleep(1200);
      if (cancelled) return;
      if (HOLD_ON_STARTUP_SCREEN_FOR_TESTING) {
        return;
      }

      startupSequenceDone = true;
      await disableVoicePipeline();
      if (cancelled) return;
      setStartupStage("done");
      setStartupExiting(true);
      await sleep(680);
      if (cancelled) return;
      setShowStartup(false);
      setStartupExiting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAppRoute]);

  useEffect(() => {
    if (!appView) {
      return;
    }
    const entry = appView.resolved_entry_ui || appView.manifest.entry_ui;
    const style = appView.manifest.style;
    if (!entry) {
      setLaunchError("No entry UI configured for this app.");
      return;
    }

    let disposed = false;
    let mountedScript: HTMLScriptElement | null = null;
    let mountedStyle: HTMLLinkElement | null = null;
    const assetToken = `${appView.manifest.id}:${Date.now()}`;
    const viteDevStyleKeys = entry.startsWith("http") ? getViteDevStyleKeys() : null;

    if (style) {
      const styleUrl = entry.startsWith("http")
        ? style
        : appendCacheBust(`/api/v1/apps/${appView.manifest.id}/asset/${style}`, assetToken);
      mountedStyle = loadStyle(styleUrl);
    }

    void (async () => {
      try {
        const scriptUrl = entry.startsWith("http")
          ? entry
          : appendCacheBust(`/api/v1/apps/${appView.manifest.id}/asset/${entry}`, assetToken);
        mountedScript = await loadScript(scriptUrl);
        if (disposed) {
          return;
        }

        const mountName = appView.resolved_mount || appView.manifest.mount;
        const mountFn = mountName ? (window as any)[mountName] : null;
        const mountEl = document.getElementById("app-mount");
        if (mountFn && mountEl) {
          mountFn(mountEl, { appId: appView.manifest.id });
        } else {
          setLaunchError("Mount function not found.");
        }
      } catch (err) {
        setLaunchError("Failed to load app UI.");
      }
    })();

    return () => {
      disposed = true;
      const mountEl = document.getElementById("app-mount");
      if (mountEl) {
        mountEl.replaceChildren();
      }
      if (viteDevStyleKeys) {
        removeNewViteDevStyles(viteDevStyleKeys);
      }
      mountedStyle?.remove();
      mountedScript?.remove();
    };
  }, [appView]);

  const availableSubjects = (controlCenterCatalog?.groups ?? []).flatMap((group) =>
    (group.subjects ?? []).map((subject) => ({
      ...subject,
      groupLabel: group.label || "Subjects",
    }))
  );
  const currentSubject = availableSubjects[subjectIndex] ?? null;
  const selectedSubject = availableSubjects.find((subject) => subject.subject_id === selectedSubjectId) ?? null;
  const availableSessionConfigs = selectedSubject
    ? (controlCenterCatalog?.session_configs ?? []).filter((config) =>
        Array.isArray(config.subject_ids) && config.subject_ids.includes(selectedSubject.subject_id)
      )
    : [];
  const selectedSessionConfigId = readSelectedSessionConfigId();
  const installedAppIds = new Set(installed.map((app) => app.manifest.id));
  const shouldShowSubjectSelection =
    !showStartup &&
    !isAppRoute &&
    !catalogLoading &&
    availableSubjects.length > 0 &&
    !selectedSubjectId;
  const shouldShowSessionConfigSelection =
    !showStartup &&
    !isAppRoute &&
    !!selectedSubject &&
    showSessionConfigScreen &&
    availableSessionConfigs.length > 0;

  useEffect(() => {
    if (catalogLoading) {
      return;
    }
    if (availableSubjects.length === 0) {
      setSelectedSubjectId(null);
      setShowSessionConfigScreen(false);
      window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
    }
  }, [availableSubjects.length, catalogLoading]);

  useEffect(() => {
    if (!selectedSubject) {
      setShowSessionConfigScreen(false);
      return;
    }
    setShowSessionConfigScreen(availableSessionConfigs.length > 0);
  }, [availableSessionConfigs.length, selectedSubject]);

  useEffect(() => {
    if (!selectedSessionConfigId || catalogLoading) {
      return;
    }

    const selectedConfigStillAvailable = (controlCenterCatalog?.session_configs ?? []).some(
      (config) => config.session_config_id === selectedSessionConfigId,
    );
    if (selectedConfigStillAvailable) {
      return;
    }

    setSelectedSubjectId(null);
    setShowSessionConfigScreen(false);
    setSubjectIndex(0);
    window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
    window.location.hash = "/";
  }, [catalogLoading, controlCenterCatalog?.session_configs, selectedSessionConfigId]);

  useEffect(() => {
    const isDashboardRoute = route === "" || route === "/";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type !== "control_center_message" || typeof msg?.payload !== "object" || !msg.payload) {
          return;
        }

        const forwardedMessage = msg.payload as {
          type?: string;
          payload?: { groups?: unknown[]; session_configs?: unknown[]; active?: unknown; device_name?: unknown; site_name?: unknown; operator_username?: unknown };
        };
        if (forwardedMessage.type === "remote_operation_update") {
          const active = Boolean(forwardedMessage.payload?.active);
          setSelectedSubjectId(null);
          setShowSessionConfigScreen(false);
          setSubjectIndex(0);
          window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
          window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
          window.location.hash = "/";
          setRemoteOperation({
            active,
            device_name: typeof forwardedMessage.payload?.device_name === "string" ? forwardedMessage.payload.device_name : null,
            site_name: typeof forwardedMessage.payload?.site_name === "string" ? forwardedMessage.payload.site_name : null,
            operator_username: typeof forwardedMessage.payload?.operator_username === "string" ? forwardedMessage.payload.operator_username : null,
          });
          return;
        }
        applyMessage(forwardedMessage);

        if (forwardedMessage.type !== "subject_catalog_update" && forwardedMessage.type !== "session_config_update") {
          return;
        }

        const nextGroups =
          forwardedMessage.type === "subject_catalog_update"
            ? (Array.isArray(forwardedMessage.payload?.groups) ? forwardedMessage.payload.groups : [])
            : mergeSubjectGroups(
                controlCenterCatalog?.groups,
                Array.isArray(forwardedMessage.payload?.session_configs)
                  ? (forwardedMessage.payload.session_configs as SessionConfigRecord[])
                  : [],
              );

        if (!isAppRoute && forwardedMessage.type === "subject_catalog_update" && Array.isArray(nextGroups) && nextGroups.length === 0) {
          setSelectedSubjectId(null);
          setShowSessionConfigScreen(false);
          setSubjectIndex(0);
          window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
          window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
          window.location.hash = "/";
          return;
        }

        if (!isAppRoute && isDashboardRoute && Array.isArray(nextGroups) && nextGroups.length > 0) {
          setSelectedSubjectId(null);
          setShowSessionConfigScreen(false);
          setSubjectIndex(0);
          window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
          window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
          window.location.hash = "/";
        }
      } catch {
        // ignore malformed gateway events
      }
    };

    return () => {
      ws.close();
    };
  }, [applyMessage, controlCenterCatalog?.groups, isAppRoute, route]);

  if (remoteOperation.active) {
    return <RemoteOperationOverlay state={remoteOperation} />;
  }

  if (appView || appViewError) {
    const layoutMode = getLayoutMode(appView?.manifest);
    return (
      <div className={`app-shell takeover layout-${layoutMode}`}>
        <header className="app-topbar">
          <div className="app-topbar-left">
            <button className="app-back-button" onClick={() => void backToDashboard()}>
              Back to Dashboard
            </button>
            <button
              className={`app-usb-button${usbPresent ? " danger" : ""}`}
              onClick={() => void sendUsbCommand(usbPresent ? "unmount" : "mount")}
              disabled={usbBusy}
              title={usbPresent ? "Safely unmount the disk" : "Mount the disk"}
            >
              {usbBusy ? "Working..." : usbPresent ? "Safe Unmount" : "Mount Disk"}
            </button>
            {usbError ? <span className="app-usb-error">{usbError}</span> : null}
          </div>
          <div className="app-topbar-status">
            <div
              className="app-server-status-container"
              title={serverReady ? "System Ready" : "Connecting..."}
            >
              <div className={`app-status-indicator ${serverReady ? "online" : "offline"}`} />
            </div>
            <span className="app-site-name">{siteName}</span>
            {!serverReady ? (
              <button className="app-retry-btn" onClick={() => void retryServer()} disabled={retrying}>
                {retrying ? "Retrying..." : "Retry server"}
              </button>
            ) : null}
          </div>
        </header>
        {appViewError ? <p className="error">{appViewError}</p> : null}
        {launchError ? <p className="error">{launchError}</p> : null}
        <div className={`app-mount takeover layout-${layoutMode}`}>
          <div id="app-mount" className={`app-stage layout-${layoutMode}`} />
        </div>
      </div>
    );
  }

  const installedApps = installed.filter((app) => getAppType(app.manifest) === "app");
  const installedWorkflows = installed.filter((app) => getAppType(app.manifest) === "workflow");
  const installedDemos = installed.filter((app) => getAppType(app.manifest) === "demo");
  const availableApps = available.filter((app) => getAppType(app.manifest) === "app");
  const availableWorkflows = available.filter((app) => getAppType(app.manifest) === "workflow");
  const availableDemos = available.filter((app) => getAppType(app.manifest) === "demo");

  const selectedInstalled =
    activeCategory === "apps"
      ? installedApps
      : activeCategory === "workflows"
        ? installedWorkflows
        : installedDemos;
  const selectedAvailable =
    activeCategory === "apps"
      ? availableApps
      : activeCategory === "workflows"
        ? availableWorkflows
        : availableDemos;
  const selectedTitle =
    activeCategory === "apps" ? "Apps" : activeCategory === "workflows" ? "Workflows" : "Demos";
  const emptyInstalledMessage =
    activeCategory === "apps"
      ? "No apps installed."
      : activeCategory === "workflows"
        ? "No workflows installed."
        : "No demo apps installed.";
  const emptyAvailableMessage =
    activeCategory === "apps"
      ? "No apps available."
      : activeCategory === "workflows"
        ? "No workflows available."
        : "No demo apps available.";

  const renderCategoryTabs = () => (
    <div className="category-tabs" role="tablist" aria-label="App categories">
      <button
        className={activeCategory === "apps" ? "tab active" : "tab"}
        onClick={() => setActiveCategory("apps")}
      >
        Apps
      </button>
      <button
        className={activeCategory === "workflows" ? "tab active" : "tab"}
        onClick={() => setActiveCategory("workflows")}
      >
        Workflows
      </button>
      <button
        className={activeCategory === "demos" ? "tab active" : "tab"}
        onClick={() => setActiveCategory("demos")}
      >
        Demos
      </button>
    </div>
  );

  const saveGatewayTarget = async () => {
    const nextHost = gatewayHostDraft.trim();
    if (!nextHost) {
      setGatewaySaveError("Enter a Nexus core host.");
      return;
    }
    setGatewaySaveError(null);
    try {
      await saveGatewaySettings(nextHost);
      await retryServer();
      setShowGatewaySettings(false);
    } catch {
      // handled in hook state
    }
  };

  const renderAppCard = (app: AppInfo, actions: React.ReactNode) => {
    const iconUrl = getAssetUrl(app.manifest.id, app.manifest.icon || undefined);
    return (
      <div className="app-card" key={app.manifest.id}>
        <div className="app-card-copy">
          <div className="app-card-header">
            {iconUrl ? (
              <img className="app-icon" src={iconUrl} alt={`${app.manifest.name} icon`} />
            ) : (
              <div className="app-icon fallback">{app.manifest.name.slice(0, 1).toUpperCase()}</div>
            )}
            <div className="app-card-title">
              <strong>{app.manifest.name}</strong>
              <span className="meta">v{app.manifest.version}</span>
            </div>
          </div>
          {app.manifest.description ? <p className="app-card-desc">{app.manifest.description}</p> : null}
          <span className="app-developer">Developed by {getDeveloper(app.manifest)}</span>
        </div>
        <div className="actions app-card-actions">{actions}</div>
      </div>
    );
  };

  const dashboardClass = showStartup && !startupExiting ? "shell dashboard-pre" : "shell dashboard-enter";

  if (shouldShowSubjectSelection) {
    return (
      <>
        <div className={dashboardClass}>
          <header className="shell-header">
            <div className="shell-brand">
            </div>
            <img className="shell-logo" src="/neia_logo.png" alt="NEIA logo" />
          </header>

          <section className="shell-body full">
            <div className="panel wide subject-select-panel">
              <SubjectCarousel
                currentIndex={subjectIndex}
                total={availableSubjects.length}
                title={currentSubject?.groupLabel || "Subjects"}
                onPrev={() => setSubjectIndex((value) => Math.max(0, value - 1))}
                onNext={() => setSubjectIndex((value) => Math.min(availableSubjects.length - 1, value + 1))}
              />
              {currentSubject ? (
                <>
                <button
                  className="subject-focus-card"
                  onClick={() => {
                    setSelectedSubjectId(currentSubject.subject_id);
                    window.localStorage.setItem(
                      SELECTED_SUBJECT_STORAGE_KEY,
                      JSON.stringify({
                        subject_id: currentSubject.subject_id,
                        display_name: currentSubject.display_name,
                        subject_type: currentSubject.subject_type ?? null,
                      }),
                    );
                  }}
                  type="button"
                >
                  <p className="subject-focus-kicker">Current Subject</p>
                  <h2>{currentSubject.display_name}</h2>
                  <p className="subject-focus-id">
                    {currentSubject.subject_type ? `${currentSubject.subject_type} · ` : ''}
                    {currentSubject.subject_id}
                  </p>
                </button>
                <button
                  className="subject-skip-action subject-skip-outside"
                  onClick={() => {
                    setSelectedSubjectId("none");
                    setShowSessionConfigScreen(false);
                    window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
                  }}
                >
                  Continue without subject
                </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
        {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
      </>
    );
  }

  if (shouldShowSessionConfigSelection && selectedSubject) {
    return (
      <>
        <div className={dashboardClass}>
          <header className="shell-header">
            <div className="shell-brand">
              <h1>Session Configs</h1>
              <p>{selectedSubject.display_name} has predefined workflow configs available.</p>
            </div>
            <img className="shell-logo" src="/neia_logo.png" alt="NEIA logo" />
          </header>

          <section className="shell-body full">
            <div className="panel wide session-config-panel">
              <div className="session-config-list">
                {availableSessionConfigs.map((config) => (
                  <div className="session-config-card" key={config.session_config_id}>
                    <div className="session-config-copy">
                      <p className="session-config-kicker">Session Config</p>
                      <h2>{config.name}</h2>
                      <p className="session-config-meta">
                        {config.app_name || config.app_id ? `App: ${config.app_name || config.app_id}` : 'App to be defined'}
                      </p>
                      <p className="session-config-meta">
                        Deployed: {config.deployed ? "Yes" : "No"}
                      </p>
                    </div>
                    <button
                      className="session-config-launch-btn"
                      disabled={!config.app_id || !installedAppIds.has(config.app_id)}
                      onClick={() => {
                        if (!config.app_id) {
                          return;
                        }
                        window.localStorage.setItem(SELECTED_SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config));
                        window.location.hash = `/app/${config.app_id}`;
                      }}
                    >
                      {!config.app_id || !installedAppIds.has(config.app_id) ? 'App not installed' : 'Launch config'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="session-config-actions">
                <button
                  className="subject-skip-action"
                  onClick={() => {
                    setSelectedSubjectId(null);
                    setShowSessionConfigScreen(false);
                    setSubjectIndex(0);
                    window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
                    window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
                  }}
                >
                  Back to subjects
                </button>
                <button className="subject-skip-action" onClick={() => setShowSessionConfigScreen(false)}>
                  Continue to dashboard
                </button>
              </div>
            </div>
          </section>
        </div>
        {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
      </>
    );
  }

  return (
    <>
      <div className={dashboardClass}>
      <header className="shell-header">
        <div className="shell-brand">
          <h1>NEIA Dashboard</h1>
          {selectedSubject ? (
            <div className="shell-subject-inline">
              <p>{selectedSubject.display_name}</p>
              <button
                className="shell-subject-change"
                onClick={() => {
                  setSelectedSubjectId(null);
                  setShowSessionConfigScreen(false);
                  window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <p>Manage and launch installed apps.</p>
          )}
          <div className="gateway-summary-row">
            <span className="gateway-summary-copy">
              Core target: {gatewaySettings?.target_host || (gatewaySettingsLoading ? "Loading..." : "Unavailable")}
            </span>
            <button
              className="gateway-settings-toggle"
              onClick={() => {
                setGatewaySaveError(null);
                setShowGatewaySettings((value) => !value);
              }}
              type="button"
            >
              {showGatewaySettings ? "Close settings" : "Connection settings"}
            </button>
          </div>
        </div>
        <img className="shell-logo" src="/neia_logo.png" alt="NEIA logo" />
      </header>

      {showGatewaySettings ? (
        <section className="panel wide gateway-settings-panel">
          <div className="gateway-settings-header">
            <div>
              <h2>Gateway Connection</h2>
              <p className="gateway-settings-copy">
                Point NEIA at the Nexus N3 core deployment it should talk to.
              </p>
            </div>
            <div className="gateway-settings-meta">
              <span>Mode: {gatewaySettings?.gateway || "unknown"}</span>
              <span>
                Ports: {gatewaySettings?.cmd_port ?? 5555} / {gatewaySettings?.event_port ?? 5556}
              </span>
            </div>
          </div>
          <div className="gateway-settings-form">
            <label className="gateway-settings-label" htmlFor="gateway-target-host">
              Core Host
            </label>
            <input
              id="gateway-target-host"
              className="gateway-settings-input"
              value={gatewayHostDraft}
              onChange={(event) => setGatewayHostDraft(event.target.value)}
              placeholder="localhost or nexus-n3-master.local"
              autoComplete="off"
            />
            <p className="gateway-settings-hint">
              Use `localhost` when NEIA and `nexus-n3-core` run on the same machine.
            </p>
            {gatewaySettingsError || gatewaySaveError ? (
              <p className="gateway-settings-error">{gatewaySaveError || gatewaySettingsError}</p>
            ) : null}
            <div className="gateway-settings-actions">
              <button
                className="subject-skip-action"
                type="button"
                onClick={() => {
                  setGatewayHostDraft(gatewaySettings?.target_host || "localhost");
                  setGatewaySaveError(null);
                  setShowGatewaySettings(false);
                }}
              >
                Cancel
              </button>
              <button
                className="session-config-launch-btn gateway-settings-save"
                type="button"
                onClick={() => void saveGatewayTarget()}
                disabled={gatewaySettingsSaving || gatewaySettings?.gateway !== "zeromq"}
              >
                {gatewaySettingsSaving ? "Saving..." : "Save target"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="shell-tabs">
        <button
          className={activeTab === "installed" ? "tab active" : "tab"}
          onClick={() => setActiveTab("installed")}
        >
          Installed Apps
        </button>
        <button
          className={activeTab === "available" ? "tab active" : "tab"}
          onClick={() => setActiveTab("available")}
        >
          Available Apps
        </button>
      </div>

      <section className="shell-body full">
        {activeTab === "installed" ? (
          <div className="panel wide">
            <h2>Installed Apps</h2>
            {renderCategoryTabs()}
            {loading ? (
              <p>Loading...</p>
            ) : installed.length === 0 ? (
              <p>No apps installed.</p>
            ) : (
              <div className="app-section">
                <h3>{selectedTitle}</h3>
                {selectedInstalled.length === 0 ? (
                  <p className="muted">{emptyInstalledMessage}</p>
                ) : (
                  <div className="app-grid">
                    {selectedInstalled.map((app) =>
                      renderAppCard(
                        app,
                        <>
                          <button className="launch-btn" style={launchButtonStyle} onClick={() => launch(app)}>
                            Launch
                          </button>
                          <button
                            className="secondary square-btn"
                            style={uninstallButtonStyle}
                            onClick={() => uninstall(app.manifest.id)}
                          >
                            Uninstall
                          </button>
                        </>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="panel wide">
            <h2>Available Apps</h2>
            {renderCategoryTabs()}
            {loading ? (
              <p>Loading...</p>
            ) : available.length === 0 ? (
              <p>No apps available.</p>
            ) : (
              <div className="app-section">
                <h3>{selectedTitle}</h3>
                {selectedAvailable.length === 0 ? (
                  <p className="muted">{emptyAvailableMessage}</p>
                ) : (
                  <div className="app-grid">
                    {selectedAvailable.map((app) =>
                      renderAppCard(
                        app,
                        <button onClick={() => install(app.manifest.id)}>Install</button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      </div>
      {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
    </>
  );
}
