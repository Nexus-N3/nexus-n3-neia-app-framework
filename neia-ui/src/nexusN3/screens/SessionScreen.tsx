import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusOverlay } from '../components/StatusOverlay';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { ScreenLayout } from '../components/ScreenLayout';
import { configuredSubjectsAtom, subjectCountAtom, selectedSubjectAtom, placedSensorsAtom, subjectPrefixAtom, discoveredSensorsAtom, connectedSensorsAtom, serverReadyAtom, sessionStageAtom, streamDrainStateAtom, subjectSensorRowsAtom } from '../store/atoms';
import { useDiscoverSensorsCore } from '../hooks/useDiscoverSensorsCore';
import { useDisconnectSensorsCore } from '../hooks/useDisconnectSensorsCore';
import { useResetSessionState } from '../hooks/useResetSessionState';
import { isCompactFlowViewport } from '../utils/displayProfiles';
import { buildWorkflowSubjects } from '../utils/subjects';

export const SessionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [rowsBySubject] = useAtom(subjectSensorRowsAtom);
  const [serverReady] = useAtom(serverReadyAtom);
  const [, setSessionStage] = useAtom(sessionStageAtom);
  const [placedSensors] = useAtom(placedSensorsAtom);
  const [discoveredSensors] = useAtom(discoveredSensorsAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);
  const streamDrainState = useAtomValue(streamDrainStateAtom);
  const setDiscoveredSensors = useSetAtom(discoveredSensorsAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const {
    phase,
    isBusy,
    activeSubjectId,
    errorMsg: discoverError,
    discoverAndConnect,
    recoverAndConnect,
    recoverAndConnectForSubject,
    discoverAndConnectForSubject,
    dismiss,
    discoveredSensors: liveDiscoveredSensors,
  } = useDiscoverSensorsCore();
  const {
    disconnectAll,
    disconnectCount,
    isDisconnecting,
    isDrainPending,
    errorMsg: disconnectError,
    dismissError: dismissDisconnectError,
  } = useDisconnectSensorsCore();
  const { resetSessionState } = useResetSessionState();
  const [disconnectRequested, setDisconnectRequested] = useState(false);

  // Pagination state (larger screens show 4 items at a time, compact shows 1)
  const [currentPage, setCurrentPage] = useState(0);
  const isCompactViewport = isCompactFlowViewport();
  const itemsPerPage = isCompactViewport ? 1 : 4;
  const totalPages = Math.ceil(subjectCount / itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleBack = () => {
    navigate('/sensor-setup');
  };

  useEffect(() => {
    if (!disconnectRequested || disconnectCount === 0) {
      return;
    }

    resetSessionState();
    navigate('/');
  }, [disconnectCount, disconnectRequested, navigate, resetSessionState]);

  useEffect(() => {
    setDiscoveredSensors(liveDiscoveredSensors);
  }, [liveDiscoveredSensors, setDiscoveredSensors]);

  const connectedAddresses = Array.from(new Set(
    Object.values(connectedSensors)
      .flat()
      .filter((sensor) => sensor.status.toUpperCase() === 'CONNECTED')
      .map((sensor) => sensor.address.toUpperCase()),
  ));
  const claimedConnectedAddresses = new Set<string>();

  // Generate subjects based on count. A physical address can satisfy only one
  // configured sensor, even if a stale payload lists it more than once.
  const subjects = buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject).map((subject) => {
    const subjectId = subject.name;
    const id = subject.id;
    const requiredSensors = rowsBySubject[subjectId] ?? [];
    const placedCount = requiredSensors.filter((sensor) => placedSensors.has(`${id}:${sensor.id}`)).length;
    const discovered = discoveredSensors[subjectId.toLowerCase()] ?? discoveredSensors[subjectId] ?? [];
    const connected = (connectedSensors[subjectId.toLowerCase()] ?? connectedSensors[subjectId] ?? [])
      .filter((sensor) => sensor.status.toUpperCase() === 'CONNECTED')
      .filter((sensor) => {
        const address = sensor.address.toUpperCase();
        if (claimedConnectedAddresses.has(address)) {
          return false;
        }
        claimedConnectedAddresses.add(address);
        return true;
      });

    return {
      id,
      name: subjectId,
      displayName: subject.displayName,
      sensorsRequired: requiredSensors.length,
      requiredSensors,
      sensorsDiscovered: discovered.length,
      sensorsConnected: connected.length,
      sensorsPlaced: placedCount,
      status: 'red',
    };
  });

  const allSubjectsReady = subjects.length > 0 && subjects.every(
    (subject) => subject.sensorsRequired > 0
      && subject.sensorsConnected >= subject.sensorsRequired
      && subject.sensorsPlaced >= subject.sensorsRequired,
  );

  const startConnection = (subjectId?: string) => {
    if (subjectId) {
      const subjectConnectedAddresses = Array.from(new Set(
        (connectedSensors[subjectId.toLowerCase()] ?? connectedSensors[subjectId] ?? [])
          .filter((sensor) => sensor.status.toUpperCase() === 'CONNECTED')
          .map((sensor) => sensor.address.toUpperCase()),
      ));

      if (subjectConnectedAddresses.length > 0) {
        recoverAndConnectForSubject(subjectId, subjectConnectedAddresses);
      } else {
        discoverAndConnectForSubject(subjectId);
      }
      return;
    }

    if (connectedAddresses.length > 0) {
      setConnectedSensors({});
      setDiscoveredSensors({});
      recoverAndConnect(connectedAddresses);
      return;
    }

    discoverAndConnect();
  };

  useEffect(() => {
    setSessionStage((current) =>
      current === 'sensor_discovery' || current === 'session_readiness'
        ? (allSubjectsReady ? 'session_readiness' : 'sensor_discovery')
        : current,
    );
  }, [allSubjectsReady, setSessionStage]);

  // Get current page subjects
  const currentSubjects = subjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <ScreenLayout
      className="screen-layout session-screen"
      header={
        <ScreenHeader
          className="compact"
          left={<BackButton onClick={handleBack} />}
          center={<SubjectsCarousel currentPage={currentPage} totalPages={totalPages} onPrev={handlePrevPage} onNext={handleNextPage} />}
          right={""}
        />
      }
      footer={
        <div className="action-row">
          <button
            className="nexus-btn disconnect-btn"
            onClick={async () => {
              setDisconnectRequested(true);
              try {
                await disconnectAll();
              } catch {
                setDisconnectRequested(false);
              }
            }}
            disabled={isBusy || isDisconnecting || isDrainPending}
          >
            {isDisconnecting ? 'Disconnecting sensors...' : isDrainPending ? 'Finalizing session...' : 'Disconnect sensors'}
          </button>
          <button className="nexus-btn secondary-btn" onClick={() => startConnection()} disabled={!serverReady || isBusy || isDisconnecting}>
            {'Connect all subjects'}
          </button>
          <button className="nexus-btn" onClick={() => navigate('/new-activity')} disabled={!serverReady || !allSubjectsReady || isDisconnecting}>
            Create Activity
          </button>
        </div>
      }
    >
      <div className="subjects-grid">
        {currentSubjects.map((subject) => {
          const hasAllRequiredConnections = subject.sensorsRequired > 0
            && subject.sensorsConnected >= subject.sensorsRequired;
          const isComplete = hasAllRequiredConnections
            && subject.sensorsPlaced >= subject.sensorsRequired;
          const isSubjectBusy = isBusy && activeSubjectId === subject.name;
          const buttonLabel = isComplete && hasAllRequiredConnections
            ? 'Subject Connected'
            : hasAllRequiredConnections
              ? 'Place sensors'
              : isSubjectBusy
                ? 'Connecting...'
                : 'Connect subject';
          const handleSubjectAction = () => {
            if (hasAllRequiredConnections) {
              navigate(`/assign-sensors?subjectId=${subject.id}`);
              return;
            }

            if (serverReady) {
              startConnection(subject.name);
            }
          };

          return (
            <div key={subject.id} className="subject-card">
              <div className="subject-info">
                <h3 className="subject-title">{subject.displayName}</h3>

                <div className={`status-row ${isComplete ? 'complete' : 'incomplete'}`}>
                  <div className={`status-dot ${isComplete ? 'complete' : 'incomplete'}`}></div>
                </div>

                {isComplete ? (
                  <div className="subject-stats-list compact">
                    {subject.requiredSensors.map((sensor) => (
                      <div key={sensor.id} className="stats-summary">
                        <span>
                          {sensor.sensorType}: {sensor.location}
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
                className={`panel-action-btn primary ${isComplete ? 'complete' : ''}`}
                onClick={handleSubjectAction}
                disabled={!serverReady || isBusy}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      <StatusOverlay
        busy={isBusy || isDisconnecting || streamDrainState.pending}
        statusText={
          isDisconnecting
            ? 'Disconnecting sensors...'
            : phase === 'disconnecting'
              ? 'Disconnecting sensors...'
            : streamDrainState.pending
              ? streamDrainState.status ?? 'Finalizing session files...'
            : phase === 'discovering'
            ? 'Discovering sensors...'
            : phase === 'connecting'
              ? 'Connecting sensors...'
              : phase === 'error'
                ? 'Sensor setup failed'
                : disconnectError
                  ? 'Disconnect failed'
                  : null
        }
        errors={[discoverError, disconnectError]}
        onDismiss={disconnectError ? dismissDisconnectError : phase === 'error' ? dismiss : undefined}
      />
    </ScreenLayout>
  );
};
