import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { batteryStatusesAtom } from '../store/atoms';
import { useBatteryUpdatesCore } from './useBatteryUpdatesCore';

export const useBatteryUpdates = () => {
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const { batteryStatuses } = useBatteryUpdatesCore();

  useEffect(() => {
    setBatteryStatuses(batteryStatuses);
  }, [batteryStatuses, setBatteryStatuses]);

  return { batteryStatuses };
};
