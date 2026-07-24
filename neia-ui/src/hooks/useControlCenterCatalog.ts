import { useCallback, useEffect, useState } from "react";

import type { ControlCenterCatalog, SessionConfigRecord, SubjectGroup } from "../types";
import { mergeSubjectGroups } from "../utils/catalog";

export function useControlCenterCatalog() {
  const [catalog, setCatalog] = useState<ControlCenterCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  const updateCatalog = useCallback((nextCatalog: ControlCenterCatalog | null) => {
    setCatalog((prev) => (JSON.stringify(prev) === JSON.stringify(nextCatalog) ? prev : nextCatalog));
  }, []);

  const mergeCatalog = useCallback((updater: (prev: ControlCenterCatalog | null) => ControlCenterCatalog | null) => {
    setCatalog((prev) => {
      const nextCatalog = updater(prev);
      return JSON.stringify(prev) === JSON.stringify(nextCatalog) ? prev : nextCatalog;
    });
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const resp = await fetch("/api/v1/control-center/catalog");
      if (!resp.ok) {
        throw new Error("Failed to load catalog");
      }
      const data = await resp.json();
      updateCatalog(data);
    } catch {
      updateCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [updateCatalog]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyMessage = useCallback((message: { type?: string; payload?: Record<string, unknown> }) => {
    const messageType = typeof message?.type === "string" ? message.type : "";
    const payload = message?.payload;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (messageType === "subject_catalog_update") {
      mergeCatalog((prev) => ({
        customer_id: typeof payload.customer_id === "string" ? payload.customer_id : prev?.customer_id,
        site_id: typeof payload.site_id === "string" ? payload.site_id : prev?.site_id,
        groups: Array.isArray(payload.groups) ? (payload.groups as SubjectGroup[]) : [],
        session_configs: prev?.session_configs ?? [],
      }));
      setLoading(false);
      return;
    }

    if (messageType === "session_config_update") {
      const nextSessionConfigs = Array.isArray(payload.session_configs)
        ? (payload.session_configs as SessionConfigRecord[])
        : [];
      mergeCatalog((prev) => ({
        customer_id: typeof payload.customer_id === "string" ? payload.customer_id : prev?.customer_id,
        site_id: typeof payload.site_id === "string" ? payload.site_id : prev?.site_id,
        groups: mergeSubjectGroups(prev?.groups, nextSessionConfigs),
        session_configs: nextSessionConfigs,
      }));
      setLoading(false);
    }
  }, [mergeCatalog]);

  return { catalog, loading, refresh, applyMessage };
}
