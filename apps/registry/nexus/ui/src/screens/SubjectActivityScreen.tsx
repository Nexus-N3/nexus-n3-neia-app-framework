import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { subjectCountAtom, sessionNameAtom } from '../store/atoms';

const PendingBarGraph = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', marginBottom: '4px' }}>
      {/* Grid Lines */}
      {/* Top Line (10 BW/s) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          borderTop: '1px dotted rgba(255, 255, 255, 0.3)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ position: 'absolute', right: 0, top: '-20px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>10 BW/s</span>
      </div>
      {/* Middle Line (5) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          borderTop: '1px dotted rgba(255, 255, 255, 0.3)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ position: 'absolute', right: 0, top: '-20px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>5</span>
      </div>
      {/* Bottom Line (Solid) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          pointerEvents: 'none',
        }}
      ></div>

      {/* Bars Groups */}
      <div style={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
        {[
          { l: '40%', r: '65%' },
          { l: '50%', r: '75%' },
          { l: '45%', r: '60%' },
          { l: '55%', r: '70%' },
          { l: '35%', r: '50%' },
        ].map((heights, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '100%', width: '14%' }}>
            {/* Left Bar (Darker) */}
            <div style={{ flex: 1, height: heights.l, backgroundColor: '#5960F6', borderRadius: '4px 4px 0 0' }}></div>
            {/* Right Bar (Lighter) */}
            <div style={{ flex: 1, height: heights.r, backgroundColor: '#19D2EA', borderRadius: '4px 4px 0 0' }}></div>
          </div>
        ))}
      </div>
    </div>

    {/* X-Axis Labels */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: '10px',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}
    >
      {['116', '117', '118', '119', '120'].map((label) => (
        <div key={label} style={{ width: '14%', textAlign: 'center', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
          {label}
        </div>
      ))}
    </div>
  </div>
);

export const SubjectActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '1', 10);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [sessionName] = useAtom(sessionNameAtom);
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
            onClick={handlePrevSubject}
            disabled={subjectId <= 1}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: subjectId <= 1 ? 'default' : 'pointer',
              opacity: subjectId <= 1 ? 0.3 : 1,
            }}
          >
            &lt;
          </button>
          <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '18px', fontWeight: 500 }}>{currentSubjectName}</span>
          <button
            onClick={handleNextSubject}
            disabled={subjectId >= subjectCount}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: subjectId >= subjectCount ? 'default' : 'pointer',
              opacity: subjectId >= subjectCount ? 0.3 : 1,
            }}
          >
            &gt;
          </button>
        </div>

        {/* Segmented Control */}
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
          options={[
            { label: 'Real time', value: 'realtime' },
            { label: 'Periodic', value: 'periodic' },
          ]}
        />
      </div>

      {/* Main Content Area */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Panel (1/3) */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '20px' }}>
          <h3
            style={{
              fontSize: '18px',
              color: 'white',
              margin: '0 0 20px 0',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '1px',
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
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textAlign: 'center',
                }}
              >
                LOADING
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>INTENSITY</span>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>DOSE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', fontWeight: 500, marginTop: '4px' }}>
                <span style={{ color: '#5960F6' }}>
                  5.1 <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>bw/s</span>
                </span>
                <span style={{ color: '#5960F6' }}>
                  0.3 <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>kBW</span>
                </span>
              </div>
            </div>

            {/* IMBALANCE */}
            <div style={{ marginBottom: '24px' }}>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textAlign: 'center',
                }}
              >
                IMBALANCE
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ marginBottom: '16px', fontSize: '14px', textAlign: 'right', color: '#19D2EA' }}>right side dominant</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>OFFLOAD</span>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>RATIO</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '24px', fontWeight: 600, color: '#5960F6' }}>4%</span>
                <span style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 500 }}>
                  <span style={{ color: '#5960F6' }}>48</span>:<span style={{ color: '#19D2EA' }}>52</span>
                </span>
              </div>
            </div>

            {/* MOVEMENT COMPENSATIONS (%) */}
            <div>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textAlign: 'center',
                }}
              >
                MOVEMENT COMPENSATIONS (%)
              </h4>
              <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0 16px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#5960F6', fontWeight: 500 }}>42</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>V</span>
                  <span style={{ color: '#19D2EA', fontWeight: 500 }}>58</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#5960F6', fontWeight: 500 }}>56</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ML</span>
                  <span style={{ color: '#19D2EA', fontWeight: 500 }}>44</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
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
              <PendingBarGraph />
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
    </main>
  );
};
