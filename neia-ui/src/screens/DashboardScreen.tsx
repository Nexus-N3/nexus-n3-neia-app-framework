import type { ReactNode } from "react";

import { AppCard, launchButtonStyle, uninstallButtonStyle } from "../components/AppCard";
import { DashboardHeader } from "../components/DashboardHeader";
import { GatewaySettingsPanel } from "../components/GatewaySettingsPanel";
import { TabButtonGroup } from "../components/TabButtonGroup";
import type { AppInfo, GatewayTargetSettings, SubjectRecord } from "../types";
import { getAssetUrl, getDeveloper } from "../utils/appRuntime";

type DashboardScreenProps = {
  activeCategory: "apps" | "workflows" | "demos";
  activeTab: "installed" | "available";
  available: AppInfo[];
  dashboardClass: string;
  gatewayHostDraft: string;
  gatewaySaveError: string | null;
  gatewaySettings: GatewayTargetSettings | null;
  gatewaySettingsError: string | null;
  gatewaySettingsLoading: boolean;
  gatewaySettingsSaving: boolean;
  installed: AppInfo[];
  loading: boolean;
  selectedSubject: SubjectRecord | null;
  showGatewaySettings: boolean;
  onChangeCategory: (value: "apps" | "workflows" | "demos") => void;
  onChangeGatewayHostDraft: (value: string) => void;
  onChangeSubject: () => void;
  onInstall: (appId: string) => void;
  onLaunch: (app: AppInfo) => void;
  onOpenGatewaySettings: () => void;
  onCancelGatewaySettings: () => void;
  onSaveGatewayTarget: () => void;
  onTabChange: (value: "installed" | "available") => void;
  onUninstall: (appId: string) => void;
};

function renderAppCard(app: AppInfo, actions: ReactNode) {
  return (
    <AppCard
      app={app}
      actions={actions}
      getAssetUrl={getAssetUrl}
      getDeveloper={getDeveloper}
      key={app.manifest.id}
    />
  );
}

export function DashboardScreen({
  activeCategory,
  activeTab,
  available,
  dashboardClass,
  gatewayHostDraft,
  gatewaySaveError,
  gatewaySettings,
  gatewaySettingsError,
  gatewaySettingsLoading,
  gatewaySettingsSaving,
  installed,
  loading,
  selectedSubject,
  showGatewaySettings,
  onChangeCategory,
  onChangeGatewayHostDraft,
  onChangeSubject,
  onInstall,
  onLaunch,
  onOpenGatewaySettings,
  onCancelGatewaySettings,
  onSaveGatewayTarget,
  onTabChange,
  onUninstall,
}: DashboardScreenProps) {
  const installedApps = installed.filter((app) => app.manifest.app_type?.toLowerCase() !== "workflow" && app.manifest.app_type?.toLowerCase() !== "demo");
  const installedWorkflows = installed.filter((app) => app.manifest.app_type?.toLowerCase() === "workflow");
  const installedDemos = installed.filter((app) => app.manifest.app_type?.toLowerCase() === "demo");
  const availableApps = available.filter((app) => app.manifest.app_type?.toLowerCase() !== "workflow" && app.manifest.app_type?.toLowerCase() !== "demo");
  const availableWorkflows = available.filter((app) => app.manifest.app_type?.toLowerCase() === "workflow");
  const availableDemos = available.filter((app) => app.manifest.app_type?.toLowerCase() === "demo");

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

  return (
    <div className={dashboardClass}>
      <DashboardHeader
        title="NEIA Dashboard"
        description={
          selectedSubject ? (
            <div className="shell-subject-inline">
              <p>{selectedSubject.display_name}</p>
              <button className="shell-subject-change" onClick={onChangeSubject} type="button">
                Change
              </button>
            </div>
          ) : (
            <p>Manage and launch installed apps.</p>
          )
        }
      >
        <div className="gateway-summary-row">
          <button className="gateway-settings-toggle" onClick={onOpenGatewaySettings} type="button">
            {showGatewaySettings ? "Close settings" : "Connection settings"}
          </button>
          <span className="gateway-summary-copy">
            Nexus N3 Core target: {gatewaySettings?.target_host || (gatewaySettingsLoading ? "Loading..." : "Unavailable")}
          </span>
        </div>
      </DashboardHeader>

      {showGatewaySettings ? (
        <GatewaySettingsPanel
          error={gatewaySaveError || gatewaySettingsError}
          gatewayHostDraft={gatewayHostDraft}
          gatewaySettings={gatewaySettings}
          gatewaySettingsSaving={gatewaySettingsSaving}
          onCancel={onCancelGatewaySettings}
          onChangeHost={onChangeGatewayHostDraft}
          onSave={onSaveGatewayTarget}
        />
      ) : null}

      <TabButtonGroup
        activeValue={activeTab}
        ariaLabel="Dashboard tabs"
        className="shell-tabs"
        options={[
          { label: "Installed Apps", value: "installed" },
          { label: "Available Apps", value: "available" },
        ]}
        onSelect={onTabChange}
      />

      <section className="shell-body full">
        {activeTab === "installed" ? (
          <div className="panel wide">
            <h2>Installed Apps</h2>
            <TabButtonGroup
              activeValue={activeCategory}
              ariaLabel="App categories"
              options={[
                { label: "Apps", value: "apps" },
                { label: "Workflows", value: "workflows" },
                { label: "Demos", value: "demos" },
              ]}
              onSelect={onChangeCategory}
            />
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
                          <button className="launch-btn" style={launchButtonStyle} onClick={() => onLaunch(app)} type="button">
                            Launch
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
              </div>
            )}
          </div>
        ) : (
          <div className="panel wide">
            <h2>Available Apps</h2>
            <TabButtonGroup
              activeValue={activeCategory}
              ariaLabel="App categories"
              options={[
                { label: "Apps", value: "apps" },
                { label: "Workflows", value: "workflows" },
                { label: "Demos", value: "demos" },
              ]}
              onSelect={onChangeCategory}
            />
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
                        <button onClick={() => onInstall(app.manifest.id)} type="button">
                          Install
                        </button>,
                      ),
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
