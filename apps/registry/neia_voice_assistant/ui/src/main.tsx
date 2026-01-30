import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

export function NeiaVoiceMount(el: HTMLElement) {
  const root = createRoot(el);
  root.render(<App />);
}

if (typeof globalThis !== "undefined") {
  (globalThis as any).NeiaVoiceMount = NeiaVoiceMount;
}

const mountEl = document.getElementById("app-mount");
const rootEl = document.getElementById("root");
if (!mountEl && rootEl) {
  NeiaVoiceMount(rootEl);
}
