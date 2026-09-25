import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import {
  serverReadyAtom,
  supportedSensorsAtom,
  supportedLocationsAtom,
  supportedComputationsAtom,
  type Computation,
  siteNameAtom,
} from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';
import { useCore } from '../../core/CoreProvider';

export const useServerReadiness = () => {
  const { connected, subscribe, sendCommand } = useGatewaySocket();
  const { capabilities, connection } = useCore();
  const setServerReady = useSetAtom(serverReadyAtom);
  const setSupportedSensors = useSetAtom(supportedSensorsAtom);
  const setSupportedLocations = useSetAtom(supportedLocationsAtom);
  const setSupportedComputations = useSetAtom(supportedComputationsAtom);
  const setSiteName = useSetAtom(siteNameAtom);

  useEffect(() => {
    setServerReady(Boolean(connected && connection?.available));
  }, [connected, connection?.available, setServerReady]);

  useEffect(() => {
    if (!capabilities || capabilities.sensors.length === 0) {
      return;
    }

    const availableSensors = capabilities.sensors.filter((sensor) => sensor.available);
    setSupportedSensors(availableSensors.map((sensor) => sensor.id));
    setSupportedLocations(
      Object.fromEntries(
        availableSensors.map((sensor) => [sensor.id, sensor.supported_locations]),
      ),
    );
    setSupportedComputations(
      Object.fromEntries(
        availableSensors.map((sensor) => [
          sensor.id,
          sensor.supported_algorithms
            .map((algorithmId) =>
              capabilities.algorithms.find(
                (algorithm) => algorithm.id === algorithmId && algorithm.available,
              ),
            )
            .filter((algorithm): algorithm is NonNullable<typeof algorithm> => Boolean(algorithm))
            .map<Computation>((algorithm) => ({
              name: algorithm.id,
              inputs: algorithm.inputs ?? {},
              description: algorithm.display_name,
            })),
        ]),
      ),
    );
  }, [
    capabilities,
    setSupportedComputations,
    setSupportedLocations,
    setSupportedSensors,
  ]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'server_ready') {
        setServerReady(true);

        const payload = msg.payload as { site?: string } | undefined;

        if (payload?.site) {
          setSiteName(payload.site);
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
  }, [subscribe, sendCommand, setServerReady, setSiteName]);
};
