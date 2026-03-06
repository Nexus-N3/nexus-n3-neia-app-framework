import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, setupsAtom, selectedSetupIdAtom, placedSensorsAtom, subjectPrefixAtom } from '../store/atoms';

export const SessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
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
      name: `${subjectPrefix || 'Subject_'}${id}`,
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

        <SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />

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
        {currentSubjects.map((subject) => {
          const isComplete = subject.sensorsPlaced >= subject.sensorsRequired && subject.sensorsRequired > 0;
          return (
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
                <h3 style={{ textAlign: 'center', margin: '0 0 15px 0' }}>{subject.name}</h3>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: isComplete ? '#4CAF50' : '#ff6b6b' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isComplete ? '#4CAF50' : '#ff6b6b',
                      marginRight: '12px',
                    }}
                  ></div>
                  <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '32px' }}>Sensors</span>
                </div>

                {isComplete ? (
                  <div className="subject-stats" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '24px' }}>
                    {selectedSetup?.sensors.map((sensor) => (
                      <div key={sensor.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                        <span>
                          {sensor.type}: {sensor.loc}
                        </span>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#4CAF50', marginLeft: '10px' }}></div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                )}
              </div>

              <button className="panel-action-btn" onClick={() => navigate(`/assign-sensors?subjectId=${subject.id}`)}>
                {isComplete ? 'Manage sensors' : 'Connect sensors'}
              </button>
            </div>
          );
        })}
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
          {allSensorsPlaced ? 'Manage sensors' : 'Connect sensors'}
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
