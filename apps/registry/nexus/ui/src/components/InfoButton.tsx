import React from 'react';

interface InfoButtonProps {
  onClick?: () => void;
  className?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`icon-btn info-btn ${className}`} onClick={onClick} aria-label="Info">
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M35.0006 46.6666V34.9999M35.0006 23.3333H35.0298M64.1673 34.9999C64.1673 51.1082 51.109 64.1666 35.0006 64.1666C18.8923 64.1666 5.83398 51.1082 5.83398 34.9999C5.83398 18.8916 18.8923 5.83325 35.0006 5.83325C51.109 5.83325 64.1673 18.8916 64.1673 34.9999Z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};
