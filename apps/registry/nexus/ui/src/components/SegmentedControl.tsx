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
        display: 'inline-flex',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '40px',
        overflow: 'hidden',
        minHeight: '80px'
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
            padding: '12px 32px', // Increased padding
            fontSize: '24px', // Updated font size
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            borderRadius: '36px', // Slightly smaller radius than container to fit inside
            fontWeight: 500,
            textTransform: 'uppercase',
            minWidth: '160px', // Ensure it's not "too short" in width
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
