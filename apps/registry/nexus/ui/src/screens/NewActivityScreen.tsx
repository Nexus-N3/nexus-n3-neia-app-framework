import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
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
    <main className="nexus-content">
      {/* Sub Header */}
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">ACTIVITY NAME</h2>
        <InfoButton />
      </div>

      <div className="form-container">
        {errorMsg && (
          <div className="error-banner" onClick={dismissError}>
            {errorMsg}
          </div>
        )}

        {/* Activity Name Input */}
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
         {/*} <div className="input-hint">Group names can be edited once created</div> */}
        </div>

        <div className="separator-line"></div>

        {/* Quick Selection */}
        <div>
          <h3 className="quick-selection-title">Quick selection</h3>
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
