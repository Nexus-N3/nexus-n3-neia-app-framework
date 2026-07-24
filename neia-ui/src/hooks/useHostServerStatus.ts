import { useEffect, useState } from "react";

export function useHostServerStatus() {
  const [serverReady, setServerReady] = useState(false);
  const [siteName, setSiteName] = useState("Site unavailable");
  const [retrying, setRetrying] = useState(false);
  const [usbPresent, setUsbPresent] = useState(false);
  const [usbBusy, setUsbBusy] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);

  const sendReadyCheck = async () => {
    await fetch("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "is_server_ready", payload: {} }),
    });
  };

  const sendUsbStatusCheck = async () => {
    await fetch("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_usb_status", payload: {} }),
    });
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setServerReady(false);
      void sendReadyCheck().catch(() => {
        setServerReady(false);
      });
      void sendUsbStatusCheck().catch(() => {
        setUsbBusy(false);
      });
    };

    ws.onclose = () => {
      setServerReady(false);
      setUsbBusy(false);
    };

    ws.onerror = () => {
      setServerReady(false);
      setUsbBusy(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "server_ready") {
          setServerReady(true);
          const site = msg?.payload?.site;
          if (typeof site === "string" && site.trim()) {
            setSiteName(site);
          }
          return;
        }
        if (msg?.type === "usb_status") {
          setUsbPresent(Boolean(msg?.payload?.present));
          setUsbBusy(false);
          const error = msg?.payload?.error;
          setUsbError(typeof error === "string" && error.trim() ? error : null);
          return;
        }
        if (msg?.type === "usb_disk_inserted") {
          setUsbPresent(true);
          setUsbBusy(false);
          setUsbError(null);
          return;
        }
        if (msg?.type === "usb_disk_removed") {
          setUsbPresent(false);
          setUsbBusy(false);
          setUsbError(null);
        }
      } catch {
        // ignore malformed gateway events
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const retryServer = async () => {
    setRetrying(true);
    setServerReady(false);
    try {
      await Promise.all([sendReadyCheck(), sendUsbStatusCheck()]);
    } finally {
      setRetrying(false);
    }
  };

  const sendUsbCommand = async (action: "mount" | "unmount") => {
    setUsbBusy(true);
    setUsbError(null);
    try {
      await fetch("/api/v1/gateway/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action === "mount" ? "usb_mount" : "usb_safe_unmount",
          payload: {},
        }),
      });
    } catch {
      setUsbBusy(false);
      setUsbError("Failed to send USB command");
    }
  };

  return { serverReady, siteName, retrying, retryServer, usbPresent, usbBusy, usbError, sendUsbCommand };
}
