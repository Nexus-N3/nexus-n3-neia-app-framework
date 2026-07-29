import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CoreCapabilities, CoreConnection, CoreStatus } from "../types";

type CoreEvent = Record<string, unknown>;
type CoreEventListener = (event: CoreEvent) => void;

type UpdateConnectionInput = {
  target_host: string;
  cmd_port: number;
  event_port: number;
};

type CoreContextValue = {
  capabilities: CoreCapabilities | null;
  connection: CoreConnection | null;
  error: string | null;
  eventConnected: boolean;
  loading: boolean;
  retrying: boolean;
  saving: boolean;
  status: CoreStatus | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  sendCommand: (command: object) => Promise<void>;
  sendUsbCommand: (action: "mount" | "unmount") => Promise<void>;
  subscribe: (listener: CoreEventListener) => () => void;
  updateConnection: (input: UpdateConnectionInput) => Promise<void>;
};

const CoreContext = createContext<CoreContextValue | null>(null);

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch {
      // Use the fallback message below.
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function CoreProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<CoreConnection | null>(null);
  const [capabilities, setCapabilities] = useState<CoreCapabilities | null>(null);
  const [status, setStatus] = useState<CoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventConnected, setEventConnected] = useState(false);
  const listenersRef = useRef(new Set<CoreEventListener>());
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const request = (async () => {
      try {
        const [nextConnection, nextCapabilities, nextStatus] = await Promise.all([
          readJson<CoreConnection>("/api/v1/core/connection"),
          readJson<CoreCapabilities>("/api/v1/core/capabilities"),
          readJson<CoreStatus>("/api/v1/core/status"),
        ]);
        setConnection(nextConnection);
        setCapabilities(nextCapabilities);
        setStatus(nextStatus);
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load Core state.");
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = request;
    return request;
  }, []);

  const retry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    setConnection((current) =>
      current ? { ...current, state: "connecting", available: false, error: null } : current,
    );
    try {
      const nextConnection = await readJson<CoreConnection>("/api/v1/core/connection/retry", {
        method: "POST",
      });
      setConnection(nextConnection);
      await refresh();
      window.setTimeout(() => {
        void refresh();
      }, 8500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to retry Core.");
      await refresh();
    } finally {
      setRetrying(false);
    }
  }, [refresh]);

  const updateConnection = useCallback(
    async (input: UpdateConnectionInput) => {
      setSaving(true);
      setError(null);
      try {
        const nextConnection = await readJson<CoreConnection>("/api/v1/core/connection", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        setConnection(nextConnection);
        await refresh();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to update Core endpoint.");
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const sendCommand = useCallback(async (command: object) => {
    await readJson("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  }, []);

  const sendUsbCommand = useCallback(async (action: "mount" | "unmount") => {
    await sendCommand({
      type: action === "mount" ? "usb_mount" : "usb_safe_unmount",
      payload: {},
    });
  }, [sendCommand]);

  const subscribe = useCallback((listener: CoreEventListener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    void refresh();
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    let socket: WebSocket | null = null;
    let stopped = false;
    let reconnectTimer: number | null = null;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refresh();
      }, 80);
    };

    const connectSocket = () => {
      if (stopped) return;
      socket = new WebSocket(socketUrl);
      socket.onopen = () => {
        setEventConnected(true);
        setError(null);
        void retry();
      };
      socket.onclose = () => {
        setEventConnected(false);
        setConnection((current) =>
          current ? { ...current, state: "disconnected", available: false } : current,
        );
        if (!stopped) {
          reconnectTimer = window.setTimeout(connectSocket, 1500);
        }
      };
      socket.onerror = () => {
        setError("The NEIA event connection is unavailable. Reconnecting…");
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as CoreEvent;
          listenersRef.current.forEach((listener) => listener(event));
          const type = typeof event.type === "string" ? event.type : "";
          if (
            type === "server_ready" ||
            type.startsWith("usb_") ||
            type.startsWith("ble_") ||
            type.startsWith("azure_") ||
            type.includes("health") ||
            type.startsWith("stream_") ||
            type === "system_initialized" ||
            type === "session_completed"
          ) {
            scheduleRefresh();
          }
        } catch {
          // Preserve the connection when a third-party event is malformed.
        }
      };
    };
    connectSocket();

    return () => {
      stopped = true;
      socket?.close();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [refresh, retry]);

  const value = useMemo<CoreContextValue>(
    () => ({
      capabilities,
      connection,
      error,
      eventConnected,
      loading,
      refresh,
      retry,
      retrying,
      saving,
      sendCommand,
      sendUsbCommand,
      status,
      subscribe,
      updateConnection,
    }),
    [
      capabilities,
      connection,
      error,
      eventConnected,
      loading,
      refresh,
      retry,
      retrying,
      saving,
      sendCommand,
      sendUsbCommand,
      status,
      subscribe,
      updateConnection,
    ],
  );

  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

export function useCore() {
  const context = useContext(CoreContext);
  if (!context) {
    throw new Error("useCore must be used inside CoreProvider");
  }
  return context;
}
