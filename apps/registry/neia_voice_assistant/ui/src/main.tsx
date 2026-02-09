import React from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __NeiaVoiceRoot?: Root;
    __NeiaVoiceRootEl?: HTMLElement;
  }
}

export function NeiaVoiceMount(el: HTMLElement) {
  if (window.__NeiaVoiceRoot) {
    try {
      window.__NeiaVoiceRoot.unmount();
    } catch {
      // ignore stale root errors
    }
    window.__NeiaVoiceRoot = undefined;
    window.__NeiaVoiceRootEl = undefined;
  }
  const root = createRoot(el);
  window.__NeiaVoiceRoot = root;
  window.__NeiaVoiceRootEl = el;
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
