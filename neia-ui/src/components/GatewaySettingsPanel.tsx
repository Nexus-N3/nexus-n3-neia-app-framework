import type { GatewayTargetSettings } from "../types";

type GatewaySettingsPanelProps = {
  error: string | null;
  gatewayHostDraft: string;
  gatewaySettings: GatewayTargetSettings | null;
  gatewaySettingsSaving: boolean;
  onCancel: () => void;
  onChangeHost: (value: string) => void;
  onSave: () => void;
};

export function GatewaySettingsPanel({
  error,
  gatewayHostDraft,
  gatewaySettings,
  gatewaySettingsSaving,
  onCancel,
  onChangeHost,
  onSave,
}: GatewaySettingsPanelProps) {
  return (
    <section className="panel wide gateway-settings-panel">
      <div className="gateway-settings-header">
        <div>
          <h2>Nexus N3 Core Connection</h2>
          <p className="gateway-settings-copy">
            Point NEIA at the Nexus N3 core deployment it should talk to.
          </p>
        </div>
        <div className="gateway-settings-meta">
          <span>Mode: {gatewaySettings?.gateway || "unknown"}</span>
          <span>
            Ports: {gatewaySettings?.cmd_port ?? 5555} / {gatewaySettings?.event_port ?? 5556}
          </span>
        </div>
      </div>
      <div className="gateway-settings-form">
        <label className="gateway-settings-label" htmlFor="gateway-target-host">
          Host
        </label>
        <input
          id="gateway-target-host"
          className="gateway-settings-input"
          value={gatewayHostDraft}
          onChange={(event) => onChangeHost(event.target.value)}
          placeholder="localhost or nexus-n3-master.local"
          autoComplete="off"
        />
        <p className="gateway-settings-hint">
          Use `localhost` when NEIA and `nexus-n3-core` run on the same machine.
        </p>
        {error ? <p className="gateway-settings-error">{error}</p> : null}
        <div className="gateway-settings-actions">
          <button
            className="gateway-settings-button gateway-settings-button-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="gateway-settings-button gateway-settings-button-primary"
            type="button"
            onClick={onSave}
            disabled={gatewaySettingsSaving || gatewaySettings?.gateway !== "zeromq"}
          >
            {gatewaySettingsSaving ? "Saving..." : "Save target"}
          </button>
        </div>
      </div>
    </section>
  );
}
