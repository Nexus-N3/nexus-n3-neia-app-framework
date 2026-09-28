import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  computeResultsHistoryAtom,
  configuredSubjectsAtom,
  connectedSensorsAtom,
  discoveredSensorsAtom,
  latestComputeResultsAtom,
  latestIntermediateComparisonsAtom,
  latestIntermediateResultsAtom,
  placedSensorsAtom,
  sessionEventsAtom,
  sessionStageAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';
import { ActiveSessionScreen, incrementActivityTag } from './ActiveSessionScreen';

const gateway = vi.hoisted(() => ({
  sendCommand: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useGatewaySocket', () => ({
  useGatewaySocket: () => ({
    sendCommand: gateway.sendCommand,
    subscribe: () => () => undefined,
  }),
}));

vi.mock('../components/SaveWorkflowButton', () => ({
  SaveWorkflowButton: () => <button type="button">Save workflow</button>,
}));

describe('ActiveSessionScreen repeat session', () => {
  beforeEach(() => {
    gateway.sendCommand.mockClear();
  });

  it.each([
    ['Activity_1', 'Activity_2'],
    ['Run_01', 'Run_02'],
    ['Test-009', 'Test-010'],
    ['Walking', 'Walking_2'],
  ])('increments %s to %s', (currentTag, nextTag) => {
    expect(incrementActivityTag(currentTag)).toBe(nextTag);
  });

  it('starts connected subjects again while preserving configuration state', async () => {
    const store = createStore();
    const configuredSubjects = [
      { subject_id: 'subject-1', display_name: 'Subject One' },
      { subject_id: 'subject-2', display_name: 'Subject Two' },
    ];
    const connectedSensors = {
      'subject-1': [{ address: 'AA', status: 'connected', location: 'LEFT_ANKLE' }],
    };
    const discoveredSensors = { 'subject-1': ['AA'] };
    const placedSensors = new Set(['subject-1:sensor-1']);
    const subjectSensorRows = {
      'subject-1': [{ id: 'sensor-1', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] }],
    };

    store.set(sessionStageAtom, 'completed');
    store.set(activeActivityAtom, 'Run_01');
    store.set(configuredSubjectsAtom, configuredSubjects);
    store.set(connectedSensorsAtom, connectedSensors);
    store.set(discoveredSensorsAtom, discoveredSensors);
    store.set(placedSensorsAtom, placedSensors);
    store.set(subjectSensorRowsAtom, subjectSensorRows);
    store.set(sessionEventsAtom, [{
      id: 'event-1',
      sequence: 1,
      timestamp: new Date().toISOString(),
      category: 'system',
      eventType: 'completed',
      subjectId: null,
      sensorId: null,
      placement: null,
      algorithmName: null,
      summary: 'Complete',
      payload: {},
    }]);
    store.set(latestComputeResultsAtom, { 'subject-1': {} });
    store.set(latestIntermediateResultsAtom, { 'subject-1': {} });
    store.set(latestIntermediateComparisonsAtom, { 'subject-1': [{ pair: ['AA', 'BB'], data: {} }] });
    store.set(computeResultsHistoryAtom, { 'subject-1': [{ timestamp: 1, resultCount: 1, results: [] }] });
    store.set(streamLifecycleBySubjectAtom, {
      'subject-1': {
        phase: 'drained',
        attempt: 1,
        maxAttempts: 2,
        countdownStartedAtMs: null,
        gateDurationSeconds: 5,
        statusMessage: 'Session finalized and archived',
        reason: null,
        isOfficial: false,
        lastEventType: 'stream_drained',
      },
    });
    store.set(streamDrainStateAtom, {
      pending: false,
      subjectIds: ['subject-1', 'subject-2'],
      status: 'Session finalization complete.',
      sessionArchiveExists: true,
    });
    store.set(activeStreamTargetSubjectIdsAtom, ['subject-1', 'subject-2']);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/completed']}>
          <ActiveSessionScreen />
        </MemoryRouter>
      </Provider>,
    );

    const actionButtons = Array.from(document.querySelectorAll('.event-results-actions button'));
    expect(actionButtons.map((button) => button.textContent)).toEqual([
      'Disconnect sensors',
      'Repeat session',
      'Start another session',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Repeat session' }));

    await waitFor(() => expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'start_stream_for_subjects',
      payload: { tag: 'Run_02', subject_ids: ['subject-1', 'subject-2'] },
    }));
    await waitFor(() => expect(store.get(sessionStageAtom)).toBe('active'));

    expect(store.get(activeActivityAtom)).toBe('Run_02');
    expect(store.get(sessionEventsAtom)).toEqual([]);
    expect(store.get(latestComputeResultsAtom)).toEqual({});
    expect(store.get(latestIntermediateResultsAtom)).toEqual({});
    expect(store.get(latestIntermediateComparisonsAtom)).toEqual({});
    expect(store.get(computeResultsHistoryAtom)).toEqual({});
    expect(store.get(streamDrainStateAtom)).toEqual({
      pending: false,
      subjectIds: [],
      status: null,
      sessionArchiveExists: null,
    });
    expect(store.get(activeStreamTargetSubjectIdsAtom)).toEqual(['subject-1', 'subject-2']);
    expect(store.get(streamLifecycleBySubjectAtom)['subject-1'].phase).toBe('starting');

    expect(store.get(configuredSubjectsAtom)).toBe(configuredSubjects);
    expect(store.get(connectedSensorsAtom)).toBe(connectedSensors);
    expect(store.get(discoveredSensorsAtom)).toBe(discoveredSensors);
    expect(store.get(placedSensorsAtom)).toBe(placedSensors);
    expect(store.get(subjectSensorRowsAtom)).toBe(subjectSensorRows);
  });
});
