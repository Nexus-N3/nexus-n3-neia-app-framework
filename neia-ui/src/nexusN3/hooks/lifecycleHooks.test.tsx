import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeStreamTargetSubjectIdsAtom,
  sessionEventsAtom,
  sessionStageAtom,
  streamDrainStateAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';

const gateway = vi.hoisted(() => {
  const listeners = new Set<(message: Record<string, unknown>) => void>();
  return {
    listeners,
    sendCommand: vi.fn(async () => undefined),
    emit(message: Record<string, unknown>) {
      listeners.forEach((listener) => listener(message));
    },
  };
});

vi.mock('./useGatewaySocket', () => ({
  useGatewaySocket: () => ({
    connected: true,
    sendCommand: gateway.sendCommand,
    subscribe: (listener: (message: Record<string, unknown>) => void) => {
      gateway.listeners.add(listener);
      return () => gateway.listeners.delete(listener);
    },
  }),
}));

import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';
import { useDiscoverSensorsCore } from './useDiscoverSensorsCore';
import { useIdentifySensor } from './useIdentifySensor';
import { useResetSessionState } from './useResetSessionState';
import { useStartStream } from './useStartStream';
import { useStopStream } from './useStopStream';
import { useStreamLifecycleCore } from './useStreamLifecycleCore';
import { useSystemInitialization } from './useSystemInitialization';

const wrapperFor = (store = createStore()) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, Wrapper };
};

beforeEach(() => {
  gateway.listeners.clear();
  gateway.sendCommand.mockClear();
});

describe('retained Core lifecycle hooks', () => {
  it('discovers and connects a selected subject', async () => {
    const { Wrapper } = wrapperFor();
    const { result } = renderHook(() => useDiscoverSensorsCore(), { wrapper: Wrapper });

    act(() => result.current.discoverAndConnectForSubject('subject-1'));
    expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'discover_sensors_for_subjects',
      payload: { subject_ids: ['subject-1'] },
    });

    act(() => gateway.emit({
      type: 'sensors_discovered_for_subject',
      payload: { subjects: [{ subject_id: 'subject-1', discovered_sensors: ['AA'] }] },
    }));
    await waitFor(() => expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'connect_subjects',
      payload: { subject_ids: ['subject-1'] },
    }));

    act(() => gateway.emit({
      type: 'sensor_connected',
      payload: { subjects: [{ subject_id: 'subject-1', connected_sensors: ['AA'] }] },
    }));
    expect(result.current.phase).toBe('done');
  });

  it('sends identify, start, stop, and initialization commands', async () => {
    const { Wrapper } = wrapperFor();
    const identify = renderHook(() => useIdentifySensor(), { wrapper: Wrapper });
    const start = renderHook(() => useStartStream(), { wrapper: Wrapper });
    const stop = renderHook(() => useStopStream(), { wrapper: Wrapper });
    const initialized = vi.fn();
    const initialize = renderHook(() => useSystemInitialization(initialized), { wrapper: Wrapper });

    await act(() => identify.result.current.identifySensor('subject-1', 'left ankle'));
    await act(() => start.result.current.startStreamForSubjects('walk', ['subject-1']));
    await act(() => stop.result.current.stopStreamForSubjects(['subject-1']));
    await act(() => initialize.result.current.initSystem({
      type: 'init_system',
      payload: {
        init_label: 'test',
        app_id: 'nexus',
        subjects: [],
      },
    }));
    act(() => gateway.emit({ type: 'system_initialized', payload: {} }));

    expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'identify_sensor',
      payload: { subject_id: 'subject-1', location: 'LEFT_ANKLE' },
    });
    expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'start_stream_for_subjects',
      payload: { tag: 'walk', subject_ids: ['subject-1'] },
    });
    expect(gateway.sendCommand).toHaveBeenCalledWith({
      type: 'stop_stream_for_subjects',
      payload: { subject_ids: ['subject-1'] },
    });
    expect(initialized).toHaveBeenCalledOnce();
  });

  it('tracks stop, drain, completion, and disconnect acknowledgements', async () => {
    const { store, Wrapper } = wrapperFor();
    store.set(activeStreamTargetSubjectIdsAtom, ['subject-1']);
    renderHook(() => useStreamLifecycleCore(), { wrapper: Wrapper });
    const disconnect = renderHook(() => useDisconnectSensorsCore(), { wrapper: Wrapper });

    act(() => gateway.emit({ type: 'stream_stopped', payload: { subject_ids: ['subject-1'] } }));
    expect(store.get(streamDrainStateAtom).pending).toBe(true);

    act(() => gateway.emit({
      type: 'stream_drained',
      payload: { subject_ids: ['subject-1'], session_archive_exists: true },
    }));
    expect(store.get(streamDrainStateAtom).pending).toBe(false);
    expect(store.get(sessionStageAtom)).toBe('completed');

    await act(() => disconnect.result.current.disconnectAll());
    expect(gateway.sendCommand).toHaveBeenCalledWith({ type: 'disconnect_all' });
    act(() => gateway.emit({ type: 'sensor_disconnected', payload: {} }));
    expect(disconnect.result.current.disconnectCount).toBe(1);
  });

  it('clears the workflow only on an explicit reset', () => {
    const { store, Wrapper } = wrapperFor();
    store.set(sessionStageAtom, 'sensor_configuration');
    store.set(subjectSensorRowsAtom, {
      'subject-1': [{ id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] }],
    });
    store.set(sessionEventsAtom, [{
      id: 'one',
      sequence: 1,
      timestamp: new Date().toISOString(),
      category: 'system',
      eventType: 'test',
      subjectId: null,
      sensorId: null,
      placement: null,
      summary: 'test',
      payload: {},
    }]);
    const { result } = renderHook(() => useResetSessionState(), { wrapper: Wrapper });

    act(() => result.current.resetSessionState());

    expect(store.get(sessionStageAtom)).toBe('idle');
    expect(store.get(subjectSensorRowsAtom)).toEqual({});
    expect(store.get(sessionEventsAtom)).toEqual([]);
  });
});
