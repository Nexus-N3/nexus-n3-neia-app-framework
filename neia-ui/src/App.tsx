import { useEffect, useState } from "react";
import "./styles.css";

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
  return type === "demo" ? "demo" : "app";
}

function getDeveloper(manifest: AppManifest) {
  return manifest.developer || "Unknown developer";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.type = "module";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(script);
  });
}

function loadStyle(href: string): void {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function fetchApp(appId: string): Promise<AppInfo> {
  const resp = await fetch(`/api/v1/apps/${appId}`);
  if (!resp.ok) {
    throw new Error("App not found");
  }
  return resp.json();
}

export default function App() {
  const { installed, available, loading, refresh } = useApps();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [appView, setAppView] = useState<AppInfo | null>(null);
  const [appViewError, setAppViewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"installed" | "available">("installed");
  const route = useHashRoute();

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
    if (!appView) {
      return;
    }
    const entry = appView.resolved_entry_ui || appView.manifest.entry_ui;
    const style = appView.manifest.style;
    if (!entry) {
      setLaunchError("No entry UI configured for this app.");
      return;
    }

    if (style) {
      const styleUrl = entry.startsWith("http") ? style : `/api/v1/apps/${appView.manifest.id}/asset/${style}`;
      loadStyle(styleUrl);
    }

    void (async () => {
      try {
        const scriptUrl = entry.startsWith("http")
          ? entry
          : `/api/v1/apps/${appView.manifest.id}/asset/${entry}`;
        await loadScript(scriptUrl);

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
  }, [appView]);

  if (appView || appViewError) {
    return (
      <div className="app-shell">
        <header className="shell-header app-header">
          <button className="secondary" onClick={() => (window.location.hash = "/")}>
            Back to Dashboard
          </button>
          <div>
            <h1>{appView?.manifest.name || "App"}</h1>
            <p>{appView?.manifest.description || " "}</p>
          </div>
        </header>
        {appViewError ? <p className="error">{appViewError}</p> : null}
        {launchError ? <p className="error">{launchError}</p> : null}
        <div id="app-mount" className="app-mount full" />
      </div>
    );
  }

  const demoApps = installed.filter((app) => getAppType(app.manifest) === "demo");
  const realApps = installed.filter((app) => getAppType(app.manifest) !== "demo");
  const demoAvailable = available.filter((app) => getAppType(app.manifest) === "demo");
  const realAvailable = available.filter((app) => getAppType(app.manifest) !== "demo");

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

  return (
    <div className="shell">
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
            {loading ? (
              <p>Loading...</p>
            ) : installed.length === 0 ? (
              <p>No apps installed.</p>
            ) : (
              <div className="app-section">
                <h3>Demo Apps</h3>
                {demoApps.length === 0 ? (
                  <p className="muted">No demo apps installed.</p>
                ) : (
                  <div className="app-grid">
                    {demoApps.map((app) =>
                      renderAppCard(
                        app,
                        <>
                          <button onClick={() => launch(app)}>Launch</button>
                          <button className="secondary" onClick={() => uninstall(app.manifest.id)}>
                            Uninstall
                          </button>
                        </>
                      )
                    )}
                  </div>
                )}
                <h3>Apps</h3>
                {realApps.length === 0 ? (
                  <p className="muted">No apps installed.</p>
                ) : (
                  <div className="app-grid">
                    {realApps.map((app) =>
                      renderAppCard(
                        app,
                        <>
                          <button onClick={() => launch(app)}>Launch</button>
                          <button className="secondary" onClick={() => uninstall(app.manifest.id)}>
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
            {loading ? (
              <p>Loading...</p>
            ) : available.length === 0 ? (
              <p>No apps available.</p>
            ) : (
              <div className="app-section">
                <h3>Demo Apps</h3>
                {demoAvailable.length === 0 ? (
                  <p className="muted">No demo apps available.</p>
                ) : (
                  <div className="app-grid">
                    {demoAvailable.map((app) =>
                      renderAppCard(
                        app,
                        <button onClick={() => install(app.manifest.id)}>Install</button>
                      )
                    )}
                  </div>
                )}
                <h3>Apps</h3>
                {realAvailable.length === 0 ? (
                  <p className="muted">No apps available.</p>
                ) : (
                  <div className="app-grid">
                    {realAvailable.map((app) =>
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
  );
}
