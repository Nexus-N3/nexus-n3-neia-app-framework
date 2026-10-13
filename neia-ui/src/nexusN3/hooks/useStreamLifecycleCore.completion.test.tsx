import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeStreamTargetSubjectIdsAtom, sessionStageAtom, streamDrainStateAtom } from '../store/atoms';
import { useStreamLifecycleCore } from './useStreamLifecycleCore';

const gateway = vi.hoisted(() => ({
  listeners: new Set<(message: Record<string, unknown>) => void>(),
  emit(message: Record<string, unknown>) {
    this.listeners.forEach(listener => listener(message));
  },
}));
vi.mock('./useGatewaySocket', () => ({
  useGatewaySocket: () => ({subscribe: (listener: (message: Record<string, unknown>) => void) => {
    gateway.listeners.add(listener);
    return () => gateway.listeners.delete(listener);
  }}),
}));
beforeEach(() => gateway.listeners.clear());

function mount(subjectIds: string[]) {
  const store = createStore();
  store.set(sessionStageAtom, 'active');
  store.set(activeStreamTargetSubjectIdsAtom, subjectIds);
  const Wrapper = ({children}: {children: React.ReactNode}) => <Provider store={store}>{children}</Provider>;
  renderHook(() => useStreamLifecycleCore(), {wrapper: Wrapper});
  act(() => gateway.emit({type: 'stream_stopped', payload: {subject_ids: subjectIds}}));
  return store;
}
const aggregate = (status = 'ok', allStreamsDrained = true) => ({
  type: 'stream_drained', node_id: 'master', payload: {
    stop_session_id: 'stop-1', aggregate: true, subject_ids: ['subject-a', 'subject-b'],
    expected_node_ids: ['master', 'worker-01'], status, all_streams_drained: allStreamsDrained,
  },
});

describe('End Session completion', () => {
  it.each([['master', 'worker-01'], ['worker-01', 'master']])(
    'waits for aggregate completion when %s drains before %s', (first, second) => {
      const store = mount(['subject-a', 'subject-b']);
      for (const node of [first, second]) {
        act(() => gateway.emit({type: 'stream_drained', node_id: node, payload: {
          stop_session_id: 'stop-1', subject_ids: [node === 'master' ? 'subject-a' : 'subject-b'],
          status: 'ok', all_local_streams_stopped: true,
        }}));
        expect(store.get(sessionStageAtom)).toBe('active');
        expect(store.get(streamDrainStateAtom).pending).toBe(true);
      }
      act(() => gateway.emit(aggregate()));
      expect(store.get(sessionStageAtom)).toBe('completed');
      expect(store.get(streamDrainStateAtom).pending).toBe(false);
      // A late node-local event must not overwrite aggregate completion state.
      act(() => gateway.emit({type: 'stream_drained', payload: {
        stop_session_id: 'stop-1', subject_ids: ['subject-a'], status: 'ok',
      }}));
      expect(store.get(streamDrainStateAtom).subjectIds).toEqual(['subject-a', 'subject-b']);
    },
  );

  it('does not complete when the aggregate STOP/finalization reports failure', () => {
    const store = mount(['subject-a', 'subject-b']);
    act(() => gateway.emit(aggregate('error')));
    expect(store.get(sessionStageAtom)).toBe('active');
    expect(store.get(streamDrainStateAtom).status).toBe('Session finalization failed.');
  });

  it('does not complete the session after an aggregate subject STOP with other streams active', () => {
    const store = mount(['subject-a', 'subject-b']);
    act(() => gateway.emit(aggregate('ok', false)));
    expect(store.get(sessionStageAtom)).toBe('active');
  });

  it('preserves standalone single-node completion', () => {
    const store = mount(['subject-a']);
    act(() => gateway.emit({type: 'stream_drained', payload: {
      subject_ids: ['subject-a'], status: 'ok', session_archive_exists: true,
    }}));
    expect(store.get(sessionStageAtom)).toBe('completed');
    expect(store.get(streamDrainStateAtom).pending).toBe(false);
  });

  it('waits for the aggregate result in distributed mode with one participating node', () => {
    const store = mount(['subject-a']);
    act(() => gateway.emit({type: 'stream_drained', payload: {
      stop_session_id: 'stop-1', subject_ids: ['subject-a'], status: 'ok',
    }}));
    expect(store.get(sessionStageAtom)).toBe('active');
    act(() => gateway.emit({type: 'stream_drained', node_id: 'master', payload: {
      stop_session_id: 'stop-1', aggregate: true, expected_node_ids: ['master'],
      subject_ids: ['subject-a'], status: 'ok', all_streams_drained: true,
    }}));
    expect(store.get(sessionStageAtom)).toBe('completed');
  });
});
