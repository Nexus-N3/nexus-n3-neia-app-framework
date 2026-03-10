import { useCallback, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export const useDisconnectSensors = () => {
  const { sendCommand } = useGatewaySocket();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    setErrorMsg(null);

    try {
      await sendCommand({ type: 'disconnect_all' });
    } catch (error) {
      console.error('[useDisconnectSensors] Failed to send disconnect command:', error);
      setErrorMsg('Failed to disconnect sensors.');
    } finally {
      setIsDisconnecting(false);
    }
  }, [sendCommand]);

  const dismissError = useCallback(() => {
    setErrorMsg(null);
  }, []);

  return {
    disconnectAll,
    isDisconnecting,
    errorMsg,
    dismissError,
  };
};
