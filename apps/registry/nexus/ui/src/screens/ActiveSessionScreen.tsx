import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, activeActivityAtom, subjectPrefixAtom } from '../store/atoms'; // Added activeActivityAtom
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph'; // Added BarGraph
import { SegmentedControl } from '../components/SegmentedControl'; // Added SegmentedControl
import { useStartStream } from '../hooks/useStartStream';
import { useStopStream } from '../hooks/useStopStream';
import { useDisconnectSensors } from '../hooks/useDisconnectSensors';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';

const locationPriority = (location: string) => {
  const normalized = location.toUpperCase();
  if (normalized.includes('LEFT')) return 0;
  if (normalized.includes('RIGHT')) return 1;
  return 2;
};

const getIntensityValue = (bands: Array<{ bandName: string; mag: number | null }>) =>
  bands.find((band) => band.bandName === '0-6')?.mag ?? null;

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);
  const [stoppedSubjects, setStoppedSubjects] = useState<Set<string>>(new Set());
  const { startStreamForSubjects, isStarting, errorMsg: startError, dismissError: dismissStartError } = useStartStream();
  const { stopStreamForAll, stopStreamForSubjects, isStopping, errorMsg, dismissError } = useStopStream();
  const {
    disconnectAll,
    isDisconnecting,
    errorMsg: disconnectError,
    dismissError: dismissDisconnectError,
  } = useDisconnectSensors();
  const { resetSessionState } = useResetSessionState();
  const { latestResults } = useLatestComputeResults();

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);
  
  // Local state for view mode (only relevant when active)
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `${subjectPrefix}${i + 1}`,
  }));

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
      setStoppedSubjects(new Set(subjects.map((subject) => subject.name)));
      setActiveActivity(null);
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
        return next;
      });
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  const handleStartSubjectActivity = async (subjectId: string) => {
    const activityTag = typeof activeActivity === 'string' && activeActivity ? activeActivity : 'Activity_1';

    try {
      await startStreamForSubjects(activityTag, [subjectId]);
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
      await disconnectAll();
      resetSessionState();
      navigate('/');
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  return (
    <ScreenLayout className="screen-layout">
      {startError && (
        <div className="error-banner" onClick={dismissStartError}>
          {startError}
        </div>
      )}
      {errorMsg && (
        <div className="error-banner" onClick={dismissError}>
          {errorMsg}
        </div>
      )}
      {disconnectError && (
        <div className="error-banner" onClick={dismissDisconnectError}>
          {disconnectError}
        </div>
      )}

      {/* Header Row with Carousel */}
      <div className="sub-header-row relative compact">
        <div className="z-1">
          <BackButton onClick={handleBack} />
        </div>

        <div className="absolute-center">
          <SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />
        </div>

        <div className="z-1">
          {activeActivity ? (
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
          )}
        </div>
      </div>

      <div className="subjects-grid">
        {currentSubjects.map((subject) => {
          const subjectResults = Object.values(latestResults[subject.name] ?? {}).sort((a, b) =>
            locationPriority(a.location) - locationPriority(b.location),
          );
          const isSubjectStopped = stoppedSubjects.has(subject.name);
          const intensityRows = subjectResults.map((result) => ({
            location: result.location.replace(/_/g, ' '),
            value: getIntensityValue(result.bands),
          }));
          const hasIntensityData = intensityRows.some((result) => result.value !== null);
          const [leftResult, rightResult] = intensityRows;
          const maxIntensity = Math.max(...intensityRows.map((result) => result.value ?? 0), 1);
          const graphData =
            hasIntensityData
              ? [
                  {
                    l: `${(((leftResult?.value ?? 0) / maxIntensity) * 100).toFixed(0)}%`,
                    r: `${(((rightResult?.value ?? 0) / maxIntensity) * 100).toFixed(0)}%`,
                  },
                ]
              : [];

          return (
          <div key={subject.id} className="subject-card">
            <div className={`subject-card-content ${activeActivity ? 'with-graph' : ''}`}>
              <h3 className="subject-card-title">{subject.name}</h3>

              <div className="subject-intensity-panel">
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
            <div className="panel-action-row">
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

        <button className="nexus-btn secondary-btn" onClick={() => navigate('/assign-sensors')} disabled={isDisconnecting}>
          Manage sensors
        </button>
        
        {activeActivity ? (
          <button className="nexus-btn nexus-btn-danger" onClick={handleEndActivity} disabled={isStopping || isStarting}>
            {isStopping ? 'Ending activity...' : 'End activity'}
          </button>
        ) : (
          <button className="nexus-btn nexus-btn-success" onClick={() => navigate('/new-activity')}>
            Start new activity
          </button>
        )}
      </div>
    </ScreenLayout>
  );
};
