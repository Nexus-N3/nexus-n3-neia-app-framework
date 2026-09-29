import type { CoreConnectionState } from "../types";

type CoreStateBadgeProps = {
  compact?: boolean;
  state: CoreConnectionState;
};

const LABELS: Record<CoreConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  error: "Connection error",
};

export function CoreStateBadge({ compact = false, state }: CoreStateBadgeProps) {
  return (
    <span className={`core-state-badge state-${state}${compact ? " compact" : ""}`}>
      <span className="core-state-dot" aria-hidden="true" />
      <span>{LABELS[state]}</span>
    </span>
  );
}
