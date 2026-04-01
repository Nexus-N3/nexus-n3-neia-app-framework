import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SensorRow } from '../components/SensorRow';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, setupsAtom, selectedSetupIdAtom, selectedSubjectAtom, placedSensorsAtom, activeActivityAtom, subjectPrefixAtom, connectedSensorsAtom } from '../store/atoms';
import { buildWorkflowSubjects } from '../utils/subjects';

export const AssignSensorsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');
  const targetSubjectId = subjectIdParam ? parseInt(subjectIdParam, 10) : null;

  const [subjectCount] = useAtom(subjectCountAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [placedSensors] = useAtom(placedSensorsAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);

  // Determine required sensors
  const selectedSetup = setups.find((s) => s.id === selectedSetupId);
  const requiredSensors = selectedSetup ? selectedSetup.sensors : [];

  // Generate subjects (this should ideally be shared state, but keeping consistent with SessionScreen logic)
  let subjects = buildWorkflowSubjects(subjectCount, subjectPrefix, selectedSubject).map((subject) => {
    const id = subject.id;
    const subjectName = subject.name;
    const subjectPlacedCount = requiredSensors.filter((s) => placedSensors.has(`${id}:${s.id}`)).length;
    const connected = connectedSensors[subjectName.toLowerCase()] ?? connectedSensors[subjectName] ?? [];
    return {
      id,
      name: subjectName,
      displayName: subject.displayName,
      requiredCount: requiredSensors ? requiredSensors.length : 0,
      connectedCount: connected.length,
      placedCount: subjectPlacedCount,
    };
  });

  if (targetSubjectId) {
    subjects = subjects.filter((s) => s.id === targetSubjectId);
  }

  const handleBack = () => {
    if (activeActivity) {
      navigate('/active-session');
    } else {
      navigate('/session');
    }
  };

  const handlePrevSubject = () => {
    if (targetSubjectId && targetSubjectId > 1) {
      setSearchParams({ subjectId: (targetSubjectId - 1).toString() });
    }
  };

  const handleNextSubject = () => {
    if (targetSubjectId && targetSubjectId < subjectCount) {
      setSearchParams({ subjectId: (targetSubjectId + 1).toString() });
    }
  };

  return (
    <main className="nexus-content screen-layout stretch assign-sensors-screen">
      {/* Sub Header */}
      <ScreenHeader
        className="compact"
        left={<BackButton onClick={handleBack} />}
        center={
          targetSubjectId ? (
            <SubjectsCarousel
              currentPage={targetSubjectId - 1}
              totalPages={subjectCount}
              onPrev={handlePrevSubject}
              onNext={handleNextSubject}
              title={subjects[0]?.displayName ?? subjects[0]?.name ?? ''}
            />
          ) : (
            <h2 className="screen-title">PLACE SENSORS</h2>
          )
        }
        right={<InfoButton />}
      />

      <div className="sensors-scroll-container">
        {subjects.map((subject) => (
          <div key={subject.id} className="subject-section">
            {/* Subject Header */}
            <div className="subject-header">
              <h3 className="subject-header-title">
                {subject.displayName}: assigned sensors
              </h3>
              <div className="subject-stats-row">
                <div className={`status-dot-small ${subject.placedCount >= subject.requiredCount ? 'complete' : 'incomplete'}`} />
                <span>{subject.requiredCount} required,</span>
                <span>{subject.connectedCount} connected,</span>
                <span>{subject.placedCount} placed</span>
              </div>
            </div>

            {/* Sensors List */}
              <div className="sensors-list-container">
                {requiredSensors.map((sensor, idx) => (
                  <SensorRow key={`${subject.id}-${idx}`} subjectId={subject.id} subjectName={subject.name} sensor={sensor} />
                ))}
                {requiredSensors.length === 0 && <div className="empty-state-msg">No sensors required for this setup.</div>}
              </div>
          </div>
        ))}
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        <div></div>
        <div></div>
        <button
          className="nexus-btn"
          onClick={() => (activeActivity ? navigate('/active-session') : navigate('/session'))}
        >
          Return to session
        </button>
      </div>
    </main>
  );
};
