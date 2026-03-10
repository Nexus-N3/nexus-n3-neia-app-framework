import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import {
  activeActivityAtom,
  computeResultsHistoryAtom,
  connectedSensorsAtom,
  discoveredSensorsAtom,
  latestComputeResultsAtom,
  placedSensorsAtom,
  selectedSetupIdAtom,
  sessionNameAtom,
  subjectCountAtom,
  subjectPrefixAtom,
} from '../store/atoms';

export const useResetSessionState = () => {
  const setSessionName = useSetAtom(sessionNameAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setActiveActivity = useSetAtom(activeActivityAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSelectedSetupId = useSetAtom(selectedSetupIdAtom);
  const setPlacedSensors = useSetAtom(placedSensorsAtom);
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const setComputeResultsHistory = useSetAtom(computeResultsHistoryAtom);

  const resetSessionState = useCallback(() => {
    setSessionName('');
    setSubjectPrefix('');
    setActiveActivity(false);
    setSubjectCount(1);
    setSelectedSetupId('default');
    setPlacedSensors(new Set<string>());
    setDiscoveredSensors({});
    setConnectedSensors({});
    setLatestComputeResults({});
    setComputeResultsHistory({});
  }, [
    setActiveActivity,
    setComputeResultsHistory,
    setConnectedSensors,
    setDiscoveredSensors,
    setLatestComputeResults,
    setPlacedSensors,
    setSelectedSetupId,
    setSessionName,
    setSubjectCount,
    setSubjectPrefix,
  ]);

  return { resetSessionState };
};
