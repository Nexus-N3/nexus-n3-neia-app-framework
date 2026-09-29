import React, { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EventResultsPanel } from '../components/EventResultsPanel';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenLayout } from '../components/ScreenLayout';
import { StatusOverlay } from '../components/StatusOverlay';
import { useDisconnectSensorsCore } from '../hooks/useDisconnectSensorsCore';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';
import { useLatestIntermediateResults } from '../hooks/useLatestIntermediateResults';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { useStartStream } from '../hooks/useStartStream';
import { useStopStream } from '../hooks/useStopStream';
import {
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  computeResultsHistoryAtom,
  configuredSubjectsAtom,
  latestComputeResultsAtom,
  latestIntermediateComparisonsAtom,
  latestIntermediateResultsAtom,
  sessionEventsAtom,
  sessionStageAtom,
  selectedSubjectAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  subjectCountAtom,
  subjectPrefixAtom,
} from '../store/atoms';
import { buildWorkflowSubjects } from '../utils/subjects';
import { SaveWorkflowButton } from '../components/SaveWorkflowButton';

export const incrementActivityTag = (tag: string): string => {
  const trailingInteger = tag.match(/(\d+)$/);
  if (!trailingInteger) {
    return `${tag}_2`;
  }

  const digits = trailingInteger[1];
  const nextInteger = String(Number.parseInt(digits, 10) + 1).padStart(digits.length, '0');
  return `${tag.slice(0, -digits.length)}${nextInteger}`;
};

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
  const [sessionStage, setSessionStage] = useAtom(sessionStageAtom);
  const streamLifecycle = useAtomValue(streamLifecycleBySubjectAtom);
  const streamDrainState = useAtomValue(streamDrainStateAtom);
  const setSessionEvents = useSetAtom(sessionEventsAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const setLatestIntermediateResults = useSetAtom(latestIntermediateResultsAtom);
  const setLatestIntermediateComparisons = useSetAtom(latestIntermediateComparisonsAtom);
  const setComputeResultsHistory = useSetAtom(computeResultsHistoryAtom);
  const setStreamLifecycle = useSetAtom(streamLifecycleBySubjectAtom);
  const setStreamDrainState = useSetAtom(streamDrainStateAtom);
  const setActiveStreamTargetSubjectIds = useSetAtom(activeStreamTargetSubjectIdsAtom);
  const { latestResults } = useLatestComputeResults();
  const { latestIntermediateResults } = useLatestIntermediateResults();
  const { stopStreamForSubjects, isStopping, errorMsg: stopError, dismissError: dismissStopError } = useStopStream();
  const {
    disconnectAll,
    isDisconnecting,
    isDrainPending,
    errorMsg: disconnectError,
    dismissError: dismissDisconnectError,
  } = useDisconnectSensorsCore();
  const { resetSessionState } = useResetSessionState();
  const {
    startStreamForSubjects,
    isStarting,
    errorMsg: startError,
    dismissError: dismissStartError,
  } = useStartStream();
  const [ending, setEnding] = useState(false);

  const subjects = useMemo(
    () => buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject),
    [configuredSubjects, selectedSubject, subjectCount, subjectPrefix],
  );
  const completed = sessionStage === 'completed';

  useEffect(() => {
    if (completed && location.pathname !== '/completed') {
      navigate('/completed', { replace: true });
    }
  }, [completed, location.pathname, navigate]);

  const handleEndSession = async () => {
    if (isStopping || ending || completed) return;
    setEnding(true);
    try {
      await stopStreamForSubjects(subjects.map((subject) => subject.name));
    } catch {
      setEnding(false);
    }
  };

  const handleRepeatSession = async () => {
    if (!completed || isStarting || !activeActivity) return;

    const nextTag = incrementActivityTag(activeActivity);
    const subjectIds = subjects.map((subject) => subject.name);

    setSessionEvents([]);
    setLatestComputeResults({});
    setLatestIntermediateResults({});
    setLatestIntermediateComparisons({});
    setComputeResultsHistory({});
    setStreamLifecycle({});
    setStreamDrainState({
      pending: false,
      subjectIds: [],
      status: null,
      sessionArchiveExists: null,
    });
    setActiveStreamTargetSubjectIds([]);

    try {
      await startStreamForSubjects(nextTag, subjectIds);
      setActiveActivity(nextTag);
      setSessionStage('active');
      navigate('/active-session', { replace: true });
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  const handleReset = () => {
    resetSessionState();
    navigate('/', { replace: true });
  };

  return (
    <ScreenLayout className="screen-layout active-session-screen event-centred-session">
      {stopError ? <ErrorBanner message={stopError} onDismiss={dismissStopError} /> : null}
      {disconnectError ? <ErrorBanner message={disconnectError} onDismiss={dismissDisconnectError} /> : null}
      {startError ? <ErrorBanner message={startError} onDismiss={dismissStartError} /> : null}

      <ScreenHeader
        className="compact"
        left={!completed ? <BackButton onClick={() => navigate('/session')} /> : <span />}
        center={
          <div className="results-session-heading">
            <h2 className="screen-title">{completed ? 'COMPLETED RESULTS' : String(activeActivity || 'ACTIVE SESSION').toUpperCase()}</h2>
          </div>
        }
        right={""}
      />

      <div
        className="session-lifecycle-strip"
        aria-label="Subject stream lifecycle"
      >
        {subjects.map((subject) => {
          const state = streamLifecycle[subject.name];

          return (
            <div key={subject.name}>
              <strong>{subject.displayName}</strong>
              <span>
                {state?.statusMessage ??
                  (completed
                    ? 'Session complete'
                    : 'Waiting for stream status')}
              </span>
            </div>
          );
        })}

        {completed ? (
          <div className="session-lifecycle-save">
            <SaveWorkflowButton subjects={subjects} />
          </div>
        ) : null}
</div>

      <EventResultsPanel completed={completed} />

      {/*<details className="specialized-results">
        <summary>Specialized computation views</summary>
        <div className="specialized-results-grid">
          {subjects.map((subject) => {
            const realtime = Object.values(latestResults[subject.name] ?? {});
            const intermediate = Object.values(latestIntermediateResults[subject.name] ?? {});
            return (
              <article key={subject.name}>
                <h3>{subject.displayName}</h3>
                <p>{realtime.length} latest real-time result{realtime.length === 1 ? '' : 's'}</p>
                <p>{intermediate.length} latest intermediate result{intermediate.length === 1 ? '' : 's'}</p>
              </article>
            );
          })}
        </div>
      </details>*/}

      <div className="action-row event-results-actions">
        {completed ? (
          <>
            <button
              className="nexus-btn secondary-btn"
              onClick={() => disconnectAll()}
              disabled={isDisconnecting || isDrainPending}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect sensors'}
            </button>
            <button
              className="nexus-btn secondary-btn"
              onClick={handleRepeatSession}
              disabled={isStarting || !activeActivity}
            >
              {isStarting ? 'Starting repeat...' : 'Repeat session'}
            </button>
            <button className="nexus-btn" onClick={handleReset}>
              Start another session
            </button>
          </>
        ) : (
          <>
            <button
              className="nexus-btn secondary-btn"
              onClick={() => navigate('/assign-sensors')}
              disabled={isStopping}
            >
              Manage sensors
            </button>
            <div />
            <button
              className="nexus-btn nexus-btn-danger"
              onClick={handleEndSession}
              disabled={isStopping || ending}
            >
              {isStopping || ending ? 'Ending session...' : 'End session'}
            </button>
          </>
        )}
      </div>

      <StatusOverlay
        busy={isDisconnecting || isStarting || streamDrainState.pending || (ending && !completed)}
        statusText={
          isDisconnecting
            ? 'Disconnecting sensors...'
            : isStarting
              ? 'Starting repeat session...'
              : streamDrainState.pending || (ending && !completed)
                ? streamDrainState.status ?? 'Finalizing session results...'
                : null
        }
        errors={[disconnectError, startError]}
        onDismiss={disconnectError ? dismissDisconnectError : startError ? dismissStartError : undefined}
      />
    </ScreenLayout>
  );
};
