from __future__ import annotations

import json
import re
import queue
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from .nlu import parse_intent, parse_command, parse_locations
from .tts import speak
import logging

logger = logging.getLogger("uvicorn.error")


@dataclass
class VoiceFlowContext:
    session_owner: Optional[str] = None
    init_label: Optional[str] = None
    subject_count: int = 1
    sensor_count: Optional[int] = None
    sensor_name: Optional[str] = None
    locations: list[str] = field(default_factory=list)
    algorithm_name: str = "standard_loading_intensity"
    algorithm_inputs: Dict[str, Any] = field(default_factory=lambda: {"gravity": 9.80665})
    tag: Optional[str] = None

    def build_subjects(self) -> list[Dict[str, Any]]:
        subjects = []
        for idx in range(self.subject_count):
            subject_id = f"subject{idx + 1}"
            subjects.append(
                {
                    "subject_id": subject_id,
                    "sensors": [
                        {
                            "number_of": self.sensor_count or 1,
                            "local_name": self.sensor_name or "Movella DOT",
                            "compute_algorithm": {
                                "name": self.algorithm_name,
                                "inputs": self.algorithm_inputs,
                            },
                            "locations": self.locations or [],
                        }
                    ],
                }
            )
        return subjects


class VoiceManager:
    def __init__(
        self,
        base_dir: Path,
        send_command: Callable[[Dict[str, Any]], None],
        broadcast_event: Callable[[Dict[str, Any]], None],
        wakeword: str,
        wakeword_aliases: str,
        model_path: str,
        device: str,
        sample_rate: int,
        debug: bool,
        device_auto: bool,
        stt_engine: str,
        stt_model: str,
        stt_device: str,
        stt_compute_type: str,
        stt_language: str,
        stt_chunk_seconds: float,
        tts_enabled: bool,
        tts_engine: str,
        tts_bin: str,
        tts_voice: str,
        tts_piper_bin: str,
        tts_piper_model: str,
        tts_piper_player: str,
        tts_piper_player_device: str,
        tts_piper_player_args: str,
        tts_pad_lead_ms: int,
        tts_pad_tail_ms: int,
        tts_output_latency_ms: int,
        flow_step_delay_ms: int,
        flow_mode: str,
        enabled: bool,
    ) -> None:
        self._base_dir = base_dir
        self._send_command = send_command
        self._broadcast_event = broadcast_event
        self._wakeword = wakeword.lower().strip()
        aliases = [a.strip().lower() for a in wakeword_aliases.split(",") if a.strip()]
        self._wakeword_aliases = [self._wakeword] + [a for a in aliases if a != self._wakeword]
        self._model_path = model_path
        self._device = device
        self._sample_rate = sample_rate
        self._debug = debug
        self._device_auto = device_auto
        self._stt_engine = stt_engine
        self._stt_model = stt_model
        self._stt_device = stt_device
        self._stt_compute_type = stt_compute_type
        self._stt_language = stt_language
        self._stt_chunk_seconds = max(0.4, stt_chunk_seconds)
        self._tts_enabled = tts_enabled
        self._tts_engine = tts_engine
        self._tts_bin = tts_bin
        self._tts_voice = tts_voice
        self._tts_piper_bin = tts_piper_bin
        self._tts_piper_model = tts_piper_model
        self._tts_piper_player = tts_piper_player
        self._tts_piper_player_device = (tts_piper_player_device or "").strip()
        self._tts_piper_player_args = tts_piper_player_args or ""
        self._tts_pad_lead_ms = max(0, int(tts_pad_lead_ms))
        self._tts_pad_tail_ms = max(0, int(tts_pad_tail_ms))
        self._tts_output_latency = max(0.0, float(tts_output_latency_ms) / 1000.0)
        self._flow_step_delay = max(0.0, float(flow_step_delay_ms) / 1000.0)
        self._flow_mode = "backend" if (flow_mode or "").strip().lower() == "backend" else "ui"
        self._enabled = enabled
        self._running = False
        if self._tts_engine == "piper" and not self._tts_piper_model:
            self._last_error = "Piper model not set"
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_transcript: Optional[str] = None
        self._last_command: Optional[Dict[str, Any]] = None
        self._last_error: Optional[str] = None
        self._last_wake_time: float = 0.0
        self._mute_until: float = 0.0
        self._tts_busy: bool = False
        self._tts_active: bool = False
        self._last_ready_speak: float = 0.0
        self._awaiting_server_ready_until: float = 0.0
        self._pending_tts: Optional[str] = None
        self._tts_lock = threading.Lock()
        self._last_partial: Optional[str] = None
        self._last_partial_time: float = 0.0
        self._last_error_event_message: Optional[str] = None
        self._last_error_event_time: float = 0.0
        self._pending_identify_commands: list[Dict[str, Any]] = []
        self._current_identify_command: Optional[Dict[str, Any]] = None
        self._identify_confirm_timer: Optional[threading.Timer] = None
        self._announced_stream_locations: set[str] = set()
        self._last_stream_result_announce_time: float = 0.0
        self._flow_state: str = "idle"
        self._flow_context = VoiceFlowContext()
        self._awaiting_field: Optional[str] = None
        self._last_prompt: Optional[str] = None
        self._last_event_type: Optional[str] = None
        self._last_sent_command: Optional[Dict[str, Any]] = None
        self._flow_active: bool = False
        self._command_window_seconds: float = 10.0
        self._last_status_event_hash: Optional[str] = None

    def start_if_enabled(self) -> None:
        if self._enabled:
            self.enable()

    def enable(self) -> Dict[str, Any]:
        if self._running:
            self._enabled = True
            self._emit_status_event()
            return self.status()
        if self._tts_engine == "piper" and not self._tts_piper_model:
            self._last_error = "Piper model not set"
        ok, error = self._start_thread()
        if not ok:
            self._last_error = error
        else:
            # Clear stale non-fatal startup errors once voice loop is running.
            self._last_error = None
        self._enabled = ok
        self._emit_status_event()
        return self.status()

    def disable(self) -> Dict[str, Any]:
        self._enabled = False
        self._pending_tts = None
        self._stop()
        self._emit_status_event()
        return self.status()

    def set_tts_enabled(self, enabled: bool) -> Dict[str, Any]:
        self._tts_enabled = enabled
        if not enabled:
            self._pending_tts = None
        self._emit_status_event()
        return self.status()

    def status(self) -> Dict[str, Any]:
        resolved_model = self._resolve_model_path()
        resolved_path = str(resolved_model) if resolved_model else None
        return {
            "enabled": self._enabled,
            "running": self._running,
            "flow_active": self._flow_active,
            "wakeword": self._wakeword,
            "wakeword_aliases": self._wakeword_aliases,
            "model_path": self._model_path,
            "resolved_model_path": resolved_path,
            "model_found": bool(resolved_model and resolved_model.exists()),
            "device": self._device or None,
            "sample_rate": self._sample_rate,
            "debug": self._debug,
            "device_auto": self._device_auto,
            "stt_engine": self._stt_engine,
            "stt_model": self._stt_model,
            "stt_device": self._stt_device,
            "stt_compute_type": self._stt_compute_type,
            "stt_language": self._stt_language,
            "tts_enabled": self._tts_enabled,
            "tts_engine": self._tts_engine,
            "tts_voice": self._tts_voice,
            "tts_piper_model": self._tts_piper_model or None,
            "tts_piper_bin": self._tts_piper_bin,
            "tts_piper_player": self._tts_piper_player,
            "tts_piper_player_device": self._tts_piper_player_device or None,
            "tts_piper_player_args": self._tts_piper_player_args,
            "tts_pad_lead_ms": self._tts_pad_lead_ms,
            "tts_pad_tail_ms": self._tts_pad_tail_ms,
            "tts_output_latency_ms": int(self._tts_output_latency * 1000.0),
            "flow_step_delay_ms": int(self._flow_step_delay * 1000.0),
            "flow_mode": self._flow_mode,
            "is_speaking": self._is_speaking(),
            "last_error": self._last_error,
        }

    def _is_speaking(self) -> bool:
        return self._tts_active

    def _emit_status_event(self, force: bool = False) -> None:
        payload = self.status()
        marker = json.dumps(payload, sort_keys=True)
        if not force and marker == self._last_status_event_hash:
            return
        self._last_status_event_hash = marker
        self._broadcast_event({"type": "voice_status", "payload": payload})

    def last(self) -> Dict[str, Any]:
        return {
            "transcript": self._last_transcript,
            "command": self._last_command,
            "error": self._last_error,
        }

    def reset(self) -> Dict[str, Any]:
        self._last_transcript = None
        self._last_command = None
        self._last_error = None
        self._awaiting_server_ready_until = 0.0
        self._pending_tts = None
        self._reset_flow()
        self._emit_status_event()
        return self.last()

    def _reset_flow(self) -> None:
        self._flow_state = "idle"
        self._flow_context = VoiceFlowContext()
        self._awaiting_field = None
        self._last_prompt = None
        self._last_event_type = None
        self._last_sent_command = None
        self._pending_identify_commands = []
        self._current_identify_command = None
        self._announced_stream_locations = set()
        self._last_stream_result_announce_time = 0.0
        if self._identify_confirm_timer:
            self._identify_confirm_timer.cancel()
            self._identify_confirm_timer = None
        if self._flow_active:
            self._emit_flow_state()

    def _schedule_identify_confirm(self, location: str) -> None:
        if self._identify_confirm_timer:
            self._identify_confirm_timer.cancel()
            self._identify_confirm_timer = None

        def _ask() -> None:
            loc = str(location).replace("_", " ").lower()
            self._set_flow_state("awaiting_identify_confirm", "identify_confirm")
            self._prompt(f"Is the {loc} sensor placed?", "identify_confirm")

        timer = threading.Timer(2.5, _ask)
        timer.daemon = True
        self._identify_confirm_timer = timer
        timer.start()

    def _start_next_identify(self) -> bool:
        if not self._pending_identify_commands:
            self._current_identify_command = None
            return False
        cmd = self._pending_identify_commands.pop(0)
        self._current_identify_command = cmd
        next_location = cmd.get("payload", {}).get("location", "sensor")
        say_loc = str(next_location).replace("_", " ").lower()
        self._send_gateway_command(cmd, f"Identifying {say_loc}.")
        self._set_flow_state("identifying", "")
        self._schedule_identify_confirm(str(next_location))
        return True

    def set_flow_active(self, active: bool) -> Dict[str, Any]:
        self._flow_active = active
        if active:
            self._emit_flow_state()
        self._emit_status_event()
        return self.status()

    def _emit_flow_state(self) -> None:
        if not self._flow_active:
            return
        payload = {
            "state": self._flow_state,
            "awaiting": self._awaiting_field,
            "last_event": self._last_event_type,
            "context": {
                "session_owner": self._flow_context.session_owner,
                "init_label": self._flow_context.init_label,
                "subject_count": self._flow_context.subject_count,
                "sensor_name": self._flow_context.sensor_name,
                "sensor_count": self._flow_context.sensor_count,
                "locations": self._flow_context.locations,
                "algorithm": self._flow_context.algorithm_name,
                "tag": self._flow_context.tag,
            },
        }
        self._broadcast_event({"type": "voice_flow_state", "payload": payload})

    def _set_flow_state(self, state: str, awaiting: Optional[str] = None) -> None:
        self._flow_state = state
        if awaiting is not None:
            self._awaiting_field = awaiting
        self._emit_flow_state()

    def _prompt(
        self,
        text: str,
        expect: Optional[str] = None,
        speak: bool = True,
        pause_before_ms: Optional[int] = None,
    ) -> None:
        if pause_before_ms is not None and pause_before_ms > 0:
            time.sleep(float(pause_before_ms) / 1000.0)
        self._last_prompt = text
        if expect is not None:
            self._awaiting_field = expect
        if self._flow_active:
            self._broadcast_event({"type": "voice_prompt", "payload": {"text": text, "expect": expect}})
            self._emit_flow_state()
        if speak:
            self._maybe_speak(text)

    def _send_gateway_command(
        self,
        command: Dict[str, Any],
        speak_text: Optional[str] = None,
        speak_wait: bool = False,
    ) -> None:
        self._last_sent_command = command
        self._awaiting_field = None
        if self._flow_active:
            self._broadcast_event({"type": "voice_gateway_command", "payload": {"command": command}})
        self._send_command(command)
        if speak_text:
            self._maybe_speak(speak_text, wait=speak_wait)

    def _auto_check_server_ready_on_wakeword(self) -> bool:
        if not self._flow_active:
            return False
        if self._flow_state != "idle":
            return False
        now = time.time()
        if self._awaiting_server_ready_until and now < self._awaiting_server_ready_until:
            return False
        self._set_flow_state("awaiting_server_ready")
        self._send_gateway_command(
            {"type": "is_server_ready", "payload": {}},
            "Checking server readiness.",
            speak_wait=True,
        )
        self._awaiting_server_ready_until = now + 12.0
        return True

    def stop(self) -> None:
        self._enabled = False
        self._stop()

    def _stop(self) -> None:
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self._thread.join(timeout=2)
        self._running = False
        self._thread = None
        self._stop_event.clear()
        self._emit_status_event()

    def _start_thread(self) -> tuple[bool, str | None]:
        if not self._wakeword:
            return False, "Wakeword is not configured"
        self._stop_event.clear()
        if self._stt_engine == "faster_whisper":
            self._thread = threading.Thread(target=self._run_faster_whisper, daemon=True)
            self._thread.start()
            return True, None
        model_path = self._resolve_model_path()
        if not model_path or not model_path.exists():
            return False, "Vosk model path not found"
        self._thread = threading.Thread(target=self._run_vosk, daemon=True, args=(model_path,))
        self._thread.start()
        return True, None

    def _resolve_model_path(self) -> Optional[Path]:
        if self._model_path:
            return Path(self._model_path)
        candidate = self._base_dir / "models" / "vosk-model"
        return candidate

    def _run_vosk(self, model_path: Path) -> None:
        self._running = True
        self._emit_status_event()
        try:
            from vosk import Model, KaldiRecognizer  # type: ignore
            import sounddevice as sd  # type: ignore
        except Exception as exc:
            self._last_error = f"Voice dependencies not available: {exc}"
            self._emit_status_event()
            self._running = False
            self._emit_status_event()
            return

        q: queue.Queue[bytes] = queue.Queue()

        def callback(indata, frames, time_info, status):
            if status:
                return
            q.put(bytes(indata))

        try:
            device = None
            if self._device:
                if self._device.isdigit():
                    device = int(self._device)
                else:
                    lowered = self._device.lower()
                    for idx, info in enumerate(sd.query_devices()):
                        name = str(info.get("name", "")).lower()
                        if lowered in name and info.get("max_input_channels", 0) > 0:
                            device = idx
                            break
                    if device is None:
                        raise ValueError(f"No input device matching '{self._device}'")
            elif self._device_auto:
                preferred = ["sennheiser", "usb audio", "microphone", "mic"]
                for idx, info in enumerate(sd.query_devices()):
                    name = str(info.get("name", "")).lower()
                    if info.get("max_input_channels", 0) <= 0:
                        continue
                    if any(token in name for token in preferred):
                        device = idx
                        break
            if device is None and self._device:
                raise ValueError(f"No input device matching '{self._device}'")
            stream_sample_rate = self._sample_rate
            try:
                import sounddevice as _sd  # type: ignore
                _sd.check_input_settings(
                    device=device,
                    samplerate=stream_sample_rate,
                    channels=1,
                    dtype="int16",
                )
            except Exception:
                try:
                    dev_info = sd.query_devices(device) if device is not None else sd.query_devices(None, "input")
                    fallback_rate = int(float(dev_info.get("default_samplerate", stream_sample_rate)))
                    if fallback_rate > 0:
                        stream_sample_rate = fallback_rate
                except Exception:
                    pass
            with sd.RawInputStream(
                samplerate=stream_sample_rate,
                # Lower block size improves wakeword responsiveness.
                blocksize=4000,
                dtype="int16",
                channels=1,
                callback=callback,
                device=device,
            ):
                recognizer = KaldiRecognizer(Model(str(model_path)), stream_sample_rate)
                try:
                    recognizer.SetWords(True)
                except Exception:
                    pass
                awaiting_wakeword = True
                last_wake_time = 0.0
                last_wake_broadcast = 0.0
                command_window_until = 0.0
                while not self._stop_event.is_set():
                    self._check_server_ready_timeout()
                    if self._flow_state in ("streaming", "streaming_starting"):
                        awaiting_wakeword = False
                    try:
                        data = q.get(timeout=0.1)
                    except queue.Empty:
                        now = time.time()
                        if (
                            not awaiting_wakeword
                            and command_window_until
                            and now > command_window_until
                            and self._flow_state not in ("streaming", "streaming_starting")
                        ):
                            # Keep multi-step setup flows alive without forcing a wakeword
                            # between prompts (for example, subject/sensor/location questions).
                            if self._flow_mode == "ui":
                                awaiting_wakeword = False
                                command_window_until = now + self._command_window_seconds
                            elif self._flow_state == "idle":
                                awaiting_wakeword = True
                            else:
                                awaiting_wakeword = False
                                command_window_until = now + self._command_window_seconds
                        continue
                    if self._is_speaking() or time.time() < self._mute_until:
                        recognizer.Reset()
                        continue
                    if recognizer.AcceptWaveform(data):
                        result = json.loads(recognizer.Result())
                        text = (result.get("text") or "").strip().lower()
                        if not text and self._awaiting_field and self._last_partial:
                            if time.time() - self._last_partial_time < 1.5:
                                text = self._last_partial
                        if len(text.split()) < 2 and self._last_partial:
                            if time.time() - self._last_partial_time < 1.5:
                                text = self._last_partial
                        if not text:
                            continue
                        if awaiting_wakeword:
                            if self._awaiting_field and text:
                                keep_listening = self._handle_command(text)
                                if keep_listening:
                                    awaiting_wakeword = False
                                    command_window_until = time.time() + self._command_window_seconds
                                else:
                                    awaiting_wakeword = True
                                continue
                            wakeword_hit = next((w for w in self._wakeword_aliases if w in text), None)
                            if wakeword_hit:
                                now = time.time()
                                if now - last_wake_broadcast > 1.2:
                                    logger.info("Wakeword heard: %s", wakeword_hit)
                                    self._broadcast_event({"type": "voice_wakeword", "payload": {"text": wakeword_hit}})
                                    last_wake_broadcast = now
                                    if self._auto_check_server_ready_on_wakeword():
                                        awaiting_wakeword = True
                                        command_window_until = 0.0
                                        continue
                                remaining = text.replace(wakeword_hit, "").strip(",. ").strip()
                                awaiting_wakeword = False
                                last_wake_time = time.time()
                                self._last_wake_time = last_wake_time
                                command_window_until = last_wake_time + self._command_window_seconds
                                if remaining:
                                    keep_listening = self._handle_command(remaining)
                                    if keep_listening:
                                        awaiting_wakeword = False
                                        command_window_until = time.time() + self._command_window_seconds
                                    else:
                                        awaiting_wakeword = True
                            continue
                        if text in self._wakeword_aliases:
                            continue
                        keep_listening = self._handle_command(text)
                        if keep_listening:
                            awaiting_wakeword = False
                            command_window_until = time.time() + self._command_window_seconds
                        else:
                            awaiting_wakeword = True
                    else:
                        partial = json.loads(recognizer.PartialResult()).get("partial", "").strip().lower()
                        if not partial:
                            continue
                        self._last_partial = partial
                        self._last_partial_time = time.time()
                        if self._debug:
                            self._last_transcript = partial
                            self._broadcast_event({"type": "voice_partial", "payload": {"text": partial}})
                        if awaiting_wakeword:
                            wakeword_hit = next((w for w in self._wakeword_aliases if w in partial), None)
                            if wakeword_hit:
                                now = time.time()
                                if now - last_wake_broadcast > 1.2:
                                    logger.info("Wakeword heard (partial): %s", wakeword_hit)
                                    self._broadcast_event({"type": "voice_wakeword", "payload": {"text": wakeword_hit}})
                                    last_wake_broadcast = now
                                    if self._auto_check_server_ready_on_wakeword():
                                        awaiting_wakeword = True
                                        command_window_until = 0.0
                                        continue
                                awaiting_wakeword = False
                                last_wake_time = time.time()
                                self._last_wake_time = last_wake_time
                                command_window_until = last_wake_time + self._command_window_seconds
        except Exception as exc:
            self._last_error = f"Voice loop failed: {exc}"
            self._emit_status_event()
        finally:
            self._running = False
            self._emit_status_event()

    def _run_faster_whisper(self) -> None:
        self._running = True
        self._emit_status_event()
        try:
            import numpy as np  # type: ignore
            import sounddevice as sd  # type: ignore
            from faster_whisper import WhisperModel  # type: ignore
        except Exception as exc:
            self._last_error = f"Whisper dependencies not available: {exc}"
            self._emit_status_event()
            self._running = False
            self._emit_status_event()
            return

        q: queue.Queue[bytes] = queue.Queue()

        def callback(indata, frames, time_info, status):
            if status:
                return
            q.put(bytes(indata))

        try:
            device = None
            if self._device:
                if self._device.isdigit():
                    device = int(self._device)
                else:
                    lowered = self._device.lower()
                    for idx, info in enumerate(sd.query_devices()):
                        name = str(info.get("name", "")).lower()
                        if lowered in name and info.get("max_input_channels", 0) > 0:
                            device = idx
                            break
                    if device is None:
                        raise ValueError(f"No input device matching '{self._device}'")
            elif self._device_auto:
                preferred = ["sennheiser", "usb audio", "microphone", "mic"]
                for idx, info in enumerate(sd.query_devices()):
                    name = str(info.get("name", "")).lower()
                    if info.get("max_input_channels", 0) <= 0:
                        continue
                    if any(token in name for token in preferred):
                        device = idx
                        break
            if device is None and self._device:
                raise ValueError(f"No input device matching '{self._device}'")
            stream_sample_rate = self._sample_rate
            try:
                import sounddevice as _sd  # type: ignore
                _sd.check_input_settings(
                    device=device,
                    samplerate=stream_sample_rate,
                    channels=1,
                    dtype="int16",
                )
            except Exception:
                try:
                    dev_info = sd.query_devices(device) if device is not None else sd.query_devices(None, "input")
                    fallback_rate = int(float(dev_info.get("default_samplerate", stream_sample_rate)))
                    if fallback_rate > 0:
                        stream_sample_rate = fallback_rate
                except Exception:
                    pass

            model = WhisperModel(
                self._stt_model,
                device=self._stt_device,
                compute_type=self._stt_compute_type,
            )
            chunk_bytes = int(stream_sample_rate * self._stt_chunk_seconds) * 2
            buffer = bytearray()
            awaiting_wakeword = True
            last_wake_time = 0.0
            last_wake_broadcast = 0.0
            command_window_until = 0.0
            with sd.RawInputStream(
                samplerate=stream_sample_rate,
                blocksize=int(stream_sample_rate * 0.2),
                dtype="int16",
                channels=1,
                callback=callback,
                device=device,
            ):
                while not self._stop_event.is_set():
                    self._check_server_ready_timeout()
                    if self._flow_state in ("streaming", "streaming_starting"):
                        awaiting_wakeword = False
                    try:
                        data = q.get(timeout=0.1)
                    except queue.Empty:
                        now = time.time()
                        if (
                            not awaiting_wakeword
                            and command_window_until
                            and now > command_window_until
                            and self._flow_state not in ("streaming", "streaming_starting")
                        ):
                            # Keep multi-step setup flows alive without forcing a wakeword
                            # between prompts (for example, subject/sensor/location questions).
                            if self._flow_mode == "ui":
                                awaiting_wakeword = False
                                command_window_until = now + self._command_window_seconds
                            elif self._flow_state == "idle":
                                awaiting_wakeword = True
                            else:
                                awaiting_wakeword = False
                                command_window_until = now + self._command_window_seconds
                        continue
                    if self._is_speaking() or time.time() < self._mute_until:
                        buffer.clear()
                        continue
                    buffer.extend(data)
                    if len(buffer) < chunk_bytes:
                        continue
                    chunk = bytes(buffer[:chunk_bytes])
                    del buffer[:chunk_bytes]
                    audio = np.frombuffer(chunk, np.int16).astype(np.float32) / 32768.0
                    segments, _info = model.transcribe(
                        audio,
                        language=self._stt_language,
                        vad_filter=True,
                    )
                    text = " ".join(segment.text for segment in segments).strip().lower()
                    if not text:
                        continue
                    if awaiting_wakeword:
                        if self._awaiting_field and text:
                            keep_listening = self._handle_command(text)
                            if keep_listening:
                                awaiting_wakeword = False
                                command_window_until = time.time() + self._command_window_seconds
                            else:
                                awaiting_wakeword = True
                            continue
                        wakeword_hit = next((w for w in self._wakeword_aliases if w in text), None)
                        if wakeword_hit:
                            now = time.time()
                            if now - last_wake_broadcast > 1.2:
                                logger.info("Wakeword heard: %s", wakeword_hit)
                                self._broadcast_event({"type": "voice_wakeword", "payload": {"text": wakeword_hit}})
                                last_wake_broadcast = now
                            if self._auto_check_server_ready_on_wakeword():
                                awaiting_wakeword = True
                                command_window_until = 0.0
                                continue
                            remaining = text.replace(wakeword_hit, "").strip(",. ").strip()
                            awaiting_wakeword = False
                            last_wake_time = time.time()
                            self._last_wake_time = last_wake_time
                            command_window_until = last_wake_time + self._command_window_seconds
                            if remaining:
                                keep_listening = self._handle_command(remaining)
                                if keep_listening:
                                    awaiting_wakeword = False
                                    command_window_until = time.time() + self._command_window_seconds
                                else:
                                    awaiting_wakeword = True
                        continue
                    keep_listening = self._handle_command(text)
                    if keep_listening:
                        awaiting_wakeword = False
                        command_window_until = time.time() + self._command_window_seconds
                    else:
                        awaiting_wakeword = True
        except Exception as exc:
            self._last_error = f"Voice loop failed: {exc}"
            self._emit_status_event()
        finally:
            self._running = False
            self._emit_status_event()

    def _apply_free_text(self, field: str, text: str) -> None:
        if field == "session_owner":
            self._flow_context.session_owner = text.title()
        elif field == "session_label":
            self._flow_context.init_label = text
        elif field == "tag":
            self._flow_context.tag = text
        elif field == "locations":
            locations = parse_locations(text)
            if locations:
                self._flow_context.locations = locations
            else:
                self._flow_context.locations = [loc.upper() for loc in text.split(",") if loc.strip()]

    @staticmethod
    def _parse_simple_count(text: str) -> Optional[int]:
        match = re.search(r"(\d+)", text)
        if match:
            return int(match.group(1))
        words = {
            "one": 1,
            "on": 1,
            "wan": 1,
            "wun": 1,
            "won": 1,
            "single": 1,
            "a": 1,
            "an": 1,
            "two": 2,
            "to": 2,
            "too": 2,
            "three": 3,
            "four": 4,
            "for": 4,
            "five": 5,
            "six": 6,
            "seven": 7,
            "ate": 8,
            "eight": 8,
            "nine": 9,
            "ten": 10,
            "eleven": 11,
            "twelve": 12,
        }
        for word, value in words.items():
            if re.search(rf"\b{word}\b", text):
                return value
        return None

    def _is_prompt_echo(self, text: str) -> bool:
        if not text or not self._last_prompt:
            return False
        candidate = re.sub(r"[^a-z0-9\s]", " ", str(text).lower())
        candidate = " ".join(candidate.split())
        prompt = re.sub(r"[^a-z0-9\s]", " ", str(self._last_prompt).lower())
        prompt = " ".join(prompt.split())
        if not candidate or not prompt:
            return False
        if candidate == prompt:
            return True
        # Ignore near-exact captures of the assistant's own question phrasing.
        if len(candidate.split()) >= 3 and (candidate in prompt or prompt in candidate):
            return True
        return False

    def _check_server_ready_timeout(self) -> None:
        if self._flow_state != "awaiting_server_ready":
            return
        if not self._awaiting_server_ready_until:
            return
        if time.time() <= self._awaiting_server_ready_until:
            return
        self._awaiting_server_ready_until = 0.0
        self._reset_flow()
        self._prompt("Server readiness timed out. Please start the server and say nexus to try again.")

    def _advance_after_server_ready(self, event: Dict[str, Any]) -> None:
        question = "Who is running the session?"
        self._mute_until = 0.0
        # Speak readiness summary first, then move flow state.
        self._maybe_speak(f"{self._summarize_server_ready(event)} {question}", wait=True)
        if self._flow_state != "server_ready_speaking":
            return
        if self._flow_step_delay > 0.0:
            time.sleep(self._flow_step_delay)
        self._set_flow_state("awaiting_session_owner", "session_owner")
        self._prompt(question, "session_owner", speak=False)

    def _clear_server_ready_wait(self) -> None:
        self._awaiting_server_ready_until = 0.0

    @staticmethod
    def _extract_result_location(payload: Dict[str, Any]) -> Optional[str]:
        if not isinstance(payload, dict):
            return None
        direct = payload.get("location") or payload.get("sensor_location") or payload.get("body_location")
        if isinstance(direct, str) and direct:
            return direct
        result = payload.get("result")
        if isinstance(result, dict):
            nested = result.get("location") or result.get("sensor_location") or result.get("body_location")
            if isinstance(nested, str) and nested:
                return nested
        sensor = payload.get("sensor")
        if isinstance(sensor, dict):
            sensor_loc = sensor.get("location") or sensor.get("sensor_location")
            if isinstance(sensor_loc, str) and sensor_loc:
                return sensor_loc
        locations = payload.get("locations")
        if isinstance(locations, list) and len(locations) == 1:
            first = locations[0]
            if isinstance(first, str) and first:
                return first
        return None

    @staticmethod
    def _extract_result_sensor_id(payload: Dict[str, Any]) -> Optional[str]:
        if not isinstance(payload, dict):
            return None
        for key in ("address", "sensor_id", "device_id", "mac", "serial", "id"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        result = payload.get("result")
        if isinstance(result, dict):
            for key in ("address", "sensor_id", "device_id", "mac", "serial", "id"):
                value = result.get(key)
                if isinstance(value, str) and value:
                    return value
        sensor = payload.get("sensor")
        if isinstance(sensor, dict):
            for key in ("address", "sensor_id", "device_id", "mac", "serial", "id"):
                value = sensor.get(key)
                if isinstance(value, str) and value:
                    return value
        return None

    def _describe_state(self) -> str:
        state = self._flow_state
        context = self._flow_context
        if state == "idle":
            return "Idle. Say start a new session to begin."
        if state == "awaiting_server_ready":
            return "Checking server readiness."
        if state == "server_ready_speaking":
            return "Server is ready."
        if state == "awaiting_session_owner":
            return "Waiting for the session owner."
        if state == "awaiting_session_label":
            return "Waiting for the session label."
        if state == "awaiting_subject_count":
            return "Waiting for the number of subjects."
        if state == "awaiting_sensor_setup":
            return "Waiting for sensor type and count."
        if state == "awaiting_sensor_locations":
            return "Waiting for sensor locations."
        if state == "awaiting_algorithm":
            return "Waiting for the algorithm."
        if state == "initializing":
            return f"Initializing system for {context.subject_count} subject(s)."
        if state == "awaiting_sensors_on":
            return "Waiting for sensors to be turned on."
        if state == "discovering":
            return "Discovering sensors."
        if state == "connecting":
            return "Connecting sensors."
        if state == "awaiting_identify":
            return "Waiting for identify confirmation."
        if state == "identifying":
            return "Identifying sensor location."
        if state == "awaiting_identify_confirm":
            return "Waiting for identify placement confirmation."
        if state == "awaiting_start_stream":
            return "Ready to start streaming."
        if state == "streaming":
            return "Streaming is active."
        if state == "stopping":
            return "Stopping the stream."
        if state == "awaiting_disconnect_confirm":
            return "Waiting to confirm disconnect."
        if state == "disconnecting":
            return "Disconnecting sensors."
        if state == "error":
            return "An error occurred. Awaiting your response."
        return f"State: {state}."

    @staticmethod
    def _summarize_server_ready(event: Dict[str, Any]) -> str:
        payload = event.get("payload") if isinstance(event, dict) else {}
        if not isinstance(payload, dict):
            payload = {}
        site = payload.get("site")
        sensors = payload.get("supported_sensors")
        lines: list[str] = []
        if isinstance(sensors, list):
            for item in sensors:
                if isinstance(item, str):
                    lines.append(f"{item} supports no computations")
                elif isinstance(item, dict):
                    name = item.get("name")
                    computations = item.get("computations")
                    algo_names: list[str] = []
                    if isinstance(computations, list):
                        for comp in computations:
                            if isinstance(comp, str):
                                algo_names.append(comp)
                            elif isinstance(comp, dict):
                                comp_name = comp.get("name")
                                if isinstance(comp_name, str) and comp_name:
                                    algo_names.append(comp_name)
                    if isinstance(name, str) and name:
                        if algo_names:
                            lines.append(f"{name} supports {', '.join(algo_names)}")
                        else:
                            lines.append(f"{name} supports no computations")
        site_text = f" at {site}" if isinstance(site, str) and site else ""
        if lines:
            return f"Server is ready{site_text}. {'. '.join(lines)}."
        return f"Server is ready{site_text}."

    def _handle_intent(self, intent: Dict[str, Any]) -> bool:
        intent_name = intent.get("intent")
        if intent_name in ("empty", None):
            return True

        if intent_name == "start_session" or intent_name == "check_ready":
            # Avoid restarting readiness checks mid-flow (often from prompt echo).
            if self._flow_state not in ("idle", "awaiting_server_ready"):
                return True
            self._set_flow_state("awaiting_server_ready")
            self._send_gateway_command(
                {"type": "is_server_ready", "payload": {}},
                "Checking server readiness.",
                speak_wait=True,
            )
            self._awaiting_server_ready_until = time.time() + 12.0
            return False

        if (
            self._awaiting_field == "session_owner"
            or self._flow_state == "awaiting_session_owner"
            or (intent_name == "session_owner" and self._flow_state == "awaiting_session_owner")
        ):
            name = intent.get("name") or intent.get("text") or intent.get("label")
            candidate = str(name).strip() if name else ""
            if self._is_prompt_echo(candidate):
                self._prompt("Who is running the session?", "session_owner")
                self._set_flow_state("awaiting_session_owner")
                return True
            if candidate and len(candidate) >= 2:
                self._flow_context.session_owner = candidate.title()
                self._prompt(
                    "What is the session called?",
                    "session_label",
                    pause_before_ms=int(self._flow_step_delay * 1000.0),
                )
                self._set_flow_state("awaiting_session_label")
                return True
            self._prompt("I did not catch the name. Who is running the session?", "session_owner")
            self._set_flow_state("awaiting_session_owner")
            return True

        if (
            self._awaiting_field == "session_label"
            or self._flow_state == "awaiting_session_label"
            or (intent_name == "session_label" and self._flow_state == "awaiting_session_label")
        ):
            label = intent.get("label") or intent.get("text")
            candidate = str(label).strip() if label else ""
            if self._is_prompt_echo(candidate):
                self._prompt("What is the session called?", "session_label")
                self._set_flow_state("awaiting_session_label")
                return True
            if candidate and len(candidate) >= 2:
                self._flow_context.init_label = candidate
                self._prompt(
                    f'Thank you. How many subjects for "{candidate}"?',
                    "subject_count",
                    pause_before_ms=int(self._flow_step_delay * 1000.0),
                )
                self._set_flow_state("awaiting_subject_count")
                return True
            self._prompt("I did not catch the session name. What is the session called?", "session_label")
            self._set_flow_state("awaiting_session_label")
            return True

        if (
            intent_name == "subject_count"
            or self._awaiting_field == "subject_count"
            or self._flow_state == "awaiting_subject_count"
        ):
            count = intent.get("count")
            if count is None:
                fallback_text = (
                    intent.get("text")
                    or intent.get("label")
                    or intent.get("name")
                    or self._last_transcript
                    or ""
                )
                count = self._parse_simple_count(str(fallback_text))
            if isinstance(count, int) and count > 0:
                self._flow_context.subject_count = count
                label = self._flow_context.init_label or "Session"
                noun = "subject" if count == 1 else "subjects"
                self._prompt(
                    f'"{label}" has {count} {noun}. Which sensors are you using and how many? '
                    "For example: two movella dots.",
                    "sensor_setup",
                    pause_before_ms=int(self._flow_step_delay * 1000.0),
                )
                self._set_flow_state("awaiting_sensor_setup")
                return True
            self._prompt("Please tell me the number of subjects, for example: two subjects.", "subject_count")
            self._set_flow_state("awaiting_subject_count")
            return True

        if (
            intent_name == "sensor_setup"
            or self._awaiting_field == "sensor_setup"
            or self._flow_state == "awaiting_sensor_setup"
        ):
            raw_text = str(intent.get("_raw_text") or intent.get("text") or "").strip()
            if raw_text and self._is_prompt_echo(raw_text):
                self._prompt("Which sensors are you using and how many? For example: two movella dots.", "sensor_setup")
                self._set_flow_state("awaiting_sensor_setup")
                return True
            sensor_name = intent.get("sensor_name")
            sensor_count = intent.get("sensor_count")
            locations = intent.get("locations") or []
            if intent_name == "free_text":
                free_text = intent.get("text", "")
                free_intent = parse_intent(free_text)
                if free_intent.get("intent") == "sensor_setup":
                    sensor_name = sensor_name or free_intent.get("sensor_name")
                    sensor_count = sensor_count or free_intent.get("sensor_count")
                    locations = locations or free_intent.get("locations") or []
                # Accept bare spoken counts and ASR variants at sensor step.
                parsed_count = self._parse_simple_count(free_text)
                if isinstance(parsed_count, int) and parsed_count > 0:
                    if sensor_count is None or (sensor_count == 1 and parsed_count != 1):
                        sensor_count = parsed_count
                if not locations:
                    locations = parse_locations(free_text)
            if sensor_name:
                self._flow_context.sensor_name = sensor_name
            if isinstance(sensor_count, int) and sensor_count > 0:
                self._flow_context.sensor_count = sensor_count
            if self._flow_context.sensor_count and not self._flow_context.sensor_name:
                self._flow_context.sensor_name = "Movella DOT"
            if locations:
                self._flow_context.locations = locations

            has_sensor_selection = bool(self._flow_context.sensor_name) and bool(
                isinstance(self._flow_context.sensor_count, int) and self._flow_context.sensor_count > 0
            )
            if not has_sensor_selection:
                self._prompt("I did not catch the sensor type and count. For example: two movella dots.", "sensor_setup")
                self._set_flow_state("awaiting_sensor_setup")
                return True
            if not self._flow_context.locations:
                self._prompt(
                    "Where are the sensors being placed? For example: left ankle and right ankle.",
                    "locations",
                    pause_before_ms=int(self._flow_step_delay * 1000.0),
                )
                self._set_flow_state("awaiting_sensor_locations")
                return True
            self._prompt(
                "What algorithm should I use?",
                "algorithm",
                pause_before_ms=int(self._flow_step_delay * 1000.0),
            )
            self._set_flow_state("awaiting_algorithm")
            return True

        if self._awaiting_field == "locations" or self._flow_state == "awaiting_sensor_locations":
            text = intent.get("text") or ""
            locations = parse_locations(text)
            if locations:
                self._flow_context.locations = locations
                self._prompt(
                    "What algorithm should I use?",
                    "algorithm",
                    pause_before_ms=int(self._flow_step_delay * 1000.0),
                )
                self._set_flow_state("awaiting_algorithm")
                return True
            self._prompt("Please specify locations like left ankle and right ankle.", "locations")
            return True

        if (
            intent_name == "algorithm"
            or self._awaiting_field == "algorithm"
            or self._flow_state == "awaiting_algorithm"
        ):
            algo_name = intent.get("name")
            inputs = intent.get("inputs")
            if algo_name:
                self._flow_context.algorithm_name = algo_name
            if isinstance(inputs, dict):
                self._flow_context.algorithm_inputs = inputs
            subjects = self._flow_context.build_subjects()
            payload = {"subjects": subjects, "init_label": self._flow_context.init_label}
            self._set_flow_state("initializing")
            self._send_gateway_command({"type": "init_system", "payload": payload}, "Got it. Initializing the system.")
            return False

        if intent_name == "affirm" and self._awaiting_field == "confirm_sensors_on":
            self._set_flow_state("discovering")
            self._send_gateway_command({"type": "discover_sensors", "payload": {}}, "Discovering sensors.")
            return False

        if intent_name == "deny" and self._awaiting_field == "confirm_sensors_on":
            self._prompt("Okay. Turn on the sensors and say discover sensors when ready.")
            self._set_flow_state("awaiting_sensors_on")
            return True

        if intent_name == "discover_sensors":
            if self._flow_state not in ("awaiting_sensors_on", "discovering"):
                return True
            self._set_flow_state("discovering")
            self._send_gateway_command({"type": "discover_sensors", "payload": {}}, "Discovering sensors.")
            return False

        if intent_name == "connect_sensors":
            if self._flow_state not in ("connecting",):
                return True
            self._set_flow_state("connecting")
            self._send_gateway_command({"type": "connect_all", "payload": {}}, "Connecting sensors.")
            return False

        if intent_name in ("identify_all", "identify") or self._awaiting_field == "identify":
            if self._flow_state not in ("awaiting_identify", "identifying", "awaiting_identify_confirm"):
                return True
            locations = intent.get("locations") or self._flow_context.locations
            if not locations:
                self._prompt("Which locations should I identify?", "locations")
                self._set_flow_state("awaiting_identify")
                return True
            subjects = self._flow_context.build_subjects()
            queue: list[Dict[str, Any]] = []
            for subject in subjects:
                for location in locations:
                    queue.append(
                        {
                            "type": "identify_sensor",
                            "payload": {"subject_id": subject["subject_id"], "location": location},
                        }
                    )
            self._pending_identify_commands = queue
            if not self._start_next_identify():
                self._prompt("I did not find any locations to identify.", "identify")
                self._set_flow_state("awaiting_identify")
            return True

        if intent_name == "affirm" and self._awaiting_field == "identify_confirm":
            if self._start_next_identify():
                return True
            self._prompt('Ready to start streaming? Please provide a tag, for example: "test one".', "start_stream")
            self._set_flow_state("awaiting_start_stream")
            return True

        if intent_name == "deny" and self._awaiting_field == "identify_confirm":
            if self._current_identify_command:
                location = self._current_identify_command.get("payload", {}).get("location", "sensor")
                say_loc = str(location).replace("_", " ").lower()
                self._send_gateway_command(self._current_identify_command, f"Okay. Identifying {say_loc} again.")
            self._prompt("Is the sensor placed?", "identify_confirm")
            self._set_flow_state("awaiting_identify_confirm", "identify_confirm")
            return True

        if intent_name == "start_stream" or self._awaiting_field == "start_stream":
            if self._flow_state not in ("awaiting_start_stream",):
                return True
            tag = intent.get("tag") or self._flow_context.tag
            if not tag and intent_name == "free_text":
                tag = intent.get("text")
            if not tag:
                self._prompt('Please provide a tag, for example: "test one".', "tag")
                self._set_flow_state("awaiting_start_stream")
                return True
            self._flow_context.tag = tag
            self._set_flow_state("streaming_starting")
            self._send_gateway_command({"type": "start_stream_for_all", "payload": {"tag": tag}}, "Starting the stream.")
            return False

        if intent_name == "tag" and self._awaiting_field == "tag":
            if self._flow_state not in ("awaiting_start_stream",):
                return True
            tag = intent.get("tag") or intent.get("text")
            if tag:
                self._flow_context.tag = tag
            self._set_flow_state("streaming_starting")
            self._send_gateway_command(
                {"type": "start_stream_for_all", "payload": {"tag": self._flow_context.tag}},
                "Starting the stream.",
            )
            return False

        if intent_name == "stop_stream":
            if self._flow_state not in ("streaming", "streaming_starting", "stopping"):
                return True
            self._set_flow_state("stopping")
            self._send_gateway_command({"type": "stop_stream_for_all", "payload": {}}, "Stopping the stream.")
            return False

        if intent_name == "disconnect":
            if self._flow_state not in ("awaiting_disconnect_confirm", "disconnecting"):
                return True
            self._set_flow_state("disconnecting")
            self._send_gateway_command({"type": "disconnect_all", "payload": {}}, "Disconnecting sensors.")
            return False

        if intent_name == "affirm" and self._awaiting_field == "confirm_disconnect":
            self._set_flow_state("disconnecting")
            self._send_gateway_command({"type": "disconnect_all", "payload": {}}, "Disconnecting sensors.")
            return False

        if intent_name == "deny" and self._awaiting_field == "confirm_disconnect":
            self._prompt("Okay. Let me know if you want to disconnect.")
            self._set_flow_state("idle")
            return True

        if intent_name == "repeat" and self._awaiting_field == "confirm_disconnect":
            self._flow_context.tag = None
            self._prompt("Please name a tag.", "start_stream")
            self._set_flow_state("awaiting_start_stream")
            return True

        if intent_name == "status":
            self._prompt(self._describe_state())
            return True

        if intent_name == "retry" and self._flow_state == "error":
            if self._last_sent_command:
                self._send_gateway_command(self._last_sent_command, "Retrying the last command.")
                return False
            self._prompt("Nothing to retry yet.")
            return True

        if intent_name == "cancel" and self._flow_state == "error":
            self._reset_flow()
            self._prompt("Canceled.")
            return True

        if intent_name == "change_inputs" and self._flow_state == "error":
            if self._awaiting_field:
                self._prompt("Okay, provide the updated value.", self._awaiting_field)
            else:
                self._prompt("Okay, what would you like to change?")
            return True

        return True

    def _handle_command(self, text: str) -> bool:
        cleaned = text
        for alias in self._wakeword_aliases:
            if alias in cleaned:
                cleaned = cleaned.replace(alias, " ")
        cleaned = " ".join(cleaned.split()).strip()
        if not cleaned or cleaned in self._wakeword_aliases:
            return True
        if self._flow_mode != "ui" and len(cleaned.strip()) < 3 and not self._awaiting_field:
            return True
        raw_text = text
        self._last_transcript = cleaned
        self._broadcast_event({"type": "voice_transcript", "payload": {"text": cleaned, "raw": raw_text}})
        intent = parse_intent(cleaned)
        if self._flow_mode == "ui" and (not intent or intent.get("intent") == "empty"):
            intent = {"intent": "free_text", "text": cleaned}
        if (not intent or intent.get("intent") == "empty") and self._awaiting_field:
            intent = {"intent": "free_text", "text": cleaned}
        if not intent or intent.get("intent") == "empty":
            return True
        intent["_raw_text"] = cleaned
        if self._flow_mode == "ui":
            self._last_command = intent
            self._broadcast_event({"type": "voice_command", "payload": {"text": cleaned, "status": "matched", "command": intent}})
            return True
        if intent.get("intent") == "free_text" and not self._awaiting_field:
            command = parse_command(cleaned)
            if not command:
                if time.time() - self._last_wake_time < 3.0:
                    return True
                if len(cleaned.split()) < 2:
                    return True
                self._broadcast_event({"type": "voice_command", "payload": {"text": cleaned, "status": "unmatched"}})
                self._maybe_speak("I did not catch that.")
                self._last_wake_time = time.time()
                return True
        self._last_command = intent
        self._broadcast_event({"type": "voice_command", "payload": {"text": cleaned, "status": "matched", "command": intent}})
        return self._handle_intent(intent)

    def _maybe_speak(self, text: str, wait: bool = False) -> tuple[bool, str | None]:
        if not text:
            return False, "No text provided"

        # wait=True callers require exact start/stop boundaries and should not be
        # followed by stale queued non-blocking utterances.
        if wait:
            with self._tts_lock:
                if not self._tts_enabled:
                    return False, "TTS disabled"
                self._pending_tts = None
            while self._tts_busy:
                time.sleep(0.02)
            with self._tts_lock:
                self._tts_busy = True
            self._emit_status_event()
            ok, error = self._speak_blocking(text)
            with self._tts_lock:
                self._tts_busy = False
                self._tts_active = False
                if not ok and error:
                    self._last_error = error
                self._mute_until = max(self._mute_until, time.time() + 0.25)
            self._emit_status_event()
            logger.info("TTS: engine=%s text=%s ok=%s error=%s", self._tts_engine, text, ok, error)
            return ok, error

        with self._tts_lock:
            if not self._tts_enabled:
                return False, "TTS disabled"
            if self._tts_busy:
                # Keep the most recent async utterance and speak it when current
                # playback completes.
                self._pending_tts = text
                return True, None
            self._tts_busy = True
        self._emit_status_event()
        worker = threading.Thread(target=self._speak_async_worker, args=(text,), daemon=True)
        worker.start()
        return True, None

    def _speak_blocking(self, text: str) -> tuple[bool, str | None]:
        def on_playback_start() -> None:
            with self._tts_lock:
                self._tts_active = True
                self._mute_until = max(self._mute_until, time.time() + 0.12)
            self._emit_status_event()

        def on_playback_end() -> None:
            with self._tts_lock:
                self._tts_active = False
                self._mute_until = max(self._mute_until, time.time() + 0.25)
            self._emit_status_event()

        return speak(
            text,
            engine=self._tts_engine,
            tts_bin=self._tts_bin,
            voice=self._tts_voice,
            piper_bin=self._tts_piper_bin,
            piper_model=self._tts_piper_model,
            piper_player=self._tts_piper_player,
            piper_player_device=self._tts_piper_player_device,
            piper_player_args=self._tts_piper_player_args,
            pad_lead_ms=self._tts_pad_lead_ms,
            pad_tail_ms=self._tts_pad_tail_ms,
            on_playback_start=on_playback_start,
            on_playback_end=on_playback_end,
            blocking=True,
        )

    def _speak_async_worker(self, text: str) -> None:
        next_text: Optional[str] = text
        while next_text:
            ok, error = self._speak_blocking(next_text)
            logger.info("TTS: engine=%s text=%s ok=%s error=%s", self._tts_engine, next_text, ok, error)
            with self._tts_lock:
                if not ok and error:
                    self._last_error = error
                queued = self._pending_tts
                self._pending_tts = None
                if not queued:
                    self._tts_busy = False
                    self._tts_active = False
            self._emit_status_event()
            next_text = queued

    @staticmethod
    def _command_response(command: Dict[str, Any]) -> str:
        cmd_type = command.get("type", "")
        if cmd_type == "is_server_ready":
            return "Checking server readiness."
        if cmd_type == "init_system":
            return "Setting up the system."
        if cmd_type == "discover_sensors":
            return "Discovering sensors."
        if cmd_type == "connect_all":
            return "Connecting sensors."
        if cmd_type == "start_stream_for_all":
            return "Starting the stream."
        if cmd_type == "stop_stream_for_all":
            return "Stopping the stream."
        if cmd_type == "disconnect_all":
            return "Disconnecting sensors."
        return "Command received."

    def handle_gateway_event(self, event: Dict[str, Any]) -> None:
        if self._flow_mode == "ui":
            return
        if not self._flow_active:
            return
        if not event:
            return
        evt_type = event.get("type")
        if not evt_type:
            return
        # Any gateway response means readiness request is no longer "no-response".
        if evt_type in ("server_ready", "error", "system_initialized", "sensors_discovered", "sensor_connected"):
            self._clear_server_ready_wait()
        self._last_event_type = evt_type
        self._emit_flow_state()

        if evt_type == "server_ready":
            if self._flow_state != "awaiting_server_ready":
                return
            self._set_flow_state("server_ready_speaking")
            threading.Thread(
                target=self._advance_after_server_ready,
                args=(dict(event),),
                daemon=True,
            ).start()
            return

        if evt_type == "system_initialized":
            if self._flow_state != "initializing":
                return
            count = self._flow_context.subject_count
            self._set_flow_state("awaiting_sensors_on", "confirm_sensors_on")
            self._prompt(
                f"System initialized for {count} subject(s). Are sensors turned on for the subjects?",
                "confirm_sensors_on",
                pause_before_ms=int(self._flow_step_delay * 1000.0),
            )
            return

        if evt_type == "sensors_discovered":
            if self._flow_state != "discovering":
                return
            self._set_flow_state("connecting")
            self._send_gateway_command({"type": "connect_all", "payload": {}}, "Found sensors. Connecting now.")
            return

        if evt_type == "sensor_connected":
            if self._flow_state != "connecting":
                return
            locations = self._flow_context.locations or []
            if not locations:
                self._set_flow_state("awaiting_identify", "identify")
                self._prompt("Sensors connected. Which locations should I identify?", "identify")
                return
            subjects = self._flow_context.build_subjects()
            queue: list[Dict[str, Any]] = []
            for subject in subjects:
                for location in locations:
                    queue.append(
                        {
                            "type": "identify_sensor",
                            "payload": {"subject_id": subject["subject_id"], "location": location},
                        }
                    )
            self._pending_identify_commands = queue
            self._start_next_identify()
            return

        if evt_type == "sensor_identified":
            # Keep progression user-driven: advance only after explicit user confirmation.
            if self._awaiting_field == "identify_confirm":
                return
            return

        if evt_type == "stream_started":
            if self._flow_state != "streaming_starting":
                return
            self._announced_stream_locations = set()
            self._last_stream_result_announce_time = 0.0
            self._set_flow_state("streaming")
            self._prompt(
                "Streaming started. Say stop stream when you're done.",
                pause_before_ms=int(self._flow_step_delay * 1000.0),
            )
            return

        if evt_type == "stream_stopped":
            if self._flow_state not in ("streaming", "stopping"):
                return
            self._announced_stream_locations = set()
            self._last_stream_result_announce_time = 0.0
            self._set_flow_state("awaiting_disconnect_confirm", "confirm_disconnect")
            self._prompt(
                "Streaming stopped. Should I disconnect sensors or repeat?",
                "confirm_disconnect",
                pause_before_ms=int(self._flow_step_delay * 1000.0),
            )
            return

        if evt_type == "intermediate_result":
            return

        if evt_type == "compute_result":
            if self._flow_state != "streaming":
                return
            return

        if evt_type == "sensor_disconnected":
            self._reset_flow()
            self._prompt("All sensors disconnected. Say nexus to begin.")
            return

        if evt_type == "error":
            payload = event.get("payload")
            message = payload if isinstance(payload, str) else None
            if isinstance(payload, dict):
                message = payload.get("msg") or payload.get("message") or str(payload)
            message = message or "Unknown error"
            now = time.time()
            if (
                self._last_error_event_message == message
                and (now - self._last_error_event_time) < 2.0
            ):
                return
            self._last_error_event_message = message
            self._last_error_event_time = now
            self._set_flow_state("error", "error_resolution")
            self._prompt(f"That failed: {message}. Do you want to retry, change inputs, or cancel?", "error_resolution")
