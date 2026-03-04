import type { FlowState } from "./states";

export function canStartSession(state: FlowState): boolean {
  return state === "idle";
}

export function isBusyFlowState(state: FlowState): boolean {
  return (
    state === "discovering"
    || state === "connecting"
    || state === "streaming_starting"
    || state === "initializing"
  );
}
