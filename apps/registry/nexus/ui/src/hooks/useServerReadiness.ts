import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import {
  serverReadyAtom,
  supportedSensorsAtom,
  supportedLocationsAtom,
  supportedComputationsAtom,
  type SupportedSensor,
  type Computation,
} from '../store/atoms';

interface ServerReadyPayload {
  supported_sensors: SupportedSensor[];
  site?: string;
}

interface ServerReadyEvent {
  type: string;
  payload?: ServerReadyPayload;
}

export const useServerReadiness = () => {
  const setServerReady = useSetAtom(serverReadyAtom);
  const setSupportedSensors = useSetAtom(supportedSensorsAtom);
  const setSupportedLocations = useSetAtom(supportedLocationsAtom);
  const setSupportedComputations = useSetAtom(supportedComputationsAtom);

  useEffect(() => {
    // 1. WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as ServerReadyEvent;

        // Handle EVT_SERVER_READY
        if (event.type === 'server_ready') {
          console.log('Server Ready Event Received:', event);
          setServerReady(true);

          if (event.payload && Array.isArray(event.payload.supported_sensors)) {
            const sensors = event.payload.supported_sensors;

            // Extract sensor names
            setSupportedSensors(sensors.map((s) => s.name).filter(Boolean));

            // Extract locations and computations maps
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
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // 2. Poll for Server Readiness
    const checkReadiness = async () => {
      try {
        await fetch('/api/v1/gateway/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'is_server_ready', payload: {} }),
        });
      } catch (error) {
        console.error('Error checking server readiness:', error);
      }
    };

    // Initial check
    checkReadiness();

    // Optional: Periodic check if not ready? (Keeping it simple for now as per Step 0)

    return () => {
      ws.close();
    };
  }, [setServerReady, setSupportedSensors, setSupportedLocations, setSupportedComputations]);
};
