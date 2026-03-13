import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { discoveredSensorsAtom, connectedSensorsAtom } from '../store/atoms';
import { useDiscoverSensorsCore } from './useDiscoverSensorsCore';

export const useDiscoverSensors = () => {
  const discoverState = useDiscoverSensorsCore();
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);

  useEffect(() => {
    setDiscoveredSensors(discoverState.discoveredSensors);
  }, [discoverState.discoveredSensors, setDiscoveredSensors]);

  useEffect(() => {
    setConnectedSensors(discoverState.connectedSensors);
  }, [discoverState.connectedSensors, setConnectedSensors]);

  return {
    phase: discoverState.phase,
    isBusy: discoverState.isBusy,
    errorMsg: discoverState.errorMsg,
    activeSubjectId: discoverState.activeSubjectId,
    discoverAndConnect: discoverState.discoverAndConnect,
    discoverAndConnectForSubject: discoverState.discoverAndConnectForSubject,
    discoverAll: discoverState.discoverAll,
    connectAll: discoverState.connectAll,
    discoverForSubject: discoverState.discoverForSubject,
    dismiss: discoverState.dismiss,
  };
};
