import { useCallback, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export const useDisconnectSensorsCore = () => {
  const { sendCommand } = useGatewaySocket();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disconnectCount, setDisconnectCount] = useState(0);

  const disconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    setErrorMsg(null);

    try {
      await sendCommand({ type: 'disconnect_all' });
      setDisconnectCount((count) => count + 1);
    } catch (error) {
      console.error('[useDisconnectSensorsCore] Failed to send disconnect command:', error);
      setErrorMsg('Failed to disconnect sensors.');
      throw error;
    } finally {
      setIsDisconnecting(false);
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
