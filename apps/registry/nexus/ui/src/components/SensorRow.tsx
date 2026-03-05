import React, { useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { BatteryIcon } from './BatteryIcon';
import { Sensor } from '../store/atoms';

export const SensorRow = ({ sensor }: { sensor: Sensor }) => {
  const [isOn, setIsOn] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);

  return (
    <div
      className="sensor-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '16px 24px',
        borderRadius: '4px',
        gap: '30px',
      }}
    >
      {/* iOS Style Toggle */}
      <ToggleSwitch isOn={isOn} onToggle={() => setIsOn(!isOn)} />

      {/* Sensor Name */}
      <span style={{ fontWeight: 600, minWidth: '120px' }}>{sensor.type}</span>

      {/* Battery */}
      <BatteryIcon level={76} />

      {/* Placement */}
      <span style={{ color: '#aaa', fontStyle: 'italic', flex: 1 }}>{sensor.loc}</span>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className="nexus-btn secondary-btn"
          style={{
            padding: '0 30px',
            height: '80px',
            minWidth: '210px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            fontSize: '24px',
            borderRadius: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
        >
          Identify
        </button>
        <button
          className="nexus-btn secondary-btn"
          onClick={() => setIsPlaced(!isPlaced)}
          style={{
            padding: '0 30px',
            height: '80px',
            minWidth: '210px',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '15px',
            background: isPlaced ? 'rgba(59, 125, 35, 0.8)' : undefined,
          }}
        >
          {isPlaced ? 'Placed' : 'Place'}
        </button>
      </div>
    </div>
  );
};
