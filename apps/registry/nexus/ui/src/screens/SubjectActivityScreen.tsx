import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { ScreenLayout } from '../components/ScreenLayout';
import { CarouselHeader } from '../components/CarouselHeader';
import { BarGraph } from '../components/BarGraph';
import { subjectCountAtom } from '../store/atoms';
import { SegmentedControl } from '../components/SegmentedControl';

export const SubjectActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '1', 10);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');

  const handleBack = () => {
    navigate('/activity');
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

  const currentSubjectName = `Subject_${subjectId}`;

  return (
    <ScreenLayout>
      <CarouselHeader
        title={currentSubjectName}
        onBack={handleBack}
        onPrev={handlePrevSubject}
        onNext={handleNextSubject}
        isPrevDisabled={subjectId <= 1}
        isNextDisabled={subjectId >= subjectCount}
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

      {/* Main Content Area */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Panel (1/3) */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '20px' }}>
          <h3
            style={{
              color: 'white',
              margin: '0 0 20px 0',
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            Performance
          </h3>

          <div style={{ color: 'white' }}>
            {/* LOADING */}
            <div style={{ marginBottom: '24px' }}>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                LOADING
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>INTENSITY</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>DOSE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, marginTop: '4px' }}>
                <span style={{ color: '#5960F6' }}>
                  5.1 <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>bw/s</span>
                </span>
                <span style={{ color: '#5960F6' }}>
                  0.3 <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>kBW</span>
                </span>
              </div>
            </div>

            {/* IMBALANCE */}
            <div style={{ marginBottom: '24px' }}>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                IMBALANCE
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ marginBottom: '16px', textAlign: 'right', color: '#19D2EA' }}>right side dominant</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>OFFLOAD</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>RATIO</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#5960F6' }}>4%</span>
                <span style={{ fontWeight: 500 }}>
                  <span style={{ color: '#5960F6' }}>48</span>:<span style={{ color: '#19D2EA' }}>52</span>
                </span>
              </div>
            </div>

            {/* MOVEMENT COMPENSATIONS (%) */}
            <div>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                MOVEMENT COMPENSATIONS (%)
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5960F6', fontWeight: 500 }}>42</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>V</span>
                  <span style={{ color: '#19D2EA', fontWeight: 500 }}>58</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5960F6', fontWeight: 500 }}>56</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ML</span>
                  <span style={{ color: '#19D2EA', fontWeight: 500 }}>44</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5960F6', fontWeight: 500 }}>48</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>AP</span>
                  <span style={{ color: '#19D2EA', fontWeight: 500 }}>52</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel (2/3) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Bar Graph with Time Control */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarGraph variant="detailed" labels={['116', '117', '118', '119', '120']} />
            </div>

            {/* Time Control */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '14px', gap: '10px', marginTop: '20px' }}>
              <span style={{ cursor: 'pointer', opacity: 0.6 }}>&lt;&lt;</span>
              <span style={{ cursor: 'pointer', opacity: 0.8 }}>&lt;</span>
              <span style={{ fontWeight: 500 }}>Every 5 seconds</span>
              <span style={{ cursor: 'pointer', opacity: 0.8 }}>&gt;</span>
              <span style={{ cursor: 'pointer', opacity: 0.6 }}>&gt;&gt;</span>
            </div>
          </div>
        </div>
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
        <div></div>{' '}
        {/* Empty 1/3 (No Manage Sensors here?) User said "End activity button should look like in the same position". Just keeping the grid structure keeps it in the 3rd column. */}
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
