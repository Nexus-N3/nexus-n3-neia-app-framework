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
    subjects: InitSubject[];
  };
}

export const useSystemInitialization = (onSuccess: () => void) => {
  const { subscribe, sendCommand } = useGatewaySocket();
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'system_initialized') {
        console.log('[useSystemInitialization] System Initialized successfully');
        isInitializingRef.current = false;
        setIsInitializing(false);
        onSuccess();
      } else if (msg.type === 'error' && isInitializingRef.current) {
        console.error('[useSystemInitialization] System Init Error:', msg.payload);
        setErrorMsg(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
        isInitializingRef.current = false;
        setIsInitializing(false);
      }
    });

    return unsubscribe;
  }, [subscribe, onSuccess]);

  const initSystem = useCallback(
    async (payload: InitSystemPayload) => {
      isInitializingRef.current = true;
      setIsInitializing(true);
      setErrorMsg(null);

      console.log('[useSystemInitialization] Sending CMD_INIT_SYSTEM:', JSON.stringify(payload, null, 2));

      try {
        await sendCommand(payload);
      } catch (e) {
        console.error('[useSystemInitialization] Failed init system:', e);
        setErrorMsg('Failed to send init command (Network Error)');
        isInitializingRef.current = false;
        setIsInitializing(false);
      }
    },
    [sendCommand],
  );

  return { isInitializing, errorMsg, initSystem };
};
