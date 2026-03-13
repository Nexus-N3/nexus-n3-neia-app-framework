import React from 'react';

interface SubjectsCarouselProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  title?: string;
}

export const SubjectsCarousel: React.FC<SubjectsCarouselProps> = ({ currentPage, totalPages, onPrev, onNext, title = 'Subjects' }) => {
  return (
    <div className="carousel">
      <button className="carousel-btn" onClick={onPrev} disabled={currentPage === 0}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M17.5 7L10.5 14L17.5 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="carousel-title">{title}</span>
      <button className="carousel-btn" onClick={onNext} disabled={currentPage >= totalPages - 1}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M10.5 7L17.5 14L10.5 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};
