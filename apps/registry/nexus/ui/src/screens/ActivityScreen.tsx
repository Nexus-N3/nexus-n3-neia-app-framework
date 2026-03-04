import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { SegmentedControl } from '../components/SegmentedControl';
import { subjectCountAtom, sessionNameAtom } from '../store/atoms';
import { ScreenLayout } from '../components/ScreenLayout';
import { CarouselHeader } from '../components/CarouselHeader';
import { BarGraph } from '../components/BarGraph';

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
    <ScreenLayout className="activity-content">
      <CarouselHeader
        onBack={handleBack}
        title="Subjects"
        onPrev={handlePrevPage}
        onNext={handleNextPage}
        isPrevDisabled={currentPage === 0}
        isNextDisabled={currentPage >= totalPages - 1}
        rightElement={
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
            options={[
              { label: 'Real time', value: 'realtime' },
              { label: 'Periodic', value: 'periodic' },
            ]}
          />
        }
      />

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
              <h3 style={{ margin: '0', fontWeight: 500, textAlign: 'center' }}>{subject.name}</h3>

              {/* Pending Bar Graph */}
              <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarGraph variant="simple" />
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
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#757db0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8a92bf')}
              onClick={() => navigate(`/activity/subject/${subject.id}`)}
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
    </ScreenLayout>
  );
};
