import { useArchives, type ArchiveSummary } from "../hooks/useArchives";


function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function ArchiveCard({ archive, downloading, onDownload }: {
  archive: ArchiveSummary;
  downloading: boolean;
  onDownload: () => void;
}) {
  const modified = new Date(archive.modified_at);
  return (
    <article className="capability-card-v2 archive-card-v2">
      <div>
        <h3>{archive.filename}</h3>
        <span>{Number.isNaN(modified.getTime()) ? archive.modified_at : modified.toLocaleString()}</span>
      </div>
      <div className="archive-card-actions-v2">
        <span>{formatBytes(archive.size_bytes)}</span>
        <button className="primary-action-v2" type="button" disabled={downloading} onClick={onDownload}>
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
    </article>
  );
}

export function ArchivesScreen() {
  const { archives, site, storageSource, loading, error, downloadingId, refresh, download } = useArchives();

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2 archives-heading-v2">
        <div>
          <h1>Archives</h1>
        </div>
        <div className="archives-heading-actions-v2">
          {site ? <span className="count-chip-v2">Site: {site}</span> : null}
          {storageSource ? <span className="count-chip-v2">{storageSource === "usb" ? "USB storage" : "Internal storage"}</span> : null}
          <button className="secondary-action-v2" type="button" disabled={loading} onClick={() => void refresh()}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      <p className="archive-live-status-v2" aria-live="polite">
        {downloadingId ? "Preparing archive download…" : ""}
      </p>

      {loading && archives.length === 0 ? (
        <div className="empty-state-v2">Loading archives…</div>
      ) : archives.length === 0 ? (
        <div className="empty-state-v2">
          <strong>No session archives found</strong>
          <p>Completed sessions stored on the active Edge output location will appear here.</p>
        </div>
      ) : (
        <div className="capability-list-v2">
          {archives.map((archive) => (
            <ArchiveCard
              key={archive.id}
              archive={archive}
              downloading={downloadingId === archive.id}
              onDownload={() => void download(archive)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
