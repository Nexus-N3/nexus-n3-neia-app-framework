import { useEffect, useState } from "react";
import "./styles.css";

type StartupStage = "booting" | "waking" | "preSpeak" | "speaking" | "postSpeak" | "done";

const STARTUP_GREETING = "Hello, I am NEIA your edge intelligence agent. Welcome to Nexus.";
const HOLD_ON_STARTUP_SCREEN_FOR_TESTING = false;
const STARTUP_API_MOUTH_DELAY_MS = 0;
const STARTUP_BOOTING_MS = 450;
const STARTUP_WAKING_MS = 600;
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

function useApps() {
  const [installed, setInstalled] = useState<AppInfo[]>([]);
  const [available, setAvailable] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [installedResp, availableResp] = await Promise.all([
      fetch("/api/v1/apps/installed"),
      fetch("/api/v1/apps/available")
    ]);
    const [installedData, availableData] = await Promise.all([
      installedResp.json(),
      availableResp.json()
    ]);
    setInstalled(installedData);
    setAvailable(availableData);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { installed, available, loading, refresh };
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

function getAssetUrl(appId: string, assetPath?: string | null) {
  if (!assetPath) return null;
  if (assetPath.startsWith("http")) return assetPath;
  return `/api/v1/apps/${appId}/asset/${assetPath}`;
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
    // Startup should be able to speak even when voice is normally disabled by default.
    await fetch("/api/v1/voice/enable", { method: "POST" });
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

export default function App() {
  const { installed, available, loading, refresh } = useApps();
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

  const install = async (appId: string) => {
    await fetch(`/api/v1/apps/install/${appId}`, { method: "POST" });
    await refresh();
  };

  const uninstall = async (appId: string) => {
    await fetch(`/api/v1/apps/uninstall/${appId}`, { method: "POST" });
    await refresh();
  };

  const launch = (appInfo: AppInfo) => {
    window.location.hash = `/app/${appInfo.manifest.id}`;
  };

  const backToDashboard = async () => {
    if (appView?.manifest.id === "neia_voice_assistant") {
      await disableVoicePipeline();
    }
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
        // Start mouth movement when backend reports actual speech start.
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
          // Fallback if backend speaking transition was missed.
          await sleep(900);
        }
      } else if (speechMode === "browser") {
        // Browser speech completed in speakStartupGreeting.
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

    if (style) {
      const styleUrl = entry.startsWith("http") ? style : `/api/v1/apps/${appView.manifest.id}/asset/${style}`;
      mountedStyle = loadStyle(styleUrl);
    }

    void (async () => {
      try {
        const scriptUrl = entry.startsWith("http")
          ? entry
          : `/api/v1/apps/${appView.manifest.id}/asset/${entry}`;
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
      mountedStyle?.remove();
      mountedScript?.remove();
    };
  }, [appView]);

  if (appView || appViewError) {
    const layoutMode = getLayoutMode(appView?.manifest);
    return (
      <div className={`app-shell takeover layout-${layoutMode}`}>
        <header className="app-topbar">
          <button className="secondary" onClick={() => void backToDashboard()}>
            Back to Dashboard
          </button>
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

  const renderAppCard = (app: AppInfo, actions: React.ReactNode) => {
    const iconUrl = getAssetUrl(app.manifest.id, app.manifest.icon || undefined);
    return (
      <div className="app-card" key={app.manifest.id}>
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
        <div className="app-card-footer">
          <span className="app-developer">Developed by {getDeveloper(app.manifest)}</span>
          <div className="actions">{actions}</div>
        </div>
      </div>
    );
  };

  const dashboardClass = showStartup && !startupExiting ? "shell dashboard-pre" : "shell dashboard-enter";

  return (
    <>
      <div className={dashboardClass}>
      <header className="shell-header">
        <div className="shell-brand">
          <h1>NEIA Dashboard</h1>
          <p>Manage and launch installed apps.</p>
        </div>
        <img className="shell-logo" src="/neia_logo.png" alt="NEIA logo" />
      </header>

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
                          <button className="launch-btn" onClick={() => launch(app)}>Launch</button>
                          <button className="secondary square-btn" onClick={() => uninstall(app.manifest.id)}>
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
