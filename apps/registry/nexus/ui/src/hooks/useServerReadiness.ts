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
  const { connected, subscribe, sendCommand } = useGatewaySocket();
  const setServerReady = useSetAtom(serverReadyAtom);
  const setSupportedSensors = useSetAtom(supportedSensorsAtom);
  const setSupportedLocations = useSetAtom(supportedLocationsAtom);
  const setSupportedComputations = useSetAtom(supportedComputationsAtom);
  const setSetups = useSetAtom(setupsAtom);
  const setSiteName = useSetAtom(siteNameAtom);

  useEffect(() => {
    if (!connected) {
      setServerReady(false);
    }
  }, [connected, setServerReady]);

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

          // Keep the default setup label stable and only refresh its default computation.
          const firstSensorType = sensors[0];
          if (firstSensorType && Array.isArray(firstSensorType.computations) && firstSensorType.computations.length > 0) {
            const firstCompName =
              firstSensorType.computations.find((comp) => comp.name === 'standard_loading_intensity')?.name ??
              firstSensorType.computations[0].name;
            setSetups((prev) =>
              prev.map((setup) =>
                setup.id === 'default'
                  ? {
                      ...setup,
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
    setServerReady(false);
    sendCommand({ type: 'is_server_ready', payload: {} }).catch((error) => {
      console.error('Error checking server readiness:', error);
      setServerReady(false);
    });

    return unsubscribe;
  }, [subscribe, sendCommand, setServerReady, setSupportedSensors, setSupportedLocations, setSupportedComputations, setSetups, setSiteName]);
};
