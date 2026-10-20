import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectedSensorsAtom,
  serverReadyAtom,
  sessionStageAtom,
  subjectCountAtom,
  subjectPrefixAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';
import { SessionScreen } from './SessionScreen';

const gateway = vi.hoisted(() => {
  const listeners = new Set<(message: Record<string, unknown>) => void>();
  return {
    listeners,
    sendCommand: vi.fn(async (_command: { type: string; payload?: Record<string, unknown> }) => undefined),
    emit(message: Record<string, unknown>) {
      listeners.forEach((listener) => listener(message));
    },
  };
});

vi.mock('../hooks/useGatewaySocket', () => ({
  useGatewaySocket: () => ({
    connected: true,
    sendCommand: gateway.sendCommand,
    subscribe: (listener: (message: Record<string, unknown>) => void) => {
      gateway.listeners.add(listener);
      return () => gateway.listeners.delete(listener);
    },
  }),
}));

beforeEach(() => {
  gateway.listeners.clear();
  gateway.sendCommand.mockClear();
});

describe('SessionScreen sensor connection gating', () => {
  it('keeps a 2-of-4 subject on Connect and retries only that subject', () => {
    const store = createStore();
    store.set(serverReadyAtom, true);
    store.set(sessionStageAtom, 'sensor_discovery');
    store.set(subjectCountAtom, 1);
    store.set(subjectPrefixAtom, 'Subject_');
    store.set(subjectSensorRowsAtom, {
      Subject_1: [
        { id: 'one', sensorType: 'movella', location: 'ONE', algorithms: [] },
        { id: 'two', sensorType: 'movella', location: 'TWO', algorithms: [] },
        { id: 'three', sensorType: 'movella', location: 'THREE', algorithms: [] },
        { id: 'four', sensorType: 'movella', location: 'FOUR', algorithms: [] },
      ],
    });
    store.set(connectedSensorsAtom, {
      Subject_1: [
        { address: 'AA', status: 'CONNECTED', location: 'ONE' },
        { address: 'BB', status: 'CONNECTED', location: 'TWO' },
      ],
    });

    render(
      <Provider store={store}>
        <MemoryRouter>
          <SessionScreen />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Place sensors' })).not.toBeInTheDocument();
    expect(screen.getByText('2', { selector: '.stat-value' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Connect subject' }));
    expect(gateway.sendCommand).toHaveBeenLastCalledWith({
      type: 'disconnect_subjects',
      payload: { subject_ids: ['Subject_1'], correlation_id: expect.any(String) },
    });
    expect(screen.getByText('Disconnecting sensors...')).toBeVisible();
    expect(store.get(connectedSensorsAtom).Subject_1).toHaveLength(2);

    act(() => gateway.emit({
      type: 'sensor_cleanup_complete',
      payload: { correlation_id: gateway.sendCommand.mock.calls[0][0].payload!.correlation_id, node_id: 'standalone', expected_node_ids: ['standalone'], results: [{ address: 'AA', status: 'cleaned' }, { address: 'BB', status: 'cleaned' }] },
    }));
    expect(gateway.sendCommand).toHaveBeenLastCalledWith({
      type: 'discover_sensors_for_subjects',
      payload: { subject_ids: ['Subject_1'] },
    });
    expect(screen.getByText('Discovering sensors...')).toBeVisible();

    act(() => gateway.emit({
      type: 'sensors_discovered',
      payload: { subjects: [{ subject_id: 'Subject_1', discovered_sensors: ['AA', 'BB', 'CC', 'DD'] }] },
    }));
    expect(gateway.sendCommand).toHaveBeenLastCalledWith({
      type: 'connect_subjects',
      payload: { subject_ids: ['Subject_1'] },
    });
    expect(screen.getByText('Connecting sensors...')).toBeVisible();
  });
});


it.each(['cleaned', 'unconfirmed'])('explicit disconnect stays on the screen after %s completion', async (status) => {
  const store = createStore();
  store.set(serverReadyAtom, true);
  store.set(sessionStageAtom, 'sensor_discovery');
  store.set(subjectCountAtom, 1);
  function RouteProbe() { return <div data-testid="route">{useLocation().pathname}</div>; }
  render(<Provider store={store}><MemoryRouter initialEntries={['/session']}><SessionScreen /><RouteProbe /></MemoryRouter></Provider>);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Disconnect sensors' })));
  const correlation_id = gateway.sendCommand.mock.calls[0][0].payload!.correlation_id;
  act(() => gateway.emit({ type: 'sensor_cleanup_complete', payload: {
    correlation_id, node_id: 'standalone', expected_node_ids: ['standalone'],
    results: [{ address: 'A', status, ...(status === 'unconfirmed' ? { error: 'Sensor unreachable' } : {}) }],
  } }));
  expect(screen.getByTestId('route')).toHaveTextContent('/session');
  expect(store.get(sessionStageAtom)).toBe('sensor_discovery');
  if (status === 'unconfirmed') expect(screen.getByText(/Sensor unreachable/)).toBeVisible();
});
