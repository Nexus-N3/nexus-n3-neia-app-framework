import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusOverlay } from '../components/StatusOverlay';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import {
  subjectCountAtom,
  activeActivityAtom,
  selectedSubjectAtom,
  subjectPrefixAtom,
} from '../store/atoms';
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph'; // Added BarGraph
import { SegmentedControl } from '../components/SegmentedControl'; // Added SegmentedControl
import { useStopStream } from '../hooks/useStopStream';
import { useDisconnectSensorsCore } from '../hooks/useDisconnectSensorsCore';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';
import { useLatestIntermediateResults } from '../hooks/useLatestIntermediateResults';
import type { SubjectResultHistoryEntry } from '../store/atoms';
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

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
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
  const itemsPerPage = 1;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);
  
  // Local state for view mode (only relevant when active)
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const subjects = buildWorkflowSubjects(subjectCount, subjectPrefix, selectedSubject);

  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

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
      setActiveActivity(null);
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

  return (
    <ScreenLayout className="screen-layout active-session-screen">
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
          activeActivity ? (
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
          </div>
        );
        })}
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
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
      </div>

      <StatusOverlay
        busy={isDisconnecting}
        statusText={isDisconnecting ? 'Disconnecting sensors...' : disconnectError ? 'Disconnect failed' : null}
        errors={[disconnectError]}
        onDismiss={disconnectError ? dismissDisconnectError : undefined}
      />
    </ScreenLayout>
  );
};
