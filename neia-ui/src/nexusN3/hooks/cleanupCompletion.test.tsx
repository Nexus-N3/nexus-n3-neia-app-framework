import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { beforeEach, expect, it, vi } from 'vitest';
const gateway = vi.hoisted(() => ({ listeners: new Set<(message: Record<string, unknown>) => void>(), sendCommand: vi.fn(async (_command: object) => undefined) }));
vi.mock('./useGatewaySocket', () => ({ useGatewaySocket: () => ({
  subscribe: (fn: (message: Record<string, unknown>) => void) => { gateway.listeners.add(fn); return () => gateway.listeners.delete(fn); }, sendCommand: gateway.sendCommand,
}) }));
import { useDisconnectSensorsCore } from './useDisconnectSensorsCore';
import { useDiscoverSensorsCore } from './useDiscoverSensorsCore';
const emit = (type: string, payload: Record<string, unknown>) => act(() => gateway.listeners.forEach((fn) => fn({ type, payload })));
beforeEach(() => { gateway.listeners.clear(); gateway.sendCommand.mockClear(); });
const setup = () => {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useDisconnectSensorsCore(), { wrapper });
};
it('waits for every distributed participant, ignores link events, stale IDs and duplicate node replies', async () => {
  const { result } = setup();
  await act(() => result.current.disconnectAll());
  const correlation_id = (gateway.sendCommand.mock.calls[0][0] as { payload: { correlation_id: string } }).payload.correlation_id;
  emit('sensor_disconnected', { disconnected_sensors: ['DOT'] });
  emit('sensor_disconnected', {});
  expect(result.current.cleanupComplete).toBe(false);
  emit('sensor_cleanup_complete', { correlation_id: 'old', node_id: 'master', expected_node_ids: ['master'], results: [] });
  expect(result.current.isDisconnecting).toBe(true);
  const worker = { correlation_id, node_id: 'worker', expected_node_ids: ['master', 'worker'], results: [{ address: 'DOT', status: 'unconfirmed', error: 'Sensor unreachable' }] };
  emit('sensor_cleanup_complete', worker); emit('sensor_cleanup_complete', worker);
  expect(result.current.cleanupComplete).toBe(false);
  emit('sensor_cleanup_complete', { correlation_id, node_id: 'master', expected_node_ids: ['master', 'worker'], results: [{ address: 'OTHER', status: 'cleaned' }] });
  expect(result.current.cleanupComplete).toBe(true);
  expect(result.current.isDisconnecting).toBe(false);
  expect(result.current.cleanupResults).toHaveLength(2);
  expect(result.current.errorMsg).toContain('Sensor unreachable');
});
it('completes zero-connected cleanup only on a correlated result and preserves subject scope', async () => {
  const { result } = setup();
  await act(() => result.current.disconnectSubjects(['Subject_1']));
  expect(result.current.isDisconnecting).toBe(true);
  const command = gateway.sendCommand.mock.calls[0][0] as { type: string; payload: { subject_ids: string[]; correlation_id: string } };
  expect(command.type).toBe('disconnect_subjects');
  expect(command.payload.subject_ids).toEqual(['Subject_1']);
  emit('sensor_cleanup_complete', { correlation_id: command.payload.correlation_id, node_id: 'standalone', expected_node_ids: ['standalone'], results: [] });
  expect(result.current.cleanupComplete).toBe(true);
  expect(result.current.isDisconnecting).toBe(false);
});

it('bounds missing node completion, retains replied results and reports node IDs', async () => {
  vi.useFakeTimers();
  try {
    const { result, unmount } = setup();
    await act(() => result.current.disconnectAll());
    const correlation_id = (gateway.sendCommand.mock.calls[0][0] as { payload: { correlation_id: string } }).payload.correlation_id;
    emit('sensor_cleanup_started', { correlation_id, expected_node_ids: ['master', 'missing-worker'] });
    emit('sensor_cleanup_complete', { correlation_id, node_id: 'master', expected_node_ids: ['master', 'missing-worker'], results: [{ address: 'A', status: 'cleaned' }] });
    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.isDisconnecting).toBe(false);
    expect(result.current.cleanupComplete).toBe(true);
    expect(result.current.cleanupResults).toEqual([{ address: 'A', status: 'cleaned' }]);
    expect(result.current.errorMsg).toContain('missing-worker');
    act(() => result.current.dismissError());
    expect(result.current.cleanupSucceeded).toBe(false);
    emit('sensor_cleanup_complete', { correlation_id, node_id: 'missing-worker', expected_node_ids: ['master', 'missing-worker'], results: [] });
    expect(result.current.cleanupSucceeded).toBe(false);
    unmount();
  } finally { vi.useRealTimers(); }
});

it('bounds an operation even when no node ever acknowledges it', async () => {
  vi.useFakeTimers();
  try {
    const { result, unmount } = setup();
    await act(() => result.current.disconnectAll());
    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.isDisconnecting).toBe(false);
    expect(result.current.errorMsg).toContain('timed out');
    unmount();
  } finally { vi.useRealTimers(); }
});

it('does not start discovery when retry cleanup has a missing participant', () => {
  vi.useFakeTimers();
  try {
    const { result, unmount } = renderHook(() => useDiscoverSensorsCore());
    act(() => result.current.recoverAndConnectForSubject('Subject_1', []));
    const correlation_id = (gateway.sendCommand.mock.calls[0][0] as { payload: { correlation_id: string } }).payload.correlation_id;
    emit('sensor_cleanup_started', { correlation_id, expected_node_ids: ['missing-worker'] });
    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.phase).toBe('error');
    expect(result.current.errorMsg).toContain('missing-worker');
    expect(gateway.sendCommand).toHaveBeenCalledTimes(1);
    unmount();
  } finally { vi.useRealTimers(); }
});
