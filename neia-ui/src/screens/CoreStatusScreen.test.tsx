import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CoreStatus } from "../types";
import { CoreStatusScreen } from "./CoreStatusScreen";

const core = vi.hoisted(() => ({
  status: null as CoreStatus | null,
}));

vi.mock("../core/CoreProvider", () => ({
  useCore: () => ({ loading: false, status: core.status }),
}));

describe("CoreStatusScreen", () => {
  it("reports the Core runtime mode", () => {
    core.status = {
      endpoint: "nexus-n3.local",
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
      version: "0.0.7",
      mode: "standalone",
      readiness: "ready",
      usb: {
        state: "unknown",
        present: null,
        mounted: null,
        capacity_bytes: null,
        available_bytes: null,
        error: null,
      },
      ble: {
        backend: null,
        adapter_state: "unknown",
        gateway_state: "unknown",
      },
      azure_bridge: { state: "unknown" },
      active_session: { state: "inactive", session_id: null },
      services: [],
    };

    render(<CoreStatusScreen />);

    expect(screen.getByText("Mode")).toBeVisible();
    expect(screen.getByText("Standalone")).toBeVisible();
  });
});
