import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { batteryStatusesAtom } from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';

export const useBatteryUpdates = () => {
  const { subscribe } = useGatewaySocket();
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);

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

      setBatteryStatuses((prev) => ({
        ...prev,
        [payload.address]: {
          batteryLevel: typeof payload.battery_level === 'number' ? payload.battery_level : null,
          isCharging: typeof payload.is_charging === 'boolean' ? payload.is_charging : null,
        },
      }));
    });

    return unsubscribe;
  }, [setBatteryStatuses, subscribe]);
};
