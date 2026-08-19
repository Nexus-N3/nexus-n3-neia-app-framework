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
  selectedSubjectAtom,
  sessionNameAtom,
  sessionEventsAtom,
  sessionStageAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  subjectCountAtom,
  subjectPrefixAtom,
  subjectSensorRowsAtom,
  activeWorkflowIdAtom,
} from '../store/atoms';

export const useResetSessionState = () => {
  const setSessionName = useSetAtom(sessionNameAtom);
  const setSessionEvents = useSetAtom(sessionEventsAtom);
  const setSessionStage = useSetAtom(sessionStageAtom);
  const setSubjectSensorRows = useSetAtom(subjectSensorRowsAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setActiveActivity = useSetAtom(activeActivityAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const setConfiguredSubjects = useSetAtom(configuredSubjectsAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
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
  const setStreamDrainState = useSetAtom(streamDrainStateAtom);
  const setActiveWorkflowId = useSetAtom(activeWorkflowIdAtom);

  const resetSessionState = useCallback(() => {
    setSessionName('');
    setSessionEvents([]);
    setSessionStage('idle');
    setSubjectSensorRows({});
    setSubjectPrefix('');
    setActiveActivity(false);
    setBatteryStatuses({});
    setConfiguredSubjects(null);
    setSubjectCount(1);
    setSelectedSubject(null);
    setSelectedSessionConfig(null);
    setActiveStreamTargetSubjectIds([]);
    setPlacedSensors(new Set<string>());
    setDiscoveredSensors({});
    setConnectedSensors({});
    setLatestComputeResults({});
    setLatestIntermediateResults({});
    setLatestIntermediateComparisons({});
    setComputeResultsHistory({});
    setStreamLifecycleBySubject({});
    setStreamDrainState({
      pending: false,
      subjectIds: [],
      status: null,
      sessionArchiveExists: null,
    });
    setActiveWorkflowId(null);
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
    setSelectedSessionConfig,
    setSelectedSubject,
    setSessionEvents,
    setSessionName,
    setSessionStage,
    setStreamDrainState,
    setStreamLifecycleBySubject,
    setSubjectCount,
    setSubjectPrefix,
    setSubjectSensorRows,
    setActiveWorkflowId,
  ]);

  return { resetSessionState };
};
