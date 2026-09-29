import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoreProvider, useCore } from "./CoreProvider";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;

  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;

  constructor(_url: string) {}

  addEventListener() {}

  close() {}
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function Probe() {
  const { connection, status, switchingRole, updateRole } = useCore();
  return (
    <>
      <span data-testid="mode">{status?.mode ?? "unknown"}</span>
      <span data-testid="available">{connection?.available ? "yes" : "no"}</span>
      <span data-testid="switching">{switchingRole ? "yes" : "no"}</span>
      <button type="button" onClick={() => void updateRole("master")}>
        Switch
      </button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CoreProvider role reconnect", () => {
  it("preserves the requested role and actively retries until Core confirms it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    let reportedRole = "standalone";
    let retryAttempts = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/core/role") {
        return jsonResponse({ role: "master", restarting: true });
      }
      if (url === "/api/v1/core/connection/retry") {
        retryAttempts += 1;
        if (retryAttempts === 1) {
          throw new Error("Core is restarting");
        }
        reportedRole = "master";
        return jsonResponse({
          gateway: "zeromq",
          target_host: "localhost",
          cmd_port: 5555,
          event_port: 5556,
          state: "connecting",
          available: false,
          error: null,
          last_event_at: null,
          last_ready_at: null,
        });
      }
      if (url === "/api/v1/core/connection") {
        return jsonResponse({
          gateway: "zeromq",
          target_host: "localhost",
          cmd_port: 5555,
          event_port: 5556,
          state: "connected",
          available: true,
          error: null,
          last_event_at: null,
          last_ready_at: null,
        });
      }
      if (url === "/api/v1/core/capabilities") {
        return jsonResponse({
          sensors: [],
          algorithms: [],
          connection_state: "connected",
          available: true,
        });
      }
      if (url === "/api/v1/core/status") {
        return jsonResponse({
          endpoint: "localhost",
          cmd_port: 5555,
          event_port: 5556,
          gateway: "zeromq",
          connection: {
            state: "connected",
            available: true,
            error: null,
            last_event_at: null,
            last_ready_at: null,
          },
          version: "0.1.0",
          mode: reportedRole,
          readiness: "ready",
          usb: {
            state: "unknown",
            present: null,
            mounted: null,
            capacity_bytes: null,
            available_bytes: null,
            error: null,
          },
          ble: { backend: null, adapter_state: "unknown", gateway_state: "unknown" },
          azure_bridge: { state: "unknown" },
          active_session: { state: "inactive", session_id: null },
          services: [],
        });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreProvider><Probe /></CoreProvider>);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("standalone");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("master");
    expect(screen.getByTestId("switching")).toHaveTextContent("yes");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(retryAttempts).toBe(1);
    expect(screen.getByTestId("mode")).toHaveTextContent("master");
    expect(screen.getByTestId("switching")).toHaveTextContent("yes");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(retryAttempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/core/connection/retry",
      { method: "POST" },
    );
    expect(screen.getByTestId("switching")).toHaveTextContent("no");
    expect(screen.getByTestId("mode")).toHaveTextContent("master");
  });

  it("discovers the persisted Core target during application startup", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    let retryAttempts = 0;
    let available = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/core/connection/retry") {
        retryAttempts += 1;
        if (retryAttempts === 2) available = true;
      }
      if (url === "/api/v1/core/connection/retry" || url === "/api/v1/core/connection") {
        return jsonResponse({
          gateway: "zeromq",
          target_host: "localhost",
          cmd_port: 5555,
          event_port: 5556,
          state: available ? "connected" : "disconnected",
          available,
          error: null,
          last_event_at: null,
          last_ready_at: null,
        });
      }
      if (url === "/api/v1/core/capabilities") {
        return jsonResponse({
          sensors: [],
          algorithms: [],
          connection_state: available ? "connected" : "disconnected",
          available,
        });
      }
      if (url === "/api/v1/core/status") {
        return jsonResponse({
          endpoint: "localhost",
          cmd_port: 5555,
          event_port: 5556,
          gateway: "zeromq",
          connection: {
            state: available ? "connected" : "disconnected",
            available,
            error: null,
            last_event_at: null,
            last_ready_at: null,
          },
          version: available ? "0.1.0" : null,
          mode: available ? "standalone" : null,
          readiness: available ? "ready" : "unknown",
          usb: {
            state: "unknown",
            present: null,
            mounted: null,
            capacity_bytes: null,
            available_bytes: null,
            error: null,
          },
          ble: { backend: null, adapter_state: "unknown", gateway_state: "unknown" },
          azure_bridge: { state: "unknown" },
          active_session: { state: "inactive", session_id: null },
          services: [],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreProvider><Probe /></CoreProvider>);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("available")).toHaveTextContent("no");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(retryAttempts).toBe(1);
    expect(screen.getByTestId("available")).toHaveTextContent("no");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(retryAttempts).toBe(2);
    expect(screen.getByTestId("available")).toHaveTextContent("yes");
  });
});
