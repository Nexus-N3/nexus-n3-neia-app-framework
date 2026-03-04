import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`icon-btn back-btn ${className}`} onClick={onClick} aria-label="Go back">
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40.833 52.5L23.333 35L40.833 17.5L44.9163 21.5833L31.4997 35L44.9163 48.4167L40.833 52.5Z" fill="#E7EEF3" />
      </svg>
    </button>
  );
};
