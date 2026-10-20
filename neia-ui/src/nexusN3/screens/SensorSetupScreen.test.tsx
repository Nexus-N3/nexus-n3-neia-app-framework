import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreCapabilities } from '../../types';
import {
  serverReadyAtom,
  sessionStageAtom,
  subjectCountAtom,
  subjectPrefixAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';
import { SensorSetupScreen } from './SensorSetupScreen';

const capabilities: CoreCapabilities = {
  available: true,
  connection_state: 'connected',
  sensors: [
    {
      id: 'movella',
      display_name: 'Movella DOT',
      supported_locations: ['LEFT_ANKLE'],
      supported_algorithms: ['loading'],
      available: true,
    },
    {
      id: 'movesense',
      display_name: 'Movesense',
      supported_locations: ['CHEST'],
      supported_algorithms: ['heart_rate'],
      available: true,
    },
  ],
  algorithms: [
    {
      id: 'loading',
      display_name: 'Loading',
      compatible_sensor_types: ['movella'],
      result_stages: [],
      output_types: [],
      available: true,
    },
    {
      id: 'heart_rate',
      display_name: 'Heart rate',
      compatible_sensor_types: ['movesense'],
      result_stages: [],
      output_types: [],
      available: true,
    },
  ],
};

const core = vi.hoisted(() => ({
  value: {
    capabilities: null as CoreCapabilities | null,
    connection: { state: 'connected', available: true },
  },
}));

vi.mock('../../core/CoreProvider', () => ({
  useCore: () => core.value,
}));

const gateway = vi.hoisted(() => ({
  listeners: new Set<(message: Record<string, unknown>) => void>(),
  sendCommand: vi.fn(async (_command: { type: string; payload?: Record<string, unknown> }) => undefined),
}));

vi.mock('../hooks/useGatewaySocket', () => ({
  useGatewaySocket: () => ({
    sendCommand: gateway.sendCommand,
    subscribe: (listener: (message: Record<string, unknown>) => void) => {
      gateway.listeners.add(listener);
      return () => gateway.listeners.delete(listener);
    },
  }),
}));

vi.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({
    workflows: [],
    loading: false,
    saving: false,
    loadingWorkflow: false,
    error: null,
    refresh: vi.fn(),
    save: vi.fn(),
    load: vi.fn(),
  }),
}));

const renderScreen = (store = createStore()) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <SensorSetupScreen />
      </MemoryRouter>
    </Provider>,
  );

beforeEach(() => {
  gateway.listeners.clear();
  gateway.sendCommand.mockClear();
  core.value = {
    capabilities,
    connection: { state: 'connected', available: true },
  };
});

describe('SensorSetupScreen', () => {
  it.each([
    'System init failed: Failed to disconnect: AA:BB:CC:DD:EE:FF',
    'System init failed: Transport plugin failed: no response before timeout',
  ])('allows the user to dismiss %s while preserving the draft', async (message) => {
    const store = createStore();
    store.set(serverReadyAtom, true);
    store.set(subjectPrefixAtom, 'Subject_');
    store.set(subjectSensorRowsAtom, {
      Subject_1: [{ id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] }],
    });
    renderScreen(store);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create session' })));
    act(() => gateway.listeners.forEach((listener) => listener({ type: 'error', payload: message })));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clean up previous session' })).not.toBeInTheDocument();
    expect(gateway.sendCommand).toHaveBeenCalledTimes(1);
    expect(store.get(subjectSensorRowsAtom).Subject_1[0].sensorType).toBe('movella');
    expect(store.get(sessionStageAtom)).toBe('sensor_configuration');
    expect(screen.getByRole('button', { name: 'Create session' })).toBeEnabled();
  });

  it('keeps rows subject-owned and clears incompatible selections on type change', () => {
    const store = createStore();
    store.set(sessionStageAtom, 'sensor_configuration');
    store.set(serverReadyAtom, true);
    store.set(subjectCountAtom, 2);
    store.set(subjectPrefixAtom, 'Subject_');
    renderScreen(store);

    fireEvent.click(screen.getByRole('button', { name: 'Add sensor' }));
    fireEvent.change(screen.getByLabelText('Sensor type'), { target: { value: 'movella' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'LEFT_ANKLE' } });
    fireEvent.change(screen.getByLabelText('Algorithm'), { target: { value: 'loading' } });
    expect(screen.getByRole('button', { name: 'Create session' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Subject_2/ }));
    expect(screen.getByText('This subject has no sensors. Add a sensor to begin its configuration.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Subject_1/ }));
    fireEvent.change(screen.getByLabelText('Sensor type'), { target: { value: 'movesense' } });
    expect(screen.getByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Algorithm')).toHaveValue('');
    expect(store.get(subjectSensorRowsAtom).Subject_2).toEqual([]);
  });

  it('preserves and displays an existing draft while Core is disconnected', () => {
    core.value = {
      capabilities,
      connection: { state: 'disconnected', available: false },
    };
    const store = createStore();
    store.set(sessionStageAtom, 'sensor_configuration');
    store.set(serverReadyAtom, false);
    store.set(subjectPrefixAtom, 'Subject_');
    store.set(subjectSensorRowsAtom, {
      Subject_1: [{
        id: 'one',
        sensorType: 'movella',
        location: 'LEFT_ANKLE',
        algorithms: ['loading'],
      }],
    });
    renderScreen(store);

    expect(screen.getByLabelText('Sensor type')).toHaveValue('movella');
    expect(screen.getByLabelText('Location')).toHaveValue('LEFT_ANKLE');
    expect(screen.getByLabelText('Algorithm')).toHaveValue('loading');
    expect(screen.getByText(/Core is disconnected.*Editing remains available/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create session' })).toBeDisabled();
  });
});
