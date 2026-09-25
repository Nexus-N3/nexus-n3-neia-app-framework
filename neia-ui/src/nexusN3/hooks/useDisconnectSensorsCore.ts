import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import {
  connectedSensorsAtom,
  streamDrainStateAtom,
} from '../store/atoms';

export const useDisconnectSensorsCore = () => {
  const { sendCommand, subscribe } = useGatewaySocket();
  const streamDrainState = useAtomValue(streamDrainStateAtom);
  const connectedSensors = useAtomValue(connectedSensorsAtom);

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disconnectCount, setDisconnectCount] = useState(0);

  const expectedDisconnectsRef = useRef(0);
  const receivedDisconnectsRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (!isDisconnecting) {
        return;
      }

      if (msg.type === 'sensor_disconnected') {
        const payload =
          typeof msg.payload === 'object' && msg.payload
            ? msg.payload as Record<string, unknown>
            : {};

        const disconnectedRaw = payload.disconnected_sensors;

        const disconnectedCount = Array.isArray(disconnectedRaw)
          ? disconnectedRaw.length
          : disconnectedRaw
            ? 1
            : 0;

        receivedDisconnectsRef.current += disconnectedCount;
        setDisconnectCount(receivedDisconnectsRef.current);

        if (
          receivedDisconnectsRef.current >=
          expectedDisconnectsRef.current
        ) {
          setIsDisconnecting(false);
        }

        return;
      }

      if (msg.type === 'error') {
        const payload = msg.payload;

        const message =
          typeof payload === 'string'
            ? payload
            : typeof payload === 'object' &&
                payload &&
                'message' in payload &&
                typeof payload.message === 'string'
              ? payload.message
              : 'Failed to disconnect sensors.';

        setErrorMsg(message);
        setIsDisconnecting(false);
      }
    });

    return unsubscribe;
  }, [isDisconnecting, subscribe]);

  const disconnectAll = useCallback(async () => {
    if (streamDrainState.pending) {
      const message =
        'Session finalization is still in progress. Wait for stream drain to complete before disconnecting.';

      setErrorMsg(message);
      throw new Error(message);
    }

    expectedDisconnectsRef.current = Object.values(connectedSensors).reduce(
      (total, sensors) => total + sensors.length,
      0,
    );
    receivedDisconnectsRef.current = 0;

    setDisconnectCount(0);
    setIsDisconnecting(true);
    setErrorMsg(null);

    try {
      await sendCommand({ type: 'disconnect_all' });

      if (expectedDisconnectsRef.current === 0) {
        setIsDisconnecting(false);
      }
    } catch (error) {
      console.error(
        '[useDisconnectSensorsCore] Failed to send disconnect command:',
        error,
      );

      setErrorMsg('Failed to disconnect sensors.');
      setIsDisconnecting(false);
      throw error;
    }
  }, [
    connectedSensors,
    sendCommand,
    streamDrainState.pending,
  ]);

  const dismissError = useCallback(() => {
    setErrorMsg(null);
  }, []);

  return {
    disconnectAll,
    disconnectCount,
    isDisconnecting,
    isDrainPending: streamDrainState.pending,
    errorMsg,
    dismissError,
  };
};