import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { subjectCountAtom, setupsAtom, selectedSetupIdAtom, placedSensorsAtom, subjectPrefixAtom, discoveredSensorsAtom, connectedSensorsAtom } from '../store/atoms';
import { useDiscoverSensors } from '../hooks/useDiscoverSensors';
import { useDisconnectSensors } from '../hooks/useDisconnectSensors';

export const SessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [setups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [placedSensors] = useAtom(placedSensorsAtom);
  const [discoveredSensors] = useAtom(discoveredSensorsAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);
  const { phase, isBusy, activeSubjectId, errorMsg: discoverError, discoverAndConnect, discoverAndConnectForSubject, dismiss } = useDiscoverSensors();
  const { disconnectAll, isDisconnecting, errorMsg: disconnectError, dismissError: dismissDisconnectError } = useDisconnectSensors();

  // Pagination state (we show 4 items at a time in a 2x2 grid)
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);

  const selectedSetup = setups.find((s) => s.id === selectedSetupId);
  const sensorsRequired = selectedSetup ? selectedSetup.sensors.length : 0;

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleBack = () => {
    navigate('/sensor-setup');
  };

  // Generate subjects based on count
  const subjects = Array.from({ length: subjectCount }, (_, i) => {
    const id = i + 1;
    const subjectId = `${subjectPrefix}${id}`;
    const placedCount = selectedSetup ? selectedSetup.sensors.filter((s) => placedSensors.has(`${id}:${s.id}`)).length : 0;
    const discovered = discoveredSensors[subjectId.toLowerCase()] ?? discoveredSensors[subjectId] ?? [];
    const connected = connectedSensors[subjectId.toLowerCase()] ?? connectedSensors[subjectId] ?? [];

    return {
      id,
      name: subjectId,
      sensorsRequired: sensorsRequired,
      sensorsDiscovered: discovered.length,
      sensorsConnected: connected.length,
      sensorsPlaced: placedCount,
      status: 'red',
    };
  });

  const allSensorsPlaced = subjects.length > 0 && subjects.every((s) => s.sensorsPlaced >= s.sensorsRequired && s.sensorsRequired > 0);

  // Get current page subjects
  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <main className="nexus-content screen-layout">
      {/* Header Row with Carousel */}
      <div className="sub-header-row compact">
        <BackButton onClick={handleBack} />
        <SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />
        <InfoButton />
      </div>

      {/* Grid Content */}
      <div className="subjects-grid">
        {currentSubjects.map((subject) => {
          const isComplete = subject.sensorsPlaced >= subject.sensorsRequired && subject.sensorsRequired > 0;
          const isConnected = subject.sensorsConnected > 0;
          const isSubjectBusy = isBusy && activeSubjectId === subject.name;
          const buttonLabel = isComplete ? 'Subject Connected' : isConnected ? 'Place sensors' : isSubjectBusy ? 'Connecting...' : 'Connect subject';
          const handleSubjectAction = () => {
            if (isComplete || isConnected) {
              navigate(`/assign-sensors?subjectId=${subject.id}`);
              return;
            }

            discoverAndConnectForSubject(subject.name);
          };

          return (
            <div key={subject.id} className="subject-card">
              <div className="subject-info">
                <h3 className="subject-title">{subject.name}</h3>

                <div className={`status-row ${isComplete ? 'complete' : 'incomplete'}`}>
                  <div className={`status-dot ${isComplete ? 'complete' : 'incomplete'}`}></div>
                  <span className="status-text">Sensors</span>
                </div>

                {isComplete ? (
                  <div className="subject-stats-list compact">
                    {selectedSetup?.sensors.map((sensor) => (
                      <div key={sensor.id} className="stats-summary">
                        <span>
                          {sensor.type}: {sensor.loc}
                        </span>
                        <div className="status-dot-small complete"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="subject-stats-list">
                    <div className="stat-row">
                      <span>Required</span>
                      <span className="stat-value">{subject.sensorsRequired}</span>
                    </div>
                    <div className="stat-row">
                      <span>Connected</span>
                      <span className="stat-value">{subject.sensorsConnected}</span>
                    </div>
                    <div className="stat-row">
                      <span>Placed</span>
                      <span className="stat-value">{subject.sensorsPlaced}</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                className={`panel-action-btn ${isComplete ? 'complete' : ''}`}
                onClick={handleSubjectAction}
                disabled={isBusy && !isConnected}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        <button className="nexus-btn disconnect-btn" onClick={() => disconnectAll()} disabled={isBusy || isDisconnecting}>
          {isDisconnecting ? 'Disconnecting sensors...' : 'Disconnect sensors'}
        </button>
        <button className="nexus-btn secondary-btn" onClick={() => discoverAndConnect()} disabled={isBusy || isDisconnecting}>
          {'Connect all subjects'}
        </button>
        <button className="nexus-btn" onClick={() => navigate('/new-activity')} disabled={!allSensorsPlaced || isDisconnecting}>
          Create Activity
        </button>
      </div>

      {/* Overlay Modal */}
      {(isBusy || phase === 'error' || disconnectError) && (
        <div
          className="overlay-backdrop"
          onClick={phase === 'error' ? dismiss : disconnectError ? dismissDisconnectError : undefined}
        >
          <div className="overlay-modal" onClick={(e) => e.stopPropagation()}>
            {isBusy && <div className="overlay-spinner" />}
            <div className="overlay-status">
              {phase === 'discovering' && 'Discovering sensors...'}
              {phase === 'connecting' && 'Connecting to sensors...'}
              {phase === 'error' && 'Sensor setup failed'}
              {disconnectError && 'Disconnect failed'}
            </div>
            {discoverError && <div className="overlay-error">{discoverError}</div>}
            {disconnectError && <div className="overlay-error">{disconnectError}</div>}
            {(phase === 'error' || disconnectError) && (
              <button className="nexus-btn" onClick={disconnectError ? dismissDisconnectError : dismiss}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
