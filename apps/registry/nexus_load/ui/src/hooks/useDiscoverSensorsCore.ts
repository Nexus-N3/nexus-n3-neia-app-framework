import { useCallback, useEffect, useRef, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';
import type { ConnectedSensorsMap, DiscoveredSensorsMap, SensorFlowPhase } from './gatewaySensorTypes';
import {
  getConnectedSubjectsFromPayload,
  getDiscoveredSubjectsFromPayload,
} from './gatewaySensorPayloads';

export const useDiscoverSensorsCore = () => {
  const { subscribe, sendCommand } = useGatewaySocket();
  const [phase, setPhase] = useState<SensorFlowPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [discoveredSensors, setDiscoveredSensors] = useState<DiscoveredSensorsMap>({});
  const [connectedSensors, setConnectedSensors] = useState<ConnectedSensorsMap>({});
  const autoConnectRef = useRef(false);
  const connectSubjectIdsRef = useRef<string[] | null>(null);
  const phaseRef = useRef<SensorFlowPhase>('idle');

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'sensors_discovered' || msg.type === 'sensors_discovered_for_subject') {
        const subjects = getDiscoveredSubjectsFromPayload(msg.payload);
        setDiscoveredSensors((prev) => {
          const next: DiscoveredSensorsMap = { ...prev };
          subjects.forEach((subject) => {
            next[subject.subject_id] = subject.discovered_sensors ?? [];
          });
          return next;
        });

        if (autoConnectRef.current) {
          autoConnectRef.current = false;
          phaseRef.current = 'connecting';
          setPhase('connecting');
          const subjectIds = connectSubjectIdsRef.current;
          const command =
            subjectIds && subjectIds.length > 0
              ? { type: 'connect_subjects', payload: { subject_ids: subjectIds } }
              : { type: 'connect_all' };

          sendCommand(command).catch((error) => {
            console.error('[useDiscoverSensorsCore] Network error:', error);
            setErrorMsg('Network error sending connect command');
            phaseRef.current = 'error';
            setPhase('error');
            setActiveSubjectId(null);
            connectSubjectIdsRef.current = null;
          });
        } else {
          phaseRef.current = 'done';
          setPhase('done');
          setActiveSubjectId(null);
          connectSubjectIdsRef.current = null;
        }
      }

      if (msg.type === 'sensor_connected') {
        const subjects = getConnectedSubjectsFromPayload(msg.payload);
        setConnectedSensors((prev) => {
          const next: ConnectedSensorsMap = { ...prev };
          subjects.forEach((subject) => {
            next[subject.subject_id] = subject.connected_sensors ?? [];
          });
          return next;
        });
        phaseRef.current = 'done';
        setPhase('done');
        setActiveSubjectId(null);
        connectSubjectIdsRef.current = null;
      }

      if (msg.type === 'error' && (phaseRef.current === 'discovering' || phaseRef.current === 'connecting')) {
        setErrorMsg(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
        phaseRef.current = 'error';
        setPhase('error');
        autoConnectRef.current = false;
        setActiveSubjectId(null);
        connectSubjectIdsRef.current = null;
      }
    });

    return unsubscribe;
  }, [sendCommand, subscribe]);

  const doSend = useCallback(
    async (command: Record<string, unknown>) => {
      try {
        await sendCommand(command);
      } catch (error) {
        console.error('[useDiscoverSensorsCore] Network error:', error);
        setErrorMsg('Network error sending command');
        phaseRef.current = 'error';
        setPhase('error');
        autoConnectRef.current = false;
        setActiveSubjectId(null);
        connectSubjectIdsRef.current = null;
      }
    },
    [sendCommand],
  );

  const discoverAndConnect = useCallback(() => {
    autoConnectRef.current = true;
    connectSubjectIdsRef.current = null;
    phaseRef.current = 'discovering';
    setPhase('discovering');
    setErrorMsg(null);
    setActiveSubjectId(null);
    void doSend({ type: 'discover_sensors' });
  }, [doSend]);

  const discoverAndConnectForSubject = useCallback(
    (subjectId: string) => {
      autoConnectRef.current = true;
      connectSubjectIdsRef.current = [subjectId];
      phaseRef.current = 'discovering';
      setPhase('discovering');
      setErrorMsg(null);
      setActiveSubjectId(subjectId);
      void doSend({
        type: 'discover_sensors_for_subjects',
        payload: { subject_ids: [subjectId] },
      });
    },
    [doSend],
  );

  const discoverAll = useCallback(() => {
    autoConnectRef.current = false;
    connectSubjectIdsRef.current = null;
    phaseRef.current = 'discovering';
    setPhase('discovering');
    setErrorMsg(null);
    setActiveSubjectId(null);
    void doSend({ type: 'discover_sensors' });
  }, [doSend]);

  const connectAll = useCallback(() => {
    connectSubjectIdsRef.current = null;
    phaseRef.current = 'connecting';
    setPhase('connecting');
    setErrorMsg(null);
    setActiveSubjectId(null);
    void doSend({ type: 'connect_all' });
  }, [doSend]);

  const discoverForSubject = useCallback(
    (subjectId: string) => {
      autoConnectRef.current = false;
      connectSubjectIdsRef.current = [subjectId];
      phaseRef.current = 'discovering';
      setPhase('discovering');
      setErrorMsg(null);
      setActiveSubjectId(subjectId);
      void doSend({
        type: 'discover_sensors_for_subjects',
        payload: { subject_ids: [subjectId] },
      });
    },
    [doSend],
  );

  const dismiss = useCallback(() => {
    phaseRef.current = 'idle';
    setPhase('idle');
    setErrorMsg(null);
    setActiveSubjectId(null);
    connectSubjectIdsRef.current = null;
  }, []);

  const isBusy = phase === 'discovering' || phase === 'connecting';

  return {
    phase,
    isBusy,
    errorMsg,
    activeSubjectId,
    discoveredSensors,
    connectedSensors,
    discoverAndConnect,
    discoverAndConnectForSubject,
    discoverAll,
    connectAll,
    discoverForSubject,
    dismiss,
  };
};
