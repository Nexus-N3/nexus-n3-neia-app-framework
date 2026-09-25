import React from 'react';

export const BatteryIcon = ({ level }: { level: number | null }) => {
  if (level === null) {
    return (
      <div className="battery-container">
        <span className="battery-level-text">-</span>
      </div>
    );
  }

  // Constants for the inner fill rectangle
  // Outline bounds roughly: x[2.7, 51.5], y[16.2, 48.8]
  // Stroke width is 4, so inner available space is approx x[4.7, 49.5], y[18.2, 46.8]
  const MAX_WIDTH = 40;
  const HEIGHT = 24;
  const X_OFFSET = 7;
  const Y_OFFSET = 20.5;

  const currentWidth = (level / 100) * MAX_WIDTH;
  const color = level > 20 ? '#4caf50' : '#ff6b6b';

  return (
    <div className="battery-container">
      <svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x={X_OFFSET} y={Y_OFFSET} width={currentWidth} height={HEIGHT} rx="2" fill={color} />
        <path
          d="M62.2913 35.2083V29.7917M8.12467 16.25H46.0413C49.0329 16.25 51.458 18.6751 51.458 21.6667V43.3333C51.458 46.3249 49.0329 48.75 46.0413 48.75H8.12467C5.13313 48.75 2.70801 46.3249 2.70801 43.3333V21.6667C2.70801 18.6751 5.13313 16.25 8.12467 16.25Z"
          stroke="#E7EEF3"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="battery-level-text">{level}%</span>
    </div>
  );
};
