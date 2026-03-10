import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import {
  activeActivityAtom,
  computeResultsHistoryAtom,
  latestComputeResultsAtom,
  type LatestComputeResultsMap,
  type LatestSensorResult,
} from '../store/atoms';

const MAX_HISTORY_ENTRIES = 50;

export const useLatestComputeResults = () => {
  const { subscribe } = useGatewaySocket();
  const latestResults = useAtomValue(latestComputeResultsAtom);
  const activeActivity = useAtomValue(activeActivityAtom);
  const resultHistory = useAtomValue(computeResultsHistoryAtom);
  const setLatestResults = useSetAtom(latestComputeResultsAtom);
  const setResultHistory = useSetAtom(computeResultsHistoryAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (!activeActivity) {
        return;
      }

      if (msg.type !== 'compute_result' || !msg.payload || typeof msg.payload !== 'object') {
        return;
      }

      const payload = msg.payload as {
        subject_id?: string;
        location?: string;
        algorithm_name?: string;
        result?: {
          address?: string;
          result_count?: number;
          frequency_band_results?: Array<{
            band_name?: string;
            axis_values?: { x?: number; y?: number; z?: number; mag?: number };
          }>;
        };
      };

      const subjectId = payload.subject_id;
      const address = payload.result?.address;
      const resultCount = payload.result?.result_count;

      if (!subjectId || !address) {
        return;
      }

      const nextResult: LatestSensorResult = {
        address,
        location: payload.location ?? 'Unknown location',
        algorithmName: payload.algorithm_name ?? 'Unknown algorithm',
        bands: (payload.result?.frequency_band_results ?? []).map((band) => ({
          bandName: band.band_name ?? 'Unknown band',
          x: typeof band.axis_values?.x === 'number' ? band.axis_values.x : null,
          y: typeof band.axis_values?.y === 'number' ? band.axis_values.y : null,
          z: typeof band.axis_values?.z === 'number' ? band.axis_values.z : null,
          mag: typeof band.axis_values?.mag === 'number' ? band.axis_values.mag : null,
        })),
      };

      let nextSubjectResults: LatestComputeResultsMap[string] = {};
      setLatestResults((prev) => {
        nextSubjectResults = {
          ...(prev[subjectId] ?? {}),
          [address]: nextResult,
        };

        return {
          ...prev,
          [subjectId]: nextSubjectResults,
        };
      });

      setResultHistory((prev) => {
        const subjectEntries = [...(prev[subjectId] ?? [])];
        const historyResultCount =
          typeof resultCount === 'number'
            ? resultCount
            : (subjectEntries[subjectEntries.length - 1]?.resultCount ?? 0) + 1;
        const existingIndex =
          typeof resultCount === 'number'
            ? subjectEntries.findIndex((entry) => entry.resultCount === historyResultCount)
            : -1;
        const nextTimestamp = Date.now();

        if (existingIndex >= 0) {
          const existingEntry = subjectEntries[existingIndex];
          const existingResultsByAddress = Object.fromEntries(
            existingEntry.results.map((result) => [result.address, result]),
          );

          existingResultsByAddress[address] = nextResult;
          subjectEntries[existingIndex] = {
            ...existingEntry,
            timestamp: nextTimestamp,
            results: Object.values(existingResultsByAddress),
          };
        } else {
          subjectEntries.push({
            timestamp: nextTimestamp,
            resultCount: historyResultCount,
            results: [nextResult],
          });
        }

        return {
          ...prev,
          [subjectId]: subjectEntries.slice(-MAX_HISTORY_ENTRIES),
        };
      });
    });

    return unsubscribe;
  }, [activeActivity, setLatestResults, setResultHistory, subscribe]);

  const clearLatestResults = useCallback(() => {
    setLatestResults({});
    setResultHistory({});
  }, [setLatestResults, setResultHistory]);

  return { latestResults, resultHistory, clearLatestResults };
};
