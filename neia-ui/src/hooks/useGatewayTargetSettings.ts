import { useCallback, useEffect, useState } from "react";

import type { GatewayTargetSettings } from "../types";

export function useGatewayTargetSettings() {
  const [settings, setSettings] = useState<GatewayTargetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/settings/gateway");
      if (!resp.ok) {
        throw new Error("Failed to load gateway settings");
      }
      const data = (await resp.json()) as GatewayTargetSettings;
      setSettings(data);
    } catch {
      setError("Failed to load gateway settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (nextHost: string) => {
    if (!settings) {
      throw new Error("Gateway settings are unavailable");
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch("/api/v1/settings/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_host: nextHost,
          cmd_port: settings.cmd_port,
          event_port: settings.event_port,
        }),
      });
      if (!resp.ok) {
        throw new Error("Failed to save gateway settings");
      }
      const data = (await resp.json()) as GatewayTargetSettings;
      setSettings(data);
      return data;
    } catch {
      setError("Failed to update gateway target.");
      throw new Error("Failed to update gateway target");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  return { settings, loading, saving, error, refresh, save };
}
