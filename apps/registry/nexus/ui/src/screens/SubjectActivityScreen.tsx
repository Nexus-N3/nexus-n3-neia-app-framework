import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { SegmentedControl } from '../components/SegmentedControl';
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
    {[0.5, 0.5, 1, 1, 0.5, 0.5].map((opacity, i) => (
      <div key={i} style={{ display: 'flex', gap: '8px', opacity, alignItems: 'flex-end', height: '100%', flex: 1 }}>
        <div style={{ flex: 1, height: '40%', backgroundColor: '#5960F6', borderRadius: '4px' }}></div>
        <div style={{ flex: 1, height: '70%', backgroundColor: '#19D2EA', borderRadius: '4px' }}></div>
      </div>
    ))}
  </div>
);

type Tab = 'performance' | 'loading';

export const SubjectActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '1', 10);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeTab, setActiveTab] = useState<Tab>('performance');
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
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <button
              onClick={() => setActiveTab('performance')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'performance' ? '2px solid #5960F6' : '2px solid transparent',
                color: activeTab === 'performance' ? 'white' : 'rgba(255, 255, 255, 0.6)',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                flex: 1,
              }}
            >
              Performance
            </button>
            <button
              onClick={() => setActiveTab('loading')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'loading' ? '2px solid #5960F6' : '2px solid transparent',
                color: activeTab === 'loading' ? 'white' : 'rgba(255, 255, 255, 0.6)',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                flex: 1,
              }}
            >
              Loading
            </button>
          </div>

          <div style={{ color: 'white' }}>
            {/* INTENSITY DOSE */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Intensity Dose
              </h4>
              <div style={{ display: 'flex', gap: '20px', fontSize: '24px', fontWeight: 500 }}>
                <span>
                  5.1 <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>bw/s</span>
                </span>
                <span>
                  0.3 <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>kBW</span>
                </span>
              </div>
            </div>

            <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '20px 0' }} />

            {/* IMBALANCE */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Imbalance
              </h4>
              <div style={{ marginBottom: '12px', fontSize: '14px' }}>Right side dominant</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>OFFLOAD RATIO</span>
                <span style={{ fontSize: '24px', fontWeight: 600 }}>4%</span>
                <span style={{ fontSize: '18px', fontFamily: 'monospace' }}>48:52</span>
              </div>
            </div>

            <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '20px 0' }} />

            {/* MOVEMENT COMPENSATIONS (%) */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Movement Compensations (%)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>42</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>V</span>
                  <span>58</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>56</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ML</span>
                  <span>44</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>48</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>AP</span>
                  <span>52</span>
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
