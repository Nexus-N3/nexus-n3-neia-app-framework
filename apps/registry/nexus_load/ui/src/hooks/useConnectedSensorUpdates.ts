import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { connectedSensorsAtom } from '../store/atoms';
import { useConnectedSensorUpdatesCore } from './useConnectedSensorUpdatesCore';

export const useConnectedSensorUpdates = () => {
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const { connectedSensors } = useConnectedSensorUpdatesCore();

  useEffect(() => {
    setConnectedSensors(connectedSensors);
  }, [connectedSensors, setConnectedSensors]);

  return { connectedSensors };
};
