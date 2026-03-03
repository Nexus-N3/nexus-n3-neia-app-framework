import React from 'react';

interface SegmentedControlProps<T> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export const SegmentedControl = <T extends string>({ options, value, onChange }: SegmentedControlProps<T>) => {
  return (
    <div
      style={{
        display: 'flex',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        padding: '2px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            background: value === option.value ? '#5960F6' : 'transparent',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '2px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
