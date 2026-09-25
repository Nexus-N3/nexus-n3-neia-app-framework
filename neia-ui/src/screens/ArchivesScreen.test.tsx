import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchivesScreen } from "./ArchivesScreen";


const subscribe = vi.fn(() => () => undefined);

vi.mock("../core/CoreProvider", () => ({
  useCore: () => ({
    connection: { state: "connected", available: true },
    subscribe,
  }),
}));

describe("ArchivesScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    subscribe.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists archives and preflights a same-origin download", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        site: "lunar",
        storage_source: "usb",
        archives: [{
          id: "archive-id",
          filename: "session.zip",
          size_bytes: 2048,
          modified_at: "2026-08-03T09:00:00Z",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<ArchivesScreen />);

    expect(await screen.findByText("session.zip")).toBeVisible();
    expect(screen.getByText("USB storage")).toBeVisible();
    expect(screen.getByText("Site: lunar")).toBeVisible();
    expect(screen.getByText("2.00 KB")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/archives/archive-id/download?storage_source=usb&site=lunar",
      { method: "HEAD", cache: "no-store" },
    ));
    expect(click).toHaveBeenCalledOnce();
  });

  it("shows an unavailable-service response without hiding the route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "Archive downloads are not available from this Core." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )));

    render(<ArchivesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Archive downloads are not available from this Core.",
    );
    expect(screen.getByText("No session archives found")).toBeVisible();
  });
});
