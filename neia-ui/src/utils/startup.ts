import type { StartupSpeechMode } from "../types";

export const STARTUP_GREETING = "Hello, I am NEIA your edge intelligence agent. Welcome to Nexus N3.";
export const HOLD_ON_STARTUP_SCREEN_FOR_TESTING = false;
export const STARTUP_API_MOUTH_DELAY_MS = 0;
export const STARTUP_BOOTING_MS = 450;
export const STARTUP_WAKING_MS = 600;

let startupSequenceDone = false;
let startupGreetingSpoken = false;

export function isStartupSequenceDone() {
  return startupSequenceDone;
}

export function markStartupSequenceDone() {
  startupSequenceDone = true;
}

export function resetStartupState() {
  startupSequenceDone = false;
  startupGreetingSpoken = false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function speakInBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("Browser speech synthesis is unavailable"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    const cleanup = () => {
      utterance.onend = null;
      utterance.onerror = null;
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 12000);
    utterance.onend = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve();
    };
    utterance.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("Browser speech synthesis failed"));
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakStartupGreeting(): Promise<StartupSpeechMode> {
  if (startupGreetingSpoken) {
    return "none";
  }
  startupGreetingSpoken = true;
  try {
    const resp = await fetch("/api/v1/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: STARTUP_GREETING, wait: false }),
    });
    if (!resp.ok) {
      throw new Error("Failed to speak startup greeting");
    }
    return "api";
  } catch {
    // Cloud/remote API may not have local speakers; use client-side speech fallback.
  }
  try {
    await speakInBrowser(STARTUP_GREETING);
    return "browser";
  } catch {
    // The intro should continue even if all speech options are unavailable.
  }
  return "none";
}

export async function readApiSpeaking(): Promise<boolean | null> {
  try {
    const resp = await fetch("/api/v1/voice/status");
    if (!resp.ok) return null;
    const data = await resp.json();
    return !!data?.is_speaking;
  } catch {
    return null;
  }
}

export async function disableVoicePipeline(): Promise<void> {
  try {
    await fetch("/api/v1/voice/deactivate", { method: "POST" });
  } catch {
    // best effort
  }
  try {
    await fetch("/api/v1/voice/disable", { method: "POST" });
  } catch {
    // best effort
  }
}

export async function waitForApiSpeaking(target: boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const speaking = await readApiSpeaking();
    if (speaking === target) {
      return true;
    }
    await sleep(120);
  }
  return false;
}
