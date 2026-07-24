import { StartupSequence } from "../components/StartupSequence";
import type { SessionConfigRecord, StartupStage, SubjectRecord } from "../types";

type SessionConfigScreenProps = {
  dashboardClass: string;
  installedAppIds: Set<string>;
  selectedSubject: SubjectRecord;
  sessionConfigs: SessionConfigRecord[];
  showStartup: boolean;
  startupExiting: boolean;
  startupStage: StartupStage;
  onBackToSubjects: () => void;
  onContinueToDashboard: () => void;
  onLaunchConfig: (config: SessionConfigRecord) => void;
};

export function SessionConfigScreen({
  dashboardClass,
  installedAppIds,
  selectedSubject,
  sessionConfigs,
  showStartup,
  startupExiting,
  startupStage,
  onBackToSubjects,
  onContinueToDashboard,
  onLaunchConfig,
}: SessionConfigScreenProps) {
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
              {sessionConfigs.map((config) => (
                <div className="session-config-card" key={config.session_config_id}>
                  <div className="session-config-copy">
                    <p className="session-config-kicker">Session Config</p>
                    <h2>{config.name}</h2>
                    <p className="session-config-meta">
                      {config.app_name || config.app_id ? `App: ${config.app_name || config.app_id}` : "App to be defined"}
                    </p>
                    <p className="session-config-meta">Deployed: {config.deployed ? "Yes" : "No"}</p>
                  </div>
                  <button
                    className="session-config-launch-btn"
                    disabled={!config.app_id || !installedAppIds.has(config.app_id)}
                    onClick={() => onLaunchConfig(config)}
                    type="button"
                  >
                    {!config.app_id || !installedAppIds.has(config.app_id) ? "App not installed" : "Launch config"}
                  </button>
                </div>
              ))}
            </div>
            <div className="session-config-actions">
              <button className="subject-skip-action" onClick={onBackToSubjects} type="button">
                Back to subjects
              </button>
              <button className="subject-skip-action" onClick={onContinueToDashboard} type="button">
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
