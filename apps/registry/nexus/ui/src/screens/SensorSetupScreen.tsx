import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';

export const SensorSetupScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => navigate('/subjects');

  return (
    <main className="nexus-content sensor-setup-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">SENSOR SETUP</h2>
        <InfoButton />
      </div>

      <div
        className="sensor-setup-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr', // 1/3 and 2/3 roughly
          gridTemplateRows: '1fr auto', // Main content takes available space, buttons take auto
          gap: '30px',
          marginTop: '30px',
          flex: 1, // Grow to fill the flex container
          width: '100%',
        }}
      >
        {/* Top Left: Default Setups (spans 1 row) */}
        <div
          className="setup-list-panel"
          style={{
            gridColumn: '1 / 2',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(231, 238, 243, 0.05)',
            borderRadius: '4px',
          }}
        >
          <h3 style={{ fontSize: '12px', color: '#888', marginBottom: '15px', letterSpacing: '1px', padding: '20px 20px 0 20px' }}>DEFAULT SETUPS</h3>
          <div className="setup-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', marginLeft: '10px', marginRight: '10px' }}>
            <div
              className="setup-item selected"
              style={{
                padding: '15px',
                background: 'rgba(255,255,255,0.08)',
                marginBottom: '10px',
                borderRadius: '4px',
                border: '1px solid #5960F6',
                color: '#5960F6',
                textAlign: 'left',
              }}
            >
              LOADING
            </div>
          </div>
          <button className="custom-setup-btn">+ New custom setup</button>
        </div>

        {/* Top Right: Sensor List */}
        <div
          className="sensor-list-panel"
          style={{
            gridColumn: '2 / 3',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div className="sensor-list">
            {[
              { type: 'MOVELLA DOT', loc: 'Left ankle', comp: 'Loading' },
              { type: 'MOVELLA DOT', loc: 'Right ankle', comp: 'Loading' },
            ].map((sensor, i) => (
              <div
                key={i}
                className="sensor-card"
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '20px',
                  background: 'rgba(255,255,255,0.05)',
                  marginBottom: '15px',
                  alignItems: 'center',
                  borderRadius: '4px',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{sensor.type}</div>
                <div style={{ fontSize: '0.9em', opacity: 0.8, color: '#aaa' }}>{sensor.loc}</div>
                <div style={{ fontSize: '0.9em', color: '#888', fontStyle: 'italic' }}>Computes: {sensor.comp}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Left: Empty (Implicitly handled by grid placement, but explicit for clarity) */}
        <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}></div>

        {/* Bottom Right: Buttons */}
        <div
          className="action-row"
          style={{
            gridColumn: '2 / 3',
            gridRow: '2 / 3',
            display: 'flex',
            gap: '20px',
            marginTop: 'auto', // Align to bottom if row has height, though grid handles placement
          }}
        >
          <button className="nexus-btn secondary-btn" style={{ flex: 1 }}>
            Modify default
          </button>
          <button className="nexus-btn continue-btn" style={{ flex: 1 }}>
            Create session
          </button>
        </div>
      </div>
    </main>
  );
};
