import { useCallback, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export const useStartStream = () => {
  const { sendCommand } = useGatewaySocket();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startStreamForAll = useCallback(
    async (tag: string) => {
      setIsStarting(true);
      setErrorMsg(null);

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
    [sendCommand],
  );

  const startStreamForSubjects = useCallback(
    async (tag: string, subjectIds: string[]) => {
      setIsStarting(true);
      setErrorMsg(null);

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
    [sendCommand],
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
