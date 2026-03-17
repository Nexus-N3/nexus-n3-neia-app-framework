import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { activeActivityAtom, latestComputeResultsAtom } from '../store/atoms';
import { useStartStream } from '../hooks/useStartStream';

export const NewActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activityName, setActivityName] = useState('');
  const setActiveActivity = useSetAtom(activeActivityAtom);
  const setLatestComputeResults = useSetAtom(latestComputeResultsAtom);
  const { startStreamForAll, isStarting, errorMsg, dismissError } = useStartStream();

  const quickSelections = ['Walking', 'Running', 'Jumping', 'Rowing'];

  const handleBack = () => {
    navigate('/active-session');
  };

  const handleStartActivity = async () => {
    const finalName = activityName || 'Activity_1';

    try {
      setLatestComputeResults({});
      await startStreamForAll(finalName);
      setActiveActivity(finalName);
      navigate('/active-session');
    } catch {
      // Error state is handled by the hook for UI display.
    }
  };

  return (
    <main className="nexus-content screen-layout new-activity-screen">
      {/* Sub Header */}
      <ScreenHeader
        left={<BackButton onClick={handleBack} />}
        center={<h2 className="screen-title">ACTIVITY</h2>}
        right={<InfoButton />}
      />

      <div className="form-container">
        {errorMsg && (
          <ErrorBanner message={errorMsg} onDismiss={dismissError} />
        )}

        <div>
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

      {/* Footer Button */}
      <div className="screen-footer">
        <button className="nexus-btn continue-btn" onClick={handleStartActivity} disabled={isStarting}>
          {isStarting ? 'Starting activity...' : 'Start activity'}
        </button>
      </div>
    </main>
  );
};
