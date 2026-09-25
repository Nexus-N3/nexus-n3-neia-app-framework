import { useEffect, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';
import type { ConnectedSensorsMap } from './gatewaySensorTypes';
import { getConnectedSubjectsFromPayload, getDisconnectedAddressesFromPayload } from './gatewaySensorPayloads';

export const useConnectedSensorUpdatesCore = () => {
  const { subscribe } = useGatewaySocket();
  const [connectedSensors, setConnectedSensors] = useState<ConnectedSensorsMap>({});

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'sensor_connected') {
        const subjects = getConnectedSubjectsFromPayload(msg.payload);
        setConnectedSensors((prev) => {
          const next: ConnectedSensorsMap = { ...prev };
          subjects.forEach((subject) => {
            next[subject.subject_id] = subject.connected_sensors ?? [];
          });
          return next;
        });
        return;
      }

      if (msg.type === 'sensor_disconnected') {
        const disconnectedAddresses = getDisconnectedAddressesFromPayload(msg.payload);
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
  }, [subscribe]);

  return { connectedSensors };
};
