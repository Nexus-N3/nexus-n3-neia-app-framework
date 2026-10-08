import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import { streamLifecycleBySubjectAtom } from '../store/atoms';
import { collectCleanupResult, collectCleanupParticipants, cancelCleanupOperation, cleanupTimeoutError, createCleanupOperation, type CleanupOperation, type CleanupResult } from './cleanupResults';

export const useDisconnectSensorsCore = () => {
  const { sendCommand, subscribe } = useGatewaySocket();
  const lifecycle = useAtomValue(streamLifecycleBySubjectAtom);
  const isDrainPending = Object.values(lifecycle).some((state) => state.phase === 'stopping');
  const operation = useRef<CleanupOperation | null>(null);
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
      const results = collectCleanupResult(current, payload);
      if (!results) return;
      cancelCleanupOperation(operation.current);
      operation.current = null;
      setCleanupResults(results);
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
  }), [subscribe]);

  useEffect(() => () => cancelCleanupOperation(operation.current), []);

  const disconnect = useCallback(async (subjectIds?: string[]) => {
    if (operation.current) return;
    if (isDrainPending) {
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
    setCleanupComplete(false);
    setCleanupFailed(false);
    setCleanupResults([]);
    setIsDisconnecting(true);
    setErrorMsg(null);
    try {
      await sendCommand({ type: subjectIds ? 'disconnect_subjects' : 'disconnect_all', payload: {
        correlation_id: current.correlationId, ...(subjectIds ? { subject_ids: subjectIds } : {}),
      } });
    } catch (error) {
      if (operation.current !== current) throw error;
      cancelCleanupOperation(operation.current);
      operation.current = null;
      setIsDisconnecting(false);
      setErrorMsg('Failed to send sensor cleanup command.');
      throw error;
    }
  }, [sendCommand, isDrainPending]);
  const disconnectAll = useCallback(() => disconnect(), [disconnect]);
  return {
    disconnectAll, disconnectSubjects: disconnect, cleanupComplete, cleanupResults,
    cleanupSucceeded: cleanupComplete && !cleanupFailed,
    disconnectCount: cleanupComplete ? cleanupResults.length : 0,
    isDisconnecting, isDrainPending: isDrainPending, errorMsg,
    dismissError: useCallback(() => setErrorMsg(null), []),
  };
};
