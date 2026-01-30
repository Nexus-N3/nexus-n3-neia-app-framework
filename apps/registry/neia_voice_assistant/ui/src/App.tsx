import { useEffect, useMemo, useRef, useState } from "react";

type VoiceStatus = {
  enabled: boolean;
  running: boolean;
  wakeword: string;
  last_error?: string | null;
};

type VoiceLast = {
  transcript?: string | null;
  command?: unknown;
  error?: string | null;
};

function useVoiceStatus() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [last, setLast] = useState<VoiceLast | null>(null);

  const refresh = async () => {
    const [statusResp, lastResp] = await Promise.all([
      fetch("/api/v1/voice/status"),
      fetch("/api/v1/voice/last")
    ]);
    if (statusResp.ok) setStatus(await statusResp.json());
    if (lastResp.ok) setLast(await lastResp.json());
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, []);

  return { status, last, refresh };
}

export default function App() {
  const { status, last, refresh } = useVoiceStatus();
  const [recentWake, setRecentWake] = useState(false);
  const [awaitingServerReady, setAwaitingServerReady] = useState(false);
  const [wakewordHeard, setWakewordHeard] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState("");
  const [lastCommandLabel, setLastCommandLabel] = useState("");
  const [awaitingCommand, setAwaitingCommand] = useState(false);
  const awaitingRef = useRef(false);
  const lastCommandRef = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const wakeTimeoutRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<number | null>(null);
  const commandWindowRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastWakeRef = useRef<number>(0);
  const lastReadyRef = useRef<number>(0);
  const isListening = !!status?.enabled && !!status?.running;
  const wakeword = status?.wakeword || "nexus";

  useEffect(() => {
    if (last?.command && last?.transcript) {
      setDisplayTranscript(last.transcript);
      setRecentWake(true);
      const timer = setTimeout(() => setRecentWake(false), 2200);
      return () => clearTimeout(timer);
    }
    return;
  }, [last]);

  const playWakeTone = () => {
    const now = Date.now();
    if (now - lastWakeRef.current <= 600) {
      return;
    }
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        const start = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      }
    } catch {
      // ignore audio errors
    }
    lastWakeRef.current = now;
  };

  const rippleClass = useMemo(() => {
    if (!isListening) return "ripple idle";
    return recentWake ? "ripple active" : "ripple listening";
  }, [isListening, recentWake]);

  const toggle = async () => {
    if (isListening) {
      await fetch("/api/v1/voice/disable", { method: "POST" });
      await fetch("/api/v1/voice/reset", { method: "POST" });
      setDisplayTranscript("");
      setWakewordHeard(false);
      setAwaitingServerReady(false);
      setLastCommandLabel("");
      setAwaitingCommand(false);
      if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
      awaitingRef.current = false;
    } else {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      } catch {
        // ignore audio init errors
      }
      await fetch("/api/v1/voice/enable", { method: "POST" });
    }
    await refresh();
  };

  const flashWakeword = () => {
    playWakeTone();
    setWakewordHeard(true);
    if (wakeTimeoutRef.current) window.clearTimeout(wakeTimeoutRef.current);
    wakeTimeoutRef.current = window.setTimeout(() => setWakewordHeard(false), 1200);
  };

  const flashTranscript = (text: string) => {
    setDisplayTranscript(text);
    setRecentWake(true);
    if (transcriptTimeoutRef.current) window.clearTimeout(transcriptTimeoutRef.current);
    transcriptTimeoutRef.current = window.setTimeout(() => setRecentWake(false), 2200);
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/v1/gateway/events`);
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === "voice_wakeword") {
          if (awaitingCommand) return;
          console.info("Wakeword heard:", event.payload?.text || "");
          flashWakeword();
          setAwaitingCommand(true);
          if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
          commandWindowRef.current = window.setTimeout(() => {
            setAwaitingCommand(false);
          }, 10000);
          const now = Date.now();
          if (now - lastReadyRef.current > 1500) {
            lastReadyRef.current = now;
          }
        }
        if (event.type === "voice_transcript" && event.payload?.text) {
          flashTranscript(event.payload?.raw || event.payload.text);
        }
        if (event.type === "voice_command") {
          setAwaitingCommand(false);
          if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
          flashWakeword();
          if (event.payload?.status === "matched") {
            const cmdType = event.payload?.command?.type;
            if (cmdType) {
              setLastCommandLabel(`Command: ${cmdType}`);
            }
            if (cmdType === "is_server_ready") {
              if (lastCommandRef.current !== "is_server_ready") {
                lastCommandRef.current = "is_server_ready";
              }
              setAwaitingServerReady(true);
              awaitingRef.current = true;
              if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
              timeoutRef.current = window.setTimeout(() => {
                if (awaitingRef.current) {
                  setAwaitingServerReady(false);
                  awaitingRef.current = false;
                }
              }, 8000);
            }
          } else if (event.payload?.status === "unmatched") {
            setLastCommandLabel("Command: unrecognized");
          }
        }
        if (event.type === "server_ready" && awaitingRef.current) {
          setAwaitingServerReady(false);
          awaitingRef.current = false;
          setWakewordHeard(false);
          const payload = event.payload || {};
          const site = payload.site || event.site;
          const sensors = Array.isArray(payload.supported_sensors) ? payload.supported_sensors : [];
          const names = sensors.map((s: any) => (typeof s === "string" ? s : s?.name)).filter(Boolean);
          const sensorList = names.length ? names.join(", ") : "no sensors";
          const siteText = site ? ` at ${site}` : "";
          speak(`Server is ready${siteText}. Supported sensors: ${sensorList}.`);
        }
      } catch {
        // ignore
      }
    };
    return () => {
      ws.close();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (wakeTimeoutRef.current) window.clearTimeout(wakeTimeoutRef.current);
      if (transcriptTimeoutRef.current) window.clearTimeout(transcriptTimeoutRef.current);
      if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
    };
  }, []);

  return (
    <div className="voice-app">
      <div className="voice-card">
        <div className="voice-header">
          <h2>NEIA Voice Assistant</h2>
          <p className="hint">Say “{wakeword}” to begin a command.</p>
        </div>
        <div className="voice-center">
          <div className={rippleClass}>
            <div className="ripple-track">
              {Array.from({ length: 12 }).map((_, idx) => (
                <span key={idx} style={{ animationDelay: `${idx * 0.08}s` }} />
              ))}
            </div>
          </div>
          {wakewordHeard ? <span className="wakeword">Wakeword heard</span> : null}
          {displayTranscript ? (
            <p className="transcript">“{displayTranscript}”</p>
          ) : awaitingCommand ? (
            <p className="transcript empty">Ready for command…</p>
          ) : (
            <p className="transcript empty">Say the wake word to begin.</p>
          )}
          {lastCommandLabel ? <p className="command-label">{lastCommandLabel}</p> : null}
          <button className="primary" onClick={toggle}>
            {isListening ? "Stop Listening" : "Start Listening"}
          </button>
          {status?.last_error ? (
            <p className="error">Voice error: {status.last_error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
