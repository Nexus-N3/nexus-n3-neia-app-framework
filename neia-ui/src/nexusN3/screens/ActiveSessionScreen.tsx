import React, { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
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
import { useStopStream } from '../hooks/useStopStream';
import {
  activeActivityAtom,
  configuredSubjectsAtom,
  sessionStageAtom,
  selectedSubjectAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  subjectCountAtom,
  subjectPrefixAtom,
} from '../store/atoms';
import { buildWorkflowSubjects } from '../utils/subjects';

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
  const [sessionStage] = useAtom(sessionStageAtom);
  const streamLifecycle = useAtomValue(streamLifecycleBySubjectAtom);
  const streamDrainState = useAtomValue(streamDrainStateAtom);
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
      setActiveActivity(false);
    } catch {
      setEnding(false);
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

      <ScreenHeader
        className="compact"
        left={!completed ? <BackButton onClick={() => navigate('/session')} /> : <span />}
        center={
          <div className="results-session-heading">
            <h2 className="screen-title">{completed ? 'COMPLETED RESULTS' : String(activeActivity || 'ACTIVE SESSION').toUpperCase()}</h2>
            <span>{completed ? 'Event history retained' : 'Receiving Core events'}</span>
          </div>
        }
        right={<InfoButton />}
      />

      <div className="session-lifecycle-strip" aria-label="Subject stream lifecycle">
        {subjects.map((subject) => {
          const state = streamLifecycle[subject.name];
          return (
            <div key={subject.name}>
              <strong>{subject.displayName}</strong>
              <span>{state?.statusMessage ?? (completed ? 'Session complete' : 'Waiting for stream status')}</span>
            </div>
          );
        })}
      </div>

      <EventResultsPanel completed={completed} />

      <details className="specialized-results">
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
      </details>

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
            <div />
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
        busy={isDisconnecting || streamDrainState.pending || (ending && !completed)}
        statusText={
          isDisconnecting
            ? 'Disconnecting sensors...'
            : streamDrainState.pending || (ending && !completed)
              ? streamDrainState.status ?? 'Finalizing session results...'
              : null
        }
        errors={[disconnectError]}
        onDismiss={disconnectError ? dismissDisconnectError : undefined}
      />
    </ScreenLayout>
  );
};
