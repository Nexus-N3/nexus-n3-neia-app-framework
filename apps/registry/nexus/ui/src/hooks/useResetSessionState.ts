import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import {
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  batteryStatusesAtom,
  configuredSubjectsAtom,
  computeResultsHistoryAtom,
  connectedSensorsAtom,
  discoveredSensorsAtom,
  latestIntermediateComparisonsAtom,
  latestIntermediateResultsAtom,
  latestComputeResultsAtom,
  placedSensorsAtom,
  selectedSessionConfigAtom,
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
  const setConfiguredSubjects = useSetAtom(configuredSubjectsAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSelectedSetupId = useSetAtom(selectedSetupIdAtom);
  const setSelectedSubject = useSetAtom(selectedSubjectAtom);
  const setSelectedSessionConfig = useSetAtom(selectedSessionConfigAtom);
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
    setConfiguredSubjects(null);
    setSubjectCount(1);
    setSelectedSubject(null);
    setSelectedSessionConfig(null);
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
    setConfiguredSubjects,
    setComputeResultsHistory,
    setConnectedSensors,
    setDiscoveredSensors,
    setLatestIntermediateComparisons,
    setLatestIntermediateResults,
    setLatestComputeResults,
    setPlacedSensors,
    setSelectedSetupId,
    setSelectedSessionConfig,
    setSelectedSubject,
    setSessionName,
    setStreamLifecycleBySubject,
    setSubjectCount,
    setSubjectPrefix,
  ]);

  return { resetSessionState };
};
