import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { ScreenLayout } from '../components/ScreenLayout';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { BackButton } from '../components/BackButton';
import { BarGraph } from '../components/BarGraph';
import { subjectCountAtom } from '../store/atoms';
import { SegmentedControl } from '../components/SegmentedControl';
import chevronLeft from '../assets/chevron-left.svg';
import chevronRight from '../assets/chevron-right.svg';

export const SubjectActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '1', 10);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const handleBack = () => {
    navigate('/active-session');
  };

  const handlePrevSubject = () => {
    if (subjectId > 1) {
      navigate(`/activity/subject/${subjectId - 1}`);
    }
  };

  const handleNextSubject = () => {
    if (subjectId < subjectCount) {
      navigate(`/activity/subject/${subjectId + 1}`);
    }
  };

  return (
    <ScreenLayout>
      <div className="sub-header-row subject-activity-header">
        <div className="subject-header-left">
          <BackButton onClick={handleBack} />
        </div>

        <div className="subject-header-center">
          <SubjectsCarousel
            title={`Subject_${subjectId}`}
            currentPage={subjectId - 1}
            totalPages={subjectCount}
            onPrev={handlePrevSubject}
            onNext={handleNextSubject}
          />
        </div>

        <div className="subject-header-right">
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
            options={[
              { label: 'Real time', value: 'realtime' },
              { label: 'Periodic', value: 'periodic' },
            ]}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="subject-content-grid">
        {/* Left Panel (1/3) */}
        <div className="metric-panel">
          <h3 className="performance-header">Performance</h3>

          <div className="text-white">
            {/* LOADING */}
            <div className="metric-container">
              <h4 className="metric-title">LOADING</h4>
              <hr className="metric-separator" />
              <div className="metric-grid">
                <div className="metric-cell">
                  <span className="metric-label">INTENSITY</span>
                  <span className="metric-value-large text-primary mt-4">
                    5.1 <span className="metric-unit">bw/s</span>
                  </span>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">DOSE</span>
                  <span className="metric-value-large text-primary mt-4">
                    0.3 <span className="metric-unit">kBW</span>
                  </span>
                </div>
              </div>
            </div>

            {/* IMBALANCE */}
            <div className="metric-container">
              <h4 className="metric-title">IMBALANCE</h4>
              <hr className="metric-separator" />
              <div className="metric-subtitle">Right Side Dominant</div>
              <div className="metric-grid">
                <div className="metric-cell">
                  <span className="metric-label">OFFLOAD</span>
                  <span className="metric-value-large text-primary font-semibold mt-4">4%</span>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">RATIO</span>
                  <span className="metric-value-large font-medium mt-4">
                    <span className="text-primary">48</span><span className="separator-ratio">:</span><span className="text-secondary">52</span>
                  </span>
                </div>
              </div>
            </div>

            {/* MOVEMENT COMPENSATIONS (%) */}
            <div>
              <h4 className="metric-title">MOVEMENT COMPENSATIONS (%)</h4>
              <hr className="metric-separator" />
              <div className="metric-col">
                <div className="movement-row">
                  <span className="metric-value-medium text-primary font-medium">42</span>
                  <span className="metric-unit-medium">V</span>
                  <span className="metric-value-medium text-secondary font-medium">58</span>
                </div>
                <div className="movement-row">
                  <span className="metric-value-medium text-primary font-medium">56</span>
                  <span className="metric-unit-medium">ML</span>
                  <span className="metric-value-medium text-secondary font-medium">44</span>
                </div>
                <div className="movement-row">
                  <span className="metric-value-medium text-primary font-medium">48</span>
                  <span className="metric-unit-medium">AP</span>
                  <span className="metric-value-medium text-secondary font-medium">52</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel (2/3) */}
        <div className="graph-panel-column">
          {/* Bar Graph with Time Control */}
          <div className="graph-panel">
            <div className="graph-wrapper">
              <BarGraph variant="detailed" labels={['116', '117', '118', '119', '120']} />
            </div>

            {/* Time Control */}
            <div className="nexus-time-control">
              <button className="time-control-btn spacing-right" aria-label="Previous Fast">
                <div className="time-control-double-icon double-prev">
                   <img src={chevronLeft} alt="" className="time-control-icon" />
                   <img src={chevronLeft} alt="" className="time-control-icon" />
                </div>
              </button>
              <button className="time-control-btn" aria-label="Previous">
                <img src={chevronLeft} alt="" className="time-control-icon" />
              </button>
              
              <span className="time-control-label">Every 5 seconds</span>

              <button className="time-control-btn" aria-label="Next">
                <img src={chevronRight} alt="" className="time-control-icon" />
              </button>
              <button className="time-control-btn spacing-left" aria-label="Next Fast">
                <div className="time-control-double-icon double-next">
                   <img src={chevronRight} alt="" className="time-control-icon" />
                   <img src={chevronRight} alt="" className="time-control-icon" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="subject-footer-grid">
        <div></div> {/* Empty 1/3 */}
        <div></div>{' '}
        {/* End Activity (Red) */}
        <button
          className="nexus-btn continue-btn end-activity-btn"
          onClick={() => navigate('/active-session')}
        >
          End activity
        </button>
      </div>
    </ScreenLayout>
  );
};
