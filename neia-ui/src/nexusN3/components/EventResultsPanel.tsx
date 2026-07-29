import React, { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  EVENT_PRESENTATION,
  filterSessionEvents,
  safePayloadText,
  SESSION_EVENT_PAGE_SIZE,
  type SessionEventCategory,
  type SessionEventFilters,
} from '../sessionEvents';
import { sessionEventsAtom } from '../store/atoms';

const EMPTY_FILTERS: SessionEventFilters = {
  category: 'all',
  subjectId: '',
  sensorId: '',
};

export function EventResultsPanel({ completed }: { completed: boolean }) {
  const events = useAtomValue(sessionEventsAtom);
  const [filters, setFilters] = useState<SessionEventFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [olderPageAnchor, setOlderPageAnchor] = useState<number | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(events.flatMap((event) => event.subjectId ? [event.subjectId] : []))).sort(),
    [events],
  );
  const sensors = useMemo(
    () => Array.from(new Set(events.flatMap((event) => event.sensorId ? [event.sensorId] : []))).sort(),
    [events],
  );
  const filtered = useMemo(
    () => filterSessionEvents(events, filters),
    [events, filters],
  );
  const anchored = useMemo(
    () =>
      page > 0 && olderPageAnchor !== null
        ? filtered.filter((event) => event.sequence <= olderPageAnchor)
        : filtered,
    [filtered, olderPageAnchor, page],
  );
  const latestFirst = useMemo(
    () => [...anchored].sort((left, right) => right.sequence - left.sequence),
    [anchored],
  );
  const totalPages = Math.max(1, Math.ceil(latestFirst.length / SESSION_EVENT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleEvents = latestFirst.slice(
    safePage * SESSION_EVENT_PAGE_SIZE,
    (safePage + 1) * SESSION_EVENT_PAGE_SIZE,
  );
  const timelineEvents = [...anchored].sort((left, right) => left.sequence - right.sequence).slice(-120);
  const activeFilterCount =
    Number(filters.category !== 'all') + Number(Boolean(filters.subjectId)) + Number(Boolean(filters.sensorId));

  const updateFilters = (next: SessionEventFilters) => {
    setFilters(next);
    setPage(0);
    setOlderPageAnchor(null);
  };

  const goToPage = (nextPage: number) => {
    if (nextPage <= 0) {
      setPage(0);
      setOlderPageAnchor(null);
      return;
    }
    setOlderPageAnchor((current) =>
      current ?? (filtered.length > 0 ? Math.max(...filtered.map((event) => event.sequence)) : null),
    );
    setPage(nextPage);
  };

  return (
    <section className="event-results" aria-label={completed ? 'Completed session events' : 'Live session events'}>
      <div className="event-results-heading">
        <div>
          <span className="event-results-eyebrow">{completed ? 'Completed session' : 'Active session'}</span>
          <h2>Core event results</h2>
        </div>
        <span className="event-count">{filtered.length} event{filtered.length === 1 ? '' : 's'}</span>
      </div>

      <div className="event-timeline" aria-label="Filtered event timeline">
        {timelineEvents.length === 0 ? (
          <span className="event-timeline-empty">Waiting for events</span>
        ) : timelineEvents.map((event) => {
          const presentation = EVENT_PRESENTATION[event.category];
          return (
            <span
              key={event.id}
              className={`event-timeline-mark category-${event.category}`}
              style={{ backgroundColor: presentation.color }}
              title={`${presentation.label}: ${event.eventType}`}
              aria-label={`${presentation.label}: ${event.eventType}`}
            />
          );
        })}
      </div>

      <div className="event-filter-row">
        <label>
          <span>Event type</span>
          <select
            value={filters.category}
            onChange={(event) =>
              updateFilters({ ...filters, category: event.target.value as SessionEventCategory | 'all' })
            }
          >
            <option value="all">All event types</option>
            {Object.entries(EVENT_PRESENTATION).map(([category, metadata]) => (
              <option key={category} value={category}>{metadata.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select
            value={filters.subjectId}
            onChange={(event) => updateFilters({ ...filters, subjectId: event.target.value })}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
        </label>
        <label>
          <span>Sensor</span>
          <select
            value={filters.sensorId}
            onChange={(event) => updateFilters({ ...filters, sensorId: event.target.value })}
          >
            <option value="">All sensors</option>
            {sensors.map((sensor) => <option key={sensor} value={sensor}>{sensor}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="event-clear-filters"
          onClick={() => updateFilters(EMPTY_FILTERS)}
          disabled={activeFilterCount === 0}
        >
          Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      <div className="event-log-heading">
        <h3>Event log</h3>
        <nav className="event-pagination" aria-label="Event pages">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              type="button"
              key={index}
              className={safePage === index ? 'active' : ''}
              onClick={() => goToPage(index)}
              aria-label={`Event page ${index + 1}`}
              aria-current={safePage === index ? 'page' : undefined}
            >
              {index + 1}
            </button>
          ))}
        </nav>
      </div>

      <div className="event-log">
        {visibleEvents.length === 0 ? (
          <div className="event-log-empty">No events match the current filters.</div>
        ) : visibleEvents.map((event) => {
          const presentation = EVENT_PRESENTATION[event.category];
          return (
            <details className={`event-log-entry category-${event.category}`} key={event.id}>
              <summary>
                <time dateTime={event.timestamp}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </time>
                <span
                  className="event-category"
                  style={{ borderColor: presentation.color, color: presentation.color }}
                >
                  <b aria-hidden="true">{presentation.icon}</b>
                  {presentation.label}
                </span>
                <strong>{event.eventType}</strong>
                {event.subjectId ? <span>Subject: {event.subjectId}</span> : null}
                {event.sensorId ? <span>Sensor: {event.sensorId}</span> : null}
                <span className="event-summary">{event.summary}</span>
              </summary>
              <pre>{safePayloadText(event.payload)}</pre>
            </details>
          );
        })}
      </div>
    </section>
  );
}
