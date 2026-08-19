import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenLayout } from '../components/ScreenLayout';
import { activeActivityAtom, configuredSubjectsAtom, latestComputeResultsAtom, selectedSubjectAtom, sessionStageAtom, subjectCountAtom, subjectPrefixAtom } from '../store/atoms';
import { useStartStream } from '../hooks/useStartStream';
import { isCompactFlowViewport } from '../utils/displayProfiles';
import { buildWorkflowSubjects } from '../utils/subjects';

export const NewActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activityName, setActivityName] = useState('');
  const setActiveActivity = useSetAtom(activeActivityAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const setSessionStage = useSetAtom(sessionStageAtom);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const { startStreamForAll, isStarting, errorMsg, dismissError } = useStartStream();
  const isCompactViewport = isCompactFlowViewport();

  const quickSelections = ['Walking', 'Running', 'Jumping', 'Rowing'];
  const workflowSubjects = useMemo(
    () => buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject),
    [configuredSubjects, selectedSubject, subjectCount, subjectPrefix],
  );

  const handleBack = () => {
    navigate('/active-session');
  };

  const handleStartActivity = async () => {
    const finalName = activityName || 'Activity_1';

    try {
      setLatestComputeResults({});
      await startStreamForAll(
        finalName,
        workflowSubjects.map((subject) => subject.name),
      );
      setActiveActivity(finalName);
      setSessionStage('active');
      navigate('/active-session');
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  return (
    <ScreenLayout
      className="screen-layout new-activity-screen"
      header={
        <ScreenHeader
          left={<BackButton onClick={handleBack} />}
          center={<h2 className="screen-title">{isCompactViewport ? 'ACTIVITY' : 'ACTIVITY NAME'}</h2>}
          right={""}
        />
      }
      footer={
        <div className="screen-footer">
          <button className="nexus-btn continue-btn" onClick={handleStartActivity} disabled={isStarting}>
            {isStarting ? 'Starting activity...' : 'Start activity'}
          </button>
        </div>
      }
    >
      <div className="form-container">
        {errorMsg && (
          <ErrorBanner message={errorMsg} onDismiss={dismissError} />
        )}

        {!isCompactViewport && (
          <>
            <div className="form-group">
              <label htmlFor="activity-name">Activity name</label>
              <input
                id="activity-name"
                type="text"
                className="nexus-input"
                placeholder="(Default) Activity_1"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
              />
            </div>

            <div className="separator-line"></div>
          </>
        )}

        {/* Quick Selection */}
        <div className="quick-selection-section">
          <h3 className="quick-selection-title">Quick select</h3>
          <div className="quick-selection-container">
            {quickSelections.map((selection) => (
              <div
                key={selection}
                className={`setup-item centered ${activityName === selection ? 'selected' : ''}`}
                onClick={() => setActivityName(selection)}
              >
                {selection}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
};
