import { useCallback, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import { activeStreamTargetSubjectIdsAtom, streamLifecycleBySubjectAtom } from '../store/atoms';

export const useStartStream = () => {
  const { sendCommand } = useGatewaySocket();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const setActiveStreamTargetSubjectIds = useSetAtom(activeStreamTargetSubjectIdsAtom);
  const setStreamLifecycleBySubject = useSetAtom(streamLifecycleBySubjectAtom);

  const markStarting = useCallback((subjectIds: string[]) => {
    setActiveStreamTargetSubjectIds(subjectIds);
    setStreamLifecycleBySubject((prev) => {
      const next = { ...prev };
      subjectIds.forEach((subjectId) => {
        next[subjectId] = {
          phase: 'starting',
          attempt: 1,
          maxAttempts: 2,
          countdownStartedAtMs: null,
          gateDurationSeconds: 5,
          statusMessage: 'Starting measurement',
          reason: null,
          isOfficial: false,
          lastEventType: 'command_start_requested',
        };
      });
      return next;
    });
  }, [setActiveStreamTargetSubjectIds, setStreamLifecycleBySubject]);

  const startStreamForAll = useCallback(
    async (tag: string, subjectIds: string[]) => {
      setIsStarting(true);
      setErrorMsg(null);
      markStarting(subjectIds);

      try {
        await sendCommand({
          type: 'start_stream_for_all',
          payload: { tag },
        });
      } catch (error) {
        console.error('[useStartStream] Failed to start stream for all:', error);
        setErrorMsg('Failed to start activity.');
        throw error;
      } finally {
        setIsStarting(false);
      }
    },
    [markStarting, sendCommand],
  );

  const startStreamForSubjects = useCallback(
    async (tag: string, subjectIds: string[]) => {
      setIsStarting(true);
      setErrorMsg(null);
      markStarting(subjectIds);

      try {
        await sendCommand({
          type: 'start_stream_for_subjects',
          payload: {
            tag,
            subject_ids: subjectIds,
          },
        });
      } catch (error) {
        console.error('[useStartStream] Failed to start stream for subjects:', error);
        setErrorMsg('Failed to start activity.');
        throw error;
      } finally {
        setIsStarting(false);
      }
    },
    [markStarting, sendCommand],
  );

  const dismissError = useCallback(() => {
    setErrorMsg(null);
  }, []);

  return {
    startStreamForAll,
    startStreamForSubjects,
    isStarting,
    errorMsg,
    dismissError,
  };
};
