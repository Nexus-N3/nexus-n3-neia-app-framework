import { useCallback, useEffect, useState } from "react";

import type { AppInfo, AppsSnapshot } from "../types";

let cachedAppsSnapshot: AppsSnapshot | null = null;
let appsSnapshotInFlight: Promise<AppsSnapshot> | null = null;

export function useApps() {
  const [installed, setInstalled] = useState<AppInfo[]>([]);
  const [available, setAvailable] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(cachedAppsSnapshot === null);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (cachedAppsSnapshot && !options?.force) {
      setInstalled(cachedAppsSnapshot.installed);
      setAvailable(cachedAppsSnapshot.available);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (!appsSnapshotInFlight || options?.force) {
      appsSnapshotInFlight = (async () => {
        const [installedResp, availableResp] = await Promise.all([
          fetch("/api/v1/apps/installed"),
          fetch("/api/v1/apps/available"),
        ]);
        const [installedData, availableData] = await Promise.all([
          installedResp.json(),
          availableResp.json(),
        ]);
        const snapshot = {
          installed: installedData as AppInfo[],
          available: availableData as AppInfo[],
        };
        cachedAppsSnapshot = snapshot;
        return snapshot;
      })().finally(() => {
        appsSnapshotInFlight = null;
      });
    }

    const snapshot = await appsSnapshotInFlight;
    setInstalled(snapshot.installed);
    setAvailable(snapshot.available);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { installed, available, loading, refresh };
}

export function invalidateAppsSnapshot() {
  cachedAppsSnapshot = null;
}
