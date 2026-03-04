import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const PROFILE_STORAGE_KEY = "nexus_display_profile";
const PROFILE_CLASS_PREFIX = "display-profile-";

function normalizeProfile(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-");
  const aliasMap: Record<string, string> = {
    "5in-portrait": "1920x1080",
    "5.5in-amoled": "1920x1080",
    "waveshare-5.5-amoled": "1920x1080",
    "waveshare-5in-800x400": "800x400"
  };
  return aliasMap[cleaned] || cleaned;
}

function resolveDisplayProfile(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeProfile(params.get("display_profile"));
  if (fromQuery) return fromQuery;

  const fromWindow = normalizeProfile((window as any).__NEXUS_DISPLAY_PROFILE);
  if (fromWindow) return fromWindow;

  const fromEnv = normalizeProfile(import.meta.env.VITE_DISPLAY_PROFILE);
  if (fromEnv) return fromEnv;

  try {
    return normalizeProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
  } catch {
    return "";
  }
}

function applyDisplayProfile(): void {
  const profile = resolveDisplayProfile();
  const body = document.body;
  const classesToRemove = Array.from(body.classList).filter((name) =>
    name.startsWith(PROFILE_CLASS_PREFIX)
  );
  classesToRemove.forEach((name) => body.classList.remove(name));
  body.removeAttribute("data-display-profile");
  if (!profile) return;
  body.classList.add(`${PROFILE_CLASS_PREFIX}${profile}`);
  body.setAttribute("data-display-profile", profile);
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profile);
  } catch {
    // best effort persistence only
  }
}

applyDisplayProfile();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
