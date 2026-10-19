import { useState, useEffect, useCallback, useRef } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export interface InitComputeAlgorithm {
  name: string;
  inputs: Record<string, unknown>;
}

export interface InitSensorConfig {
  local_name: string;
  number_of: number;
  compute_algorithm: InitComputeAlgorithm;
  locations: string[];
}

export interface InitSubject {
  subject_id: string;
  sensors: InitSensorConfig[];
}

export interface InitSystemPayload {
  type: 'init_system';
  payload: {
    init_label: string;
    app_id: string;
    app_name?: string;
    subjects: InitSubject[];
  };
}

export const useSystemInitialization = (onSuccess: () => void) => {
  const { subscribe, sendCommand } = useGatewaySocket();
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pendingRequestRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = useCallback(() => {
    pendingRequestRef.current = null;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsInitializing(false);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    pendingRequestRef.current = null;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      const response = msg.payload && typeof msg.payload === 'object'
        ? msg.payload as Record<string, unknown> : {};
      if (!pendingRequestRef.current || response.correlation_id !== pendingRequestRef.current) return;
      if (msg.type === 'system_initialized' && response.initialization_complete === true) {
        console.log('[useSystemInitialization] System Initialized successfully');
        clearPending();
        onSuccess();
      } else if (msg.type === 'error') {
        console.error('[useSystemInitialization] System Init Error:', msg.payload);
        setErrorMsg(typeof response.message === 'string' ? response.message : JSON.stringify(msg.payload));
        clearPending();
      }
    });

    return unsubscribe;
  }, [subscribe, onSuccess, clearPending]);

  const initSystem = useCallback(
    async (payload: InitSystemPayload) => {
      if (pendingRequestRef.current) return;
      const requestId = globalThis.crypto?.randomUUID?.() ?? `init-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingRequestRef.current = requestId;
      setIsInitializing(true);
      setErrorMsg(null);
      timeoutRef.current = setTimeout(() => {
        if (pendingRequestRef.current !== requestId) return;
        clearPending();
        setErrorMsg('Initialization completion was not confirmed. Reset before retrying.');
      }, 100_000);

      console.log('[useSystemInitialization] Sending CMD_INIT_SYSTEM:', JSON.stringify(payload, null, 2));

      try {
        await sendCommand({ ...payload, payload: { ...payload.payload, correlation_id: requestId } });
      } catch (e) {
        if (pendingRequestRef.current !== requestId) return;
        console.error('[useSystemInitialization] Failed init system:', e);
        setErrorMsg('Failed to send init command (Network Error)');
        clearPending();
      }
    },
    [sendCommand, clearPending],
  );

  const dismissError = useCallback(() => setErrorMsg(null), []);

  return { isInitializing, errorMsg, initSystem, dismissError };
};
