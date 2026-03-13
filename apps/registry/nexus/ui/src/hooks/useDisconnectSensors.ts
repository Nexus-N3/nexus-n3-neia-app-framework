import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { batteryStatusesAtom, connectedSensorsAtom, discoveredSensorsAtom, placedSensorsAtom } from '../store/atoms';
import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';

export const useDisconnectSensors = () => {
  const disconnectState = useDisconnectSensorsCore();
  const setPlacedSensors = useSetAtom(placedSensorsAtom);
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);

  useEffect(() => {
    if (disconnectState.disconnectCount === 0) {
      return;
    }

      setPlacedSensors(new Set<string>());
      setDiscoveredSensors({});
      setConnectedSensors({});
      setBatteryStatuses({});
  }, [
    disconnectState.disconnectCount,
    setBatteryStatuses,
    setConnectedSensors,
    setDiscoveredSensors,
    setPlacedSensors,
  ]);

  return {
    disconnectAll: disconnectState.disconnectAll,
    disconnectCount: disconnectState.disconnectCount,
    isDisconnecting: disconnectState.isDisconnecting,
    errorMsg: disconnectState.errorMsg,
    dismissError: disconnectState.dismissError,
  };
};
