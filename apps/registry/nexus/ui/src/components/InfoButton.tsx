import React from 'react';

interface InfoButtonProps {
  onClick?: () => void;
  className?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`icon-btn info-btn ${className}`} onClick={onClick} aria-label="Info">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16V12" />
        <path d="M12 8H12.01" />
      </svg>
    </button>
  );
};
