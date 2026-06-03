import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusOverlay } from '../components/StatusOverlay';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import {
  activeActivityAtom,
  activeStreamTargetSubjectIdsAtom,
  selectedSubjectAtom,
  streamLifecycleBySubjectAtom,
  subjectCountAtom,
  subjectPrefixAtom,
  type SubjectResultHistoryEntry,
  type SubjectStreamLifecycleState,
} from '../store/atoms';
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph';
import { SegmentedControl } from '../components/SegmentedControl';
import { useStopStream } from '../hooks/useStopStream';
import { useDisconnectSensorsCore } from '../hooks/useDisconnectSensorsCore';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';
import { useLatestIntermediateResults } from '../hooks/useLatestIntermediateResults';
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
  const elapsedSeconds = Math.floor((clockNow - state.countdownStartedAtMs) / 1000);
  const remaining = state.gateDurationSeconds - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
};

const getStartupStatusText = (state: SubjectStreamLifecycleState | undefined, clockNow: number) => {
  if (!state) {
    return 'Waiting to start measurement';
  }

  if (state.phase === 'warming_up') {
    const countdown = getCountdownValue(state, clockNow);
    return `Preparing sensors${countdown !== null ? ` (${countdown}s)` : ''}`;
  }

  if (state.phase === 'official_streaming') {
    const countdown = getCountdownValue(state, clockNow);
    if (countdown !== null && countdown > 0) {
      return `Sensors ready (${countdown}s)`;
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
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
  const [activeStreamTargetSubjectIds] = useAtom(activeStreamTargetSubjectIdsAtom);
  const [streamLifecycleBySubject] = useAtom(streamLifecycleBySubjectAtom);
  const { stopStreamForAll, isStopping, errorMsg, dismissError } = useStopStream();
  const {
    disconnectAll,
    disconnectCount,
    isDisconnecting,
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
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const subjects = buildWorkflowSubjects(subjectCount, subjectPrefix, selectedSubject);
  const targetSubjectIds = useMemo(
    () => activeStreamTargetSubjectIds.filter((subjectId) => subjects.some((subject) => subject.name === subjectId)),
    [activeStreamTargetSubjectIds, subjects],
  );
  const targetLifecycleStates = useMemo(
    () =>
      targetSubjectIds.map((subjectId) => ({
        subjectId,
        state: streamLifecycleBySubject[subjectId],
      })),
    [streamLifecycleBySubject, targetSubjectIds],
  );
  const allTargetSubjectsOfficial =
    targetLifecycleStates.length > 0 &&
    targetLifecycleStates.every(({ state }) => state?.phase === 'official_streaming');
  const allTargetCountdownsComplete =
    targetLifecycleStates.length > 0 &&
    targetLifecycleStates.every(({ state }) => {
      const countdown = getCountdownValue(state, clockNow);
      return countdown === null || countdown === 0;
    });
  const hasTargetStartupFailure = targetLifecycleStates.some(({ state }) => state?.phase === 'startup_failed');
  const showStartupGateView =
    Boolean(activeActivity) &&
    targetLifecycleStates.length > 0 &&
    ((!allTargetSubjectsOfficial || !allTargetCountdownsComplete) || officialAnnouncementVisible) &&
    !hasTargetStartupFailure;

  const visibleSubjects = showStartupGateView
    ? subjects.filter((subject) => targetSubjectIds.includes(subject.name))
    : subjects;
  const totalPages = Math.max(1, visibleSubjects.length);
  const currentSubjects = visibleSubjects.slice(currentPage, currentPage + 1);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(totalPages - 1, 0)));
  }, [totalPages]);

  useEffect(() => {
    if (!disconnectRequested || disconnectCount === 0) {
      return;
    }
    resetSessionState();
    navigate('/');
  }, [disconnectCount, disconnectRequested, navigate, resetSessionState]);

  useEffect(() => {
    if (!showStartupGateView) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [showStartupGateView]);

  useEffect(() => {
    if (!allTargetSubjectsOfficial || !allTargetCountdownsComplete) {
      setOfficialAnnouncementVisible(false);
      return;
    }
    setOfficialAnnouncementVisible(true);
    const timeoutId = window.setTimeout(() => {
      setOfficialAnnouncementVisible(false);
    }, 1000);
    return () => window.clearTimeout(timeoutId);
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
    try {
      await stopStreamForAll();
      setActiveActivity(false);
    } catch {
      // Error state is handled by the hook.
    }
  };

  const handleDisconnectSensors = async () => {
    try {
      setDisconnectRequested(true);
      await disconnectAll();
    } catch {
      setDisconnectRequested(false);
    }
  };

  return (
    <ScreenLayout className="screen-layout active-session-screen">
      {errorMsg ? <ErrorBanner message={errorMsg} onDismiss={dismissError} /> : null}
      {disconnectError ? <ErrorBanner message={disconnectError} onDismiss={dismissDisconnectError} /> : null}

      <ScreenHeader
        className="relative compact"
        leftWrapperClassName="z-1"
        centerWrapperClassName="absolute-center"
        rightWrapperClassName="z-1"
        left={<BackButton onClick={handleBack} />}
        center={<SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} title={currentSubjects[0]?.displayName ?? 'Subject'} />}
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
          const startupStatusText =
            officialAnnouncementVisible && subjectState?.phase === 'official_streaming'
              ? 'Official measurement started'
              : getStartupStatusText(subjectState, clockNow);

          if (showStartupGateView) {
            return (
              <div key={subject.id} className="subject-card active-session-card startup-gate-card">
                <div className="subject-card-content startup-gate-card-content compact">
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
              <div className="compact-active-session-card">
                <h3 className="subject-card-title">{subject.displayName}</h3>
                {hasIntensityData ? (
                  <div className="compact-active-session-body">
                    <div className="compact-intensity-values">
                      <div className="compact-intensity-title">Intensity</div>
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
                  <div className="debug-empty-state subject-intensity-empty">Waiting for results...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="action-row">
        {showStartupGateView ? (
          <>
            <div></div>
            <button className="nexus-btn" disabled>
              {hasTargetStartupFailure ? 'Disconnecting...' : 'Starting activity...'}
            </button>
          </>
        ) : (
          <>
            {!activeActivity ? (
              <button className="nexus-btn disconnect-btn" onClick={handleDisconnectSensors} disabled={isDisconnecting}>
                {isDisconnecting ? 'Disconnecting sensors...' : 'Disconnect sensors'}
              </button>
            ) : (
              <div></div>
            )}

            {activeActivity ? (
              <button className="nexus-btn nexus-btn-danger" onClick={handleEndActivity} disabled={isStopping}>
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
        busy={isDisconnecting}
        statusText={
          isDisconnecting
            ? 'Disconnecting sensors...'
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
