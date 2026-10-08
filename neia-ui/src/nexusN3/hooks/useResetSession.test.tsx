import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sessionNameAtom, streamDrainStateAtom } from '../store/atoms';
import { useResetSession } from './useResetSession';
import { SELECTED_SESSION_CONFIG_STORAGE_KEY } from '../utils/sessionConfigContext';

const gateway = vi.hoisted(() => ({
  listeners: new Set<(message: Record<string, unknown>) => void>(),
  sendCommand: vi.fn(async (_command: { type: string; payload: { correlation_id: string } }) => undefined),
}));
vi.mock('./useGatewaySocket', () => ({ useGatewaySocket: () => ({
  sendCommand: gateway.sendCommand,
  subscribe: (fn: (message: Record<string, unknown>) => void) => {
    gateway.listeners.add(fn);
    return () => gateway.listeners.delete(fn);
  },
}) }));
beforeEach(() => { gateway.listeners.clear(); gateway.sendCommand.mockReset(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });
const emit = (type: string, payload: Record<string, unknown>) =>
  act(() => gateway.listeners.forEach((fn) => fn({ type, payload })));
const setup = () => {
  const store = createStore();
  store.set(sessionNameAtom, 'Failed session');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}><MemoryRouter initialEntries={['/sensor-setup']}>{children}</MemoryRouter></Provider>
  );
  const hook = renderHook(() => ({ ...useResetSession(), path: useLocation().pathname }), { wrapper });
  return { ...hook, store };
};

it('requests cleanup with an empty UI connection list and resets only after all nodes reply', async () => {
  localStorage.setItem(SELECTED_SESSION_CONFIG_STORAGE_KEY, JSON.stringify({ session_config_id: 'old', name: 'Failed workflow' }));
  const { result, store } = setup();
  await act(() => result.current.reset());
  const { correlation_id } = gateway.sendCommand.mock.calls[0][0].payload;
  expect(gateway.sendCommand).toHaveBeenCalledWith({ type: 'disconnect_all', payload: { correlation_id } });
  emit('sensor_cleanup_started', { correlation_id, expected_node_ids: ['master', 'worker'] });
  emit('sensor_cleanup_complete', { correlation_id: 'stale', node_id: 'worker', expected_node_ids: ['master', 'worker'], results: [] });
  emit('sensor_disconnected', { disconnected_sensors: ['AA'] });
  emit('sensor_cleanup_complete', { correlation_id, node_id: 'master', expected_node_ids: ['master', 'worker'], results: [] });
  expect(result.current.isResetting).toBe(true);
  expect(result.current.path).toBe('/sensor-setup');
  expect(store.get(sessionNameAtom)).toBe('Failed session');
  await act(() => result.current.reset());
  expect(gateway.sendCommand).toHaveBeenCalledTimes(1);
  emit('sensor_cleanup_complete', { correlation_id, node_id: 'worker', expected_node_ids: ['master', 'worker'], results: [] });
  expect(result.current.isResetting).toBe(false);
  expect(result.current.path).toBe('/');
  expect(store.get(sessionNameAtom)).toBe('');
  expect(result.current.errorMsg).toBeNull();
  expect(localStorage.getItem(SELECTED_SESSION_CONFIG_STORAGE_KEY)).toBeNull();
});

it('starts over after unconfirmed cleanup and lets the user dismiss the warning', async () => {
  const { result, store } = setup();
  await act(() => result.current.reset());
  const { correlation_id } = gateway.sendCommand.mock.calls[0][0].payload;
  emit('sensor_cleanup_complete', { correlation_id, node_id: 'standalone', expected_node_ids: ['standalone'],
    results: [{ address: 'AA', status: 'unconfirmed', error: 'Transport plugin timeout' }] });
  expect(result.current.path).toBe('/');
  expect(store.get(sessionNameAtom)).toBe('');
  expect(result.current.errorMsg).toContain('Transport plugin timeout');
  act(() => result.current.dismissError());
  expect(result.current.errorMsg).toBeNull();
});

it('starts over with a visible warning when the gateway never replies', async () => {
  vi.useFakeTimers();
  const { result } = setup();
  await act(() => result.current.reset());
  act(() => vi.advanceTimersByTime(90_000));
  expect(result.current.isResetting).toBe(false);
  expect(result.current.path).toBe('/');
  expect(result.current.errorMsg).toContain('timed out');
});

it('starts over with a visible warning when sending cleanup fails', async () => {
  gateway.sendCommand.mockRejectedValueOnce(new Error('Network unavailable'));
  const { result } = setup();
  await act(() => result.current.reset());
  expect(result.current.isResetting).toBe(false);
  expect(result.current.path).toBe('/');
  expect(result.current.errorMsg).toContain('Failed to send');
});

it('does not reset while session finalization is pending', async () => {
  const { result, store } = setup();
  act(() => store.set(streamDrainStateAtom, { pending: true, subjectIds: ['Subject_1'], status: null, sessionArchiveExists: null }));
  await act(() => result.current.reset());
  expect(gateway.sendCommand).not.toHaveBeenCalled();
  expect(result.current.path).toBe('/sensor-setup');
});
