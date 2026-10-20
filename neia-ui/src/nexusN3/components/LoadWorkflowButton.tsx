import React, { useState } from 'react';
import { useSetAtom } from 'jotai';
import { toast } from 'sonner';

import { useWorkflows } from '../../hooks/useWorkflows';
import {
  createEmptySensorRow,
  type SubjectSensorRows,
} from '../sessionWorkflow';
import {
  activeWorkflowIdAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';
import type { WorkflowSubject } from '../utils/subjects';

interface LoadWorkflowButtonProps {
  subjects: WorkflowSubject[];
  disabled?: boolean;
}

export const LoadWorkflowButton: React.FC<
  LoadWorkflowButtonProps
> = ({
  subjects,
  disabled = false,
}) => {
  const setRowsBySubject = useSetAtom(subjectSensorRowsAtom);
  const setActiveWorkflowId = useSetAtom(activeWorkflowIdAtom);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  const {
    workflows,
    loading: workflowsLoading,
    loadingWorkflow,
    error: workflowApiError,
    load: loadWorkflow,
  } = useWorkflows();

  const handleLoadWorkflow = async () => {
    if (!selectedWorkflowId) {
      return;
    }

    try {
      const loadedWorkflow = await loadWorkflow(
        selectedWorkflowId,
        subjects.map((subject) => subject.name),
      );

      const loadedAt = Date.now();

      const nextRowsBySubject = subjects.reduce<SubjectSensorRows>(
        (result, subject) => {
          const loadedSensors =
            loadedWorkflow.subjects[subject.name] ?? [];

          result[subject.name] = loadedSensors.map(
            (sensor, index) => ({
              ...createEmptySensorRow(
                `sensor-${loadedAt}-${subject.id}-${index + 1}`,
              ),
              sensorType: sensor.sensor_type,
              location: sensor.location,
              algorithms: [...sensor.algorithms],
            }),
          );

          return result;
        },
        {},
      );

      setRowsBySubject(nextRowsBySubject);
      setActiveWorkflowId(loadedWorkflow.workflow_id);
      setModalOpen(false);

      toast.success('Workflow loaded', {
        description: `"${loadedWorkflow.workflow_name}" was loaded successfully.`,
        duration: 3000,
      });
    } catch {
      // Keep the modal open so the API error remains visible.
    }
  };

  return (
    <>
      <button
        type="button"
        className="nexus-btn secondary-btn"
        disabled={disabled || loadingWorkflow}
        onClick={() => {
          setSelectedWorkflowId('');
          setModalOpen(true);
        }}
      >
        Load workflow
      </button>

      {modalOpen ? (
        <div
          className="overlay-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!loadingWorkflow) {
              setModalOpen(false);
            }
          }}
        >
          <form
            className="overlay-modal workflow-load-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="load-workflow-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleLoadWorkflow();
            }}
          >
            <h2 id="load-workflow-title">
              Load workflow
            </h2>

            <p className="workflow-modal-description">
              Select a saved sensor and algorithm configuration.
            </p>

            {workflowsLoading ? (
              <div className="workflow-load-status">
                <div className="overlay-spinner" />
                <span>Loading workflows...</span>
              </div>
            ) : workflows.length === 0 ? (
              <div className="workflow-modal-empty">
                No saved workflows are available.
              </div>
            ) : (
              <label className="workflow-modal-field">
                <span>Saved workflow</span>

                <select
                  className="workflow-modal-input"
                  value={selectedWorkflowId}
                  disabled={loadingWorkflow}
                  onChange={(event) =>
                    setSelectedWorkflowId(event.target.value)
                  }
                >
                  <option value="">
                    Select a workflow
                  </option>

                  {workflows.map((workflow) => (
                    <option
                      key={workflow.id}
                      value={workflow.id}
                    >
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {loadingWorkflow ? (
              <div
                className="workflow-load-status"
                role="status"
                aria-live="polite"
              >
                <div className="overlay-spinner" />
                <span>Loading workflow...</span>
              </div>
            ) : null}

            {workflowApiError ? (
              <div className="overlay-error" role="alert">
                {workflowApiError}
              </div>
            ) : null}

            <div className="workflow-modal-actions">
              <button
                type="button"
                className="nexus-btn secondary-btn"
                disabled={loadingWorkflow}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="nexus-btn"
                disabled={
                  loadingWorkflow ||
                  workflowsLoading ||
                  !selectedWorkflowId
                }
              >
                {loadingWorkflow ? 'Loading...' : 'Load'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
};