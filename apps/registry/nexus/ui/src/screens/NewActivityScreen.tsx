import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';

export const NewActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activityName, setActivityName] = useState('');

  const quickSelections = ['Walking', 'Running', 'Jumping', 'Rowing'];

  const handleBack = () => {
    navigate('/active-session');
  };

  const handleStartActivity = () => {
    // Logic to start activity would go here
    console.log('Starting activity:', activityName || 'Activity_1');
    navigate('/activity');
  };

  return (
    <main className="nexus-content new-activity-content">
      {/* Sub Header */}
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">ACTIVITY NAME</h2>
        <InfoButton />
      </div>

      <div className="session-form-container">
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
          <div className="input-hint">Group names can be edited once created</div>
        </div>

        {/* Separator - kept custom as it's not in App.css */}
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '20px 0' }}></div>

        {/* Quick Selection */}
        <div>
          <h3 style={{ marginBottom: '20px' }}>Quick selection</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {quickSelections.map((selection) => (
              <div
                key={selection}
                className={`setup-item centered ${activityName === selection ? 'selected' : ''}`}
                onClick={() => setActivityName(selection)}
                style={{
                  padding: '10px 30px', // Adjusted to match button size better while keeping style
                }}
              >
                {selection}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Button */}
      <div className="screen-footer">
        <button className="nexus-btn continue-btn" onClick={handleStartActivity}>
          Start activity
        </button>
      </div>
    </main>
  );
};
