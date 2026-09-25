import { useState } from "react";

import {
  useWorkflows,
  type WorkflowSummary,
} from "../hooks/useWorkflows";

type WorkflowCardProps = {
  workflow: WorkflowSummary;
  deleting: boolean;
  exporting: boolean;
  onDelete: (
    workflowId: string,
    workflowName: string,
  ) => void;
  onExport: (
    workflowId: string,
    workflowName: string,
  ) => void;
};

function formatLocation(location: string) {
  return location.replace(/_/g, " ");
}

function WorkflowCard({
  workflow,
  deleting,
  exporting,
  onDelete,
  onExport,
}: WorkflowCardProps) {
  const subjects = Object.entries(workflow.subjects);

  return (
    <article className="capability-card-v2">
      <div className="capability-title-v2">
        <div>
          <h3>{workflow.name}</h3>
          <code>{workflow.id}</code>
        </div>

        <div className="workflow-card-actions-v2">
          <button
            type="button"
            className="secondary-action-v2"
            disabled={exporting}
            onClick={() => {
              onExport(workflow.id, workflow.name);
            }}
          >
            {exporting ? "Exporting…" : "Export"}
          </button>

          <button
            type="button"
            className="danger-action-v2"
            disabled={deleting}
            onClick={() => {
              onDelete(workflow.id, workflow.name);
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="metadata-group-v2">
        <span>Configuration</span>

        <div className="tag-list-v2 workflow-configuration-tags-v2">
          <span>
            Subjects ({workflow.subject_count})
          </span>

          <span>
            Sensors ({workflow.sensor_count})
          </span>
        </div>
      </div>

      {subjects.map(([subjectId, sensors], subjectIndex) => (
        <div
          className="metadata-group-v2"
          key={subjectId}
        >
          <span>Subject {subjectIndex + 1}</span>

          <div className="tag-list-v2">
            {sensors.length === 0 ? (
              <em>No sensors configured</em>
            ) : (
              sensors.map((sensor, sensorIndex) => (
                <span
                  key={`${subjectId}-${sensorIndex}`}
                >
                  {sensor.sensor_type}
                  {" · "}
                  {formatLocation(sensor.location)}
                  {sensor.algorithms.length > 0
                    ? ` · ${sensor.algorithms.join(", ")}`
                    : ""}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </article>
  );
}

function EmptyWorkflows() {
  return (
    <div className="empty-state-v2">
      <strong>No workflows saved</strong>

      <p>
        Workflows saved from a Nexus N3 session will
        appear here.
      </p>
    </div>
  );
}

export function WorkflowsScreen() {
  const {
    workflows,
    loading,
    error,
    deleteWorkflow,
    exportWorkflow,
  } = useWorkflows();

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [exportingId, setExportingId] =
    useState<string | null>(null);

  const handleExport = async (
    workflowId: string,
    workflowName: string,
  ) => {
    setExportingId(workflowId);

    try {
      await exportWorkflow(
        workflowId,
        workflowName,
      );
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (
    workflowId: string,
    workflowName: string,
  ) => {
    const confirmed = window.confirm(
      `Delete workflow "${workflowName}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(workflowId);

    try {
      await deleteWorkflow(workflowId);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="system-view-v2">
        <div className="view-heading-v2">
          <h1>Workflows</h1>
        </div>

        <div className="empty-state-v2">
          Loading workflows…
        </div>
      </div>
    );
  }

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2">
        <div>
          <h1>Workflows</h1>
        </div>

        <span className="count-chip-v2">
          {workflows.length}{" "}
          {workflows.length === 1
            ? "workflow"
            : "workflows"}
        </span>
      </div>

      {error ? (
        <div
          className="error-banner"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {workflows.length === 0 ? (
        <EmptyWorkflows />
      ) : (
        <div className="capability-list-v2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              deleting={
                deletingId === workflow.id
              }
              exporting={
                exportingId === workflow.id
              }
              onDelete={(
                workflowId,
                workflowName,
              ) => {
                void handleDelete(
                  workflowId,
                  workflowName,
                );
              }}
              onExport={(
                workflowId,
                workflowName,
              ) => {
                void handleExport(
                  workflowId,
                  workflowName,
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}