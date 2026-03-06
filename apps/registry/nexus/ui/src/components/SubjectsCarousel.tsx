import React from 'react';
import chevronLeft from '../assets/chevron-left.svg';
import chevronRight from '../assets/chevron-right.svg';

interface SubjectsCarouselProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  title?: string;
}

export const SubjectsCarousel: React.FC<SubjectsCarouselProps> = ({ currentPage, totalPages, onPrev, onNext, title = 'Subjects' }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
      <button
        onClick={onPrev}
        disabled={currentPage === 0}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'white',
          cursor: currentPage === 0 ? 'default' : 'pointer',
          opacity: currentPage === 0 ? 0.3 : 1,
        }}
      >
        <img src={chevronLeft} alt="Previous" style={{ width: '32px', height: '32px', marginTop: '8px' }} />
      </button>
      <span style={{ textTransform: 'uppercase', fontWeight: 500, fontSize: '48px' }}>{title}</span>
      <button
        onClick={onNext}
        disabled={currentPage >= totalPages - 1}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'white',
          cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
          opacity: currentPage >= totalPages - 1 ? 0.3 : 1,
        }}
      >
        <img src={chevronRight} alt="Next" style={{ width: '32px', height: '32px', marginTop: '8px' }} />
      </button>
    </div>
  );
};
