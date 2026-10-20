import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { useCore } from '../../core/CoreProvider';
import type { CoreStatus } from '../../types';
import { streamDrainStateAtom, streamLifecycleBySubjectAtom, type StreamLifecycleStateMap } from '../store/atoms';
import { clearSelectedSessionConfig } from '../utils/sessionConfigContext';
import { SELECTED_SUBJECT_STORAGE_KEY } from '../utils/subjectContext';
import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';
import { useResetSessionState } from './useResetSessionState';

const ACTIVE_PHASES = new Set(['starting', 'warming_up', 'retrying', 'official_streaming', 'stopping', 'draining']);

function navigationBlockReason(drainPending: boolean, lifecycles: StreamLifecycleStateMap, apiState?: string): string | null {
  if (Object.values(lifecycles).some((subject) => subject.phase === 'finalization_failed')) {
    return 'Session finalization failed. Resolve the finalization failure before leaving.';
  }
  if (drainPending || Object.values(lifecycles).some((subject) => ACTIVE_PHASES.has(subject.phase))
      || ['starting', 'warming_up', 'active', 'stopping', 'draining'].includes(apiState ?? '')) {
    return 'Stop and finalize the session before leaving.';
  }
  return null;
}

// This hook lives in the shell, so menu navigation cannot discard its waiter.
export function useSessionAbandonment(onNavigate: (route: string) => void) {
  const { refresh, status } = useCore();
  const store = useStore();
  const drain = useAtomValue(streamDrainStateAtom);
  const lifecycles = useAtomValue(streamLifecycleBySubjectAtom);
  const blockedReason = navigationBlockReason(drain.pending, lifecycles, status?.active_session.state);
  const cleanup = useDisconnectSensorsCore(true);
  const { resetSessionState } = useResetSessionState();
  const [phase, setPhase] = useState<'idle' | 'requesting-reset' | 'resetting' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const destination = useRef<string | null>(null);

  const fail = useCallback((message: string) => {
    destination.current = null;
    setPhase('idle');
    setError(`Could not leave the session: ${message} Your on-screen configuration is retained. Retry the menu item after resolving the failure.`);
  }, []);

  const leave = useCallback((route: string) => {
    if (destination.current) return;
    // Re-read the atoms at the point of navigation as well as disabling buttons.
    const reason = navigationBlockReason(
      store.get(streamDrainStateAtom).pending,
      store.get(streamLifecycleBySubjectAtom),
      status?.active_session.state,
    );
    if (reason) {
      setError(reason);
      return;
    }
    destination.current = route;
    setError(null);
    setPhase('requesting-reset');
  }, [status?.active_session.state, store]);

  useEffect(() => {
    if (phase !== 'requesting-reset') return;
    if (blockedReason) {
      fail(blockedReason);
      return;
    }
    setPhase('resetting');
    void cleanup.disconnectAll().catch((failure) => {
      fail(failure instanceof Error ? failure.message : 'Cleanup could not be started.');
    });
  }, [blockedReason, cleanup.disconnectAll, fail, phase]);

  useEffect(() => {
    if (phase !== 'resetting' || cleanup.isDisconnecting
        || (!cleanup.cleanupComplete && !cleanup.errorMsg)) return;
    if (cleanup.errorMsg || !cleanup.cleanupSucceeded
        || cleanup.coreReadyForConfiguration !== true
        || cleanup.gatewayCommunicationAvailable !== true
        || !cleanup.recoveryComplete
        || cleanup.cleanupResults.some((sensor) => sensor.link_connected !== false)) {
      fail(cleanup.errorMsg || 'Not all nodes confirmed recovery and sensor disconnection.');
      return;
    }
    setPhase('confirming');
    void (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch('/api/v1/core/status', { signal: controller.signal });
        if (!response.ok) throw new Error('Could not verify the API reset state.');
        const nextStatus = await response.json() as CoreStatus;
        if (nextStatus.active_session.state !== 'inactive') {
          throw new Error('The API has not confirmed that the session is reset.');
        }
        // Queue a fresh shell snapshot even if a pre-reset refresh is in flight.
        // API confirmation above is authoritative; shell refresh must not hold
        // navigation indefinitely when a separate capabilities request stalls.
        void refresh().then(() => refresh());
        clearSelectedSessionConfig();
        window.localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
        resetSessionState();
        const route = destination.current;
        destination.current = null;
        setPhase('idle');
        if (route) onNavigate(route);
      } catch (failure) {
        fail(failure instanceof Error ? failure.message : 'Reset confirmation failed.');
      } finally {
        clearTimeout(timeout);
      }
    })();
  }, [cleanup, fail, onNavigate, phase, refresh, resetSessionState]);

  return {
    leave,
    navigationBlocked: blockedReason !== null,
    navigationBlockReason: blockedReason,
    isAbandoning: phase !== 'idle',
    error,
    message: phase === 'confirming' ? 'Confirming session reset…'
      : 'Disconnecting sensors and resetting all participating nodes…',
  };
}
