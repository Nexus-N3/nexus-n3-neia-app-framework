import React from 'react';

interface BurgerMenuProps {
  onClick?: () => void;
  className?: string;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`burger-menu ${className}`} onClick={onClick} aria-label="Menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12H21" />
        <path d="M3 6H21" />
        <path d="M3 18H21" />
      </svg>
    </button>
  );
};
