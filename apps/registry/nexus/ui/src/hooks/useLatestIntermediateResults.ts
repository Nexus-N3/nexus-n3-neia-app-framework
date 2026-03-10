import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import {
  activeActivityAtom,
  latestIntermediateComparisonsAtom,
  latestComputeResultsAtom,
  latestIntermediateResultsAtom,
  type IntermediateComparisonResult,
  type LatestSensorResult,
} from '../store/atoms';

export const useLatestIntermediateResults = () => {
  const { subscribe } = useGatewaySocket();
  const activeActivity = useAtomValue(activeActivityAtom);
  const latestResults = useAtomValue(latestComputeResultsAtom);
  const latestIntermediateResults = useAtomValue(latestIntermediateResultsAtom);
  const latestIntermediateComparisons = useAtomValue(latestIntermediateComparisonsAtom);
  const setLatestIntermediateResults = useSetAtom(latestIntermediateResultsAtom);
  const setLatestIntermediateComparisons = useSetAtom(latestIntermediateComparisonsAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (!activeActivity) {
        return;
      }

      if (msg.type !== 'intermediate_result' || !msg.payload || typeof msg.payload !== 'object') {
        return;
      }

      const payload = msg.payload as {
        subject_id?: string;
        algorithm_name?: string;
        results?: Array<{
          address?: string;
          kind?: string;
          pair?: string[];
          location?: string;
          data?: Record<string, { x?: number; y?: number; z?: number; mag?: number }>;
        }>;
      };

      const subjectId = payload.subject_id;
      const results = payload.results;

      if (!subjectId || !Array.isArray(results) || results.length === 0) {
        return;
      }

      const subjectLocations = latestResults[subjectId] ?? {};
      const mappedResults = results.reduce<Record<string, LatestSensorResult>>((acc, result) => {
        const address = result.address;

        if (!address || !result.data || typeof result.data !== 'object') {
          return acc;
        }

        acc[address] = {
          address,
          location: result.location ?? subjectLocations[address]?.location ?? address,
          algorithmName: payload.algorithm_name ?? subjectLocations[address]?.algorithmName ?? 'Unknown algorithm',
          bands: Object.entries(result.data).map(([bandName, axisValues]) => ({
            bandName,
            x: typeof axisValues?.x === 'number' ? axisValues.x : null,
            y: typeof axisValues?.y === 'number' ? axisValues.y : null,
            z: typeof axisValues?.z === 'number' ? axisValues.z : null,
            mag: typeof axisValues?.mag === 'number' ? axisValues.mag : null,
          })),
        };

        return acc;
      }, {});
      const comparisons = results.reduce<IntermediateComparisonResult[]>((acc, result) => {
        if (result.kind !== 'comparison' || !Array.isArray(result.pair) || !result.data || typeof result.data !== 'object') {
          return acc;
        }

        acc.push({
          pair: result.pair,
          data: result.data,
        });

        return acc;
      }, []);

      if (Object.keys(mappedResults).length === 0 && comparisons.length === 0) {
        return;
      }

      if (Object.keys(mappedResults).length > 0) {
        setLatestIntermediateResults((prev) => ({
          ...prev,
          [subjectId]: mappedResults,
        }));
      }
      setLatestIntermediateComparisons((prev) => ({
        ...prev,
        [subjectId]: comparisons,
      }));
    });

    return unsubscribe;
  }, [activeActivity, latestResults, setLatestIntermediateComparisons, setLatestIntermediateResults, subscribe]);

  const clearLatestIntermediateResults = useCallback(() => {
    setLatestIntermediateResults({});
    setLatestIntermediateComparisons({});
  }, [setLatestIntermediateComparisons, setLatestIntermediateResults]);

  return {
    latestIntermediateResults,
    latestIntermediateComparisons,
    clearLatestIntermediateResults,
  };
};
