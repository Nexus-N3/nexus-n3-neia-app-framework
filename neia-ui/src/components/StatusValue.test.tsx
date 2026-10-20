import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { displayState, formatBytes, StatusValue } from "./StatusValue";

describe("StatusValue helpers", () => {
  it("uses Unknown for missing Core data", () => {
    expect(displayState(null)).toBe("Unknown");
    expect(formatBytes(null)).toBe("Unknown");
  });

  it("formats normalized states and storage sizes", () => {
    expect(displayState("warming_up")).toBe("Warming Up");
    expect(displayState(false)).toBe("Unavailable");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("provides text in addition to status colour", () => {
    render(<StatusValue label="Azure bridge" value="Unavailable" state="unavailable" />);

    expect(screen.getByText("Azure bridge")).toBeVisible();
    expect(screen.getByText("Unavailable")).toHaveClass("tone-danger");
  });
});
