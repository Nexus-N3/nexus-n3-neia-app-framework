import type { RemoteOperationState } from "../types";

export function RemoteOperationOverlay({ state }: { state: RemoteOperationState }) {
  return (
    <div className="remote-operation-overlay">
      <div className="remote-operation-card">
        <p className="remote-operation-kicker">Remote Session</p>
        <h1>NEIA is being remotely operated</h1>
        <p className="remote-operation-copy">
          Control has been transferred to the Nexus Control Center.
        </p>
        <div className="remote-operation-meta">
          <span>Device: {state.device_name || "Unknown device"}</span>
          <span>Site: {state.site_name || "Unknown site"}</span>
          <span>Operator: {state.operator_username || "Unknown operator"}</span>
        </div>
      </div>
    </div>
  );
}
