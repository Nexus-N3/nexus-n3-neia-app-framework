import { useState } from "react";

import { displayState, formatBytes, StatusValue } from "../components/StatusValue";
import { useCore } from "../core/CoreProvider";

export function CoreStatusScreen() {
  const { loading, status, switchingRole, updateRole } = useCore();
  const [roleError, setRoleError] = useState<string | null>(null);
  const currentRole =
    status?.mode === "standalone" || status?.mode === "master"
      ? status.mode
      : null;
  const sessionState = status?.active_session.state;
  const isIdle =
    status?.connection.available === true &&
    (sessionState === "inactive" || sessionState === "completed");

  const switchRole = async (role: "standalone" | "master") => {
    setRoleError(null);
    try {
      await updateRole(role);
    } catch (requestError) {
      setRoleError(requestError instanceof Error ? requestError.message : "Failed to change Core mode.");
    }
  };

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2">
        <div>
          <h1>Nexus N3 Status</h1>
        </div>
        {status?.updated_at ? (
          <span className="updated-copy-v2">Updated {new Date(status.updated_at).toLocaleTimeString()}</span>
        ) : null}
      </div>

      {loading ? (
        <div className="empty-state-v2">Loading Core status…</div>
      ) : (
        <div className="status-sections-v2">
          <section className="status-panel-v2">
            <h2>Core</h2>
            <div className="status-grid-v2">
              <StatusValue label="Endpoint" value={status?.endpoint ?? "Unknown"} />
              <StatusValue
                label="Connection"
                value={displayState(status?.connection.state)}
                state={status?.connection.state}
              />
              <StatusValue label="Version" value={status?.version ?? "Unknown"} />
              <StatusValue label="Mode" value={displayState(status?.mode)} />
              <StatusValue
                label="Readiness"
                value={displayState(status?.readiness)}
                state={status?.readiness}
              />
            </div>

            <div className="mode-control-v2">
              <div>
                <span className="mode-label-v2">Operating mode</span>
                <strong>Current: {displayState(status?.mode)}</strong>
              </div>
              <div className="mode-options-v2" aria-label="Core operating mode">
                {(["standalone", "master"] as const).map((role) => (
                  <button
                    aria-pressed={currentRole === role}
                    className={
                      currentRole === role ? "primary-action-v2" : "secondary-action-v2"
                    }
                    disabled={
                      !isIdle ||
                      switchingRole ||
                      currentRole === null ||
                      currentRole === role
                    }
                    key={role}
                    onClick={() => void switchRole(role)}
                    type="button"
                  >
                    {displayState(role)}
                  </button>
                ))}
              </div>
              <p className="mode-help-v2">
                {switchingRole
                  ? "Applying mode and restarting Core…"
                  : currentRole === null
                    ? "This Core role is deployment-managed."
                    : isIdle
                      ? "Changing mode restarts Core."
                      : "Mode can only be changed while Core is idle."}
              </p>
              {roleError ? (
                <p className="form-message-v2 error" role="alert">{roleError}</p>
              ) : null}
            </div>
          </section>

          <section className="status-panel-v2">
            <h2>USB storage</h2>
            <div className="status-grid-v2">
              <StatusValue
                label="State"
                value={displayState(status?.usb.state)}
                state={status?.usb.state}
              />
              
              <StatusValue label="Capacity" value={formatBytes(status?.usb.capacity_bytes)} />
            </div>
            {status?.usb.error ? <p className="form-message-v2 error">{status.usb.error}</p> : null}
          </section>

          <section className="status-panel-v2">
            <h2>BLE</h2>
            <div className="status-grid-v2">
              <StatusValue label="Backend" value={status?.ble.backend ?? "Unknown"} />
              <StatusValue
                label="Host adapter"
                value={displayState(status?.ble.adapter_state)}
                state={status?.ble.adapter_state}
              />
             
            </div>
          </section>

          <section className="status-panel-v2">
            <h2>External services</h2>
            <div className="status-grid-v2">
              <StatusValue
                label="Azure bridge"
                value={displayState(status?.azure_bridge.state)}
                state={status?.azure_bridge.state}
              />
              {(status?.services ?? []).map((service, index) => {
                const name = String(service.name ?? `Service ${index + 1}`);
                const state = service.state ?? service.status ?? null;
                return (
                  <StatusValue
                    key={`${name}-${index}`}
                    label={name}
                    value={displayState(state)}
                    state={typeof state === "string" || typeof state === "boolean" ? state : null}
                  />
                );
              })}
            </div>
            {/*{(status?.services ?? []).length === 0 ? (
              <p className="empty-copy-v2">No service-health information has been reported.</p>
            ) : null}*/}
          </section>
        </div>
      )}
    </div>
  );
}
