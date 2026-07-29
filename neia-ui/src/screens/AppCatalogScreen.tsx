import type { ReactNode } from "react";

import { AppCard, launchButtonStyle, uninstallButtonStyle } from "../components/AppCard";
import type { AppInfo } from "../types";
import { getAssetUrl, getDeveloper } from "../utils/appRuntime";

type AppCatalogScreenProps = {
  available: AppInfo[];
  installed: AppInfo[];
  loading: boolean;
  onInstall: (appId: string) => void;
  onLaunch: (app: AppInfo) => void;
  onUninstall: (appId: string) => void;
};

function optionalApps(apps: AppInfo[]) {
  return apps.filter((app) => app.manifest.id !== "nexus");
}

function renderCard(app: AppInfo, actions: ReactNode) {
  const presentedApp =
    app.manifest.id === "neia_voice_assistant"
      ? { ...app, manifest: { ...app.manifest, name: "Voice Demo" } }
      : app;
  return (
    <AppCard
      app={presentedApp}
      actions={actions}
      getAssetUrl={getAssetUrl}
      getDeveloper={getDeveloper}
      key={app.manifest.id}
    />
  );
}

export function AppCatalogScreen({
  available,
  installed,
  loading,
  onInstall,
  onLaunch,
  onUninstall,
}: AppCatalogScreenProps) {
  const installedOptional = optionalApps(installed);
  const availableOptional = optionalApps(available);

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2">
        <div>
          <h1>App Catalog</h1>
        </div>
      </div>

      {loading ? (
        <div className="empty-state-v2">Loading applications…</div>
      ) : (
        <div className="catalog-sections-v2">
          <section>
            <div className="section-heading-v2">
              <h2>Installed</h2>
              <span>{installedOptional.length}</span>
            </div>
            {installedOptional.length === 0 ? (
              <div className="empty-state-v2 compact">No optional applications are installed.</div>
            ) : (
              <div className="app-grid">
                {installedOptional.map((app) =>
                  renderCard(
                    app,
                    <>
                      <button
                        className="launch-btn"
                        style={launchButtonStyle}
                        onClick={() => onLaunch(app)}
                        type="button"
                      >
                        Open
                      </button>
                      <button
                        className="secondary square-btn"
                        style={uninstallButtonStyle}
                        onClick={() => onUninstall(app.manifest.id)}
                        type="button"
                      >
                        Uninstall
                      </button>
                    </>,
                  ),
                )}
              </div>
            )}
          </section>

          <section>
            <div className="section-heading-v2">
              <h2>Available</h2>
              <span>{availableOptional.length}</span>
            </div>
            {availableOptional.length === 0 ? (
              <div className="empty-state-v2 compact">All local optional applications are installed.</div>
            ) : (
              <div className="app-grid">
                {availableOptional.map((app) =>
                  renderCard(
                    app,
                    <button onClick={() => onInstall(app.manifest.id)} type="button">
                      Install
                    </button>,
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
