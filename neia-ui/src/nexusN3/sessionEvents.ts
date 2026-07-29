export type SessionEventCategory =
  | 'system'
  | 'diagnostic'
  | 'realtime'
  | 'intermediate'
  | 'consolidated';

export interface NormalizedSessionEvent {
  id: string;
  sequence: number;
  timestamp: string;
  category: SessionEventCategory;
  eventType: string;
  subjectId: string | null;
  sensorId: string | null;
  summary: string;
  payload: unknown;
}

export interface SessionEventFilters {
  category: SessionEventCategory | 'all';
  subjectId: string;
  sensorId: string;
}

export const MAX_SESSION_EVENTS = 1000;
export const SESSION_EVENT_PAGE_SIZE = 20;

export const EVENT_PRESENTATION: Record<
  SessionEventCategory,
  { label: string; icon: string; color: string }
> = {
  system: { label: 'System', icon: 'SYS', color: '#4285f4' },
  diagnostic: { label: 'Diagnostic', icon: 'DIA', color: '#9297a1' },
  realtime: { label: 'Real-time compute', icon: 'RTC', color: '#31b86b' },
  intermediate: { label: 'Intermediate', icon: 'INT', color: '#ef9f35' },
  consolidated: { label: 'Consolidated', icon: 'CON', color: '#9c6cff' },
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const firstString = (...values: unknown[]): string | null => {
  const match = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof match === 'string' ? match : null;
};

export function classifySessionEvent(eventType: string): SessionEventCategory {
  const normalized = eventType.toLowerCase();
  if (normalized.includes('consolidated') || normalized.includes('session_result')) {
    return 'consolidated';
  }
  if (normalized.includes('intermediate')) {
    return 'intermediate';
  }
  if (normalized.includes('compute') || normalized.includes('realtime')) {
    return 'realtime';
  }
  if (
    normalized.includes('diagnostic') ||
    normalized.includes('error') ||
    normalized.includes('warning') ||
    normalized.includes('health')
  ) {
    return 'diagnostic';
  }
  return 'system';
}

export function normalizeSessionEvent(
  raw: Record<string, unknown>,
  sequence: number,
  receivedAt = new Date(),
): NormalizedSessionEvent {
  const payload = raw.payload;
  const payloadRecord = asRecord(payload);
  const resultRecord = asRecord(payloadRecord.result);
  const eventType = firstString(raw.type, raw.event_type, raw.name) ?? 'unknown_event';
  const rawTimestamp = firstString(
    raw.timestamp,
    raw.received_at,
    payloadRecord.timestamp,
    payloadRecord.created_at,
  );
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : receivedAt;
  const timestamp = Number.isNaN(parsedTimestamp.getTime())
    ? receivedAt.toISOString()
    : parsedTimestamp.toISOString();
  const subjectId = firstString(
    raw.subject_id,
    payloadRecord.subject_id,
    payloadRecord.subject,
  );
  const sensorId = firstString(
    raw.sensor_id,
    raw.address,
    payloadRecord.sensor_id,
    payloadRecord.address,
    resultRecord.address,
    payloadRecord.location,
  );
  const summary =
    firstString(
      raw.summary,
      raw.message,
      payloadRecord.summary,
      payloadRecord.message,
      payloadRecord.reason,
      payloadRecord.status,
    ) ?? eventType.replace(/_/g, ' ');

  return {
    id: `${sequence}-${eventType}-${timestamp}`,
    sequence,
    timestamp,
    category: classifySessionEvent(eventType),
    eventType,
    subjectId,
    sensorId,
    summary,
    payload,
  };
}

export function appendBoundedEvent(
  current: NormalizedSessionEvent[],
  event: NormalizedSessionEvent,
  limit = MAX_SESSION_EVENTS,
): NormalizedSessionEvent[] {
  return [...current, event].slice(-limit);
}

export function filterSessionEvents(
  events: NormalizedSessionEvent[],
  filters: SessionEventFilters,
): NormalizedSessionEvent[] {
  return events.filter(
    (event) =>
      (filters.category === 'all' || event.category === filters.category) &&
      (!filters.subjectId || event.subjectId === filters.subjectId) &&
      (!filters.sensorId || event.sensorId === filters.sensorId),
  );
}

export function safePayloadText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2) ?? String(payload);
  } catch {
    return String(payload);
  }
}
