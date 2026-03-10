import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { connectedSensorsAtom, type ConnectedSensorsMap } from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';

export const useConnectedSensorUpdates = () => {
  const { subscribe } = useGatewaySocket();
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'sensor_connected') {
        const subjects = Array.isArray(msg.payload) ? msg.payload : [];
        setConnectedSensors((prev) => {
          const next: ConnectedSensorsMap = { ...prev };
          subjects.forEach((subject: {
            subject_id: string;
            connected_sensors: Array<{ address: string; status: string; location: string | null }>;
          }) => {
            next[subject.subject_id] = subject.connected_sensors ?? [];
          });
          return next;
        });
        return;
      }

      if (msg.type === 'sensor_disconnected') {
        const disconnectedAddresses = Array.isArray(msg.payload) ? msg.payload : [];
        setConnectedSensors((prev) => {
          const next: ConnectedSensorsMap = {};
          Object.entries(prev).forEach(([subjectId, sensors]) => {
            next[subjectId] = sensors.filter(
              (sensor) => !disconnectedAddresses.includes(sensor.address),
            );
          });
          return next;
        });
      }
    });

    return unsubscribe;
  }, [setConnectedSensors, subscribe]);
};
