import { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { discoveredSensorsAtom, connectedSensorsAtom, type DiscoveredSensorsMap, type ConnectedSensorsMap } from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';

export type SensorFlowPhase = 'idle' | 'discovering' | 'connecting' | 'done' | 'error';

/**
 * Hook for the discover → connect sensor flow.
 *
 * discoverAndConnect()  — discovers all sensors, then auto-connects
 * discoverAll()         — discover only
 * connectAll()          — connect only
 * discoverForSubject()  — discover for a single subject
 */
export const useDiscoverSensors = () => {
  const { subscribe, sendCommand } = useGatewaySocket();
  const [phase, setPhase] = useState<SensorFlowPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const autoConnectRef = useRef(false);
  const phaseRef = useRef<SensorFlowPhase>('idle');

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      // --- Discovery events ---
      if (msg.type === 'sensors_discovered' || msg.type === 'sensors_discovered_for_subject') {
        const subjects = Array.isArray(msg.payload) ? msg.payload : [];
        setDiscoveredSensors((prev) => {
          const next: DiscoveredSensorsMap = { ...prev };
          subjects.forEach((s: { subject_id: string; discovered_sensors: string[] }) => {
            next[s.subject_id] = s.discovered_sensors ?? [];
          });
          return next;
        });

        if (autoConnectRef.current) {
          autoConnectRef.current = false;
          phaseRef.current = 'connecting';
          setPhase('connecting');
          sendCommand({ type: 'connect_all' }).catch((e) => {
            console.error('[useDiscoverSensors] Network error:', e);
            setErrorMsg('Network error sending connect command');
            phaseRef.current = 'error';
            setPhase('error');
          });
        } else {
          phaseRef.current = 'done';
          setPhase('done');
        }
      }

      // --- Connection events ---
      if (msg.type === 'sensor_connected') {
        const subjects = Array.isArray(msg.payload) ? msg.payload : [];
        setConnectedSensors((prev) => {
          const next: ConnectedSensorsMap = { ...prev };
          subjects.forEach((s: { subject_id: string; connected_sensors: string[] }) => {
            next[s.subject_id] = s.connected_sensors ?? [];
          });
          return next;
        });
        phaseRef.current = 'done';
        setPhase('done');
      }

      // --- Errors ---
      if (msg.type === 'error') {
        if (phaseRef.current === 'discovering' || phaseRef.current === 'connecting') {
          setErrorMsg(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
          phaseRef.current = 'error';
          setPhase('error');
          autoConnectRef.current = false;
        }
      }
    });

    return unsubscribe;
  }, [subscribe, sendCommand, setDiscoveredSensors, setConnectedSensors]);

  const doSend = useCallback(
    async (command: Record<string, unknown>) => {
      try {
        await sendCommand(command);
      } catch (e) {
        console.error('[useDiscoverSensors] Network error:', e);
        setErrorMsg('Network error sending command');
        phaseRef.current = 'error';
        setPhase('error');
        autoConnectRef.current = false;
      }
    },
    [sendCommand],
  );

  /** Discover all sensors then automatically connect */
  const discoverAndConnect = useCallback(() => {
    autoConnectRef.current = true;
    phaseRef.current = 'discovering';
    setPhase('discovering');
    setErrorMsg(null);
    doSend({ type: 'discover_sensors' });
  }, [doSend]);

  /** Discover all sensors (no auto-connect) */
  const discoverAll = useCallback(() => {
    autoConnectRef.current = false;
    phaseRef.current = 'discovering';
    setPhase('discovering');
    setErrorMsg(null);
    doSend({ type: 'discover_sensors' });
  }, [doSend]);

  /** Connect all sensors */
  const connectAll = useCallback(() => {
    phaseRef.current = 'connecting';
    setPhase('connecting');
    setErrorMsg(null);
    doSend({ type: 'connect_all' });
  }, [doSend]);

  /** Discover sensors for a specific subject */
  const discoverForSubject = useCallback(
    (subjectId: string) => {
      autoConnectRef.current = false;
      phaseRef.current = 'discovering';
      setPhase('discovering');
      setErrorMsg(null);
      doSend({
        type: 'discover_sensors_for_subjects',
        payload: { subject_ids: [subjectId] },
      });
    },
    [doSend],
  );

  /** Dismiss the overlay */
  const dismiss = useCallback(() => {
    phaseRef.current = 'idle';
    setPhase('idle');
    setErrorMsg(null);
  }, []);

  const isBusy = phase === 'discovering' || phase === 'connecting';

  return {
    phase,
    isBusy,
    errorMsg,
    discoverAndConnect,
    discoverAll,
    connectAll,
    discoverForSubject,
    dismiss,
  };
};
