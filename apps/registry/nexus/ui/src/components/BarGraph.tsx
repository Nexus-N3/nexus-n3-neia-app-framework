import React from 'react';

export interface BarGroup {
  l: string; // height percentage
  r: string; // height percentage
  opacity?: number;
}

interface BarGraphProps {
  variant?: 'simple' | 'detailed';
  data?: BarGroup[];
  labels?: string[];
}

export const BarGraph: React.FC<BarGraphProps> = ({ variant = 'detailed', data, labels }) => {
  const isSimple = variant === 'simple';

  // Default data for detailed view (5 bars)
  const defaultDetailedData: BarGroup[] = [
    { l: '40%', r: '65%' },
    { l: '50%', r: '75%' },
    { l: '45%', r: '60%' },
    { l: '55%', r: '70%' },
    { l: '35%', r: '50%' },
  ];

  // Default data for simple view (3 bars)
  const defaultSimpleData: BarGroup[] = [
    { l: '40%', r: '70%', opacity: 0.5 },
    { l: '40%', r: '70%', opacity: 0.5 },
    { l: '40%', r: '70%', opacity: 1 },
  ];

  const graphData = data || (isSimple ? defaultSimpleData : defaultDetailedData);

  if (isSimple) {
    return (
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
        {graphData.map((heights, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '8px',
              opacity: heights.opacity !== undefined ? heights.opacity : 1,
              alignItems: 'flex-end',
              height: '100%',
              flex: 1,
            }}
          >
            <div style={{ flex: 1, height: heights.l, backgroundColor: '#5960F6', borderRadius: '4px' }}></div>
            <div style={{ flex: 1, height: heights.r, backgroundColor: '#19D2EA', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
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
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            justifyContent: 'space-between',
            padding: '0 20px',
            boxSizing: 'border-box',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1,
          }}
        >
          {graphData.map((heights, i) => (
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
      {labels && (
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
          {labels.map((label) => (
            <div key={label} style={{ width: '14%', textAlign: 'center', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
