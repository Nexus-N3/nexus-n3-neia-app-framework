import { describe, expect, it } from 'vitest';
import {
  appendBoundedEvent,
  classifySessionEvent,
  filterSessionEvents,
  normalizeSessionEvent,
  safePayloadText,
} from './sessionEvents';

describe('session event normalization', () => {
  it('maps all five event categories', () => {
    expect(classifySessionEvent('system_initialized')).toBe('system');
    expect(classifySessionEvent('diagnostic_warning')).toBe('diagnostic');
    expect(classifySessionEvent('compute_result')).toBe('realtime');
    expect(classifySessionEvent('intermediate_result')).toBe('intermediate');
    expect(classifySessionEvent('consolidated_result')).toBe('consolidated');
  });

  it('normalizes identifiers and retains malformed payloads for display', () => {
    const event = normalizeSessionEvent({
      type: 'compute_result',
      payload: {
        subject_id: 'subject-1',
        location: 'LEFT_ANKLE',
        algorithm_name: 'standard_loading_intensity',
        result: { address: 'AA:BB' },
      },
    }, 4, new Date('2026-01-01T12:00:00Z'));

    expect(event.subjectId).toBe('subject-1');
    expect(event.sensorId).toBe('AA:BB');
    expect(event.algorithmName).toBe('standard_loading_intensity');
    expect(event.sequence).toBe(4);
    expect(safePayloadText('not-json')).toBe('not-json');
  });

  it('trims old events to the configured memory bound', () => {
    const events = [1, 2, 3].reduce(
      (current, sequence) =>
        appendBoundedEvent(
          current,
          normalizeSessionEvent({ type: 'system_event', payload: sequence }, sequence),
          2,
        ),
      [] as ReturnType<typeof normalizeSessionEvent>[],
    );

    expect(events.map((event) => event.sequence)).toEqual([2, 3]);
  });

  it('combines category, subject, and sensor filters', () => {
    const events = [
      normalizeSessionEvent({ type: 'compute_result', payload: { subject_id: 'one', address: 'A' } }, 1),
      normalizeSessionEvent({ type: 'compute_result', payload: { subject_id: 'two', address: 'B' } }, 2),
      normalizeSessionEvent({ type: 'diagnostic_event', payload: { subject_id: 'one', address: 'A' } }, 3),
    ];

    expect(filterSessionEvents(events, {
      category: 'realtime',
      subjectId: 'one',
      sensorId: 'A',
      placement: '',
    }).map((event) => event.sequence)).toEqual([1]);
  });
});
