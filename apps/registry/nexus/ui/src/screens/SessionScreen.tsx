import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { sessionNameAtom, subjectCountAtom, setupsAtom, selectedSetupIdAtom, placedSensorsAtom } from '../store/atoms';
import chevronLeft from '../assets/chevron-left.svg';
import chevronRight from '../assets/chevron-right.svg';

export const SessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sessionName] = useAtom(sessionNameAtom);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [placedSensors] = useAtom(placedSensorsAtom);

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
  const subjects = Array.from({ length: subjectCount }, (_, i) => {
    const id = i + 1;
    const placedCount = selectedSetup ? selectedSetup.sensors.filter((s) => placedSensors.has(`${id}:${s.id}`)).length : 0;

    return {
      id,
      name: `Subject_${id}`,
      sensorsRequired: sensorsRequired,
      sensorsConnected: 0,
      sensorsPlaced: placedCount,
      status: 'red', // Default status
    };
  });

  const allSensorsPlaced = subjects.length > 0 && subjects.every((s) => s.sensorsPlaced >= s.sensorsRequired && s.sensorsRequired > 0);

  // Get current page subjects
  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <main className="nexus-content session-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Row with Carousel */}
      <div className="sub-header-row" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton onClick={handleBack} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'white',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              opacity: currentPage === 0 ? 0.3 : 1,
            }}
          >
            <img src={chevronLeft} alt="Previous" style={{ width: '32px', height: '32px', marginTop: '8px' }} />
          </button>
          <span style={{ textTransform: 'uppercase', fontWeight: 500, fontSize: '48px' }}>Subjects</span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'white',
              cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
              opacity: currentPage >= totalPages - 1 ? 0.3 : 1,
            }}
          >
            <img src={chevronRight} alt="Next" style={{ width: '32px', height: '32px', marginTop: '8px' }} />
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
          minHeight: 0,
        }}
      >
        {currentSubjects.map((subject) => (
          <div
            key={subject.id}
            className="subject-card"
            style={{
              background: 'rgba(231, 238, 243, 0.05)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <div className="subject-info" style={{ padding: '20px', flex: 1 }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 15px 0', fontWeight: 500, fontSize: '32px' }}>{subject.name}</h3>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: '#ff6b6b' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#ff6b6b',
                    marginRight: '12px',
                  }}
                ></div>
                <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '32px' }}>Sensors</span>
              </div>

              <div className="subject-stats" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Required</span>
                  <span style={{ color: 'white' }}>{subject.sensorsRequired}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Connected</span>
                  <span style={{ color: 'white' }}>{subject.sensorsConnected}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Placed</span>
                  <span style={{ color: 'white' }}>{subject.sensorsPlaced}</span>
                </div>
              </div>
            </div>

            <button className="panel-action-btn" onClick={() => navigate(`/assign-sensors?subjectId=${subject.id}`)}>
              Connect sensors
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
          width: '100%',
        }}
      >
        <div></div> {/* Empty 1/3 */}
        <button className="nexus-btn secondary-btn" onClick={() => navigate('/assign-sensors')}>
          Connect sensors
        </button>
        <button
          className="nexus-btn continue-btn"
          onClick={() => navigate('/active-session')}
          disabled={!allSensorsPlaced}
          style={{
            backgroundColor: allSensorsPlaced ? undefined : '#D9D9D9',
            cursor: allSensorsPlaced ? 'pointer' : 'default',
            color: allSensorsPlaced ? undefined : '#888',
          }}
        >
          Start session
        </button>
      </div>
    </main>
  );
};
