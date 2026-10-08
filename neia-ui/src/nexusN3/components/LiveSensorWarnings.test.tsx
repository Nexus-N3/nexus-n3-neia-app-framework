import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeStreamTargetSubjectIdsAtom, configuredSubjectsAtom, connectedSensorsAtom, streamLifecycleBySubjectAtom, sessionEventsAtom } from '../store/atoms';
const gateway = vi.hoisted(() => ({ listeners: new Set<(message: Record<string, unknown>) => void>(), sendCommand: vi.fn() }));
vi.mock('../hooks/useGatewaySocket', () => ({ useGatewaySocket: () => ({
  subscribe: (fn: (message: Record<string, unknown>) => void) => { gateway.listeners.add(fn); return () => gateway.listeners.delete(fn); },
  sendCommand: gateway.sendCommand,
}) }));
import { LiveSensorWarnings } from './LiveSensorWarnings';
const lost = { type: 'sensor_disconnected', payload: {
  unexpected: true, session_timestamp: 'session-1', lost_at: '2026-10-08T10:27:03+03:00',
  sensors: [{ subject_id: 'Subject_1', address: 'DOT', name: 'Movella DOT', location: 'RIGHT_ANKLE' }],
} };
const emit = (event = lost) => act(() => { gateway.listeners.forEach((fn) => fn(event)); });
function setup(suppressed = false, phase = 'official_streaming') {
  const store = createStore();
  store.set(activeStreamTargetSubjectIdsAtom, ['Subject_1']);
  store.set(configuredSubjectsAtom, [{ subject_id: 'Subject_1', display_name: 'Subject 1' }]);
  store.set(streamLifecycleBySubjectAtom, { Subject_1: { phase } } as never);
  store.set(connectedSensorsAtom, { Subject_1: [{ address: 'DOT', status: 'CONNECTED', location: 'RIGHT_ANKLE' }] });
  const view = render(<Provider store={store}><LiveSensorWarnings suppressed={suppressed} /></Provider>);
  return { store, view };
}
beforeEach(() => { gateway.listeners.clear(); gateway.sendCommand.mockClear(); });
describe('live Event Log lost sensor warning', () => {
  it('persists, deduplicates, and acknowledges without changing sensor state', () => {
    const { store } = setup();
    const sensors = store.get(connectedSensorsAtom);
    emit(); emit();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText(/Subject 1 — Right Ankle/)).toBeVisible();
    expect(screen.getByText(/Movella DOT/)).toBeVisible();
    const expectedTime = new Date(lost.payload.lost_at).toLocaleTimeString(undefined, { hour12: false });
    expect(screen.getByText(`Lost at ${expectedTime}`)).toBeVisible();
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    vi.useRealTimers();
    act(() => store.set(sessionEventsAtom, []));
    expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss warning/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    emit();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(store.get(connectedSensorsAtom)).toBe(sensors);
    expect(gateway.sendCommand).not.toHaveBeenCalled();
  });
  it.each(['stopping', 'draining', 'stopped', 'idle'])('does not warn after official acquisition: %s', (phase) => {
    setup(false, phase); emit(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('suppresses Stop, explicit Disconnect, and teardown', () => {
    setup(true); emit(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('rejects expected disconnect and unassigned sensors', () => {
    setup();
    emit({ ...lost, payload: { ...lost.payload, unexpected: false } });
    emit({ ...lost, payload: { ...lost.payload, sensors: [{ ...lost.payload.sensors[0], subject_id: 'Other' }] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
