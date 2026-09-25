import React from 'react';

interface BurgerMenuProps {
  onClick?: () => void;
  className?: string;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`icon-btn burger-menu ${className}`} onClick={onClick} aria-label="Menu">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 24H42M6 12H42M6 36H42" stroke="#E7EEF3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  );
};
