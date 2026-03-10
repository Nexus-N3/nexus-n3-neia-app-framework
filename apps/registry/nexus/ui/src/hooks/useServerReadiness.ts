import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import {
  serverReadyAtom,
  supportedSensorsAtom,
  supportedLocationsAtom,
  supportedComputationsAtom,
  setupsAtom,
  type SupportedSensor,
  type Computation,
  siteNameAtom,
} from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';

export const useServerReadiness = () => {
  const { subscribe, sendCommand } = useGatewaySocket();
  const setServerReady = useSetAtom(serverReadyAtom);
  const setSupportedSensors = useSetAtom(supportedSensorsAtom);
  const setSupportedLocations = useSetAtom(supportedLocationsAtom);
  const setSupportedComputations = useSetAtom(supportedComputationsAtom);
  const setSetups = useSetAtom(setupsAtom);
  const setSiteName = useSetAtom(siteNameAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'server_ready') {
        console.log('Server Ready Event Received:', msg);
        setServerReady(true);

        const payload = msg.payload as { supported_sensors?: SupportedSensor[]; site?: string } | undefined;

        if (payload?.site) {
          setSiteName(payload.site);
        }

        if (payload && Array.isArray(payload.supported_sensors)) {
          const sensors = payload.supported_sensors;

          setSupportedSensors(sensors.map((s) => s.name).filter(Boolean));

          const locMap: Record<string, string[]> = {};
          const compMap: Record<string, Computation[]> = {};

          sensors.forEach((s) => {
            if (s.name && Array.isArray(s.locations)) {
              locMap[s.name] = s.locations;
            }
            if (s.name && Array.isArray(s.computations)) {
              compMap[s.name] = s.computations;
            }
          });

          setSupportedLocations(locMap);
          setSupportedComputations(compMap);

          // Update default setup name and sensor comp to the 1st computation
          const firstSensorType = sensors[0];
          if (firstSensorType && Array.isArray(firstSensorType.computations) && firstSensorType.computations.length > 0) {
            const firstCompName = firstSensorType.computations[0].name;
            setSetups((prev) =>
              prev.map((setup) =>
                setup.id === 'default'
                  ? {
                      ...setup,
                      name: firstCompName,
                      sensors: setup.sensors.map((s) => ({ ...s, comp: firstCompName })),
                    }
                  : setup,
              ),
            );
          }
        }
      }
    });

    // Send initial readiness check
    sendCommand({ type: 'is_server_ready', payload: {} }).catch((error) => {
      console.error('Error checking server readiness:', error);
    });

    return unsubscribe;
  }, [subscribe, sendCommand, setServerReady, setSupportedSensors, setSupportedLocations, setSupportedComputations, setSetups, setSiteName]);
};
