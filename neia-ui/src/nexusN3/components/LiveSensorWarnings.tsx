import { useEffect, useRef } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useGatewaySocket } from '../hooks/useGatewaySocket';
import { activeStreamTargetSubjectIdsAtom, configuredSubjectsAtom, streamLifecycleBySubjectAtom } from '../store/atoms';

interface LostSensorWarning {
  id: string;
  subject: string;
  name: string;
  location: string;
  lostAt: string;
  dismissed: boolean;
}
// Retain acknowledgements across Event Log remounts; IDs include the acquisition.
export const lostSensorWarningsAtom = atom<LostSensorWarning[]>([]);
const friendly = (value: string) => value.replace(/_/g, ' ').replace(/\b\w+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

export function LiveSensorWarnings({ suppressed }: { suppressed: boolean }) {
  const { subscribe } = useGatewaySocket();
  const lifecycle = useAtomValue(streamLifecycleBySubjectAtom);
  const activeSubjects = useAtomValue(activeStreamTargetSubjectIdsAtom);
  const subjects = useAtomValue(configuredSubjectsAtom);
  const [warnings, setWarnings] = useAtom(lostSensorWarningsAtom);
  const current = useRef({ suppressed, lifecycle, activeSubjects, subjects });
  current.current = { suppressed, lifecycle, activeSubjects, subjects };
  useEffect(() => subscribe((message) => {
    if (message.type !== 'sensor_disconnected' || !message.payload || typeof message.payload !== 'object') return;
    const payload = message.payload as Record<string, unknown>;
    const state = current.current;
    if (state.suppressed || payload.unexpected !== true || !Array.isArray(payload.sensors)) return;
    const lostAt = typeof payload.lost_at === 'string' ? payload.lost_at : new Date().toISOString();
    const session = String(payload.session_timestamp ?? '');
    if (!session) return;
    for (const raw of payload.sensors) {
      if (!raw || typeof raw !== 'object') continue;
      const sensor = raw as Record<string, unknown>;
      const subjectId = String(sensor.subject_id ?? '');
      if (state.lifecycle[subjectId]?.phase !== 'official_streaming'
          || !state.activeSubjects.includes(subjectId) || typeof sensor.address !== 'string') continue;
      const id = `${session}:${sensor.address.toUpperCase()}`;
      const warning: LostSensorWarning = {
        id, subject: state.subjects?.find((subject) => subject.subject_id === subjectId)?.display_name || friendly(subjectId),
        location: friendly(String(sensor.location || 'Unspecified location')),
        name: String(sensor.name || 'Sensor'), lostAt, dismissed: false,
      };
      setWarnings((previous) => previous.some((item) => item.id === id) ? previous : [...previous, warning]);
    }
  }), [subscribe, setWarnings]);
  return <aside className="lost-sensor-toasts" aria-label="Sensor connection warnings">
    {warnings.filter((warning) => !warning.dismissed).map((warning) => <article role="alert" className="lost-sensor-toast" key={warning.id}>
      <button className="lost-sensor-toast-close" aria-label={`Dismiss warning for ${warning.subject} ${warning.location}`}
        onClick={() => setWarnings((previous) => previous.map((item) => item.id === warning.id ? { ...item, dismissed: true } : item))}>×</button>
      <strong>Sensor connection lost</strong>
      <p>{warning.subject} — {warning.location}<br />{warning.name}</p>
      <p>Data from this sensor is no longer being received.<br />The session is continuing with the remaining sensors.</p>
      <small>Lost at {new Date(warning.lostAt).toLocaleTimeString(undefined, { hour12: false })}</small>
    </article>)}
  </aside>;
}
