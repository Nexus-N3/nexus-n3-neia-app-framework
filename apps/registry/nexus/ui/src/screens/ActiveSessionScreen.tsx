import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusOverlay } from '../components/StatusOverlay';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import {
  subjectCountAtom,
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  configuredSubjectsAtom,
  selectedSubjectAtom,
  subjectPrefixAtom,
  latestComputeResultsAtom,
  latestIntermediateResultsAtom,
  latestIntermediateComparisonsAtom,
  computeResultsHistoryAtom,
  streamDrainStateAtom,
  streamLifecycleBySubjectAtom,
  type SubjectStreamLifecycleState,
} from '../store/atoms';
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph'; // Added BarGraph
import { SegmentedControl } from '../components/SegmentedControl'; // Added SegmentedControl
import { useStartStream } from '../hooks/useStartStream';
import { useStopStream } from '../hooks/useStopStream';
import { useDisconnectSensorsCore } from '../hooks/useDisconnectSensorsCore';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';
import { useLatestIntermediateResults } from '../hooks/useLatestIntermediateResults';
import type { SubjectResultHistoryEntry } from '../store/atoms';
import { isCompactFlowViewport } from '../utils/displayProfiles';
import { buildWorkflowSubjects } from '../utils/subjects';

const locationPriority = (location: string) => {
  const normalized = location.toUpperCase();
  if (normalized.includes('LEFT')) return 0;
  if (normalized.includes('RIGHT')) return 1;
  return 2;
};

const getIntensityValue = (bands: Array<{ bandName: string; mag: number | null }>) =>
  bands.find((band) => band.bandName === '0-6')?.mag ?? null;

const buildSimpleGraphData = (
  intensityRows: Array<{ location: string; value: number | null }>,
  subjectHistory: SubjectResultHistoryEntry[],
) => {
  const latestEntry = subjectHistory[subjectHistory.length - 1];
  const previousEntry = subjectHistory[subjectHistory.length - 2];

  const buildPair = (rows: Array<{ location: string; value: number | null }>, maxIntensity: number, opacity?: number) => {
    const leftRow = rows.find((row) => locationPriority(row.location) === 0);
    const rightRow = rows.find((row) => locationPriority(row.location) === 1);

    return {
      l: `${((((leftRow?.value ?? 0) || 0) / maxIntensity) * 100).toFixed(0)}%`,
      r: `${((((rightRow?.value ?? 0) || 0) / maxIntensity) * 100).toFixed(0)}%`,
      ...(opacity !== undefined ? { opacity } : {}),
    };
  };

  if (!latestEntry) {
    return [];
  }

  const latestRows = latestEntry.results
    .map((result) => ({
      location: result.location.replace(/_/g, ' '),
      value: getIntensityValue(result.bands),
    }))
    .sort((a, b) => locationPriority(a.location) - locationPriority(b.location));

  const previousRows = previousEntry
    ? previousEntry.results
        .map((result) => ({
          location: result.location.replace(/_/g, ' '),
          value: getIntensityValue(result.bands),
        }))
        .sort((a, b) => locationPriority(a.location) - locationPriority(b.location))
    : [];

  const sourceRows = latestRows.length > 0 ? latestRows : intensityRows;
  const maxIntensity = Math.max(
    1,
    ...sourceRows.map((row) => row.value ?? 0),
    ...previousRows.map((row) => row.value ?? 0),
  );

  if (previousRows.length > 0) {
    return [
      buildPair(previousRows, maxIntensity, 0.5),
      buildPair(sourceRows, maxIntensity, 1),
    ];
  }

  return [buildPair(sourceRows, maxIntensity, 1)];
};

const getCountdownValue = (state: SubjectStreamLifecycleState | undefined, clockNow: number) => {
  if (!state?.countdownStartedAtMs) {
    return null;
  }

  const elapsedMs = Math.max(0, clockNow - state.countdownStartedAtMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remaining = state.gateDurationSeconds - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
};

const getStartupStatusText = (state: SubjectStreamLifecycleState | undefined, clockNow: number) => {
  if (!state) {
    return 'Waiting to start measurement';
  }

  if (state.phase === 'warming_up') {
    const countdown = getCountdownValue(state, clockNow);
    if (countdown === 0 && state.isOfficial) {
      return 'Official measurement started';
    }
    return `Preparing sensors${countdown !== null ? ` (${countdown}s)` : ''}`;
  }

  if (state.phase === 'official_streaming') {
    const countdown = getCountdownValue(state, clockNow);
    if (countdown !== null && countdown > 0) {
      return `Sensors ready${countdown !== null ? ` (${countdown}s)` : ''}`;
    }
    return 'Official measurement started';
  }

  if (state.phase === 'retrying') {
    return state.statusMessage;
  }

  if (state.phase === 'startup_failed') {
    return state.reason || state.statusMessage;
  }

  return state.statusMessage;
};

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
  const [activeStreamTargetSubjectIds] = useAtom(activeStreamTargetSubjectIdsAtom);
  const [streamLifecycleBySubject] = useAtom(streamLifecycleBySubjectAtom);
  const streamDrainState = useAtomValue(streamDrainStateAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const setLatestIntermediateResults = useSetAtom(latestIntermediateResultsAtom);
  const setLatestIntermediateComparisons = useSetAtom(latestIntermediateComparisonsAtom);
  const setComputeResultsHistory = useSetAtom(computeResultsHistoryAtom);
  const [stoppedSubjects, setStoppedSubjects] = useState<Set<string>>(new Set());
  const { startStreamForSubjects, isStarting, errorMsg: startError, dismissError: dismissStartError } = useStartStream();
  const { stopStreamForSubjects, isStopping, errorMsg, dismissError } = useStopStream();
  const {
    disconnectAll,
    disconnectCount,
    isDisconnecting,
    isDrainPending,
    errorMsg: disconnectError,
    dismissError: dismissDisconnectError,
  } = useDisconnectSensorsCore();
  const { resetSessionState } = useResetSessionState();
  const { latestResults, resultHistory } = useLatestComputeResults();
  const { latestIntermediateResults } = useLatestIntermediateResults();

  const [currentPage, setCurrentPage] = useState(0);
  const [disconnectRequested, setDisconnectRequested] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [officialAnnouncementVisible, setOfficialAnnouncementVisible] = useState(false);
  const isCompactViewport = isCompactFlowViewport();
  const itemsPerPage = isCompactViewport ? 1 : 4;
  
  // Local state for view mode (only relevant when active)
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const subjects = buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject);
  const allSubjectsStopped = subjects.length > 0 && subjects.every((subject) => stoppedSubjects.has(subject.name));
  const workflowSubjectIds = useMemo(() => subjects.map((subject) => subject.name), [subjects]);
  const targetSubjectIds = useMemo(
    () => activeStreamTargetSubjectIds.filter((subjectId) => workflowSubjectIds.includes(subjectId)),
    [activeStreamTargetSubjectIds, workflowSubjectIds],
  );
  const targetLifecycleStates = useMemo(
    () =>
      targetSubjectIds.map((subjectId) => ({
        subjectId,
        state: streamLifecycleBySubject[subjectId],
      })),
    [streamLifecycleBySubject, targetSubjectIds],
  );
  const allTargetCountdownsComplete =
    targetLifecycleStates.length > 0 &&
    targetLifecycleStates.every(({ state }) => {
      const countdown = getCountdownValue(state, clockNow);
      return countdown === null || countdown === 0;
    });
  const allTargetSubjectsOfficial =
    targetLifecycleStates.length > 0 &&
    targetLifecycleStates.every(({ state }) => state?.phase === 'official_streaming');
  const hasTargetStartupFailure = targetLifecycleStates.some(({ state }) => state?.phase === 'startup_failed');
  const startupGateActive =
    Boolean(activeActivity) &&
    targetLifecycleStates.length > 0 &&
    (!allTargetSubjectsOfficial || !allTargetCountdownsComplete) &&
    !hasTargetStartupFailure;
  const showStartupGateView = startupGateActive || officialAnnouncementVisible;
  const visibleSubjects = showStartupGateView
    ? subjects.filter((subject) => targetSubjectIds.includes(subject.name))
    : subjects;
  const totalPages = Math.max(1, Math.ceil(visibleSubjects.length / itemsPerPage));

  const currentSubjects = visibleSubjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleBack = () => {
    navigate('/session');
  };

  const handleEndActivity = async () => {
    if (allSubjectsStopped || isStopping || isStarting) {
      return;
    }

    const runningSubjectIds = subjects
      .filter((subject) => !stoppedSubjects.has(subject.name))
      .map((subject) => subject.name);

    if (runningSubjectIds.length === 0) {
      setActiveActivity(false);
      return;
    }

    try {
      await stopStreamForSubjects(runningSubjectIds);
      setStoppedSubjects(new Set(subjects.map((subject) => subject.name)));
      setActiveActivity(false);
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  const handleStopSubjectActivity = async (subjectId: string) => {
    try {
      await stopStreamForSubjects([subjectId]);
      setStoppedSubjects((prev) => {
        const next = new Set(prev);
        next.add(subjectId);
        if (next.size >= subjects.length) {
          setActiveActivity(false);
        }
        return next;
      });
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  const handleStartSubjectActivity = async (subjectId: string) => {
    const activityTag = typeof activeActivity === 'string' && activeActivity ? activeActivity : 'Activity_1';

    try {
      setLatestComputeResults((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
      setLatestIntermediateResults((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
      setLatestIntermediateComparisons((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
      setComputeResultsHistory((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });

      await startStreamForSubjects(activityTag, [subjectId]);
      setActiveActivity(activityTag);
      setStoppedSubjects((prev) => {
        const next = new Set(prev);
        next.delete(subjectId);
        return next;
      });
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  const handleDisconnectSensors = async () => {
    try {
      setDisconnectRequested(true);
      await disconnectAll();
    } catch {
      setDisconnectRequested(false);
      // Error state is handled by the hook for UI display.
    }
  };

  useEffect(() => {
    if (!disconnectRequested || disconnectCount === 0) {
      return;
    }

    resetSessionState();
    navigate('/');
  }, [disconnectCount, disconnectRequested, navigate, resetSessionState]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(totalPages - 1, 0)));
  }, [totalPages]);

  useEffect(() => {
    if (!startupGateActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startupGateActive]);

  useEffect(() => {
    if (!allTargetSubjectsOfficial || !allTargetCountdownsComplete) {
      setOfficialAnnouncementVisible(false);
      return;
    }

    setOfficialAnnouncementVisible(true);
    const timeoutId = window.setTimeout(() => {
      setOfficialAnnouncementVisible(false);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [allTargetCountdownsComplete, allTargetSubjectsOfficial]);

  useEffect(() => {
    if (!hasTargetStartupFailure || disconnectRequested || isDisconnecting) {
      return;
    }

    setDisconnectRequested(true);
    void disconnectAll().catch(() => {
      setDisconnectRequested(false);
    });
  }, [disconnectAll, disconnectRequested, hasTargetStartupFailure, isDisconnecting]);

  return (
    <ScreenLayout className="screen-layout active-session-screen">
      {startError && (
        <ErrorBanner message={startError} onDismiss={dismissStartError} />
      )}
      {errorMsg && (
        <ErrorBanner message={errorMsg} onDismiss={dismissError} />
      )}
      {disconnectError && (
        <ErrorBanner message={disconnectError} onDismiss={dismissDisconnectError} />
      )}

      <ScreenHeader
        className="relative compact"
        leftWrapperClassName="z-1"
        centerWrapperClassName="absolute-center"
        rightWrapperClassName="z-1"
        left={<BackButton onClick={handleBack} />}
        center={<SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />}
        right={
          activeActivity && !showStartupGateView ? (
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
              options={[
                { label: 'Real time', value: 'realtime' },
                { label: 'Periodic', value: 'periodic' },
              ]}
            />
          ) : (
            <InfoButton />
          )
        }
      />

      <div className="subjects-grid">
        {currentSubjects.map((subject) => {
          const subjectState = streamLifecycleBySubject[subject.name];
          const startupCountdown = getCountdownValue(subjectState, clockNow);
          const startupStatusText = officialAnnouncementVisible && subjectState?.phase === 'official_streaming'
            ? 'Official measurement started'
            : getStartupStatusText(subjectState, clockNow);

          if (showStartupGateView) {
            return (
              <div key={subject.id} className="subject-card active-session-card startup-gate-card">
                <div className={`subject-card-content startup-gate-card-content ${isCompactViewport ? 'compact' : ''}`}>
                  <div className="startup-gate-card-header">
                    <h3 className="subject-card-title">{subject.displayName}</h3>
                    <span className={`startup-phase-badge startup-phase-${subjectState?.phase ?? 'idle'}`}>
                      {subjectState?.phase === 'retrying'
                        ? `Attempt ${subjectState.attempt} of ${subjectState.maxAttempts}`
                        : subjectState?.phase === 'official_streaming'
                          ? 'Measurement live'
                          : `Attempt ${subjectState?.attempt ?? 1} of ${subjectState?.maxAttempts ?? 2}`}
                    </span>
                  </div>

                  <div className="startup-gate-body">
                    <div className="startup-countdown-panel">
                      <div className="startup-countdown-label">Startup gate</div>
                      <div className="startup-countdown-value">
                        {subjectState?.phase === 'warming_up' || subjectState?.phase === 'official_streaming'
                          ? startupCountdown ?? subjectState.gateDurationSeconds
                          : '--'}
                      </div>
                    </div>

                    <div className="startup-status-panel">
                      <div className="startup-status-title">Status</div>
                      <div className="startup-status-message">{startupStatusText}</div>
                      {subjectState?.reason ? <div className="startup-status-reason">{subjectState.reason}</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const resultSource = viewMode === 'periodic' ? latestIntermediateResults : latestResults;
          const subjectResults = Object.values(resultSource[subject.name] ?? {}).sort((a, b) =>
            locationPriority(a.location) - locationPriority(b.location),
          );
          const isSubjectStopped = stoppedSubjects.has(subject.name);
          const intensityRows = subjectResults.map((result) => ({
            location: result.location.replace(/_/g, ' '),
            value: getIntensityValue(result.bands),
          }));
          const hasIntensityData = intensityRows.some((result) => result.value !== null);
          const graphData =
            hasIntensityData
              ? viewMode === 'realtime'
                ? buildSimpleGraphData(intensityRows, resultHistory[subject.name] ?? [])
                : buildSimpleGraphData(intensityRows, [])
              : [];

          return (
          <div key={subject.id} className="subject-card active-session-card">
            {isCompactViewport ? (
              <div className="compact-active-session-card">
                <h3 className="subject-card-title">{subject.name}</h3>
                {hasIntensityData ? (
                  <div className="compact-active-session-body">
                    <div className="compact-intensity-values">
                      <div className="compact-intensity-title">INTENSITY</div>
                      <div className="compact-intensity-columns">
                        <div className="compact-intensity-labels">
                          {intensityRows.map((result) => (
                            <span key={`${subject.name}-${result.location}-label`} className="compact-intensity-location">
                              {result.location}
                            </span>
                          ))}
                        </div>
                        <div className="compact-intensity-metrics">
                          {intensityRows.map((result) => (
                            <span key={`${subject.name}-${result.location}-value`} className="compact-intensity-value">
                              {result.value !== null ? result.value.toFixed(4) : '-'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="compact-intensity-chart">
                      <BarGraph variant="simple" data={graphData} />
                    </div>
                  </div>
                ) : (
                  <div className="debug-empty-state subject-intensity-empty">Waiting for compute results...</div>
                )}
              </div>
            ) : (
              <div className={`subject-card-content active-session-card-content ${activeActivity ? 'with-graph' : ''}`}>
                <h3 className="subject-card-title">{subject.name}</h3>

                <div className="subject-intensity-panel active-session-intensity-panel">
                  {hasIntensityData ? (
                    <>
                      <div className="subject-intensity-values">
                        <div className="subject-intensity-title">INTENSITY</div>
                        <div className="subject-intensity-grid">
                          {intensityRows.map((result) => (
                            <div key={`${subject.name}-${result.location}`} className="subject-intensity-cell">
                              <span className="subject-intensity-location">{result.location}</span>
                              <span className="subject-intensity-value">
                                {result.value !== null ? result.value.toFixed(4) : '-'}
                              </span>
                            </div>
                          ))}
                          {intensityRows.length === 1 && <div className="subject-intensity-cell" />}
                        </div>
                      </div>
                      <div className="subject-intensity-graph">
                        <BarGraph variant="simple" data={graphData} />
                      </div>
                    </>
                  ) : (
                    <div className="debug-empty-state subject-intensity-empty">Waiting for compute results...</div>
                  )}
                </div>
              </div>
            )}
            {!isCompactViewport && (
            <div className="panel-action-row active-session-card-actions">
              <button
                className={`panel-action-btn ${isSubjectStopped ? 'success' : 'danger'} split-left`}
                onClick={() => (isSubjectStopped ? handleStartSubjectActivity(subject.name) : handleStopSubjectActivity(subject.name))}
                disabled={isStopping || isStarting}
              >
                {isSubjectStopped ? 'Start activity' : 'End activity'}
              </button>
              <button
                className="panel-action-btn primary split-right"
                onClick={() => navigate(`/activity/subject/${subject.id}`)}
                disabled={isStopping || isStarting}
              >
                View details
              </button>
            </div>
            )}
          </div>
        );
        })}
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        {showStartupGateView ? (
          <>
            <div></div>
            <button className="nexus-btn secondary-btn" onClick={() => navigate('/assign-sensors')} disabled={isDisconnecting || isStarting}>
              Manage sensors
            </button>
            <button className="nexus-btn" disabled>
              {hasTargetStartupFailure ? 'Disconnecting...' : 'Starting activity...'}
            </button>
          </>
        ) : (
          <>
            {allSubjectsStopped ? (
              <button className="nexus-btn disconnect-btn" onClick={handleDisconnectSensors} disabled={isDisconnecting || isDrainPending}>
                {isDisconnecting ? 'Disconnecting sensors...' : isDrainPending ? 'Finalizing session...' : 'Disconnect sensors'}
              </button>
            ) : (
              <div></div>
            )}

            <button className="nexus-btn secondary-btn" onClick={() => navigate('/assign-sensors')} disabled={isDisconnecting}>
              Manage sensors
            </button>

            {!allSubjectsStopped ? (
              <button className="nexus-btn nexus-btn-danger" onClick={handleEndActivity} disabled={isStopping || isStarting}>
                {isStopping ? 'Ending activity...' : 'End activity'}
              </button>
            ) : (
              <button className="nexus-btn nexus-btn-success" onClick={() => navigate('/new-activity')}>
                Start new activity
              </button>
            )}
          </>
        )}
      </div>

      <StatusOverlay
        busy={isDisconnecting || streamDrainState.pending}
        statusText={
          isDisconnecting
            ? 'Disconnecting sensors...'
            : streamDrainState.pending
              ? streamDrainState.status ?? 'Finalizing session files...'
            : hasTargetStartupFailure
              ? 'Startup failed'
              : disconnectError
                ? 'Disconnect failed'
                : null
        }
        errors={[disconnectError]}
        onDismiss={disconnectError ? dismissDisconnectError : undefined}
      />
    </ScreenLayout>
  );
};
