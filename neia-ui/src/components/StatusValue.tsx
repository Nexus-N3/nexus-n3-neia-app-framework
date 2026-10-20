import type { ReactNode } from "react";

type StatusValueProps = {
  label: string;
  value: ReactNode;
  state?: string | boolean | null;
};

function toneFor(state: StatusValueProps["state"]) {
  if (state === true) return "healthy";
  if (state === false || state === "error" || state === "failed" || state === "unavailable") return "danger";
  if (
    state === "connected" ||
    state === "available" ||
    state === "active" ||
    state === "ready" ||
    state === "healthy" ||
    state === "mounted"
  ) {
    return "healthy";
  }
  if (state === "connecting" || state === "warning" || state === "pending" || state === "warming_up") {
    return "warning";
  }
  return "unknown";
}

export function StatusValue({ label, value, state }: StatusValueProps) {
  return (
    <div className="status-value-v2">
      <span>{label}</span>
      <strong className={`tone-${toneFor(state)}`}>{value ?? "Unknown"}</strong>
    </div>
  );
}

export function displayState(value: unknown) {
  if (value === null || value === undefined || value === "") return "Unknown";
  if (typeof value === "boolean") return value ? "Available" : "Unavailable";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}
