import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSubjects, extractComputeLocation, parseLocations, parseSimpleCount } from "./flow/commands";
import { buildServerReadySpeech } from "./flow/prompts";
import {
  defaultFlowContext,
  flowActionText,
  flowPromptText,
  flowStatusText,
  type FlowContext,
  type FlowState,
  type VoiceIntent
} from "./flow/states";
import { canStartSession } from "./flow/transitions";

type VoiceStatus = {
  enabled: boolean;
  running: boolean;
  wakeword: string;
  tts_enabled?: boolean;
  is_speaking?: boolean;
  last_error?: string | null;
};

type RobotState = "idle" | "listening" | "active" | "speaking";
const IDLE_PROMPT_DEDUPE_MS = 3000;
const WAKE_IDLE_COMMAND_TIMEOUT_MS = 60000;
const CONTROLLER_LOCK_KEY = "__neia_voice_controller_lock_v1";
const CONTROLLER_ID_KEY = "__neia_voice_controller_id_v1";
const CONTROLLER_STALE_MS = 4000;
const ACTIVE_INSTANCE_KEY = "__neia_voice_active_instance_v1";
const IDENTIFY_CONFIRM_DELAY_MS = 2000;
const NO_CATCH_COOLDOWN_MS = 2500;

type ConfirmField =
  | "session_owner"
  | "session_label"
  | "subject_count"
  | "sensor_setup"
  | "sensor_locations"
  | "algorithm";

type PendingInputConfirm = {
  field: ConfirmField;
  value: any;
  ctx: FlowContext;
};

type GatewaySubjectPayload = {
  subject_id: string;
};

function getGatewaySubjects(payload: unknown): GatewaySubjectPayload[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is GatewaySubjectPayload =>
        Boolean(item) && typeof item === "object" && typeof (item as GatewaySubjectPayload).subject_id === "string",
    );
  }

  if (payload && typeof payload === "object") {
    const subjects = (payload as { subjects?: unknown }).subjects;
    if (Array.isArray(subjects)) {
      return subjects.filter(
        (item): item is GatewaySubjectPayload =>
          Boolean(item) && typeof item === "object" && typeof (item as GatewaySubjectPayload).subject_id === "string",
      );
    }
  }

  return [];
}

function resolveGatewayEventsWsUrl(): string {
  const fromWindow = String((window as any).__NEIA_GATEWAY_WS_URL || "").trim();
  if (fromWindow) return fromWindow;

  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const { hostname, port } = window.location;
  const devPorts = new Set(["3000", "3002", "5173", "5174"]);
  const targetPort = devPorts.has(port) ? "8050" : port;
  const portSuffix = targetPort ? `:${targetPort}` : "";
  return `${wsProtocol}://${hostname}${portSuffix}/api/v1/gateway/events`;
}

function shouldAnnounceIdlePromptNow() {
  if (typeof window === "undefined") return true;
  const key = "__neia_voice_idle_prompt_at";
  const now = Date.now();
  const last = Number((window as any)[key] || 0);
  if (now - last < IDLE_PROMPT_DEDUPE_MS) return false;
  (window as any)[key] = now;
  return true;
}

function useVoiceStatus() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);

  const refresh = useCallback(async () => {
    const statusResp = await fetch("/api/v1/voice/status");
    if (statusResp.ok) setStatus(await statusResp.json());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const applyStatusEvent = useCallback((nextStatus: VoiceStatus) => {
    setStatus(nextStatus);
  }, []);

  return { status, refresh, applyStatusEvent };
}

function RobotFace({ state }: { state: RobotState }) {
  return (
    <div className={`assistant-robot ${state}`} aria-hidden="true">
      <div className="assistant-head">
        <div className="assistant-eyes">
          <span className="assistant-eye" />
          <span className="assistant-eye" />
        </div>
        <div className="assistant-mouth" />
      </div>
    </div>
  );
}


export default function App() {
  const { status, refresh, applyStatusEvent } = useVoiceStatus();
  const [isController, setIsController] = useState(false);
  const [booting, setBooting] = useState(true);
  const [recentWake, setRecentWake] = useState(false);
  const [wakewordHeard, setWakewordHeard] = useState(false);
  const [displayTranscript, setDisplayTranscript] = useState("");
  const [heardText, setHeardText] = useState("");
  const [awaitingCommand, setAwaitingCommand] = useState(false);
  const [robotSpeaking, setRobotSpeaking] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [flowContext, setFlowContext] = useState<FlowContext>(defaultFlowContext());
  const [identifyActionText, setIdentifyActionText] = useState("");
  const [identifyPromptText, setIdentifyPromptText] = useState("");

  const flowStateRef = useRef<FlowState>("idle");
  const flowContextRef = useRef<FlowContext>(defaultFlowContext());
  const controllerIdRef = useRef<string>("");
  const instanceIdRef = useRef<string>(`inst-${Math.random().toString(36).slice(2)}`);
  const apiTtsEnabledRef = useRef<boolean>(true);
  const pendingIdentifyRef = useRef<Array<Record<string, any>>>([]);
  const pendingInputConfirmRef = useRef<PendingInputConfirm | null>(null);
  const currentIdentifyRef = useRef<Record<string, any> | null>(null);
  const lastGatewayCommandRef = useRef<Record<string, any> | null>(null);
  const serverReadyHandledRef = useRef<boolean>(false);
  const userStepConsumedRef = useRef<boolean>(false);
  const gatewayStepLockRef = useRef<string>("");
  const apiSpeakingRef = useRef<boolean>(false);
  const speechBlockRef = useRef<boolean>(false);
  const speechBlockUntilRef = useRef<number>(0);
  const lastNoCatchAtRef = useRef<number>(0);
  const wakeTimeoutRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<number | null>(null);
  const transcriptClearRef = useRef<number | null>(null);
  const commandWindowRef = useRef<number | null>(null);
  const wakeAutoAdvanceRef = useRef<number | null>(null);
  const identifyConfirmTimerRef = useRef<number | null>(null);
  const wakeSessionOpenRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const idlePromptSpokenRef = useRef<boolean>(false);

  const isListening = !!status?.enabled && !!status?.running;
  const apiSpeaking = !!status?.is_speaking;
  const visibleVoiceError = status?.last_error || null;

  const isActiveInstance = useCallback(() => {
    try {
      return (window as any)[ACTIVE_INSTANCE_KEY] === instanceIdRef.current;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    try {
      const existing = window.sessionStorage.getItem(CONTROLLER_ID_KEY);
      if (existing) {
        controllerIdRef.current = existing;
      } else {
        const next = `voice-${Math.random().toString(36).slice(2)}`;
        controllerIdRef.current = next;
        window.sessionStorage.setItem(CONTROLLER_ID_KEY, next);
      }
    } catch {
      if (!controllerIdRef.current) {
        controllerIdRef.current = `voice-${Math.random().toString(36).slice(2)}`;
      }
    }
  }, []);

  const tryAcquireControllerLock = useCallback(() => {
    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(CONTROLLER_LOCK_KEY);
      const lock = raw ? JSON.parse(raw) as { id?: string; ts?: number } : null;
      const lockId = String(lock?.id || "");
      const lockTs = Number(lock?.ts || 0);
      const stale = !lockId || !lockTs || (now - lockTs) > CONTROLLER_STALE_MS;
      if (stale || lockId === controllerIdRef.current) {
        window.localStorage.setItem(
          CONTROLLER_LOCK_KEY,
          JSON.stringify({ id: controllerIdRef.current, ts: now })
        );
        setIsController(true);
      } else {
        setIsController(false);
      }
    } catch {
      setIsController(true);
    }
  }, []);

  const isSpeechBlocked = useCallback(() => {
    if (speechBlockRef.current) return true;
    if (apiSpeakingRef.current) return true;
    if (Date.now() < speechBlockUntilRef.current) return true;
    return false;
  }, []);

  const showTranscript = useCallback((text: string) => {
    if (!text) return;
    setDisplayTranscript(text);
    setHeardText(text);
    if (transcriptClearRef.current) window.clearTimeout(transcriptClearRef.current);
    transcriptClearRef.current = window.setTimeout(() => {
      setDisplayTranscript("");
      setHeardText("");
    }, 9000);
  }, []);

  const updateFlow = (next: FlowState, awaiting = "", nextCtx?: FlowContext) => {
    const prev = flowStateRef.current;
    flowStateRef.current = next;
    setFlowState(next);
    gatewayStepLockRef.current = "";
    userStepConsumedRef.current = false;
    if (next !== prev) {
      setWakewordHeard(false);
      setRecentWake(false);
      if (next !== "identifying") {
        setIdentifyActionText("");
      }
      if (next !== "awaiting_identify_confirm") {
        setIdentifyPromptText("");
      }
      if (next !== "idle") {
        setAwaitingCommand(false);
      }
      if (next === "idle") {
        setHeardText("");
      }
    }
    void awaiting;
    if (nextCtx) {
      flowContextRef.current = nextCtx;
      setFlowContext(nextCtx);
      return;
    }
    setFlowContext({ ...flowContextRef.current });
  };

  const speakBrowser = (text: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => setRobotSpeaking(true);
      utterance.onend = () => setRobotSpeaking(false);
      utterance.onerror = () => setRobotSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore browser tts errors
    }
  };

  const speakBrowserBlocking = (text: string) =>
    new Promise<void>((resolve) => {
      if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          utterance.onstart = null;
          utterance.onend = null;
          utterance.onerror = null;
          setRobotSpeaking(false);
          resolve();
        };
        const timeout = window.setTimeout(finish, 12000);
        utterance.onstart = () => setRobotSpeaking(true);
        utterance.onend = () => {
          window.clearTimeout(timeout);
          finish();
        };
        utterance.onerror = () => {
          window.clearTimeout(timeout);
          finish();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });

  const speak = useCallback(async (text: string, wait = false) => {
    if (!text) return;
    if (wait) {
      speechBlockRef.current = true;
      setAwaitingCommand(false);
    }
    const finishBlock = () => {
      if (!wait) return;
      speechBlockRef.current = false;
      speechBlockUntilRef.current = Date.now() + 500;
    };
    if (apiTtsEnabledRef.current) {
      const resp = await fetch("/api/v1/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, wait })
      }).catch(() => null);
      if (resp?.ok) {
        finishBlock();
        return;
      }
    }
    if (wait) {
      await speakBrowserBlocking(text);
    } else {
      speakBrowser(text);
    }
    finishBlock();
  }, []);

  const speakNoCatch = useCallback(async () => {
    const now = Date.now();
    if (now - lastNoCatchAtRef.current < NO_CATCH_COOLDOWN_MS) {
      return;
    }
    lastNoCatchAtRef.current = now;
    await speak("I did not catch that. Please repeat.", true);
  }, [speak]);

  const sendGatewayCommand = useCallback(
    async (command: Record<string, any>, spokenText?: string, spokenWait = true) => {
      if (!isActiveInstance()) return;
      if (!isController) return;
      lastGatewayCommandRef.current = command;
      await fetch("/api/v1/gateway/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command)
      }).catch(() => null);
      if (spokenText) {
        await speak(spokenText, spokenWait);
      }
    },
    [isActiveInstance, isController, speak]
  );

  const resetFlow = useCallback(
    async (spokenText?: string) => {
      pendingIdentifyRef.current = [];
      pendingInputConfirmRef.current = null;
      currentIdentifyRef.current = null;
      if (identifyConfirmTimerRef.current) {
        window.clearTimeout(identifyConfirmTimerRef.current);
        identifyConfirmTimerRef.current = null;
      }
      wakeSessionOpenRef.current = false;
      serverReadyHandledRef.current = false;
      flowContextRef.current = defaultFlowContext();
      updateFlow("idle", "", flowContextRef.current);
      if (spokenText) {
        await speak(spokenText, true);
      }
    },
    [speak]
  );

  const startNextIdentify = useCallback(async () => {
    if (identifyConfirmTimerRef.current) {
      window.clearTimeout(identifyConfirmTimerRef.current);
      identifyConfirmTimerRef.current = null;
    }
    const next = pendingIdentifyRef.current.shift() || null;
    currentIdentifyRef.current = next;
    if (!next) {
      await speak('Ready to start streaming? Please provide a tag, for example: "test one".', true);
      updateFlow("awaiting_start_stream", "start_stream");
      return false;
    }
    const location = String(next.payload?.location || "sensor")
      .replace(/_/g, " ")
      .toLowerCase();
    const subjectId = String(next.payload?.subject_id || "subject1");
    const subjectNum = subjectId.toLowerCase().startsWith("subject")
      ? subjectId.slice("subject".length)
      : subjectId;
    const subjectLabel = `subject ${subjectNum || "1"}`;
    updateFlow("identifying", "identify_confirm");
    const identifySpeech = `Identifying ${location} sensor for ${subjectLabel}.`;
    setIdentifyActionText(identifySpeech);
    await sendGatewayCommand(next, identifySpeech);
    identifyConfirmTimerRef.current = window.setTimeout(() => {
      const confirmSpeech = `Is the ${location} sensor for ${subjectLabel} placed?`;
      setIdentifyPromptText(confirmSpeech);
      void speak(confirmSpeech, true);
      updateFlow("awaiting_identify_confirm", "identify_confirm");
      identifyConfirmTimerRef.current = null;
    }, IDENTIFY_CONFIRM_DELAY_MS);
    return true;
  }, [sendGatewayCommand, speak]);

  const listToSpeech = useCallback((items: string[]) => {
    const labels = items.map((item) => item.replace(/_/g, " ").toLowerCase());
    if (!labels.length) return "";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  }, []);

  const isAffirmative = useCallback((intentName: string, text: string) => {
    if (intentName === "affirm") return true;
    return /\b(yes|yeah|yep|correct|right|affirmative|continue|okay|ok)\b/.test(text);
  }, []);

  const isNegative = useCallback((intentName: string, text: string) => {
    if (intentName === "deny") return true;
    return /\b(no|nope|negative|wrong|incorrect|change|again)\b/.test(text);
  }, []);

  const requestInputConfirmation = useCallback(async (
    field: ConfirmField,
    value: any,
    ctx: FlowContext,
    confirmSpeech: string
  ) => {
    pendingInputConfirmRef.current = { field, value, ctx: { ...ctx } };
    updateFlow("awaiting_input_confirm", "input_confirm", { ...ctx });
    await speak(confirmSpeech, true);
  }, [speak]);

  const handleIntent = useCallback(
    async (intent: VoiceIntent) => {
      const name = (intent.intent || "").toLowerCase();
      const state = flowStateRef.current;
      const ctx = { ...flowContextRef.current };
      const rawText = String(intent.text || intent._raw_text || intent.label || intent.name || "").trim();
      const loweredRawText = rawText.toLowerCase();

      const isUserStep = (
        state === "awaiting_session_owner"
        || state === "awaiting_session_label"
        || state === "awaiting_subject_count"
        || state === "awaiting_sensor_setup"
        || state === "awaiting_sensor_locations"
        || state === "awaiting_algorithm"
        || state === "awaiting_input_confirm"
        || state === "awaiting_sensors_on"
        || state === "awaiting_identify_confirm"
        || state === "awaiting_start_stream"
        || state === "awaiting_disconnect_confirm"
      );
      if (isUserStep && userStepConsumedRef.current) {
        return;
      }

      if ((name === "start_session" || name === "check_ready") && canStartSession(state)) {
        serverReadyHandledRef.current = false;
        updateFlow("awaiting_server_ready");
        await sendGatewayCommand({ type: "is_server_ready", payload: {} }, "Checking server readiness.");
        return;
      }

      if (state === "awaiting_input_confirm") {
        const pending = pendingInputConfirmRef.current;
        if (!pending) {
          await speak("I did not catch that. Please repeat.", true);
          return;
        }
        if (isAffirmative(name, loweredRawText)) {
          userStepConsumedRef.current = true;
          pendingInputConfirmRef.current = null;
          const confirmedCtx = { ...pending.ctx };
          if (pending.field === "session_owner") {
            confirmedCtx.session_owner = String(pending.value);
            flowContextRef.current = confirmedCtx;
            await speak("What is the session called?", true);
            updateFlow("awaiting_session_label", "session_label", confirmedCtx);
            return;
          }
          if (pending.field === "session_label") {
            confirmedCtx.init_label = String(pending.value);
            flowContextRef.current = confirmedCtx;
            await speak(`Thank you. How many subjects for ${confirmedCtx.init_label}?`, true);
            updateFlow("awaiting_subject_count", "subject_count", confirmedCtx);
            return;
          }
          if (pending.field === "subject_count") {
            confirmedCtx.subject_count = Number(pending.value);
            flowContextRef.current = confirmedCtx;
            await speak("Which sensors are you using and how many? For example: two movella dots.", true);
            updateFlow("awaiting_sensor_setup", "sensor_setup", confirmedCtx);
            return;
          }
          if (pending.field === "sensor_setup") {
            const setup = pending.value as {
              sensor_name: string;
              sensor_count: number;
              locations: string[];
            };
            confirmedCtx.sensor_name = setup.sensor_name;
            confirmedCtx.sensor_count = setup.sensor_count;
            confirmedCtx.locations = setup.locations || [];
            flowContextRef.current = confirmedCtx;
            if (!confirmedCtx.locations.length) {
              await speak("Where are the sensors being placed? For example: left ankle and right ankle.", true);
              updateFlow("awaiting_sensor_locations", "locations", confirmedCtx);
              return;
            }
            await speak("What algorithm should I use?", true);
            updateFlow("awaiting_algorithm", "algorithm", confirmedCtx);
            return;
          }
          if (pending.field === "sensor_locations") {
            confirmedCtx.locations = [...(pending.value as string[])];
            flowContextRef.current = confirmedCtx;
            await speak("What algorithm should I use?", true);
            updateFlow("awaiting_algorithm", "algorithm", confirmedCtx);
            return;
          }
          if (pending.field === "algorithm") {
            const algo = pending.value as { name: string; inputs: Record<string, any> };
            confirmedCtx.algorithm_name = algo.name;
            confirmedCtx.algorithm_inputs = algo.inputs;
            flowContextRef.current = confirmedCtx;
            await speak("Got it. Initializing the system.", true);
            updateFlow("initializing", "", confirmedCtx);
            await sendGatewayCommand(
              { type: "init_system", payload: { subjects: buildSubjects(confirmedCtx), init_label: confirmedCtx.init_label } }
            );
            return;
          }
        }
        if (isNegative(name, loweredRawText)) {
          userStepConsumedRef.current = true;
          pendingInputConfirmRef.current = null;
          if (pending.field === "session_owner") {
            await speak("Okay. Who is running the session?", true);
            updateFlow("awaiting_session_owner", "session_owner", { ...pending.ctx });
            return;
          }
          if (pending.field === "session_label") {
            await speak("Okay. What is the session called?", true);
            updateFlow("awaiting_session_label", "session_label", { ...pending.ctx });
            return;
          }
          if (pending.field === "subject_count") {
            await speak("Okay. How many subjects?", true);
            updateFlow("awaiting_subject_count", "subject_count", { ...pending.ctx });
            return;
          }
          if (pending.field === "sensor_setup") {
            await speak("Okay. Which sensors are you using and how many?", true);
            updateFlow("awaiting_sensor_setup", "sensor_setup", { ...pending.ctx });
            return;
          }
          if (pending.field === "sensor_locations") {
            await speak("Okay. Where are the sensors being placed?", true);
            updateFlow("awaiting_sensor_locations", "locations", { ...pending.ctx });
            return;
          }
          if (pending.field === "algorithm") {
            await speak("Okay. What algorithm should I use?", true);
            updateFlow("awaiting_algorithm", "algorithm", { ...pending.ctx });
            return;
          }
        }
        await speak("Please say yes or no.", true);
        return;
      }

      if (state === "awaiting_session_owner") {
        const owner = String(intent.name || intent.text || intent.label || "").trim();
        if (owner.length >= 2) {
          userStepConsumedRef.current = true;
          await requestInputConfirmation("session_owner", owner, ctx, `I heard ${owner}. Is that correct?`);
        } else {
          await speak("I did not catch the name. Who is running the session?", true);
        }
        return;
      }

      if (state === "awaiting_session_label") {
        const label = String(intent.label || intent.text || "").trim();
        if (label.length >= 2) {
          userStepConsumedRef.current = true;
          await requestInputConfirmation("session_label", label, ctx, `I heard ${label}. Is that correct?`);
        } else {
          await speak("I did not catch the session name. What is the session called?", true);
        }
        return;
      }

      if (state === "awaiting_subject_count") {
        const count = typeof intent.count === "number" ? intent.count : parseSimpleCount(rawText);
        if (count && count > 0) {
          userStepConsumedRef.current = true;
          await requestInputConfirmation("subject_count", count, ctx, `I heard ${count} subjects. Is that correct?`);
        } else {
          await speak("Please tell me the number of subjects, for example: two subjects.", true);
        }
        return;
      }

      if (state === "awaiting_sensor_setup") {
        if (intent.sensor_name) ctx.sensor_name = intent.sensor_name;
        if (typeof intent.sensor_count === "number" && intent.sensor_count > 0) ctx.sensor_count = intent.sensor_count;
        if (Array.isArray(intent.locations) && intent.locations.length) ctx.locations = intent.locations;
        if (rawText) {
          if (!ctx.sensor_count) {
            const parsed = parseSimpleCount(rawText);
            if (parsed && parsed > 0) ctx.sensor_count = parsed;
          }
          if (!ctx.locations.length) {
            ctx.locations = parseLocations(rawText);
          }
        }
        if (ctx.sensor_count && !ctx.sensor_name) ctx.sensor_name = "Movella DOT";
        flowContextRef.current = ctx;
        updateFlow("awaiting_sensor_setup", "sensor_setup", ctx);
        if (!ctx.sensor_name || !ctx.sensor_count) {
          await speak("I did not catch the sensor type and count. For example: two movella dots.", true);
          return;
        }
        userStepConsumedRef.current = true;
        const setupSpeech = ctx.locations.length
          ? `I heard ${ctx.sensor_count} ${ctx.sensor_name} sensors at ${listToSpeech(ctx.locations)}. Is that correct?`
          : `I heard ${ctx.sensor_count} ${ctx.sensor_name} sensors. Is that correct?`;
        await requestInputConfirmation(
          "sensor_setup",
          { sensor_name: ctx.sensor_name, sensor_count: ctx.sensor_count, locations: [...ctx.locations] },
          ctx,
          setupSpeech
        );
        return;
      }

      if (state === "awaiting_sensor_locations") {
        const locations = parseLocations(rawText);
        if (locations.length) {
          userStepConsumedRef.current = true;
          await requestInputConfirmation(
            "sensor_locations",
            locations,
            ctx,
            `I heard sensor locations ${listToSpeech(locations)}. Is that correct?`
          );
        } else {
          await speak("Please specify locations like left ankle and right ankle.", true);
        }
        return;
      }

      if (state === "awaiting_algorithm") {
        const algorithmName = String(intent.name || "").trim() || ctx.algorithm_name;
        const algorithmInputs = (intent.inputs && typeof intent.inputs === "object")
          ? intent.inputs
          : ctx.algorithm_inputs;
        if (!algorithmName) {
          await speak("I did not catch the algorithm. What algorithm should I use?", true);
          return;
        }
        userStepConsumedRef.current = true;
        await requestInputConfirmation(
          "algorithm",
          { name: algorithmName, inputs: algorithmInputs },
          ctx,
          `I heard algorithm ${algorithmName}. Is that correct?`
        );
        return;
      }

      if (state === "awaiting_sensors_on") {
        if (name === "affirm" || name === "discover_sensors") {
          userStepConsumedRef.current = true;
          updateFlow("discovering");
          await sendGatewayCommand({ type: "discover_sensors", payload: {} }, "Discovering sensors.");
          return;
        }
        if (name === "deny") {
          await speak("Okay. Turn on the sensors and say discover sensors when ready.", true);
          return;
        }
      }

      if (state === "awaiting_identify_confirm") {
        if (name === "affirm") {
          userStepConsumedRef.current = true;
          await startNextIdentify();
          return;
        }
        if (name === "deny") {
          if (currentIdentifyRef.current) {
            await sendGatewayCommand(currentIdentifyRef.current, "Okay. Identifying that location again.");
          }
          await speak("Is the sensor placed?", true);
          return;
        }
      }

      if (state === "awaiting_start_stream") {
        let tag = intent.tag || flowContextRef.current.tag;
        if (!tag && (name === "free_text" || name === "tag" || name === "start_stream")) {
          tag = rawText;
        }
        if (!tag) {
          await speak('Please provide a tag, for example: "test one".', true);
          return;
        }
        userStepConsumedRef.current = true;
        ctx.tag = tag;
        flowContextRef.current = ctx;
        updateFlow("streaming_starting", "", ctx);
        await sendGatewayCommand({ type: "start_stream_for_all", payload: { tag } }, "Starting the stream.");
        return;
      }

      if (state === "streaming" || state === "streaming_starting") {
        if (name === "stop_stream") {
          updateFlow("stopping");
          await sendGatewayCommand({ type: "stop_stream_for_all", payload: {} }, "Stopping the stream.");
          return;
        }
        await speakNoCatch();
        return;
      }

      if (state === "awaiting_disconnect_confirm") {
        if (name === "affirm" || name === "disconnect") {
          userStepConsumedRef.current = true;
          updateFlow("disconnecting");
          await sendGatewayCommand({ type: "disconnect_all", payload: {} }, "Disconnecting sensors.");
          return;
        }
        if (name === "deny") {
          await resetFlow("Okay. Say nexus when you are ready.");
          return;
        }
        if (name === "repeat") {
          ctx.tag = undefined;
          flowContextRef.current = ctx;
          await speak("Please name a tag.", true);
          updateFlow("awaiting_start_stream", "start_stream", ctx);
          return;
        }
      }

      if (state === "error") {
        if (name === "retry" && lastGatewayCommandRef.current) {
          await sendGatewayCommand(lastGatewayCommandRef.current, "Retrying the last command.");
          return;
        }
        if (name === "cancel") {
          await resetFlow("Canceled.");
          return;
        }
      }

      if (name === "status") {
        await speak(flowStatusText(state) || "Idle. Say nexus to begin.");
        return;
      }

      const activeFlow = state !== "idle" && state !== "awaiting_server_ready" && state !== "initializing";
      if (activeFlow) {
        await speakNoCatch();
      }
    },
    [
      isAffirmative,
      isNegative,
      listToSpeech,
      requestInputConfirmation,
      resetFlow,
      sendGatewayCommand,
      speak,
      speakNoCatch,
      startNextIdentify
    ]
  );

  const handleGatewayEvent = useCallback(
    async (event: any) => {
      const type = event?.type;
      const state = flowStateRef.current;
      const ctx = { ...flowContextRef.current };
      const eventSig = `${state}|${String(type || "")}`;
      if (gatewayStepLockRef.current === eventSig) {
        return;
      }

      if (type === "server_ready" && state === "awaiting_server_ready") {
        if (serverReadyHandledRef.current) {
          return;
        }
        gatewayStepLockRef.current = eventSig;
        serverReadyHandledRef.current = true;
        await speak(`${buildServerReadySpeech(event)} Who is running the session?`, true);
        updateFlow("awaiting_session_owner", "session_owner");
        return;
      }

      if (type === "system_initialized" && state === "initializing") {
        gatewayStepLockRef.current = eventSig;
        await speak(`System initialized for ${ctx.subject_count} subjects. Are sensors turned on for the subjects?`, true);
        updateFlow("awaiting_sensors_on", "confirm_sensors_on");
        return;
      }

      if (type === "sensors_discovered" && state === "discovering") {
        const subjects = getGatewaySubjects(event?.payload);
        if (!subjects.length) {
          return;
        }
        gatewayStepLockRef.current = eventSig;
        updateFlow("connecting");
        await sendGatewayCommand({ type: "connect_all", payload: {} }, "Found sensors. Connecting now.");
        return;
      }

      if (type === "sensor_connected" && state === "connecting") {
        const subjects = getGatewaySubjects(event?.payload);
        if (!subjects.length) {
          return;
        }
        gatewayStepLockRef.current = eventSig;
        if (!ctx.locations.length) {
          await speak("Sensors connected. Where are the sensors being placed?", true);
          updateFlow("awaiting_sensor_locations", "locations", ctx);
          return;
        }
        const queue: Array<Record<string, any>> = [];
        const subjectCount = Math.max(1, ctx.subject_count || 1);
        for (let i = 0; i < subjectCount; i += 1) {
          const subjectId = `subject${i + 1}`;
          for (const location of ctx.locations) {
            queue.push({ type: "identify_sensor", payload: { subject_id: subjectId, location } });
          }
        }
        pendingIdentifyRef.current = queue;
        await startNextIdentify();
        return;
      }

      if (type === "sensor_identified" && state === "identifying") {
        gatewayStepLockRef.current = eventSig;
        return;
      }

      if (type === "stream_started" && state === "streaming_starting") {
        gatewayStepLockRef.current = eventSig;
        setEventCounts({});
        await speak("Streaming started. Say stop stream when you're done.", true);
        updateFlow("streaming");
        return;
      }

      if (type === "stream_stopped" && (state === "streaming" || state === "stopping")) {
        gatewayStepLockRef.current = eventSig;
        await speak("Streaming stopped. Should I disconnect sensors or repeat?", true);
        updateFlow("awaiting_disconnect_confirm", "confirm_disconnect");
        return;
      }

      if (type === "sensor_disconnected") {
        await resetFlow("All sensors disconnected. Say nexus to begin.");
        return;
      }

      if (type === "error") {
        gatewayStepLockRef.current = eventSig;
        const payload = event?.payload;
        const message = typeof payload === "string" ? payload : payload?.msg || payload?.message || "Unknown error";
        await speak(`That failed: ${message}. Do you want to retry, change inputs, or cancel?`, true);
        updateFlow("error", "error_resolution", ctx);
      }
    },
    [resetFlow, sendGatewayCommand, speak, startNextIdentify]
  );

  const playWakeTone = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
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
    } catch {
      // ignore audio errors
    }
  };

  const ensureVoiceEnabled = useCallback(async (attempts = 4) => {
    for (let i = 0; i < attempts; i += 1) {
      await fetch("/api/v1/voice/activate", { method: "POST" }).catch(() => null);
      const statusResp = await fetch("/api/v1/voice/status").catch(() => null);
      if (statusResp?.ok) {
        const next = (await statusResp.json()) as VoiceStatus;
        if (next.enabled && next.running) {
          return true;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
    return false;
  }, []);

  useEffect(() => {
    apiTtsEnabledRef.current = status?.tts_enabled !== false;
  }, [status?.tts_enabled]);

  useEffect(() => {
    apiSpeakingRef.current = !!status?.is_speaking;
  }, [status?.is_speaking]);

  useEffect(() => {
    try {
      (window as any)[ACTIVE_INSTANCE_KEY] = instanceIdRef.current;
    } catch {
      // ignore
    }
    return () => {
      try {
        if ((window as any)[ACTIVE_INSTANCE_KEY] === instanceIdRef.current) {
          delete (window as any)[ACTIVE_INSTANCE_KEY];
        }
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    tryAcquireControllerLock();
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        tryAcquireControllerLock();
      }
    }, 1000);
    const onStorage = (evt: StorageEvent) => {
      if (evt.key === CONTROLLER_LOCK_KEY) {
        tryAcquireControllerLock();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tryAcquireControllerLock();
      }
    };
    const onUnload = () => {
      try {
        const raw = window.localStorage.getItem(CONTROLLER_LOCK_KEY);
        const lock = raw ? JSON.parse(raw) as { id?: string } : null;
        if (String(lock?.id || "") === controllerIdRef.current) {
          void fetch("/api/v1/voice/deactivate", { method: "POST", keepalive: true }).catch(() => null);
          window.localStorage.removeItem(CONTROLLER_LOCK_KEY);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      onUnload();
    };
  }, [tryAcquireControllerLock]);

  useEffect(() => {
    if (!isActiveInstance()) return;
    if (!isController) {
      setBooting(false);
      return;
    }
    setBooting(true);
    let active = true;
    void (async () => {
      try {
        await fetch("/api/v1/voice/reset", { method: "POST" }).catch(() => null);
        await ensureVoiceEnabled(5);
        await refresh();
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ensureVoiceEnabled, isActiveInstance, isController, refresh]);

  useEffect(() => {
    if (!isActiveInstance()) return;
    if (!isController) return;
    if (booting || !isListening) return;
    if (idlePromptSpokenRef.current) return;
    if (flowStateRef.current !== "idle") return;
    if (!shouldAnnounceIdlePromptNow()) return;
    idlePromptSpokenRef.current = true;
    playWakeTone();
    void speak("Say nexus to begin.", true);
  }, [booting, isActiveInstance, isController, isListening, speak]);

  const robotState = useMemo<RobotState>(() => {
    if (!isListening) return "idle";
    if (robotSpeaking || apiSpeaking) return "speaking";
    if (wakewordHeard || recentWake || awaitingCommand) return "active";
    return "listening";
  }, [apiSpeaking, awaitingCommand, isListening, recentWake, robotSpeaking, wakewordHeard]);

  const eventCountEntries = useMemo(() => {
    const entries = Object.entries(eventCounts);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [eventCounts]);

  useEffect(() => {
    const ws = new WebSocket(resolveGatewayEventsWsUrl());
    ws.onmessage = (msg) => {
      try {
        if (!isActiveInstance()) return;
        const event = JSON.parse(msg.data);
        if (!isController) {
          if (event.type === "voice_status" && event.payload && typeof event.payload === "object") {
            applyStatusEvent(event.payload as VoiceStatus);
          }
          return;
        }
        if (event.type === "voice_wakeword") {
          setWakewordHeard(true);
          setRecentWake(true);
          setAwaitingCommand(true);
          showTranscript(String(event.payload?.text || "nexus"));
          wakeSessionOpenRef.current = true;
          playWakeTone();
          if (wakeTimeoutRef.current) window.clearTimeout(wakeTimeoutRef.current);
          wakeTimeoutRef.current = window.setTimeout(() => setWakewordHeard(false), 1200);
          if (transcriptTimeoutRef.current) window.clearTimeout(transcriptTimeoutRef.current);
          transcriptTimeoutRef.current = window.setTimeout(() => setRecentWake(false), 2200);
          if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
          commandWindowRef.current = window.setTimeout(() => {
            setAwaitingCommand(false);
            if (flowStateRef.current === "idle") {
              wakeSessionOpenRef.current = false;
            }
          }, WAKE_IDLE_COMMAND_TIMEOUT_MS);
          if (wakeAutoAdvanceRef.current) window.clearTimeout(wakeAutoAdvanceRef.current);
          if (flowStateRef.current === "idle") {
            wakeAutoAdvanceRef.current = window.setTimeout(() => {
              if (flowStateRef.current !== "idle") return;
              wakeSessionOpenRef.current = false;
              serverReadyHandledRef.current = false;
              updateFlow("awaiting_server_ready");
              void sendGatewayCommand({ type: "is_server_ready", payload: {} }, "Checking server readiness.");
            }, 1400);
          }
          return;
        }
        if (event.type === "voice_transcript" && event.payload?.text) {
          if (isSpeechBlocked() && flowStateRef.current === "idle") {
            return;
          }
          if (wakeAutoAdvanceRef.current) {
            window.clearTimeout(wakeAutoAdvanceRef.current);
            wakeAutoAdvanceRef.current = null;
          }
          showTranscript(event.payload?.raw || event.payload.text);
          return;
        }
        if (event.type === "voice_command") {
          if (isSpeechBlocked() && flowStateRef.current === "idle") {
            return;
          }
          if (flowStateRef.current === "idle" && !wakeSessionOpenRef.current) {
            return;
          }
          if (wakeAutoAdvanceRef.current) {
            window.clearTimeout(wakeAutoAdvanceRef.current);
            wakeAutoAdvanceRef.current = null;
          }
          setAwaitingCommand(false);
          if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
          if (event.payload?.status === "matched" && event.payload?.command) {
            const recognizedText = String(event.payload?.text || "").trim()
              || String(event.payload?.command?.text || event.payload?.command?._raw_text || "").trim();
            showTranscript(recognizedText);
            void (async () => {
              await handleIntent(event.payload.command as VoiceIntent);
            })();
          }
          return;
        }
        if (event.type === "voice_status" && event.payload && typeof event.payload === "object") {
          applyStatusEvent(event.payload as VoiceStatus);
          return;
        }
        if (event.type === "compute_result") {
          const location = extractComputeLocation(event);
          if (location !== "UNKNOWN") {
            setEventCounts((prev) => ({ ...prev, [location]: (prev[location] || 0) + 1 }));
          }
          return;
        }
        void handleGatewayEvent(event);
      } catch {
        // ignore malformed websocket events
      }
    };

    return () => {
      ws.close();
      if (wakeTimeoutRef.current) window.clearTimeout(wakeTimeoutRef.current);
      if (transcriptTimeoutRef.current) window.clearTimeout(transcriptTimeoutRef.current);
      if (transcriptClearRef.current) window.clearTimeout(transcriptClearRef.current);
      if (commandWindowRef.current) window.clearTimeout(commandWindowRef.current);
      if (wakeAutoAdvanceRef.current) window.clearTimeout(wakeAutoAdvanceRef.current);
      if (identifyConfirmTimerRef.current) window.clearTimeout(identifyConfirmTimerRef.current);
    };
  }, [applyStatusEvent, handleGatewayEvent, handleIntent, isActiveInstance, isController, isSpeechBlocked, sendGatewayCommand, showTranscript]);

  const flowText = flowStatusText(flowState);
  const visibleTranscript = displayTranscript || heardText;
  const actionText = flowState === "identifying" && identifyActionText
    ? identifyActionText
    : flowActionText(flowState);
  const promptText = flowState === "awaiting_identify_confirm" && identifyPromptText
    ? identifyPromptText
    : flowPromptText(flowState);
  const showFlowText = flowState !== "idle" && (!!actionText || !!promptText || !!flowText);

  return (
    <div className="voice-app">
      {flowState === "streaming" ? (
        <div className="event-counter" aria-live="polite">
          <div className="event-counter-title">Events</div>
          {eventCountEntries.length ? (
            eventCountEntries.map(([location, count]) => (
              <div key={location} className="event-counter-line">
                {location.replace(/_/g, " ").toLowerCase()}: {count}
              </div>
            ))
          ) : (
            <div className="event-counter-line muted">none</div>
          )}
        </div>
      ) : null}
      <div className="voice-card">
        <div className="voice-center">
          <RobotFace state={robotState} />
          {wakewordHeard ? <span className="wakeword">Nexus heard</span> : null}
          {showFlowText ? (
            <>
              {actionText ? <p className="transcript empty">{actionText}</p> : null}
              {promptText ? (
                <p className="transcript">
                  {promptText}
                </p>
              ) : null}
              {!actionText && !promptText && flowText ? <p className="transcript empty">{flowText}</p> : null}
            </>
          ) : flowState === "streaming" ? (
            <p className="transcript empty">Listening for stop stream...</p>
          ) : apiSpeaking ? (
            <p className="transcript empty">Speaking...</p>
          ) : flowText ? (
            <p className="transcript empty">{flowText}</p>
          ) : isListening ? (
            <p className="transcript empty">Say "nexus" to begin.</p>
          ) : booting ? (
            <p className="transcript empty">Initializing voice...</p>
          ) : (
            <p className="transcript empty">Voice assistant offline.</p>
          )}
          <p className={`heard-label${visibleTranscript ? "" : " empty"}`}>
            You said: {visibleTranscript || "—"}
          </p>
          {visibleVoiceError ? <p className="error">Voice error: {visibleVoiceError}</p> : null}
          {!isController ? <p className="error">Voice control is active in another tab/window.</p> : null}
        </div>
      </div>
    </div>
  );
}
