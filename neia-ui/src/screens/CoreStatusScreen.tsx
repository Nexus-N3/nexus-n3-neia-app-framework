import { displayState, formatBytes, StatusValue } from "../components/StatusValue";
import { useCore } from "../core/CoreProvider";

export function CoreStatusScreen() {
  const { loading, status } = useCore();

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
              <StatusValue
                label="Readiness"
                value={displayState(status?.readiness)}
                state={status?.readiness}
              />
              <StatusValue
                label="Active session"
                value={displayState(status?.active_session.state)}
                state={status?.active_session.state}
              />
              <StatusValue label="Session ID" value={status?.active_session.session_id ?? "None"} />
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
              <StatusValue label="Mounted" value={displayState(status?.usb.mounted)} state={status?.usb.mounted} />
              <StatusValue label="Capacity" value={formatBytes(status?.usb.capacity_bytes)} />
              <StatusValue label="Available" value={formatBytes(status?.usb.available_bytes)} />
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
              <StatusValue
                label="BLE gateway"
                value={displayState(status?.ble.gateway_state)}
                state={status?.ble.gateway_state}
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
            {(status?.services ?? []).length === 0 ? (
              <p className="empty-copy-v2">No service-health information has been reported.</p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
