import { useEffect, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';
import type { BatteryStatusMap } from './gatewaySensorTypes';

export const useBatteryUpdatesCore = () => {
  const { subscribe } = useGatewaySocket();
  const [batteryStatuses, setBatteryStatuses] = useState<BatteryStatusMap>({});

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type !== 'battery_update' || !msg.payload || typeof msg.payload !== 'object') {
        return;
      }

      const payload = msg.payload as {
        address?: string;
        battery_level?: number | null;
        is_charging?: boolean | null;
      };

      if (!payload.address) {
        return;
      }
      const address = payload.address;

      setBatteryStatuses((prev) => ({
        ...prev,
        [address]: {
          batteryLevel: typeof payload.battery_level === 'number' ? payload.battery_level : null,
          isCharging: typeof payload.is_charging === 'boolean' ? payload.is_charging : null,
        },
      }));
    });

    return unsubscribe;
  }, [subscribe]);

  return { batteryStatuses };
};
