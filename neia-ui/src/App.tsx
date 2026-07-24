import { useEffect, useState } from "react";

import { RemoteOperationOverlay } from "./components/RemoteOperationOverlay";
import { StartupSequence } from "./components/StartupSequence";
import { useApps, invalidateAppsSnapshot } from "./hooks/useApps";
import { useControlCenterCatalog } from "./hooks/useControlCenterCatalog";
import { useGatewayTargetSettings } from "./hooks/useGatewayTargetSettings";
import { useHashRoute } from "./hooks/useHashRoute";
import { useHostServerStatus } from "./hooks/useHostServerStatus";
import { AppHostScreen } from "./screens/AppHostScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { SessionConfigScreen } from "./screens/SessionConfigScreen";
import { SubjectSelectionScreen } from "./screens/SubjectSelectionScreen";
import "./styles.css";
import type {
  AppInfo,
  RemoteOperationState,
  SessionConfigRecord,
  StartupStage,
  SubjectSelectionOption,
} from "./types";
import {
  mergeSubjectGroups,
  readSelectedSessionConfigId,
  SELECTED_SESSION_CONFIG_STORAGE_KEY,
  SELECTED_SUBJECT_STORAGE_KEY,
} from "./utils/catalog";
import {
  appendCacheBust,
  fetchApp,
  getViteDevStyleKeys,
  loadScript,
  loadStyle,
  removeNewViteDevStyles,
} from "./utils/appRuntime";
import {
  disableVoicePipeline,
  HOLD_ON_STARTUP_SCREEN_FOR_TESTING,
  isStartupSequenceDone,
  markStartupSequenceDone,
  sleep,
  speakStartupGreeting,
  STARTUP_API_MOUTH_DELAY_MS,
  STARTUP_BOOTING_MS,
  STARTUP_WAKING_MS,
  waitForApiSpeaking,
} from "./utils/startup";

export default function App() {
  const { installed, available, loading, refresh: refreshApps } = useApps();
  const {
    catalog: controlCenterCatalog,
    loading: catalogLoading,
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
    isStartupSequenceDone() || isAppRoute ? "done" : "booting",
  );
  const [showStartup, setShowStartup] = useState(!isStartupSequenceDone() && !isAppRoute);
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
    invalidateAppsSnapshot();
    await refreshApps({ force: true });
  };

  const uninstall = async (appId: string) => {
    await fetch(`/api/v1/apps/uninstall/${appId}`, { method: "POST" });
    invalidateAppsSnapshot();
    await refreshApps({ force: true });
  };

  const launch = (appInfo: AppInfo) => {
    window.location.hash = `/app/${appInfo.manifest.id}`;
  };

  const resetSelectionState = () => {
    setSelectedSubjectId(null);
    setShowSessionConfigScreen(false);
    setSubjectIndex(0);
    window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
  };

  const backToDashboard = async () => {
    if (appView?.manifest.id === "neia_voice_assistant") {
      await disableVoicePipeline();
    }
    resetSelectionState();
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
    if (isAppRoute || isStartupSequenceDone()) {
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

      markStartupSequenceDone();
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
        const mountFn = mountName ? (window as Window & Record<string, unknown>)[mountName] : null;
        const mountEl = document.getElementById("app-mount");
        if (typeof mountFn === "function" && mountEl) {
          (mountFn as (element: HTMLElement, options: { appId: string }) => void)(mountEl, {
            appId: appView.manifest.id,
          });
        } else {
          setLaunchError("Mount function not found.");
        }
      } catch {
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

  const availableSubjects: SubjectSelectionOption[] = (controlCenterCatalog?.groups ?? []).flatMap((group) =>
    (group.subjects ?? []).map((subject) => ({
      ...subject,
      groupLabel: group.label || "Subjects",
    })),
  );
  const currentSubject = availableSubjects[subjectIndex] ?? null;
  const selectedSubject = availableSubjects.find((subject) => subject.subject_id === selectedSubjectId) ?? null;
  const availableSessionConfigs = selectedSubject
    ? (controlCenterCatalog?.session_configs ?? []).filter(
        (config) =>
          Array.isArray(config.subject_ids) && config.subject_ids.includes(selectedSubject.subject_id),
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

    resetSelectionState();
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
          payload?: {
            active?: unknown;
            device_name?: unknown;
            groups?: unknown[];
            operator_username?: unknown;
            session_configs?: unknown[];
            site_name?: unknown;
          };
        };
        if (forwardedMessage.type === "remote_operation_update") {
          const active = Boolean(forwardedMessage.payload?.active);
          resetSelectionState();
          window.location.hash = "/";
          setRemoteOperation({
            active,
            device_name:
              typeof forwardedMessage.payload?.device_name === "string"
                ? forwardedMessage.payload.device_name
                : null,
            site_name:
              typeof forwardedMessage.payload?.site_name === "string"
                ? forwardedMessage.payload.site_name
                : null,
            operator_username:
              typeof forwardedMessage.payload?.operator_username === "string"
                ? forwardedMessage.payload.operator_username
                : null,
          });
          return;
        }
        applyMessage(forwardedMessage);

        if (forwardedMessage.type !== "subject_catalog_update" && forwardedMessage.type !== "session_config_update") {
          return;
        }

        const nextGroups =
          forwardedMessage.type === "subject_catalog_update"
            ? Array.isArray(forwardedMessage.payload?.groups)
              ? forwardedMessage.payload.groups
              : []
            : mergeSubjectGroups(
                controlCenterCatalog?.groups,
                Array.isArray(forwardedMessage.payload?.session_configs)
                  ? (forwardedMessage.payload.session_configs as SessionConfigRecord[])
                  : [],
              );

        if (!isAppRoute && forwardedMessage.type === "subject_catalog_update" && Array.isArray(nextGroups) && nextGroups.length === 0) {
          resetSelectionState();
          window.location.hash = "/";
          return;
        }

        if (!isAppRoute && isDashboardRoute && Array.isArray(nextGroups) && nextGroups.length > 0) {
          resetSelectionState();
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

  const dashboardClass = showStartup && !startupExiting ? "shell dashboard-pre" : "shell dashboard-enter";

  if (remoteOperation.active) {
    return <RemoteOperationOverlay state={remoteOperation} />;
  }

  if (appView || appViewError) {
    return (
      <AppHostScreen
        appView={appView}
        appViewError={appViewError}
        launchError={launchError}
        serverReady={serverReady}
        siteName={siteName}
        retrying={retrying}
        usbPresent={usbPresent}
        usbBusy={usbBusy}
        usbError={usbError}
        onBack={() => void backToDashboard()}
        onRetryServer={() => void retryServer()}
        onUsbCommand={(action) => void sendUsbCommand(action)}
      />
    );
  }

  if (shouldShowSubjectSelection) {
    return (
      <SubjectSelectionScreen
        currentSubject={currentSubject}
        dashboardClass={dashboardClass}
        showStartup={showStartup}
        startupExiting={startupExiting}
        startupStage={startupStage}
        subjectCount={availableSubjects.length}
        subjectIndex={subjectIndex}
        onNext={() => setSubjectIndex((value) => Math.min(availableSubjects.length - 1, value + 1))}
        onPrev={() => setSubjectIndex((value) => Math.max(0, value - 1))}
        onSelectSubject={(subject) => {
          setSelectedSubjectId(subject.subject_id);
          window.localStorage.setItem(
            SELECTED_SUBJECT_STORAGE_KEY,
            JSON.stringify({
              subject_id: subject.subject_id,
              display_name: subject.display_name,
              subject_type: subject.subject_type ?? null,
            }),
          );
        }}
        onSkip={() => {
          setSelectedSubjectId("none");
          setShowSessionConfigScreen(false);
          window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
        }}
      />
    );
  }

  if (shouldShowSessionConfigSelection && selectedSubject) {
    return (
      <SessionConfigScreen
        dashboardClass={dashboardClass}
        installedAppIds={installedAppIds}
        selectedSubject={selectedSubject}
        sessionConfigs={availableSessionConfigs}
        showStartup={showStartup}
        startupExiting={startupExiting}
        startupStage={startupStage}
        onBackToSubjects={() => {
          resetSelectionState();
        }}
        onContinueToDashboard={() => setShowSessionConfigScreen(false)}
        onLaunchConfig={(config) => {
          if (!config.app_id) {
            return;
          }
          window.localStorage.setItem(SELECTED_SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config));
          window.location.hash = `/app/${config.app_id}`;
        }}
      />
    );
  }

  return (
    <>
      <DashboardScreen
        activeCategory={activeCategory}
        activeTab={activeTab}
        available={available}
        dashboardClass={dashboardClass}
        gatewayHostDraft={gatewayHostDraft}
        gatewaySaveError={gatewaySaveError}
        gatewaySettings={gatewaySettings}
        gatewaySettingsError={gatewaySettingsError}
        gatewaySettingsLoading={gatewaySettingsLoading}
        gatewaySettingsSaving={gatewaySettingsSaving}
        installed={installed}
        loading={loading}
        selectedSubject={selectedSubject}
        showGatewaySettings={showGatewaySettings}
        onChangeCategory={setActiveCategory}
        onChangeGatewayHostDraft={setGatewayHostDraft}
        onChangeSubject={() => {
          setSelectedSubjectId(null);
          setShowSessionConfigScreen(false);
          window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
        }}
        onInstall={(appId) => void install(appId)}
        onLaunch={launch}
        onOpenGatewaySettings={() => {
          setGatewaySaveError(null);
          setShowGatewaySettings((value) => !value);
        }}
        onCancelGatewaySettings={() => {
          setGatewayHostDraft(gatewaySettings?.target_host || "localhost");
          setGatewaySaveError(null);
          setShowGatewaySettings(false);
        }}
        onSaveGatewayTarget={() => void saveGatewayTarget()}
        onTabChange={setActiveTab}
        onUninstall={(appId) => void uninstall(appId)}
      />
      {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
    </>
  );
}
