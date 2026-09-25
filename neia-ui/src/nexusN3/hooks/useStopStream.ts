import { useCallback, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

export const useStopStream = () => {
  const { sendCommand } = useGatewaySocket();
  const [isStopping, setIsStopping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopStreamForAll = useCallback(async () => {
    setIsStopping(true);
    setErrorMsg(null);

    try {
      await sendCommand({
        type: 'stop_stream_for_all',
      });
    } catch (error) {
      console.error('[useStopStream] Failed to stop stream for all:', error);
      setErrorMsg('Failed to stop activity.');
      throw error;
    } finally {
      setIsStopping(false);
    }
  }, [sendCommand]);

  const stopStreamForSubjects = useCallback(
    async (subjectIds: string[]) => {
      setIsStopping(true);
      setErrorMsg(null);

      try {
        await sendCommand({
          type: 'stop_stream_for_subjects',
          payload: {
            subject_ids: subjectIds,
          },
        });
      } catch (error) {
        console.error('[useStopStream] Failed to stop stream for subjects:', error);
        setErrorMsg('Failed to stop activity.');
        throw error;
      } finally {
        setIsStopping(false);
      }
    },
    [sendCommand],
  );

  const dismissError = useCallback(() => {
    setErrorMsg(null);
  }, []);

  return {
    stopStreamForAll,
    stopStreamForSubjects,
    isStopping,
    errorMsg,
    dismissError,
  };
};
