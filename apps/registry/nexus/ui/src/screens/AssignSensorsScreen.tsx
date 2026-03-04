import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { subjectCountAtom, setupsAtom, selectedSetupIdAtom, Sensor } from '../store/atoms';

// Mock Battery Icon component
const BatteryIcon = ({ level }: { level: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div
      style={{
        width: '24px',
        height: '12px',
        border: '1px solid #fff',
        borderRadius: '2px',
        padding: '1px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: `${level}%`,
          height: '100%',
          background: level > 20 ? '#4caf50' : '#ff6b6b',
          transition: 'width 0.3s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-4px',
          top: '3px',
          width: '2px',
          height: '6px',
          background: '#fff',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
    <span style={{ fontSize: '12px', color: '#ccc' }}>{level}%</span>
  </div>
);

const SensorRow = ({ sensor }: { sensor: Sensor }) => {
  const [isOn, setIsOn] = useState(false);

  return (
    <div
      className="sensor-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '8px',
        borderRadius: '4px',
        gap: '20px',
      }}
    >
      {/* iOS Style Toggle */}
      <div
        onClick={() => setIsOn(!isOn)}
        style={{
          width: '50px',
          height: '28px',
          background: isOn ? 'rgba(76, 175, 80, 0.4)' : 'rgba(231, 238, 243, 0.1)',
          borderRadius: '14px',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background-color 0.2s',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            background: isOn ? '#4caf50' : '#8A92BF',
            borderRadius: '50%',
            position: 'absolute',
            left: isOn ? '24px' : '0',
            transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1), background-color 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* Sensor Name */}
      <span style={{ fontWeight: 600, minWidth: '120px' }}>{sensor.type}</span>

      {/* Battery */}
      <BatteryIcon level={76} />

      {/* Placement */}
      <span style={{ color: '#aaa', fontStyle: 'italic', flex: 1 }}>{sensor.loc}</span>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className="nexus-btn secondary-btn"
          style={{
            padding: '6px 16px',
            height: 'auto',
            minWidth: 'auto',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
        >
          Identify
        </button>
        <button
          className="nexus-btn secondary-btn"
          style={{
            padding: '6px 16px',
            height: 'auto',
            minWidth: 'auto',
          }}
        >
          Place
        </button>
      </div>
    </div>
  );
};

export const AssignSensorsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);

  // Determine required sensors
  const selectedSetup = setups.find((s) => s.id === selectedSetupId);
  const requiredSensors = selectedSetup ? selectedSetup.sensors : [];

  // Generate subjects (this should ideally be shared state, but keeping consistent with SessionScreen logic)
  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `Subject_${i + 1}`,
    requiredCount: requiredSensors.length,
    connectedCount: 0, // Mocked for now
    placedCount: 0, // Mocked for now
  }));

  const handleBack = () => {
    navigate('/session');
  };

  return (
    <main className="nexus-content assign-sensors-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub Header */}
      <div className="sub-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />
        <h2 className="screen-title" style={{ margin: 0 }}>
          PLACE SENSORS
        </h2>
        <InfoButton />
      </div>

      <div className="scrollable-content" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', width: '100%' }}>
        {subjects.map((subject) => (
          <div key={subject.id} className="subject-section" style={{ marginBottom: '30px' }}>
            {/* Subject Header */}
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ fontWeight: 500, margin: '0 0 5px 0', textAlign: 'left' }}>{subject.name}: assigned sensors</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#ff6b6b', // Red for incomplete
                    marginRight: '5px',
                  }}
                />
                <span style={{ color: '#fff' }}>{subject.requiredCount} required</span>,
                <span style={{ color: '#fff' }}>{subject.connectedCount} connected</span>,<span style={{ color: '#fff' }}>{subject.placedCount} placed</span>
              </div>
            </div>

            {/* Sensors List */}
            <div className="sensors-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {requiredSensors.map((sensor, idx) => (
                <SensorRow key={`${subject.id}-${idx}`} sensor={sensor} />
              ))}
              {requiredSensors.length === 0 && <div style={{ fontStyle: 'italic', color: '#888', padding: '10px' }}>No sensors required for this setup.</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Buttons */}
      <div
        className="action-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '20px',
          marginTop: '20px',
          marginBottom: '20px',
          width: '100%',
        }}
      >
        <div></div> {/* Empty 1/3 */}
        <button
          className="nexus-btn secondary-btn"
          style={{
            background: 'transparent',
            border: '1px solid #5960F6',
            color: '#5960F6',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(89, 96, 246, 0.1)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Find more sensors
        </button>
        <button className="nexus-btn continue-btn" onClick={() => navigate('/session')}>
          Return to session
        </button>
      </div>
    </main>
  );
};
