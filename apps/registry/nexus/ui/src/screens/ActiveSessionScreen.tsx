import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, activeActivityAtom, subjectPrefixAtom } from '../store/atoms'; // Added activeActivityAtom
import { ScreenLayout } from '../components/ScreenLayout';
import { BarGraph } from '../components/BarGraph'; // Added BarGraph
import { SegmentedControl } from '../components/SegmentedControl'; // Added SegmentedControl

export const ActiveSessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [activeActivity, setActiveActivity] = useAtom(activeActivityAtom);

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);
  
  // Local state for view mode (only relevant when active)
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const subjects = Array.from({ length: subjectCount }, (_, i) => ({
    id: i + 1,
    name: `${subjectPrefix}${i + 1}`,
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
    <ScreenLayout className="screen-layout">
      {/* Header Row with Carousel */}
      <div className="sub-header-row relative compact">
        <div className="z-1">
          <BackButton onClick={handleBack} />
        </div>

        <div className="absolute-center">
          <SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />
        </div>

        <div className="z-1">
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

      <div className="subjects-grid">
        {currentSubjects.map((subject) => (
          <div key={subject.id} className="subject-card">
            <div className={`subject-card-content ${activeActivity ? 'with-graph' : ''}`}>
              <h3 className="subject-card-title">{subject.name}</h3>
              
              {activeActivity && (
                <div className="bar-graph-wrapper">
                  <BarGraph variant="simple" />
                </div>
              )}
            </div>

            <button
              className="panel-action-btn primary"
              onClick={() => navigate(`/activity/subject/${subject.id}`)}
            >
              View details
            </button>
          </div>
        ))}
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        <div></div>

        <button className="nexus-btn secondary-btn" onClick={() => navigate('/assign-sensors')}>
          Manage sensors
        </button>
        
        {activeActivity ? (
          <button className="nexus-btn nexus-btn-danger" onClick={handleEndActivity}>
            End activity
          </button>
        ) : (
          <button className="nexus-btn nexus-btn-success" onClick={() => navigate('/new-activity')}>
            Start new activity
          </button>
        )}
      </div>
    </ScreenLayout>
  );
};
