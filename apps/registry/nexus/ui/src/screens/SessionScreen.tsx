import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { sessionNameAtom, subjectCountAtom, setupsAtom, selectedSetupIdAtom } from '../store/atoms';

export const SessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName] = useAtom(sessionNameAtom);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);

  // Pagination state (we show 4 items at a time in a 2x2 grid)
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);

  const selectedSetup = setups.find((s) => s.id === selectedSetupId);
  const sensorsRequired = selectedSetup ? selectedSetup.sensors.length : 0;

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleBack = () => {
    navigate('/sensor-setup');
  };

  // Generate subjects based on count
  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `Subject_${i + 1}`,
    sensorsRequired: sensorsRequired,
    sensorsConnected: 0,
    sensorsPlaced: 0,
    status: 'red', // Default status
  }));

  // Get current page subjects
  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <main className="nexus-content session-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Row with Carousel */}
      <div className="sub-header-row" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              opacity: currentPage === 0 ? 0.3 : 1,
            }}
          >
            &lt;
          </button>
          <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '18px', fontWeight: 500 }}>Subjects</span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
              opacity: currentPage >= totalPages - 1 ? 0.3 : 1,
            }}
          >
            &gt;
          </button>
        </div>

        <InfoButton />
      </div>

      {/* Grid Content */}
      <div
        className="subjects-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '20px',
          flex: 1,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {currentSubjects.map((subject) => (
          <div
            key={subject.id}
            className="subject-card"
            style={{
              background: 'rgba(231, 238, 243, 0.05)',
              borderRadius: '4px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div className="subject-info">
              <h3 style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '18px', fontWeight: 500 }}>{subject.name}</h3>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: '#ff6b6b' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#ff6b6b',
                    marginRight: '8px',
                  }}
                ></div>
                <span style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>Sensors</span>
              </div>

              <div className="subject-stats" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Required</span>
                  <span style={{ color: 'white' }}>{subject.sensorsRequired}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Connected</span>
                  <span style={{ color: 'white' }}>{subject.sensorsConnected}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Placed</span>
                  <span style={{ color: 'white' }}>{subject.sensorsPlaced}</span>
                </div>
              </div>
            </div>

            <button
              className="place-sensors-btn"
              style={{
                background: '#8a92bf',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                width: '100%',
                padding: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                marginTop: '15px',
                textTransform: 'uppercase',
                fontSize: '14px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#757db0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8a92bf')}
            >
              Place sensors
            </button>
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
        }}
      >
        <div></div> {/* Empty 1/3 */}
        <button className="nexus-btn secondary-btn">Connect sensors</button>
        <button className="nexus-btn continue-btn">Start session</button>
      </div>
    </main>
  );
};
