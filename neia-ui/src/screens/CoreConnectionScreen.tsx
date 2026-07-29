import { useEffect, useState } from "react";

import { CoreStateBadge } from "../components/CoreStateBadge";
import { useCore } from "../core/CoreProvider";

export function CoreConnectionScreen() {
  const { connection, error, retry, retrying, saving, updateConnection } = useCore();
  const [host, setHost] = useState("localhost");
  const [cmdPort, setCmdPort] = useState("5555");
  const [eventPort, setEventPort] = useState("5556");
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!connection) return;
    setHost(connection.target_host);
    setCmdPort(String(connection.cmd_port));
    setEventPort(String(connection.event_port));
  }, [connection]);

  const apply = async () => {
    const nextHost = host.trim();
    const nextCmdPort = Number(cmdPort);
    const nextEventPort = Number(eventPort);
    if (!nextHost) {
      setFormError("Enter a Nexus N3 Core hostname or address.");
      return;
    }
    if (
      !Number.isInteger(nextCmdPort) ||
      !Number.isInteger(nextEventPort) ||
      nextCmdPort <= 0 ||
      nextEventPort <= 0 ||
      nextCmdPort > 65535 ||
      nextEventPort > 65535
    ) {
      setFormError("Ports must be whole numbers between 1 and 65535.");
      return;
    }
    setFormError(null);
    setSaved(false);
    try {
      await updateConnection({
        target_host: nextHost,
        cmd_port: nextCmdPort,
        event_port: nextEventPort,
      });
      setSaved(true);
    } catch {
      // Provider exposes the request error.
    }
  };

  return (
    <div className="system-view-v2 narrow-view-v2">
      <div className="view-heading-v2">
        <div>
          <h1>N3 Connection</h1>
        </div>
        <CoreStateBadge state={connection?.state ?? "disconnected"} />
      </div>

      <section className="settings-card-v2">
        <div className="connection-callout-v2">
          <div>
            <span>Current endpoint</span>
            <strong>{connection?.target_host ?? "Not configured"}</strong>
          </div>
        </div>

        <div className="connection-form-v2">
          <label>
            <span>Hostname or IP address</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="localhost or nexus-n3-master.local"
              autoComplete="off"
            />
            <small>Use `localhost` when NEIA and Core run on the same system.</small>
          </label>
        </div>

        {formError || error ? <p className="form-message-v2 error">{formError || error}</p> : null}
        {saved ? <p className="form-message-v2 success">Connection settings saved. Waiting for Core readiness.</p> : null}

        <div className="settings-actions-v2">
          <button
            className="secondary-action-v2"
            onClick={() => void retry()}
            disabled={retrying}
            type="button"
          >
            {retrying ? "Retrying…" : "Retry connection"}
          </button>
          <button
            className="primary-action-v2"
            onClick={() => void apply()}
            disabled={saving || connection?.gateway !== "zeromq"}
            type="button"
          >
            {saving ? "Applying…" : "Apply connection"}
          </button>
        </div>
      </section>
    </div>
  );
}
