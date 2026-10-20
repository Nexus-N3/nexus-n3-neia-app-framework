import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { appendBoundedEvent, normalizeSessionEvent } from '../sessionEvents';
import { sessionEventsAtom, sessionStageAtom } from '../store/atoms';
import { useGatewaySocket } from './useGatewaySocket';

export function useSessionEventIngestion() {
  const { subscribe } = useGatewaySocket();
  const sessionStage = useAtomValue(sessionStageAtom);
  const setEvents = useSetAtom(sessionEventsAtom);
  const sequenceRef = useRef(0);

  useEffect(() => {
    return subscribe((message) => {
      if (sessionStage === 'idle') return;
      sequenceRef.current += 1;
      const event = normalizeSessionEvent(message, sequenceRef.current);
      setEvents((current) => appendBoundedEvent(current, event));
    });
  }, [sessionStage, setEvents, subscribe]);
}
