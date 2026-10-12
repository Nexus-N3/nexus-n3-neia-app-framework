import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import { streamDrainStateAtom } from '../store/atoms';
import { collectCleanupResult, collectCleanupParticipants, cancelCleanupOperation, cleanupTimeoutError, createCleanupOperation, type CleanupOperation, type CleanupResult } from './cleanupResults';

export const useDisconnectSensorsCore = (recoverSession = false) => {
  const { sendCommand, subscribe } = useGatewaySocket();
  const streamDrainState = useAtomValue(streamDrainStateAtom);
  const operation = useRef<CleanupOperation | null>(null);
  const recoveryNodes = useRef(new Map<string, Record<string, unknown>>());
  const [gatewayCommunicationAvailable, setGatewayCommunicationAvailable] = useState<boolean | null>(null);
  const [coreReadyForConfiguration, setCoreReadyForConfiguration] = useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [cleanupComplete, setCleanupComplete] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => subscribe((msg) => {
    const current = operation.current;
    if (!current) return;
    const payload = typeof msg.payload === 'object' && msg.payload ? msg.payload as Record<string, unknown> : {};
    if (msg.type === 'sensor_cleanup_started') {
      collectCleanupParticipants(current, payload);
    } else if (msg.type === 'sensor_cleanup_complete') {
      if (payload.correlation_id === current.correlationId && typeof payload.node_id === 'string') recoveryNodes.current.set(payload.node_id, payload);
      const results = collectCleanupResult(current, payload);
      if (!results) return;
      cancelCleanupOperation(operation.current);
      operation.current = null;
      setCleanupResults(results);
      const nodes = [...recoveryNodes.current.values()];
      const coreReady = nodes.every((node) => node.core_ready_for_configuration === true);
      if (recoverSession) {
        setCoreReadyForConfiguration(coreReady);
        setGatewayCommunicationAvailable(nodes.every((node) => node.gateway_communication_available === true));
      }
      if (recoverSession && !coreReady) setErrorMsg('Core recovery is not confirmed. Retry Reset.');
      else if (recoverSession && nodes.some((node) => node.gateway_communication_available === false)) setErrorMsg('Core is ready for configuration, but gateway communication is unavailable. Restore UART communication and retry Reset before acquisition.');
      setCleanupComplete(true);
      setIsDisconnecting(false);
      const unresolved = results.filter((result) => result.status === 'unconfirmed' || result.status === 'failed');
      setCleanupFailed(unresolved.length > 0);
      if (unresolved.length) setErrorMsg(`Physical cleanup unconfirmed: ${unresolved.map((result) => `${result.name || result.address}${result.location ? ` (${result.location.replace(/_/g, ' ')})` : ''}: ${result.error || result.status}`).join('; ')}`);
    } else if (msg.type === 'error' && payload.correlation_id === current.correlationId) {
      cancelCleanupOperation(operation.current);
      operation.current = null;
      setIsDisconnecting(false);
      setErrorMsg(typeof payload.message === 'string' ? payload.message : 'Failed to clean up sensors.');
    }
  }), [subscribe, recoverSession]);

  useEffect(() => () => cancelCleanupOperation(operation.current), []);

  const disconnect = useCallback(async (subjectIds?: string[], recoveryOptions: { allow_ble_reset?: boolean; confirmed_stopped_sensor_addresses?: string[] } = {}) => {
    if (operation.current) return;
    if (streamDrainState.pending) {
      const message = 'Session finalization is still in progress. Wait for stream drain to complete before disconnecting.';
      setErrorMsg(message);
      throw new Error(message);
    }
    const current = createCleanupOperation((expired) => {
      if (operation.current !== expired) return;
      operation.current = null;
      setCleanupResults([...expired.nodes.values()].flat());
      setCleanupComplete(true);
      setIsDisconnecting(false);
      setCleanupFailed(true);
      setErrorMsg(cleanupTimeoutError(expired));
    });
    operation.current = current;
    recoveryNodes.current.clear();
    setCoreReadyForConfiguration(null);
    setGatewayCommunicationAvailable(null);
    setCleanupComplete(false);
    setCleanupFailed(false);
    setCleanupResults([]);
    setIsDisconnecting(true);
    setErrorMsg(null);
    try {
      await sendCommand({ type: subjectIds ? 'disconnect_subjects' : 'disconnect_all', payload: {
        correlation_id: current.correlationId, ...(recoverSession ? { recover_session: true,
          ...(recoveryOptions.allow_ble_reset === true ? { allow_ble_reset: true } : {}),
          ...(Array.isArray(recoveryOptions.confirmed_stopped_sensor_addresses) ? { confirmed_stopped_sensor_addresses: recoveryOptions.confirmed_stopped_sensor_addresses } : {}),
        } : {}), ...(subjectIds ? { subject_ids: subjectIds } : {}),
      } });
    } catch (error) {
      if (operation.current !== current) throw error;
      cancelCleanupOperation(operation.current);
      operation.current = null;
      setIsDisconnecting(false);
      setErrorMsg('Failed to send sensor cleanup command.');
      throw error;
    }
  }, [sendCommand, streamDrainState.pending, recoverSession]);
  const disconnectAll = useCallback((options?: { allow_ble_reset?: boolean; confirmed_stopped_sensor_addresses?: string[] }) => disconnect(undefined, options), [disconnect]);
  return {
    coreReadyForConfiguration, gatewayCommunicationAvailable, disconnectAll, disconnectSubjects: disconnect, cleanupComplete, cleanupResults,
    cleanupSucceeded: cleanupComplete && !cleanupFailed,
    disconnectCount: cleanupComplete ? cleanupResults.length : 0,
    isDisconnecting, isDrainPending: streamDrainState.pending, errorMsg,
    dismissError: useCallback(() => setErrorMsg(null), []),
  };
};
