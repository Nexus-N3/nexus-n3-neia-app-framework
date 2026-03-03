import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { sessionNameAtom } from '../store/atoms';

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
    <main className="nexus-content new-activity-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub Header */}
      <div className="sub-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />
        <h2 className="screen-title" style={{ margin: 0, fontSize: '24px' }}>
          ACTIVITY NAME
        </h2>
        <InfoButton />
      </div>

      <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', flex: 1 }}>
        {/* Activity Name Input */}
        <div className="form-group" style={{ marginBottom: '40px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#ccc', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Activity name
          </label>
          <input
            type="text"
            className="nexus-input"
            placeholder="(Default) Activity_1"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '16px',
            }}
          />
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Group names can be edited once created</div>
        </div>

        {/* Separator */}
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', marginBottom: '40px' }}></div>

        {/* Quick Selection */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '14px', color: '#ccc', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '20px' }}>Quick selection</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {quickSelections.map((selection) => (
              <button
                key={selection}
                onClick={() => setActivityName(selection)}
                style={{
                  background: 'transparent',
                  border: '1px solid #E7EEF3',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {selection}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Button */}
      <div style={{ marginTop: 'auto', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
        <button className="nexus-btn continue-btn" onClick={handleStartActivity} style={{ width: '100%', maxWidth: '400px' }}>
          Start activity
        </button>
      </div>
    </main>
  );
};
