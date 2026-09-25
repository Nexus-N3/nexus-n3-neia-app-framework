import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => {
  return (
    <div className={`toggle-switch ${isOn ? 'on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  );
};
