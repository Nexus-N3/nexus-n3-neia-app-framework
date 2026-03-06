import { useState, useEffect, useCallback } from 'react';

export const useSystemInitialization = (onSuccess: () => void) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[useSystemInitialization] WS connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Only listen for relevant events
        if (msg.type === 'system_initialized') {
          console.log('[useSystemInitialization] System Initialized successfully');
          onSuccess();
        } else if (msg.type === 'error') {
          // Check if this error is relevant to initialization?
          // Ideally we'd match a command ID, but for now we assume any error during init state is relevant
          // OR checks generic errors. The previous code checked generic errors.
          if (isInitializing) {
            console.error('[useSystemInitialization] System Init Error:', msg.payload);
            setErrorMsg(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
            setIsInitializing(false);
          }
        }
      } catch (err) {
        console.error('[useSystemInitialization] Error parsing WS message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [onSuccess, isInitializing]); // Added isInitializing dependency to correctly gate error handling

  const initSystem = useCallback(async (payload: any) => {
    setIsInitializing(true);
    setErrorMsg(null);

    console.log('[useSystemInitialization] Sending CMD_INIT_SYSTEM:', JSON.stringify(payload, null, 2));

    try {
      await fetch('/api/v1/gateway/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Navigation/Success happens via WebSocket event 'system_initialized'
    } catch (e) {
      console.error('[useSystemInitialization] Failed init system:', e);
      setErrorMsg('Failed to send init command (Network Error)');
      setIsInitializing(false);
    }
  }, []);

  return { isInitializing, errorMsg, initSystem };
};
