import { useState } from "react";

import { useWorkflows } from "../hooks/useWorkflows";

export function WorkflowsScreen() {
  const {
    workflows,
    loading,
    error,
    deleteWorkflow,
    exportWorkflow,
  } = useWorkflows();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [exportingId, setExportingId] = useState<string | null>(
  null,
);

  const handleExport = async (
    workflowId: string,
    workflowName: string,
  ) => {
    setExportingId(workflowId);

    try {
      await exportWorkflow(workflowId, workflowName);
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
          {workflows.length === 1 ? "workflow" : "workflows"}
        </span>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {workflows.length === 0 ? (
        <div className="empty-state-v2">
          <strong>No workflows saved</strong>
          <p>
            Workflows saved from a Nexus N3 session will appear here.
          </p>
        </div>
      ) : (
        <div className="capability-list-v2">
        {workflows.map((workflow) => {
          const sensorTypes = workflow.sensor_types ?? [];
          const algorithms = workflow.algorithms ?? [];
          const sensorCount = workflow.sensor_count ?? 0;

          return (
            <article
              className="capability-card-v2 workflow-card-v2"
              key={workflow.id}
            >
              <div className="capability-title-v2">
                <div className="workflow-card-content-v2">
                  <h3>{workflow.name}</h3>
                  <code>{workflow.id}</code>

                  <div className="workflow-summary-v2">
                    <div className="workflow-summary-group-v2">

                      <div className="tag-list-v2">
                        <span>
                            Subjects ({workflow.subject_count})
                        </span>
                      </div>
                      <div className="tag-list-v2">
                          {sensorTypes.map((sensorType) => (
                            <span key={sensorType}>
                              {sensorType} ({workflow.sensor_type_counts[sensorType] ?? 0})
                            </span>
                          ))}
                      </div>
                      <div className="tag-list-v2">
                        {workflow.algorithms.length > 0 ? (
                          workflow.algorithms.map((algorithm) => (
                            <span key={algorithm}>
                              {algorithm}
                            </span>
                          ))
                        ) : (
                          <em>None</em>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="workflow-card-actions-v2">
                  <button
                    type="button"
                    className="secondary-action-v2"
                    disabled={exportingId === workflow.id}
                    onClick={() =>
                      void handleExport(
                        workflow.id,
                        workflow.name,
                      )
                    }
                  >
                    {exportingId === workflow.id
                      ? "Exporting…"
                      : "Export"}
                  </button>

                  <button
                    type="button"
                    className="danger-action-v2"
                    disabled={deletingId === workflow.id}
                    onClick={() =>
                      void handleDelete(
                        workflow.id,
                        workflow.name,
                      )
                    }
                  >
                    {deletingId === workflow.id
                      ? "Deleting…"
                      : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      )}
    </div>
  );
}