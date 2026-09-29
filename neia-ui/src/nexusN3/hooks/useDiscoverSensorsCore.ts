import { useCallback, useEffect, useRef, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';
import type { ConnectedSensorsMap, DiscoveredSensorsMap, SensorFlowPhase } from './gatewaySensorTypes';
import {
  getConnectedSubjectsFromPayload,
  getDisconnectedAddressesFromPayload,
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
  const recoveryDisconnectAddressesRef = useRef<Set<string> | null>(null);
  const recoverySubjectIdsRef = useRef<string[] | null>(null);
  const phaseRef = useRef<SensorFlowPhase>('idle');

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'sensor_disconnected' && recoveryDisconnectAddressesRef.current !== null) {
        const pendingAddresses = recoveryDisconnectAddressesRef.current;
        const disconnectedAddresses = getDisconnectedAddressesFromPayload(msg.payload);
        disconnectedAddresses.forEach((address) => {
          pendingAddresses.delete(address.toUpperCase());
        });
        if (disconnectedAddresses.length === 0 && pendingAddresses.size > 0) {
          pendingAddresses.delete(pendingAddresses.values().next().value as string);
        }

        if (pendingAddresses.size > 0) {
          return;
        }

        const subjectIds = recoverySubjectIdsRef.current;
        recoveryDisconnectAddressesRef.current = null;
        recoverySubjectIdsRef.current = null;
        autoConnectRef.current = true;
        connectSubjectIdsRef.current = subjectIds;
        phaseRef.current = 'discovering';
        setPhase('discovering');
        const command = subjectIds && subjectIds.length > 0
          ? {
              type: 'discover_sensors_for_subjects',
              payload: { subject_ids: subjectIds },
            }
          : { type: 'discover_sensors' };
        void sendCommand(command).catch((error) => {
          console.error('[useDiscoverSensorsCore] Network error:', error);
          setErrorMsg('Network error sending discover command');
          autoConnectRef.current = false;
          phaseRef.current = 'error';
          setPhase('error');
        });
        return;
      }

      if (msg.type === 'sensors_discovered' || msg.type === 'sensors_discovered_for_subject') {
        const subjects = getDiscoveredSubjectsFromPayload(msg.payload);
        setConnectedSensors((prev) => {
          if (subjects.length === 0) {
            return {};
          }
          const next = { ...prev };
          subjects.forEach((subject) => {
            next[subject.subject_id] = [];
          });
          return next;
        });
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

      if (
        msg.type === 'error'
        && (phaseRef.current === 'disconnecting' || phaseRef.current === 'discovering' || phaseRef.current === 'connecting')
      ) {
        setErrorMsg(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
        phaseRef.current = 'error';
        setPhase('error');
        autoConnectRef.current = false;
        setActiveSubjectId(null);
        connectSubjectIdsRef.current = null;
        recoveryDisconnectAddressesRef.current = null;
        recoverySubjectIdsRef.current = null;
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
        recoveryDisconnectAddressesRef.current = null;
        recoverySubjectIdsRef.current = null;
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

  const recoverAndConnect = useCallback((connectedAddresses: string[]) => {
    autoConnectRef.current = false;
    connectSubjectIdsRef.current = null;
    recoverySubjectIdsRef.current = null;
    recoveryDisconnectAddressesRef.current = new Set(
      connectedAddresses.map((address) => address.toUpperCase()),
    );
    phaseRef.current = 'disconnecting';
    setPhase('disconnecting');
    setErrorMsg(null);
    setActiveSubjectId(null);
    setDiscoveredSensors({});
    setConnectedSensors({});
    void doSend({ type: 'disconnect_all' });
  }, [doSend]);

  const recoverAndConnectForSubject = useCallback((subjectId: string, connectedAddresses: string[]) => {
    autoConnectRef.current = false;
    connectSubjectIdsRef.current = [subjectId];
    recoverySubjectIdsRef.current = [subjectId];
    recoveryDisconnectAddressesRef.current = new Set(
      connectedAddresses.map((address) => address.toUpperCase()),
    );
    phaseRef.current = 'disconnecting';
    setPhase('disconnecting');
    setErrorMsg(null);
    setActiveSubjectId(subjectId);
    setDiscoveredSensors((prev) => ({ ...prev, [subjectId]: [] }));
    setConnectedSensors((prev) => ({ ...prev, [subjectId]: [] }));
    void doSend({
      type: 'disconnect_subjects',
      payload: { subject_ids: [subjectId] },
    });
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
    recoveryDisconnectAddressesRef.current = null;
    recoverySubjectIdsRef.current = null;
  }, []);

  const isBusy = phase === 'disconnecting' || phase === 'discovering' || phase === 'connecting';

  return {
    phase,
    isBusy,
    errorMsg,
    activeSubjectId,
    discoveredSensors,
    connectedSensors,
    discoverAndConnect,
    recoverAndConnect,
    recoverAndConnectForSubject,
    discoverAndConnectForSubject,
    discoverAll,
    connectAll,
    discoverForSubject,
    dismiss,
  };
};
