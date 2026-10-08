import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ConfigBootstrapScreen } from './ConfigBootstrapScreen';
import { SELECTED_SESSION_CONFIG_STORAGE_KEY } from '../utils/sessionConfigContext';
import { sessionStageAtom } from '../store/atoms';

const gateway = vi.hoisted(() => ({
  listeners: new Set<(message: Record<string, unknown>) => void>(),
  sendCommand: vi.fn(async (_command: object) => undefined),
}));
vi.mock('../hooks/useGatewaySocket', () => ({ useGatewaySocket: () => ({
  sendCommand: gateway.sendCommand,
  subscribe: (fn: (message: Record<string, unknown>) => void) => {
    gateway.listeners.add(fn);
    return () => gateway.listeners.delete(fn);
  },
}) }));
beforeEach(() => { gateway.listeners.clear(); gateway.sendCommand.mockClear(); localStorage.clear(); });

it('lets the user clear a workflow initialization timeout overlay without restarting initialization', async () => {
  localStorage.setItem(SELECTED_SESSION_CONFIG_STORAGE_KEY, JSON.stringify({
    session_config_id: 'workflow', name: 'Failed workflow', init_payload: { subjects: [] },
  }));
  const store = createStore();
  await act(async () => {
    render(<Provider store={store}><MemoryRouter><ConfigBootstrapScreen /></MemoryRouter></Provider>);
  });
  act(() => gateway.listeners.forEach((fn) => fn({
    type: 'error', payload: 'System init failed: Transport plugin failed: no response before timeout',
  })));
  expect(screen.getByText(/Transport plugin failed/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
  expect(screen.queryByText(/Transport plugin failed/)).not.toBeInTheDocument();
  expect(gateway.sendCommand).toHaveBeenCalledTimes(1);
  expect(store.get(sessionStageAtom)).toBe('sensor_configuration');
});
