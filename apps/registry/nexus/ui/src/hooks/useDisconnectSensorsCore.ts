import { useCallback, useEffect, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export const useDisconnectSensorsCore = () => {
  const { sendCommand, subscribe } = useGatewaySocket();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disconnectCount, setDisconnectCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (!isDisconnecting) {
        return;
      }

      if (msg.type === 'sensor_disconnected') {
        setDisconnectCount((count) => count + 1);
        setIsDisconnecting(false);
        return;
      }

      if (msg.type === 'error') {
        const payload = msg.payload;
        const message =
          typeof payload === 'string'
            ? payload
            : typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : 'Failed to disconnect sensors.';

        setErrorMsg(message);
        setIsDisconnecting(false);
      }
    });

    return unsubscribe;
  }, [isDisconnecting, subscribe]);

  const disconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    setErrorMsg(null);

    try {
      await sendCommand({ type: 'disconnect_all' });
    } catch (error) {
      console.error('[useDisconnectSensorsCore] Failed to send disconnect command:', error);
      setErrorMsg('Failed to disconnect sensors.');
      setIsDisconnecting(false);
      throw error;
    }
  }, [sendCommand]);

  const dismissError = useCallback(() => {
    setErrorMsg(null);
  }, []);

  return {
    disconnectAll,
    disconnectCount,
    isDisconnecting,
    errorMsg,
    dismissError,
  };
};
