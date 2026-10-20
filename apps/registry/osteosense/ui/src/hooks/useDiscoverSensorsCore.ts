import { collectCleanupResult, collectCleanupParticipants, cancelCleanupOperation, cleanupTimeoutError, createCleanupOperation, type CleanupOperation } from './cleanupResults';
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
  const cleanupOperationRef = useRef<CleanupOperation | null>(null);
  const recoverySubjectIdsRef = useRef<string[] | null>(null);
  const phaseRef = useRef<SensorFlowPhase>('idle');

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'sensor_cleanup_started' && cleanupOperationRef.current) {
        collectCleanupParticipants(cleanupOperationRef.current, msg.payload && typeof msg.payload === 'object' ? msg.payload as Record<string, unknown> : {});
        return;
      }
      if (msg.type === 'sensor_cleanup_complete' && cleanupOperationRef.current !== null) {
        const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload as Record<string, unknown> : {};
        const results = collectCleanupResult(cleanupOperationRef.current, payload);
        if (!results) return;
        cancelCleanupOperation(cleanupOperationRef.current);
        cleanupOperationRef.current = null;
        if (results.some((result) => result.status === 'failed' || result.status === 'unconfirmed')) {
          setErrorMsg('Physical sensor cleanup is unconfirmed. Resolve it before retrying acquisition.');
          phaseRef.current = 'error';
          setPhase('error');
          return;
        }
        const subjectIds = recoverySubjectIdsRef.current;
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
        recoverySubjectIdsRef.current = null;
        cancelCleanupOperation(cleanupOperationRef.current);
        cleanupOperationRef.current = null;
      }
    });

    return unsubscribe;
  }, [sendCommand, subscribe]);

  useEffect(() => () => cancelCleanupOperation(cleanupOperationRef.current), []);
  const beginCleanup = useCallback(() => createCleanupOperation((expired) => {
    if (cleanupOperationRef.current !== expired) return;
    cleanupOperationRef.current = null;
    recoverySubjectIdsRef.current = null;
    autoConnectRef.current = false;
    phaseRef.current = 'error';
    setPhase('error');
    setErrorMsg(cleanupTimeoutError(expired));
  }), []);

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
        recoverySubjectIdsRef.current = null;
        cancelCleanupOperation(cleanupOperationRef.current);
        cleanupOperationRef.current = null;
      }
    },
    [sendCommand],
  );

  const discoverAndConnect = useCallback(() => {
    autoConnectRef.current = true;
    connectSubjectIdsRef.current = null;
    cancelCleanupOperation(cleanupOperationRef.current);
    cleanupOperationRef.current = null;
    phaseRef.current = 'discovering';
    setPhase('discovering');
    setErrorMsg(null);
    setActiveSubjectId(null);
    void doSend({ type: 'discover_sensors' });
  }, [doSend]);

  const recoverAndConnect = useCallback((_connectedAddresses: string[]) => {
    autoConnectRef.current = false;
    connectSubjectIdsRef.current = null;
    recoverySubjectIdsRef.current = null;
    phaseRef.current = 'disconnecting';
    setPhase('disconnecting');
    setErrorMsg(null);
    setActiveSubjectId(null);
    setDiscoveredSensors({});
    setConnectedSensors({});
    cancelCleanupOperation(cleanupOperationRef.current);
    cleanupOperationRef.current = beginCleanup();
    void doSend({ type: 'disconnect_all', payload: { correlation_id: cleanupOperationRef.current.correlationId } });
  }, [doSend, beginCleanup]);

  const recoverAndConnectForSubject = useCallback((subjectId: string, _connectedAddresses: string[]) => {
    autoConnectRef.current = false;
    connectSubjectIdsRef.current = [subjectId];
    recoverySubjectIdsRef.current = [subjectId];
    phaseRef.current = 'disconnecting';
    setPhase('disconnecting');
    setErrorMsg(null);
    setActiveSubjectId(subjectId);
    setDiscoveredSensors((prev) => ({ ...prev, [subjectId]: [] }));
    setConnectedSensors((prev) => ({ ...prev, [subjectId]: [] }));
    cancelCleanupOperation(cleanupOperationRef.current);
    cleanupOperationRef.current = beginCleanup();
    void doSend({
      type: 'disconnect_subjects',
      payload: { subject_ids: [subjectId], correlation_id: cleanupOperationRef.current.correlationId },
    });
  }, [doSend, beginCleanup]);

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
    cancelCleanupOperation(cleanupOperationRef.current);
    cleanupOperationRef.current = null;
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
    cancelCleanupOperation(cleanupOperationRef.current);
    cleanupOperationRef.current = null;
    phaseRef.current = 'idle';
    setPhase('idle');
    setErrorMsg(null);
    setActiveSubjectId(null);
    connectSubjectIdsRef.current = null;
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
