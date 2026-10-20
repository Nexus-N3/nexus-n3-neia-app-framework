import React, { useState } from 'react';
import { useSetAtom } from 'jotai';
import { serverReadyAtom } from '../store/atoms';
import { useGatewaySocket } from '../hooks/useGatewaySocket';

export const RetryServerButton: React.FC = () => {
  const { sendCommand } = useGatewaySocket();
  const setServerReady = useSetAtom(serverReadyAtom);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    setServerReady(false);

    try {
      await sendCommand({ type: 'is_server_ready', payload: {} });
    } catch (error) {
      console.error('[RetryServerButton] Failed readiness check:', error);
      setServerReady(false);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <button className="retry-server-btn" onClick={handleRetry} disabled={isRetrying}>
      {isRetrying ? 'Retrying...' : 'Retry server'}
    </button>
  );
};
