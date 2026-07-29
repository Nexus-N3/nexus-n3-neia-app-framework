import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CoreConnection } from "../types";
import { MainLayout } from "./MainLayout";

const connection: CoreConnection = {
  gateway: "zeromq",
  site: "test-site",
  target_host: "nexus-n3-master.local",
  cmd_port: 5555,
  event_port: 5556,
  state: "connected",
  available: true,
  error: null,
  last_event_at: null,
  last_ready_at: null,
};

describe("MainLayout", () => {
  it("renders the required navigation and visible disabled AI placeholder", () => {
    render(
      <MainLayout connection={connection} route="/dashboard" onNavigate={() => undefined}>
        <p>Dashboard content</p>
      </MainLayout>,
    );

    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Nexus N3 Connection" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Nexus N3 Capabilities" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Nexus N3 Status" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "App Catalog" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /NEIA AI/ })).toBeDisabled();
    expect(screen.getByText("nexus-n3-master.local")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
  });

  it("navigates without triggering a document reload", () => {
    const navigate = vi.fn();
    render(
      <MainLayout connection={connection} route="/status" onNavigate={navigate}>
        <p>Status content</p>
      </MainLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Nexus N3 Capabilities" }));

    expect(navigate).toHaveBeenCalledWith("/capabilities");
  });

  it("keeps Dashboard selected while the built-in session view is open", () => {
    render(
      <MainLayout connection={connection} route="/session" onNavigate={() => undefined}>
        <p>Built-in session view</p>
      </MainLayout>,
    );

    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Built-in session view")).toBeVisible();
  });
});
