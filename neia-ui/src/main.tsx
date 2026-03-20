import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const PROFILE_CLASS_PREFIX = "display-profile-";

function normalizeProfile(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-");
  const aliasMap: Record<string, string> = {
    "5in-800x480": "800x480"
  };
  return aliasMap[cleaned] || cleaned;
}

function resolveExplicitDisplayProfile(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeProfile(params.get("display_profile"));
  if (fromQuery) return fromQuery;

  const fromWindow = normalizeProfile((window as any).__NEXUS_DISPLAY_PROFILE);
  if (fromWindow) return fromWindow;

  const fromEnv = normalizeProfile(import.meta.env.VITE_DISPLAY_PROFILE);
  if (fromEnv) return fromEnv;

  return "";
}

function resolveViewportProfile(): string {
  if (window.innerWidth <= 800 && window.innerHeight <= 480) {
    return "800x480";
  }
  return "";
}

function resolveDisplayProfile(): string {
  const explicit = resolveExplicitDisplayProfile();
  if (explicit) return explicit;
  return resolveViewportProfile();
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
}

applyDisplayProfile();
window.addEventListener("resize", applyDisplayProfile);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
