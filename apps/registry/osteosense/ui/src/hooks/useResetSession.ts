import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';
import { useResetSessionState } from './useResetSessionState';

export const useResetSession = () => {
  const navigate = useNavigate();
  const cleanup = useDisconnectSensorsCore();
  const { resetSessionState } = useResetSessionState();
  const requested = useRef(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!requested.current || cleanup.isDisconnecting
        || (!cleanup.cleanupComplete && !cleanup.errorMsg)) return;
    requested.current = false;
    setIsResetting(false);
    // Starting over is allowed even when physical cleanup is unconfirmed.
    // Keep the cleanup error visible; only Core can confirm a new initialization.
    resetSessionState();
    navigate('/', { replace: true });
  }, [cleanup.isDisconnecting, cleanup.cleanupComplete, cleanup.errorMsg, navigate, resetSessionState]);

  const reset = useCallback(async () => {
    if (requested.current || cleanup.isDrainPending) return;
    requested.current = true;
    setIsResetting(true);
    try {
      // UI connection knowledge is lost on refresh; always ask Core to clean up.
      await cleanup.disconnectAll();
    } catch {
      // The cleanup hook reports failure, which also completes the UI reset.
    }
  }, [cleanup.isDrainPending, cleanup.disconnectAll]);

  return { reset, isResetting, isDrainPending: cleanup.isDrainPending,
    errorMsg: cleanup.errorMsg, dismissError: cleanup.dismissError };
};
