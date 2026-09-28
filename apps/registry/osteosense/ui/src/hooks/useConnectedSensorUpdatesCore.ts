import { useEffect, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';
import type { ConnectedSensorsMap } from './gatewaySensorTypes';
import {
  getConnectedSubjectsFromPayload,
  getDisconnectedAddressesFromPayload,
  getDiscoveredSubjectsFromPayload,
} from './gatewaySensorPayloads';

export const useConnectedSensorUpdatesCore = () => {
  const { subscribe } = useGatewaySocket();
  const [connectedSensors, setConnectedSensors] = useState<ConnectedSensorsMap>({});

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
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
        return;
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
