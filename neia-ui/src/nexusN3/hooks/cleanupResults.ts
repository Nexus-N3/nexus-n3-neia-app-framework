export interface CleanupResult {
  address: string;
  name?: string;
  location?: string;
  status: 'cleaned' | 'already_clean' | 'unconfirmed' | 'failed';
  error?: string;
  link_connected?: boolean;
  measurement_stop_confirmed?: boolean;
  eligible_for_acquisition?: boolean;
  confirmation_source?: 'operator' | 'plugin';
}
export interface CleanupOperation {
  correlationId: string;
  nodes: Map<string, CleanupResult[]>;
  expected: Set<string>;
  timer?: ReturnType<typeof setTimeout>;
}
// An operator watchdog, independent of sensor count. Individual cleanup is
// bounded separately (20s reconnect, 15s stop, 5s disconnect, local bounds).
// Expiry reports partial/unconfirmed completion; it never retries or resets.
export const CLEANUP_OPERATION_TIMEOUT_MS = 90_000;
export const createCleanupOperation = (onTimeout?: (operation: CleanupOperation) => void): CleanupOperation => {
  const operation: CleanupOperation = {
    correlationId: globalThis.crypto?.randomUUID?.() ?? `cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    nodes: new Map(), expected: new Set(),
  };
  if (onTimeout) operation.timer = setTimeout(() => onTimeout(operation), CLEANUP_OPERATION_TIMEOUT_MS);
  return operation;
};
export const cancelCleanupOperation = (operation: CleanupOperation | null) => {
  if (operation?.timer !== undefined) clearTimeout(operation.timer);
};
export const cleanupTimeoutError = (operation: CleanupOperation) => {
  const missing = [...operation.expected].filter((node) => !operation.nodes.has(node));
  return `Sensor cleanup timed out; cleanup remains unconfirmed. ${missing.length
    ? `Missing node replies: ${missing.join(', ')}.` : 'No complete participant acknowledgement was received.'}`;
};
export const collectCleanupParticipants = (operation: CleanupOperation, payload: Record<string, unknown>) => {
  if (payload.correlation_id !== operation.correlationId || !Array.isArray(payload.expected_node_ids)) return;
  payload.expected_node_ids.forEach((node) => { if (typeof node === 'string') operation.expected.add(node); });
};
export const collectCleanupResult = (operation: CleanupOperation, payload: Record<string, unknown>) => {
  if (payload.correlation_id !== operation.correlationId || typeof payload.node_id !== 'string'
      || !Array.isArray(payload.expected_node_ids) || !Array.isArray(payload.results)) return null;
  if (!payload.results.every((value) => value && typeof value === 'object'
      && typeof value.address === 'string' && ['cleaned', 'already_clean', 'unconfirmed', 'failed'].includes(value.status))) return null;
  payload.expected_node_ids.forEach((node) => { if (typeof node === 'string') operation.expected.add(node); });
  operation.nodes.set(payload.node_id, payload.results as CleanupResult[]);
  if (!operation.expected.size || [...operation.expected].some((node) => !operation.nodes.has(node))) return null;
  return [...operation.nodes.values()].flat();
};
