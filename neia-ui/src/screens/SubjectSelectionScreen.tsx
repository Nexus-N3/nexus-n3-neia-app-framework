import { StartupSequence } from "../components/StartupSequence";
import { SubjectCarousel } from "../components/SubjectCarousel";
import type { StartupStage, SubjectSelectionOption } from "../types";

type SubjectSelectionScreenProps = {
  currentSubject: SubjectSelectionOption | null;
  dashboardClass: string;
  showStartup: boolean;
  startupExiting: boolean;
  startupStage: StartupStage;
  subjectCount: number;
  subjectIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSelectSubject: (subject: SubjectSelectionOption) => void;
  onSkip: () => void;
};

export function SubjectSelectionScreen({
  currentSubject,
  dashboardClass,
  showStartup,
  startupExiting,
  startupStage,
  subjectCount,
  subjectIndex,
  onNext,
  onPrev,
  onSelectSubject,
  onSkip,
}: SubjectSelectionScreenProps) {
  return (
    <>
      <div className={dashboardClass}>
        <header className="shell-header">
          <div className="shell-brand" />
          <img className="shell-logo" src="/neia_logo.png" alt="NEIA logo" />
        </header>

        <section className="shell-body full">
          <div className="panel wide subject-select-panel">
            <SubjectCarousel
              currentIndex={subjectIndex}
              total={subjectCount}
              title={currentSubject?.groupLabel || "Subjects"}
              onPrev={onPrev}
              onNext={onNext}
            />
            {currentSubject ? (
              <>
                <button
                  className="subject-focus-card"
                  onClick={() => onSelectSubject(currentSubject)}
                  type="button"
                >
                  <p className="subject-focus-kicker">Current Subject</p>
                  <h2>{currentSubject.display_name}</h2>
                  <p className="subject-focus-id">
                    {currentSubject.subject_type ? `${currentSubject.subject_type} · ` : ""}
                    {currentSubject.subject_id}
                  </p>
                </button>
                <button className="subject-skip-action subject-skip-outside" onClick={onSkip} type="button">
                  Continue without subject
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>
      {showStartup ? <StartupSequence stage={startupStage} exiting={startupExiting} /> : null}
    </>
  );
}
