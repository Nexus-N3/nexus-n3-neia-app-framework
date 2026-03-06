import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, activeActivityAtom } from '../store/atoms'; // Added activeActivityAtom
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph'; // Added BarGraph
import { SegmentedControl } from '../components/SegmentedControl'; // Added SegmentedControl

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom); // Use atom

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);
  
  // Local state for view mode (only relevant when active)
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

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

  const handleEndActivity = () => {
    if (window.confirm('Are you sure you want to end the current activity?')) {
       setActiveActivity(null);
    }
  };

  return (
    <ScreenLayout className="active-session-content">
      {/* Header Row with Carousel */}
      <div className="sub-header-row" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ zIndex: 1 }}>
          <BackButton onClick={handleBack} />
        </div>

        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 0 }}>
          <SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />
        </div>

        <div style={{ zIndex: 1 }}>
          {activeActivity ? (
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
              options={[
                { label: 'Real time', value: 'realtime' },
                { label: 'Periodic', value: 'periodic' },
              ]}
            />
          ) : (
            <InfoButton />
          )}
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
              height: '100%',
            }}
          >
            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: activeActivity ? 'space-between' : 'center', alignItems: 'center' }}>
              <h3 style={{ margin: '0', textAlign: 'center' }}>{subject.name}</h3>
              
              {activeActivity && (
                <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarGraph variant="simple" />
                </div>
              )}
            </div>

            <button
              className="panel-action-btn primary"
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

        {/* Manage Sensors (Outlined) - Always visible */}
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
        
        {/* Dynamic Action Button */}
        {activeActivity ? (
           <button
              className="nexus-btn continue-btn"
              style={{ backgroundColor: '#c00000', transition: 'background-color 0.2s', opacity: 0.8 }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#df0000')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#c00000')}
              onClick={handleEndActivity}
            >
              End activity
            </button>
        ) : (
            <button
              className="nexus-btn continue-btn"
              style={{ backgroundColor: '#3B7D23', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2E611B')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3B7D23')}
              onClick={() => navigate('/new-activity')}
            >
              Start new activity
            </button>
        )}
      </div>
    </ScreenLayout>
  );
};
