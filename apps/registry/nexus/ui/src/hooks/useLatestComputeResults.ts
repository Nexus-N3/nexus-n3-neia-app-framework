import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import { latestComputeResultsAtom, type LatestComputeResultsMap } from '../store/atoms';

export const useLatestComputeResults = () => {
  const { subscribe } = useGatewaySocket();
  const latestResults = useAtomValue(latestComputeResultsAtom);
  const setLatestResults = useSetAtom(latestComputeResultsAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type !== 'compute_result' || !msg.payload || typeof msg.payload !== 'object') {
        return;
      }

      const payload = msg.payload as {
        subject_id?: string;
        location?: string;
        algorithm_name?: string;
        result?: {
          address?: string;
          frequency_band_results?: Array<{
            band_name?: string;
            axis_values?: { mag?: number };
          }>;
        };
      };

      const subjectId = payload.subject_id;
      const address = payload.result?.address;

      if (!subjectId || !address) {
        return;
      }

      setLatestResults((prev) => ({
        ...prev,
        [subjectId]: {
          ...(prev[subjectId] ?? {}),
          [address]: {
            address,
            location: payload.location ?? 'Unknown location',
            algorithmName: payload.algorithm_name ?? 'Unknown algorithm',
            bands: (payload.result?.frequency_band_results ?? []).map((band) => ({
              bandName: band.band_name ?? 'Unknown band',
              mag: typeof band.axis_values?.mag === 'number' ? band.axis_values.mag : null,
            })),
          },
        },
      }));
    });

    return unsubscribe;
  }, [subscribe]);

  const clearLatestResults = useCallback(() => {
    setLatestResults({});
  }, [setLatestResults]);

  return { latestResults, clearLatestResults };
};
