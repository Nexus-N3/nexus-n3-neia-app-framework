type SubjectCarouselProps = {
  currentIndex: number;
  total: number;
  title: string;
  onPrev: () => void;
  onNext: () => void;
};

export function SubjectCarousel({
  currentIndex,
  total,
  title,
  onPrev,
  onNext,
}: SubjectCarouselProps) {
  return (
    <div className="subject-carousel">
      <button className="subject-carousel-btn" onClick={onPrev} disabled={currentIndex === 0} aria-label="Previous subject">
        <span aria-hidden="true">‹</span>
      </button>
      <div className="subject-carousel-copy">
        <span className="subject-carousel-title">{title}</span>
        <span className="subject-carousel-count">
          {currentIndex + 1} / {total}
        </span>
      </div>
      <button
        className="subject-carousel-btn"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        aria-label="Next subject"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
