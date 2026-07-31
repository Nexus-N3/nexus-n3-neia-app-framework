import { useCallback, useEffect, useState } from 'react';

export interface WorkflowSensorConfig {
  sensor_type: string;
  location: string;
  algorithms: string[];
}

export interface WorkflowSaveSubject {
  subject_id: string;
  sensors: WorkflowSensorConfig[];
}

export interface WorkflowSaveRequest {
  name: string;
  derived_from: string | null;
  subjects: WorkflowSaveSubject[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  subject_count: number;
  sensor_count: number;
  sensor_types: string[];
  sensor_type_counts: Record<string, number>;
  algorithms: string[];
  created_at: string;
  modified_at: string;
  derived_from: string | null;
}
export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
}

export interface WorkflowLoadResponse {
  workflow_id: string;
  workflow_name: string;
  subjects: Record<string, WorkflowSensorConfig[]>;
}

type ApiErrorBody = {
  detail?:
    | string
    | {
        code?: string;
        message?: string;
      };
};

let cachedWorkflows: WorkflowSummary[] | null = null;
let workflowsInFlight: Promise<WorkflowSummary[]> | null = null;

async function readJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = (await response.json()) as ApiErrorBody;

      if (typeof body.detail === 'string') {
        message = body.detail;
      } else if (body.detail?.message) {
        message = body.detail.message;
      }
    } catch {
      // Keep the fallback message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>(
    cachedWorkflows ?? [],
  );
  const [loading, setLoading] = useState(cachedWorkflows === null);
  const [saving, setSaving] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      if (cachedWorkflows && !options?.force) {
        setWorkflows(cachedWorkflows);
        setLoading(false);
        return cachedWorkflows;
      }

      setLoading(true);
      setError(null);

      try {
        if (!workflowsInFlight || options?.force) {
          workflowsInFlight = readJson<WorkflowListResponse>(
            '/api/v1/workflows',
          )
            .then((response) => {
              cachedWorkflows = response.workflows;
              return response.workflows;
            })
            .finally(() => {
              workflowsInFlight = null;
            });
        }

        const result = await workflowsInFlight;
        setWorkflows(result);

        return result;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to list workflows.',
        );
        throw requestError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const save = useCallback(
    async (
      request: WorkflowSaveRequest,
    ): Promise<WorkflowSummary> => {
      setSaving(true);
      setError(null);

      try {
        const saved = await readJson<WorkflowSummary>(
          '/api/v1/workflows',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          },
        );

        cachedWorkflows = null;
        await refresh({ force: true });

        return saved;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to save workflow.',
        );
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const load = useCallback(
    async (
      workflowId: string,
      subjectIds: string[],
    ): Promise<WorkflowLoadResponse> => {
      setLoadingWorkflow(true);
      setError(null);

      try {
        return await readJson<WorkflowLoadResponse>(
          `/api/v1/workflows/${workflowId}/load`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subjects: subjectIds.map((subjectId) => ({
                subject_id: subjectId,
              })),
            }),
          },
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load workflow.',
        );
        throw requestError;
      } finally {
        setLoadingWorkflow(false);
      }
    },
    [],
  );
  const deleteWorkflow = async (workflowId: string) => {
    setError(null);

    const response = await fetch(
      `/api/v1/workflows/${encodeURIComponent(workflowId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete workflow.");
    }

    setWorkflows((current) =>
      current.filter((workflow) => workflow.id !== workflowId),
    );
  };

  const exportWorkflow = async (
    workflowId: string,
    fallbackName: string,
  ) => {
    setError(null);

    const response = await fetch(
      `/api/v1/workflows/${encodeURIComponent(workflowId)}/export`,
    );

    if (!response.ok) {
      setError("Failed to export workflow.");
      throw new Error("Failed to export workflow.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const contentDisposition =
      response.headers.get("content-disposition");

    const filenameMatch = contentDisposition?.match(
      /filename="?([^"]+)"?/i,
    );

    const safeFallbackName =
      fallbackName
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "workflow";

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${safeFallbackName}-${workflowId}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(objectUrl);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    workflows,
    loading,
    saving,
    loadingWorkflow,
    error,
    refresh,
    save,
    load,
    deleteWorkflow,
    exportWorkflow,
  };
}

export function invalidateWorkflows() {
  cachedWorkflows = null;
}

