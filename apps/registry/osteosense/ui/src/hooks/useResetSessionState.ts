import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import {
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  batteryStatusesAtom,
  computeResultsHistoryAtom,
  connectedSensorsAtom,
  discoveredSensorsAtom,
  latestIntermediateComparisonsAtom,
  latestIntermediateResultsAtom,
  latestComputeResultsAtom,
  placedSensorsAtom,
  selectedSetupIdAtom,
  selectedSubjectAtom,
  sessionNameAtom,
  streamLifecycleBySubjectAtom,
  subjectCountAtom,
  subjectPrefixAtom,
} from '../store/atoms';

export const useResetSessionState = () => {
  const setSessionName = useSetAtom(sessionNameAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setActiveActivity = useSetAtom(activeActivityAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSelectedSetupId = useSetAtom(selectedSetupIdAtom);
  const setSelectedSubject = useSetAtom(selectedSubjectAtom);
  const setActiveStreamTargetSubjectIds = useSetAtom(activeStreamTargetSubjectIdsAtom);
  const setPlacedSensors = useSetAtom(placedSensorsAtom);
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const setLatestIntermediateResults = useSetAtom(latestIntermediateResultsAtom);
  const setLatestIntermediateComparisons = useSetAtom(latestIntermediateComparisonsAtom);
  const setComputeResultsHistory = useSetAtom(computeResultsHistoryAtom);
  const setStreamLifecycleBySubject = useSetAtom(streamLifecycleBySubjectAtom);

  const resetSessionState = useCallback(() => {
    setSessionName('');
    setSubjectPrefix('');
    setActiveActivity(false);
    setBatteryStatuses({});
    setSubjectCount(1);
    setSelectedSubject(null);
    setActiveStreamTargetSubjectIds([]);
    setSelectedSetupId('default');
    setPlacedSensors(new Set<string>());
    setDiscoveredSensors({});
    setConnectedSensors({});
    setLatestComputeResults({});
    setLatestIntermediateResults({});
    setLatestIntermediateComparisons({});
    setComputeResultsHistory({});
    setStreamLifecycleBySubject({});
  }, [
    setActiveActivity,
    setActiveStreamTargetSubjectIds,
    setBatteryStatuses,
    setComputeResultsHistory,
    setConnectedSensors,
    setDiscoveredSensors,
    setLatestIntermediateComparisons,
    setLatestIntermediateResults,
    setLatestComputeResults,
    setPlacedSensors,
    setSelectedSetupId,
    setSelectedSubject,
    setSessionName,
    setStreamLifecycleBySubject,
    setSubjectCount,
    setSubjectPrefix,
  ]);

  return { resetSessionState };
};
