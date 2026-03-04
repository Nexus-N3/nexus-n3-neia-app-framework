import React from 'react';
import { BackButton } from './BackButton';

interface CarouselHeaderProps {
  onBack: () => void;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  rightElement?: React.ReactNode;
}

export const CarouselHeader: React.FC<CarouselHeaderProps> = ({ onBack, title, onPrev, onNext, isPrevDisabled, isNextDisabled, rightElement }) => {
  return (
    <div
      className="sub-header-row"
      style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <BackButton onClick={onBack} />

      {/* Carousel Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <button
          onClick={onPrev}
          disabled={isPrevDisabled}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 'inherit',
            cursor: isPrevDisabled ? 'default' : 'pointer',
            opacity: isPrevDisabled ? 0.3 : 1,
          }}
        >
          &lt;
        </button>
        <span style={{ textTransform: 'uppercase', fontWeight: 500 }}>{title}</span>
        <button
          onClick={onNext}
          disabled={isNextDisabled}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 'inherit',
            cursor: isNextDisabled ? 'default' : 'pointer',
            opacity: isNextDisabled ? 0.3 : 1,
          }}
        >
          &gt;
        </button>
      </div>

      {/* Right Element */}
      <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'flex-end' }}>{rightElement}</div>
    </div>
  );
};
