import { useCallback, useEffect, useState } from "react";

import { useCore } from "../core/CoreProvider";

export type ArchiveSummary = {
  id: string;
  filename: string;
  size_bytes: number;
  modified_at: string;
};

type ArchiveList = {
  site: string;
  storage_source: "internal" | "usb";
  archives: ArchiveSummary[];
};

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Use the status fallback.
  }
  return `Archive request failed (${response.status}).`;
}

export function useArchives() {
  const { connection, subscribe } = useCore();
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [site, setSite] = useState<string | null>(null);
  const [storageSource, setStorageSource] = useState<"internal" | "usb" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/archives", { cache: "no-store" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const payload = (await response.json()) as ArchiveList;
      setArchives(payload.archives);
      setSite(payload.site);
      setStorageSource(payload.storage_source);
    } catch (requestError) {
      setArchives([]);
      setSite(null);
      setStorageSource(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to list archives.");
    } finally {
      setLoading(false);
    }
  }, []);

  const download = useCallback(async (archive: ArchiveSummary) => {
    if (!storageSource || !site) return;
    setDownloadingId(archive.id);
    setError(null);
    const params = new URLSearchParams({ storage_source: storageSource, site });
    const url = `/api/v1/archives/${encodeURIComponent(archive.id)}/download?${params.toString()}`;
    try {
      const preflight = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!preflight.ok) throw new Error(await errorMessage(preflight));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.setAttribute("aria-hidden", "true");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to download archive.");
    } finally {
      setDownloadingId(null);
    }
  }, [site, storageSource]);

  useEffect(() => {
    void refresh();
  }, [connection?.state, refresh]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (["server_ready", "usb_status", "usb_disk_inserted", "usb_disk_removed", "session_completed"]
        .includes(String(event.type ?? ""))) {
        void refresh();
      }
    });
    return () => { unsubscribe(); };
  }, [refresh, subscribe]);

  return { archives, site, storageSource, loading, error, downloadingId, refresh, download };
}
