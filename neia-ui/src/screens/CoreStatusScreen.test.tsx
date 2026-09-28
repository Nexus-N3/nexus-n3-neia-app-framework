import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CoreStatus } from "../types";
import { CoreStatusScreen } from "./CoreStatusScreen";

const core = vi.hoisted(() => ({
  status: null as CoreStatus | null,
  updateRole: vi.fn(),
}));

vi.mock("../core/CoreProvider", () => ({
  useCore: () => ({
    loading: false,
    status: core.status,
    switchingRole: false,
    updateRole: core.updateRole,
  }),
}));

describe("CoreStatusScreen", () => {
  it("reports and switches the Core runtime mode only while idle", async () => {
    core.updateRole.mockResolvedValue(undefined);
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

    const { rerender } = render(<CoreStatusScreen />);

    expect(screen.getByText("Mode")).toBeVisible();
    expect(screen.getByRole("button", { name: "Standalone" })).toBeDisabled();
    expect(screen.getByText("Current: Standalone")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Worker" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Master" }));
    await waitFor(() => expect(core.updateRole).toHaveBeenCalledWith("master"));

    core.status = {
      ...core.status!,
      active_session: { state: "active", session_id: "session-1" },
    };
    rerender(<CoreStatusScreen />);

    expect(screen.getByRole("button", { name: "Master" })).toBeDisabled();
  });
});
