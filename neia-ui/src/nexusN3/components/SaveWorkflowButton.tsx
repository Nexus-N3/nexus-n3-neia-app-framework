import React, { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';

import { useWorkflows } from '../../hooks/useWorkflows';
import type { WorkflowSubject } from '../utils/subjects';
import {
  activeWorkflowIdAtom,
  subjectSensorRowsAtom,
} from '../store/atoms';

interface SaveWorkflowButtonProps {
  subjects: WorkflowSubject[];
  disabled?: boolean;
}

export const SaveWorkflowButton: React.FC<
  SaveWorkflowButtonProps
> = ({
  subjects,
  disabled = false,
}) => {
  const rowsBySubject = useAtomValue(subjectSensorRowsAtom);

  const [activeWorkflowId, setActiveWorkflowId] = useAtom(
    activeWorkflowIdAtom,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');

  const {
    saving: workflowSaving,
    error: workflowApiError,
    save: saveWorkflow,
  } = useWorkflows();

  const handleSaveWorkflow = async () => {
    const name = workflowName.trim();

    if (!name || disabled) {
      return;
    }

    try {
      const savedWorkflow = await saveWorkflow({
        name,
        derived_from: activeWorkflowId,
        subjects: subjects.map((subject) => ({
          subject_id: subject.name,
          sensors: (rowsBySubject[subject.name] ?? []).map((row) => ({
            sensor_type: row.sensorType,
            location: row.location,
            algorithms: [...row.algorithms],
          })),
        })),
      });

      setActiveWorkflowId(savedWorkflow.id);
      setModalOpen(false);

      toast.success('Workflow saved', {
        description: `"${savedWorkflow.name}" was saved successfully.`,
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
        disabled={disabled || workflowSaving}
        onClick={() => {
          setWorkflowName('');
          setModalOpen(true);
        }}
      >
        Save workflow
      </button>

      {modalOpen ? (
        <div
          className="overlay-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!workflowSaving) {
              setModalOpen(false);
            }
          }}
        >
          <form
            className="overlay-modal workflow-save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-workflow-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveWorkflow();
            }}
          >
            <h2 id="save-workflow-title">
              Save workflow
            </h2>

            <p className="workflow-modal-description">
              Save the current sensor and algorithm configuration.
            </p>

            <label className="workflow-modal-field">
              <span>Workflow name</span>

              <input
                type="text"
                className="workflow-modal-input"
                value={workflowName}
                maxLength={120}
                autoFocus
                disabled={workflowSaving}
                placeholder="Enter workflow name"
                onChange={(event) =>
                  setWorkflowName(event.target.value)
                }
              />
            </label>

            {activeWorkflowId ? (
              <p className="workflow-modal-note">
                This will be saved as a new workflow. The original
                workflow will not be overwritten.
              </p>
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
                disabled={workflowSaving}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="nexus-btn"
                disabled={
                  workflowSaving ||
                  !workflowName.trim() ||
                  disabled
                }
              >
                {workflowSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
};