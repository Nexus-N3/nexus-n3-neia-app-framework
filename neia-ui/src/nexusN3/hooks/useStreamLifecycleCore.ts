import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useGatewaySocket } from './useGatewaySocket';
import {
  activeStreamTargetSubjectIdsAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  sessionStageAtom,
  type StreamLifecyclePhase,
  type SubjectStreamLifecycleState,
} from '../store/atoms';

type UnknownRecord = Record<string, unknown>;

const DEFAULT_GATE_SECONDS = 5;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const normalizeSubjectIds = (payload: unknown): string[] => {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.subject_ids)) {
    return payload.subject_ids.filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  if (Array.isArray(payload.subjects)) {
    return payload.subjects
      .filter(isRecord)
      .map((subject) => (typeof subject.subject_id === 'string' ? subject.subject_id : ''))
      .filter((subjectId): subjectId is string => subjectId.length > 0);
  }

  return [];
};

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const buildLifecycleState = (
  phase: StreamLifecyclePhase,
  previous: SubjectStreamLifecycleState | undefined,
  options: {
    attempt?: number;
    maxAttempts?: number;
    gateDurationSeconds?: number;
    statusMessage: string;
    reason?: string | null;
    isOfficial?: boolean;
    lastEventType: string;
    restartCountdown?: boolean;
  },
): SubjectStreamLifecycleState => ({
  phase,
  attempt: options.attempt ?? previous?.attempt ?? 0,
  maxAttempts: options.maxAttempts ?? previous?.maxAttempts ?? 2,
  countdownStartedAtMs: options.restartCountdown ? Date.now() : (previous?.countdownStartedAtMs ?? null),
  gateDurationSeconds: options.gateDurationSeconds ?? previous?.gateDurationSeconds ?? DEFAULT_GATE_SECONDS,
  statusMessage: options.statusMessage,
  reason: options.reason ?? null,
  isOfficial: options.isOfficial ?? previous?.isOfficial ?? false,
  lastEventType: options.lastEventType,
});

export const useStreamLifecycleCore = () => {
  const { subscribe } = useGatewaySocket();
  const setStreamLifecycleBySubject = useSetAtom(streamLifecycleBySubjectAtom);
  const setActiveStreamTargetSubjectIds = useSetAtom(activeStreamTargetSubjectIdsAtom);
  const setStreamDrainState = useSetAtom(streamDrainStateAtom);
  const setSessionStage = useSetAtom(sessionStageAtom);
  const activeStreamTargetSubjectIds = useAtomValue(activeStreamTargetSubjectIdsAtom);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      const eventType = typeof msg.type === 'string' ? msg.type : '';
      const reportedSubjectIds = normalizeSubjectIds(msg.payload);
      const subjectIds =
        reportedSubjectIds.length > 0 ? reportedSubjectIds : activeStreamTargetSubjectIds;
      if (msg.type === 'session_completed') {
        setStreamDrainState({
          pending: false,
          subjectIds,
          status: 'Session completion confirmed.',
          sessionArchiveExists: null,
        });
        setSessionStage('completed');
        return;
      }
      if (subjectIds.length === 0) {
        return;
      }

      if (msg.type === 'stream_started') {
        setStreamDrainState({
          pending: false,
          subjectIds: [],
          status: null,
          sessionArchiveExists: null,
        });
        setActiveStreamTargetSubjectIds(subjectIds);
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('starting', prev[subjectId], {
              statusMessage: 'Starting measurement',
              lastEventType: eventType,
              reason: null,
              isOfficial: false,
              restartCountdown: false,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_warmup_started') {
        setStreamDrainState({
          pending: false,
          subjectIds: [],
          status: null,
          sessionArchiveExists: null,
        });
        const payload = isRecord(msg.payload) ? msg.payload : {};
        const gateDurationSeconds = asNumber(payload.startup_total_gate_seconds, DEFAULT_GATE_SECONDS);
        const attempt = asNumber(payload.attempt, 1);
        const maxAttempts = asNumber(payload.max_attempts, 2);
        setActiveStreamTargetSubjectIds(subjectIds);
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('warming_up', prev[subjectId], {
              attempt,
              maxAttempts,
              gateDurationSeconds,
              statusMessage: 'Preparing sensors',
              reason: null,
              isOfficial: false,
              lastEventType: eventType,
              restartCountdown: true,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_startup_retry') {
        const payload = isRecord(msg.payload) ? msg.payload : {};
        const attempt = asNumber(payload.attempt, 1);
        const maxAttempts = asNumber(payload.max_attempts, 2);
        const reason = typeof payload.reason === 'string' ? payload.reason : null;
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('retrying', prev[subjectId], {
              attempt,
              maxAttempts,
              statusMessage: `Retrying start (${attempt}/${maxAttempts})`,
              reason,
              isOfficial: false,
              lastEventType: eventType,
              restartCountdown: false,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_official_started') {
        setStreamDrainState({
          pending: false,
          subjectIds: [],
          status: null,
          sessionArchiveExists: null,
        });
        const payload = isRecord(msg.payload) ? msg.payload : {};
        const attempt = asNumber(payload.attempt, 1);
        const maxAttempts = asNumber(payload.max_attempts, 2);
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('official_streaming', prev[subjectId], {
              attempt,
              maxAttempts,
              statusMessage: 'Official measurement started',
              reason: null,
              isOfficial: true,
              lastEventType: eventType,
              restartCountdown: false,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_startup_failed') {
        const payload = isRecord(msg.payload) ? msg.payload : {};
        const attempt = asNumber(payload.attempt, 1);
        const maxAttempts = asNumber(payload.max_attempts, 2);
        const reason = typeof payload.reason === 'string' ? payload.reason : 'Measurement start failed';
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('startup_failed', prev[subjectId], {
              attempt,
              maxAttempts,
              statusMessage: 'Failed to start measurement',
              reason,
              isOfficial: false,
              lastEventType: eventType,
              restartCountdown: false,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_stopped') {
        setStreamDrainState({
          pending: true,
          subjectIds,
          status: 'Finalizing session files...',
          sessionArchiveExists: null,
        });
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          subjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('draining', prev[subjectId], {
              statusMessage: 'Finalizing session files',
              reason: null,
              isOfficial: false,
              lastEventType: eventType,
              restartCountdown: false,
            });
          });
          return next;
        });
        return;
      }

      if (msg.type === 'stream_drained') {
        const payload = isRecord(msg.payload) ? msg.payload : {};
        const drainedSubjectIds = normalizeSubjectIds(payload).length > 0
          ? normalizeSubjectIds(payload)
          : subjectIds;
        const archiveExists =
          typeof payload.session_archive_exists === 'boolean' ? payload.session_archive_exists : null;
        setStreamDrainState({
          pending: false,
          subjectIds: drainedSubjectIds,
          status: archiveExists === false ? 'Session finalized without archive.' : 'Session finalization complete.',
          sessionArchiveExists: archiveExists,
        });
        setSessionStage('completed');
        if (drainedSubjectIds.length === 0) {
          return;
        }
        setStreamLifecycleBySubject((prev) => {
          const next = { ...prev };
          drainedSubjectIds.forEach((subjectId) => {
            next[subjectId] = buildLifecycleState('drained', prev[subjectId], {
              statusMessage: archiveExists === false ? 'Session finalized' : 'Session finalized and archived',
              reason: typeof payload.reason === 'string' ? payload.reason : null,
              isOfficial: false,
              lastEventType: eventType,
              restartCountdown: false,
            });
          });
          return next;
        });
      }
    });

    return unsubscribe;
  }, [activeStreamTargetSubjectIds, setActiveStreamTargetSubjectIds, setSessionStage, setStreamDrainState, setStreamLifecycleBySubject, subscribe]);
};
