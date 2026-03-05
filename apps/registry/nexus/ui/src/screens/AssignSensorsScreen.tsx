import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SensorRow } from '../components/SensorRow';
import { subjectCountAtom, setupsAtom, selectedSetupIdAtom, Sensor, placedSensorsAtom } from '../store/atoms';

export const AssignSensorsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');
  const targetSubjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : null;

  const [subjectCount] = useAtom(subjectCountAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [placedSensors] = useAtom(placedSensorsAtom);

  // Determine required sensors
  const selectedSetup = setups.find((s) => s.id === selectedSetupId);
  const requiredSensors = selectedSetup ? selectedSetup.sensors : [];

  // Generate subjects (this should ideally be shared state, but keeping consistent with SessionScreen logic)
  let subjects = Array.from({ length: subjectCount }, (_, i) => {
    const id = i + 1;
    const subjectPlacedCount = requiredSensors.filter((s) => placedSensors.has(`${id}:${s.id}`)).length;
    return {
      id,
      name: `Subject_${id}`,
      requiredCount: requiredSensors.length,
      connectedCount: 0, // Mocked for now
      placedCount: subjectPlacedCount,
    };
  });

  if (targetSubjectId) {
    subjects = subjects.filter((s) => s.id === targetSubjectId);
  }

  const handleBack = () => {
    navigate('/session');
  };

  const allSensorsPlaced = subjects.length > 0 && subjects.every((s) => s.placedCount >= s.requiredCount);

  return (
    <main
      className="nexus-content assign-sensors-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        alignItems: 'stretch', // Override .nexus-content center alignment
      }}
    >
      {/* Sub Header */}
      <div className="sub-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />
        <h2 className="screen-title" style={{ margin: 0 }}>
          PLACE SENSORS
        </h2>
        <InfoButton />
      </div>

      <div
        className="scrollable-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '10px',
          width: '100%',
          overflowX: 'hidden',
          minHeight: 0,
          boxSizing: 'border-box', // Ensure padding is included in width
        }}
      >
        {subjects.map((subject) => (
          <div key={subject.id} className="subject-section" style={{ marginBottom: '30px' }}>
            {/* Subject Header */}
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ fontWeight: 500, margin: '0 0 5px 0', textAlign: 'left', fontSize: '32px', textTransform: 'uppercase' }}>
                {subject.name}: assigned sensors
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '32px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: subject.placedCount >= subject.requiredCount ? '#4CAF50' : '#ff6b6b',
                    marginRight: '5px',
                  }}
                />
                <span style={{ color: '#fff' }}>{subject.requiredCount} required,</span>
                <span style={{ color: '#fff' }}>{subject.connectedCount} connected,</span>
                <span style={{ color: '#fff' }}>{subject.placedCount} placed</span>
              </div>
            </div>

            {/* Sensors List */}
            <div className="sensors-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {requiredSensors.map((sensor, idx) => (
                <SensorRow key={`${subject.id}-${idx}`} subjectId={subject.id} sensor={sensor} />
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
          {'Find more sensors'}
        </button>
        <button className="nexus-btn continue-btn" onClick={() => navigate('/session')}>
          Return to session
        </button>
      </div>
    </main>
  );
};
