import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';
import { useResetSessionState } from './useResetSessionState';

export const useResetSession = () => {
  const navigate = useNavigate();
  const cleanup = useDisconnectSensorsCore(true);
  const { resetSessionState } = useResetSessionState();
  const requested = useRef(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!requested.current || cleanup.isDisconnecting
        || (!cleanup.cleanupComplete && !cleanup.errorMsg)) return;
    requested.current = false;
    setIsResetting(false);
    if (cleanup.coreReadyForConfiguration !== true) return;
    // Core allows configuration even when some physical resources remain unavailable.
    // Keep the cleanup error visible; only Core can confirm a new initialization.
    resetSessionState();
    navigate('/', { replace: true });
  }, [cleanup.isDisconnecting, cleanup.cleanupComplete, cleanup.errorMsg, cleanup.coreReadyForConfiguration, navigate, resetSessionState]);

  const reset = useCallback(async (options: { allow_ble_reset?: boolean; confirmed_stopped_sensor_addresses?: string[] } = {}) => {
    if (requested.current || cleanup.isDrainPending) return;
    requested.current = true;
    setIsResetting(true);
    try {
      // UI connection knowledge is lost on refresh; always ask Core to clean up.
      await cleanup.disconnectAll(options);
    } catch {
      // Retain configuration until an authoritative Core recovery acknowledgement.
    }
  }, [cleanup.isDrainPending, cleanup.disconnectAll]);

  return { reset, isResetting, isDrainPending: cleanup.isDrainPending,
    coreReadyForConfiguration: cleanup.coreReadyForConfiguration,
    gatewayCommunicationAvailable: cleanup.gatewayCommunicationAvailable, recoveryResults: cleanup.cleanupResults,
    errorMsg: cleanup.errorMsg, dismissError: cleanup.dismissError };
};
