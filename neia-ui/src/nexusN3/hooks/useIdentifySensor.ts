import { useCallback, useState } from 'react';
import { useGatewaySocket } from './useGatewaySocket';

const normalizeLocation = (location: string) => location.toUpperCase().replace(/\s+/g, '_');

export const useIdentifySensor = () => {
  const { sendCommand } = useGatewaySocket();
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const identifySensor = useCallback(
    async (subjectId: string, location: string) => {
      setIsIdentifying(true);
      setErrorMsg(null);

      try {
        await sendCommand({
          type: 'identify_sensor',
          payload: {
            subject_id: subjectId,
            location: normalizeLocation(location),
          },
        });
      } catch (error) {
        console.error('[useIdentifySensor] Failed to send identify command:', error);
        setErrorMsg('Failed to send identify command.');
      } finally {
        setIsIdentifying(false);
      }
    },
    [sendCommand],
  );

  return {
    identifySensor,
    isIdentifying,
    errorMsg,
  };
};
