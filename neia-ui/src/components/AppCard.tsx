import type { CSSProperties, ReactNode } from "react";

import type { AppInfo } from "../types";

type AppCardProps = {
  app: AppInfo;
  actions: ReactNode;
  getAssetUrl: (appId: string, assetPath?: string | null) => string | null;
  getDeveloper: (manifest: AppInfo["manifest"]) => string;
};

export function AppCard({ app, actions, getAssetUrl, getDeveloper }: AppCardProps) {
  const iconUrl = getAssetUrl(app.manifest.id, app.manifest.icon || undefined);

  return (
    <div className="app-card">
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
}

export const launchButtonStyle: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "var(--accent)",
  color: "#ffffff",
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontWeight: 600,
  letterSpacing: "0.01em",
  textTransform: "none",
};

export const uninstallButtonStyle: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "#e5e0fb",
  color: "#3d2f7a",
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontWeight: 600,
  letterSpacing: "0.01em",
  textTransform: "none",
};
