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
    <div className="carousel">
      <button className="carousel-btn" onClick={onPrev} disabled={currentPage === 0}>
        <img src={chevronLeft} alt="Previous" />
      </button>
      <span className="carousel-title">{title}</span>
      <button className="carousel-btn" onClick={onNext} disabled={currentPage >= totalPages - 1}>
        <img src={chevronRight} alt="Next" />
      </button>
    </div>
  );
};
