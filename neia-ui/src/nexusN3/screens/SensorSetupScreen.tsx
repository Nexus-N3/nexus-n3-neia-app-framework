import React, { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useCore } from '../../core/CoreProvider';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { ScreenLayout } from '../components/ScreenLayout';
import { NEXUS_N3_APP } from '../config';
import { useSystemInitialization } from '../hooks/useSystemInitialization';
import {
  buildInitSubjects,
  changeSensorType,
  createEmptySensorRow,
  reconcileSubjectSensorRows,
  validateSensorRow,
  validateSessionDraft,
  type SubjectSensorRows,
} from '../sessionWorkflow';
import {
  configuredSubjectsAtom,
  selectedSubjectAtom,
  serverReadyAtom,
  sessionNameAtom,
  sessionStageAtom,
  subjectCountAtom,
  subjectPrefixAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';
import { buildWorkflowSubjects } from '../utils/subjects';
import { SaveWorkflowButton } from '../components/SaveWorkflowButton';
import { LoadWorkflowButton } from '../components/LoadWorkflowButton';

export const SensorSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const { capabilities, connection } = useCore();
  const [sessionName] = useAtom(sessionNameAtom);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [rowsBySubject, setRowsBySubject] = useAtom(subjectSensorRowsAtom);
  const serverReady = useAtomValue(serverReadyAtom);
  const setSessionStage = useSetAtom(sessionStageAtom);
  const [activeSubjectId, setActiveSubjectId] = useState('');

  const subjects = useMemo(
    () => buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject),
    [configuredSubjects, selectedSubject, subjectCount, subjectPrefix],
  );

  useEffect(() => {
    setRowsBySubject((current) => reconcileSubjectSensorRows(subjects, current));
    setActiveSubjectId((current) =>
      subjects.some((subject) => subject.name === current) ? current : (subjects[0]?.name ?? ''),
    );
    setSessionStage((current) =>
      current === 'idle' || current === 'session_creation' || current === 'subject_selection'
        ? 'sensor_configuration'
        : current,
    );
  }, [setRowsBySubject, setSessionStage, subjects]);

  const validation = useMemo(
    () => validateSessionDraft(subjects, rowsBySubject, capabilities),
    [capabilities, rowsBySubject, subjects],
  );
  const activeSubject = subjects.find((subject) => subject.name === activeSubjectId);

  // temp logging of sensor / alogrithm shape for a subject
  useEffect(() => {
    console.log(
      '[SensorSetup] rowsBySubject:',
      JSON.stringify(rowsBySubject, null, 2),
    );
  }, [rowsBySubject]);


  const activeRows = activeSubject ? rowsBySubject[activeSubject.name] ?? [] : [];
  const availableSensors = capabilities?.sensors.filter((sensor) => sensor.available) ?? [];

  const { isInitializing, errorMsg, initSystem } = useSystemInitialization(() => {
    setSessionStage('sensor_discovery');
    navigate('/session');
  });

  const updateRow = (
    subjectId: string,
    rowId: string,
    updater: (row: (typeof activeRows)[number]) => (typeof activeRows)[number],
  ) => {
    setRowsBySubject((current) => ({
      ...current,
      [subjectId]: (current[subjectId] ?? []).map((row) =>
        row.id === rowId ? updater(row) : row,
      ),
    }));
  };

  const addRow = () => {
    if (!activeSubject) return;
    setRowsBySubject((current) => ({
      ...current,
      [activeSubject.name]: [
        ...(current[activeSubject.name] ?? []),
        createEmptySensorRow(`sensor-${Date.now()}-${activeSubject.id}`),
      ],
    }));
  };

  const removeRow = (rowId: string) => {
    if (!activeSubject) return;
    setRowsBySubject((current) => ({
      ...current,
      [activeSubject.name]: (current[activeSubject.name] ?? []).filter(
        (row) => row.id !== rowId,
      ),
    }));
  };

  const handleCreateSession = async () => {
    if (!capabilities || !validation.valid || !serverReady) return;
    const subjectsPayload = buildInitSubjects(subjects, rowsBySubject, capabilities);
    await initSystem({
      type: 'init_system',
      payload: {
        init_label: sessionName || `Session_${new Date().toISOString()}`,
        app_id: NEXUS_N3_APP.id,
        app_name: NEXUS_N3_APP.name,
        subjects: subjectsPayload,
      },
    });
  };


  return (
    <ScreenLayout
      className="screen-layout sensor-setup-screen"
      header={
        <div className="sub-header-row">
          <BackButton onClick={() => navigate('/subjects')} disabled={isInitializing} />
          <h2 className="screen-title">SENSOR CONFIGURATION</h2>
          <InfoButton />
        </div>
      }
      footer={
        <div className="screen-footer">
          {/*<div className="configuration-status" aria-live="polite">
            {!serverReady
              ? 'Core disconnected — your draft is preserved.'
              : validation.valid
                ? 'Configuration complete'
                : 'Complete every subject before continuing'}
          </div>
          <div />*/}
          <button
            className="nexus-btn"
            onClick={handleCreateSession}
            disabled={!validation.valid || !serverReady || isInitializing}
          >
            {isInitializing ? 'Initializing...' : 'Create session'}
          </button>
        </div>
      }
    >
      {errorMsg ? <div className="error-banner">Error: {errorMsg}</div> : null}

      <div className="subject-configuration-layout">
        <nav className="subject-config-tabs" aria-label="Subjects">
          {subjects.map((subject) => {
            const errors = validation.errorsBySubject[subject.name] ?? [];
            return (
              <button
                key={subject.name}
                type="button"
                className={activeSubjectId === subject.name ? 'active' : ''}
                onClick={() => setActiveSubjectId(subject.name)}
              >
                <span>{subject.displayName}</span>
                <small>{errors.length === 0 ? 'Complete' : `${errors.length} issue${errors.length === 1 ? '' : 's'}`}</small>
              </button>
            );
          })}
        </nav>

        <section className="subject-config-panel">
          <div className="workflow-action-row">
            <SaveWorkflowButton
              subjects={subjects}
              disabled={!validation.valid || isInitializing}
            />
            <LoadWorkflowButton
              subjects={subjects}
              disabled={isInitializing}
            />
          </div>
          
          <div className="subject-config-heading">
            <div>
              <h3>{activeSubject?.displayName ?? 'No subject selected'}</h3>
            </div>
            <button
              type="button"
              className="nexus-btn secondary-btn"
              onClick={addRow}
              disabled={!activeSubject}
            >
              Add sensor
            </button>
          </div>

          {availableSensors.length === 0 ? (
            <div className="sensor-config-empty">
              No sensor capabilities are available from Core. No fallback configuration will be used.
            </div>
          ) : null}

          {activeRows.length === 0 ? (
            <div className="sensor-config-empty">
              This subject has no sensors. Add a sensor to begin its configuration.
            </div>
          ) : (
            <div className="logical-sensor-list">
              {activeRows.map((row, index) => {
                const selectedSensor = availableSensors.find(
                  (sensor) => sensor.id === row.sensorType,
                );
                const rowValidation = validateSensorRow(row, capabilities);
                return (
                  <div className={`logical-sensor-row ${rowValidation.valid ? 'valid' : 'invalid'}`} key={row.id}>
                    <div className="logical-sensor-row-title">
                      <strong>Sensor {index + 1}</strong>
                      <span>{rowValidation.valid ? 'Complete' : 'Incomplete'}</span>
                    </div>

                    <label>
                      <span>Sensor type</span>
                      <select
                        value={row.sensorType}
                        onChange={(event) =>
                          updateRow(activeSubjectId, row.id, (current) =>
                            changeSensorType(current, event.target.value, capabilities),
                          )
                        }
                      >
                        <option value="">Select type</option>
                        {availableSensors.map((sensor) => (
                          <option key={sensor.id} value={sensor.id}>
                            {sensor.display_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Location</span>
                      <select
                        value={row.location}
                        disabled={!selectedSensor}
                        onChange={(event) =>
                          updateRow(activeSubjectId, row.id, (current) => ({
                            ...current,
                            location: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select location</option>
                        {(selectedSensor?.supported_locations ?? []).map((location) => (
                          <option key={location} value={location}>
                            {location.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Algorithm</span>
                      <select
                        value={row.algorithms[0] ?? ''}
                        disabled={!selectedSensor}
                        onChange={(event) =>
                          updateRow(activeSubjectId, row.id, (current) => ({
                            ...current,
                            algorithms: event.target.value ? [event.target.value] : [],
                          }))
                        }
                      >
                        <option value="">Select algorithm</option>
                        {(selectedSensor?.supported_algorithms ?? []).map((algorithmId) => {
                          const algorithm = capabilities?.algorithms.find(
                            (candidate) => candidate.id === algorithmId && candidate.available,
                          );
                          return algorithm ? (
                            <option key={algorithm.id} value={algorithm.id}>
                              {algorithm.display_name}
                            </option>
                          ) : null;
                        })}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="logical-sensor-remove"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove sensor ${index + 1}`}
                    >
                      Remove
                    </button>

                    {!rowValidation.valid ? (
                      <ul className="logical-sensor-errors">
                        {rowValidation.errors.map((error) => <li key={error}>{error}</li>)}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {connection?.state !== 'connected' ? (
        <div className="draft-disconnected-notice">
          Core is {connection?.state ?? 'disconnected'}. Editing remains available; initialization is disabled.
        </div>
      ) : null}

    </ScreenLayout>
  );
};
