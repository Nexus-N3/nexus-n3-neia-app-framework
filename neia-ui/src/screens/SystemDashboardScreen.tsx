import { CoreStateBadge } from "../components/CoreStateBadge";
import { displayState, StatusValue } from "../components/StatusValue";
import { useCore } from "../core/CoreProvider";

type SystemDashboardScreenProps = {
  onLaunchSession: () => void;
  onOpenConnection: () => void;
  onOpenStatus: () => void;
};

export function SystemDashboardScreen({
  onLaunchSession,
  onOpenConnection,
  onOpenStatus,
}: SystemDashboardScreenProps) {
  const { connection, loading, status } = useCore();
  const connectionState = connection?.state ?? "disconnected";

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2"></div>
      {/*<div className="view-heading-v2">
        <div>
          <span className="eyebrow">System overview</span>
          <h1>Dashboard</h1>
          <p>Configure, run, and review Nexus N3 sessions from one place.</p>
        </div>
        
        <CoreStateBadge state={connectionState} />
      </div>*/}

      <div className="dashboard-grid-v2">
        <section className="session-hero-card">
          <div className="session-card-icon" aria-hidden="true">
            <img src="/NX_icon_all_white.png" alt="" />
          </div>
          <div>
            <h2>Nexus N3 Session Management</h2>
            <p>
              Create a session, configure subjects and sensors, connect devices,
              and follow results from the active session.
            </p>
          </div>
          <div className="session-card-actions">
            <button className="primary-action-v2" onClick={onLaunchSession} type="button">
              Launch session management
            </button>
          </div>
        </section>

        <section className="core-summary-card">
          <div className="card-heading-v2">
            <div>
              <span className="eyebrow">Connected system</span>
              <h2>Nexus N3 Core</h2>
            </div>
            <button className="text-action-v2" onClick={onOpenStatus} type="button">
              View details
            </button>
          </div>

          {loading ? (
            <p className="empty-copy-v2">Loading Core status…</p>
          ) : (
            <div className="status-grid-v2">
              <StatusValue label="Endpoint" value={connection?.target_host ?? "Unknown"} />
              <StatusValue
                label="Connection"
                value={displayState(connectionState)}
                state={connectionState}
              />
              <StatusValue
                label="Core availability"
                value={connection?.available ? "Available" : "Unavailable"}
                state={connection?.available ?? null}
              />
              <StatusValue
                label="USB storage"
                value={displayState(status?.usb.state)}
                state={status?.usb.state}
              />
              <StatusValue
                label="BLE backend"
                value={status?.ble.backend ?? "Unknown"}
                state={status?.ble.backend ? "available" : "unknown"}
              />
              <StatusValue
                label="Azure bridge"
                value={displayState(status?.azure_bridge.state)}
                state={status?.azure_bridge.state}
              />
            </div>
          )}

          {connectionState !== "connected" ? (
            <button className="secondary-action-v2" onClick={onOpenConnection} type="button">
              Configure Core connection
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
