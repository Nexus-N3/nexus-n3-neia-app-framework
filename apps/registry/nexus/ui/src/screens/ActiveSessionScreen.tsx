import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { subjectCountAtom } from '../store/atoms';

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);

  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `Subject_${i + 1}`,
  }));

  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleBack = () => {
    navigate('/session');
  };

  return (
    <main className="nexus-content active-session-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            <div style={{ padding: '20px', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 500, textAlign: 'center' }}>{subject.name}</h3>
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
              View subject
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
        <button
          className="nexus-btn continue-btn"
          style={{ backgroundColor: '#3B7D23', transition: 'background-color 0.2s' }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2E611B')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3B7D23')}
          onClick={() => navigate('/new-activity')}
        >
          Start new activity
        </button>
      </div>
    </main>
  );
};
