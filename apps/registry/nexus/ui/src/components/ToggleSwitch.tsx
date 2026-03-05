import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => {
  return (
    <div
      onClick={onToggle}
      style={{
        width: '140px',
        height: '80px',
        background: isOn ? 'rgba(76, 175, 80, 0.4)' : 'rgba(231, 238, 243, 0.1)',
        borderRadius: '40px',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.2s',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          background: isOn ? '#4caf50' : '#8A92BF',
          borderRadius: '50%',
          position: 'absolute',
          left: isOn ? '60px' : '0',
          transition: 'left 0.2s cubic-bezier(0.4, 0.0, 0.2, 1), background-color 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  );
};
