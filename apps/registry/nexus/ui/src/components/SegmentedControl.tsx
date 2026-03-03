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
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '40px',
        overflow: 'hidden',
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
            padding: '8px 16px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            flex: 1,
            borderRadius: '40px',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
