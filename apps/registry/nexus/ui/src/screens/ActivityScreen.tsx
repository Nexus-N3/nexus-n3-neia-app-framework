import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { subjectCountAtom, sessionNameAtom } from '../store/atoms';

const PendingBarGraph = () => (
  <div
    style={{
      display: 'flex',
      gap: '40px',
      alignItems: 'flex-end',
      height: '100%',
      width: '100%',
      justifyContent: 'center',
      padding: '0 30px',
      boxSizing: 'border-box',
    }}
  >
    {[0.5, 0.5, 1].map((opacity, i) => (
      <div key={i} style={{ display: 'flex', gap: '8px', opacity, alignItems: 'flex-end', height: '100%', flex: 1 }}>
        <div style={{ flex: 1, height: '40%', backgroundColor: '#5960F6', borderRadius: '4px' }}></div>
        <div style={{ flex: 1, height: '70%', backgroundColor: '#19D2EA', borderRadius: '4px' }}></div>
      </div>
    ))}
  </div>
);

export const ActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [sessionName] = useAtom(sessionNameAtom);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);

  // View Mode state
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `Subject_${i + 1}`,
  }));

  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const handleBack = () => {
    navigate('/active-session');
  };

  return (
    <main className="nexus-content activity-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Row */}
      <div
        className="sub-header-row"
        style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}
      >
        <BackButton onClick={handleBack} />

        {/* Carousel Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
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

        {/* Segmented Control */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            padding: '2px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <button
            onClick={() => setViewMode('realtime')}
            style={{
              background: viewMode === 'realtime' ? '#5960F6' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '2px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Real time
          </button>
          <button
            onClick={() => setViewMode('periodic')}
            style={{
              background: viewMode === 'periodic' ? '#5960F6' : 'transparent',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '2px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Periodic
          </button>
        </div>
      </div>

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
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 500, textAlign: 'center' }}>{subject.name}</h3>

              {/* Pending Bar Graph */}
              <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PendingBarGraph />
              </div>
            </div>

            <button
              className="nexus-btn secondary-btn"
              style={{
                background: '#8a92bf',
                color: 'white',
                border: 'none',
                borderRadius: '0 0 4px 4px',
                width: '100%',
                padding: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                marginTop: '0',
                textTransform: 'uppercase',
                fontSize: '14px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#757db0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8a92bf')}
            >
              View
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
        {/* Manage Sensors (Outlined) */}
        <button
          className="nexus-btn secondary-btn"
          onClick={() => navigate('/assign-sensors')}
          style={{
            background: 'transparent',
            border: '1px solid #5960F6',
            color: '#5960F6',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(89, 96, 246, 0.1)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Manage sensors
        </button>
        {/* End Activity (Red) */}
        <button
          className="nexus-btn continue-btn"
          style={{ backgroundColor: '#c00000', transition: 'background-color 0.2s', opacity: 0.8 }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#df0000')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#c00000')}
          onClick={() => navigate('/active-session')}
        >
          End activity
        </button>
      </div>
    </main>
  );
};
