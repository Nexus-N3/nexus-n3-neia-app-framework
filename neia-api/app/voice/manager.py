from __future__ import annotations

import json
import queue
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from .nlu import parse_command
from .tts import speak
import logging

logger = logging.getLogger("uvicorn.error")


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
        tts_enabled: bool,
        tts_engine: str,
        tts_bin: str,
        tts_voice: str,
        tts_piper_bin: str,
        tts_piper_model: str,
        tts_piper_player: str,
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
        self._tts_enabled = tts_enabled
        self._tts_engine = tts_engine
        self._tts_bin = tts_bin
        self._tts_voice = tts_voice
        self._tts_piper_bin = tts_piper_bin
        self._tts_piper_model = tts_piper_model
        self._tts_piper_player = tts_piper_player
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
        self._last_ready_speak: float = 0.0
        self._awaiting_server_ready_until: float = 0.0
        self._pending_tts: Optional[str] = None
        self._pending_timer: Optional[threading.Timer] = None
        self._last_partial: Optional[str] = None
        self._last_partial_time: float = 0.0

    def start_if_enabled(self) -> None:
        if self._enabled:
            self.enable()

    def enable(self) -> Dict[str, Any]:
        if self._running:
            self._enabled = True
            return self.status()
        if self._tts_engine == "piper" and not self._tts_piper_model:
            self._last_error = "Piper model not set"
        ok, error = self._start_thread()
        if not ok:
            self._last_error = error
        self._enabled = ok
        return self.status()

    def disable(self) -> Dict[str, Any]:
        self._enabled = False
        self._pending_tts = None
        if self._pending_timer:
            self._pending_timer.cancel()
            self._pending_timer = None
        self._stop()
        return self.status()

    def status(self) -> Dict[str, Any]:
        resolved_model = self._resolve_model_path()
        resolved_path = str(resolved_model) if resolved_model else None
        return {
            "enabled": self._enabled,
            "running": self._running,
            "wakeword": self._wakeword,
            "wakeword_aliases": self._wakeword_aliases,
            "model_path": self._model_path,
            "resolved_model_path": resolved_path,
            "model_found": bool(resolved_model and resolved_model.exists()),
            "device": self._device or None,
            "sample_rate": self._sample_rate,
            "debug": self._debug,
            "device_auto": self._device_auto,
            "tts_enabled": self._tts_enabled,
            "tts_engine": self._tts_engine,
            "tts_voice": self._tts_voice,
            "tts_piper_model": self._tts_piper_model or None,
            "tts_piper_bin": self._tts_piper_bin,
            "tts_piper_player": self._tts_piper_player,
            "last_error": self._last_error,
        }

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
        if self._pending_timer:
            self._pending_timer.cancel()
            self._pending_timer = None
        return self.last()

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

    def _start_thread(self) -> tuple[bool, str | None]:
        if not self._wakeword:
            return False, "Wakeword is not configured"
        model_path = self._resolve_model_path()
        if not model_path or not model_path.exists():
            return False, "Vosk model path not found"
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, args=(model_path,))
        self._thread.start()
        return True, None

    def _resolve_model_path(self) -> Optional[Path]:
        if self._model_path:
            return Path(self._model_path)
        candidate = self._base_dir / "models" / "vosk-model"
        return candidate

    def _run(self, model_path: Path) -> None:
        self._running = True
        try:
            from vosk import Model, KaldiRecognizer  # type: ignore
            import sounddevice as sd  # type: ignore
        except Exception as exc:
            self._last_error = f"Voice dependencies not available: {exc}"
            self._running = False
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
            with sd.RawInputStream(
                samplerate=self._sample_rate,
                blocksize=8000,
                dtype="int16",
                channels=1,
                callback=callback,
                device=device,
            ):
                recognizer = KaldiRecognizer(Model(str(model_path)), self._sample_rate)
                try:
                    recognizer.SetWords(True)
                except Exception:
                    pass
                awaiting_wakeword = True
                last_wake_time = 0.0
                last_wake_broadcast = 0.0
                command_window_until = 0.0
                while not self._stop_event.is_set():
                    try:
                        data = q.get(timeout=0.1)
                    except queue.Empty:
                        now = time.time()
                        if not awaiting_wakeword and command_window_until and now > command_window_until:
                            awaiting_wakeword = True
                        continue
                    if time.time() < self._mute_until:
                        recognizer.Reset()
                        continue
                    if recognizer.AcceptWaveform(data):
                        result = json.loads(recognizer.Result())
                        text = (result.get("text") or "").strip().lower()
                        if len(text.split()) < 2 and self._last_partial:
                            if time.time() - self._last_partial_time < 1.5:
                                text = self._last_partial
                        if not text:
                            continue
                        if awaiting_wakeword:
                            wakeword_hit = next((w for w in self._wakeword_aliases if w in text), None)
                            if wakeword_hit:
                                now = time.time()
                                if now - last_wake_broadcast > 1.2:
                                    logger.info("Wakeword heard: %s", wakeword_hit)
                                    self._broadcast_event({"type": "voice_wakeword", "payload": {"text": wakeword_hit}})
                                    last_wake_broadcast = now
                                    if self._tts_enabled and now - self._last_ready_speak > 2.0:
                                        self._last_ready_speak = now
                                        self._maybe_speak("Ready for command.")
                                remaining = text.replace(wakeword_hit, "").strip(",. ").strip()
                                awaiting_wakeword = False
                                last_wake_time = time.time()
                                self._last_wake_time = last_wake_time
                                command_window_until = last_wake_time + 10
                                if remaining:
                                    keep_listening = self._handle_command(remaining)
                                    if keep_listening:
                                        awaiting_wakeword = False
                                        command_window_until = time.time() + 10
                                    else:
                                        awaiting_wakeword = True
                            continue
                        if text in self._wakeword_aliases:
                            continue
                        keep_listening = self._handle_command(text)
                        if keep_listening:
                            awaiting_wakeword = False
                            command_window_until = time.time() + 10
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
                                    if self._tts_enabled and now - self._last_ready_speak > 2.0:
                                        self._last_ready_speak = now
                                        self._maybe_speak("Ready for command.")
                                awaiting_wakeword = False
                                last_wake_time = time.time()
                                self._last_wake_time = last_wake_time
                                command_window_until = last_wake_time + 10
        except Exception as exc:
            self._last_error = f"Voice loop failed: {exc}"
        finally:
            self._running = False

    def _handle_command(self, text: str) -> bool:
        cleaned = text
        for alias in self._wakeword_aliases:
            if alias in cleaned:
                cleaned = cleaned.replace(alias, " ")
        cleaned = " ".join(cleaned.split()).strip()
        if not cleaned or cleaned in self._wakeword_aliases:
            return True
        if len(text.strip()) < 3:
            return True
        raw_text = text
        self._last_transcript = cleaned
        self._broadcast_event({"type": "voice_transcript", "payload": {"text": cleaned, "raw": raw_text}})
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
        self._last_command = command
        self._broadcast_event({"type": "voice_command", "payload": {"text": cleaned, "status": "matched", "command": command}})
        self._send_command(command)
        self._maybe_speak(self._command_response(command))
        if command.get("type") == "is_server_ready":
            self._awaiting_server_ready_until = time.time() + 12.0
        return False

    def _maybe_speak(self, text: str) -> tuple[bool, str | None]:
        if not self._tts_enabled:
            return False, "TTS disabled"
        now = time.time()
        if self._mute_until > now:
            self._pending_tts = text
            if self._pending_timer:
                self._pending_timer.cancel()
            delay = max(0.1, self._mute_until - now + 0.1)
            self._pending_timer = threading.Timer(delay, self._drain_pending_tts)
            self._pending_timer.daemon = True
            self._pending_timer.start()
            return True, None
        if text:
            mute_for = max(3.0, min(10.0, 0.12 * len(text) + 1.2))
            self._mute_until = time.time() + mute_for
        ok, error = speak(
            text,
            engine=self._tts_engine,
            tts_bin=self._tts_bin,
            voice=self._tts_voice,
            piper_bin=self._tts_piper_bin,
            piper_model=self._tts_piper_model,
            piper_player=self._tts_piper_player,
        )
        logger.info("TTS: engine=%s text=%s ok=%s error=%s", self._tts_engine, text, ok, error)
        if not ok and error:
            self._last_error = error
        return ok, error

    def _drain_pending_tts(self) -> None:
        text = self._pending_tts
        self._pending_tts = None
        self._pending_timer = None
        if text:
            self._maybe_speak(text)

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
        if not event:
            return
        if event.get("type") != "server_ready":
            return
        if time.time() > self._awaiting_server_ready_until:
            return
        payload = event.get("payload") if isinstance(event, dict) else None
        payload = payload if isinstance(payload, dict) else {}
        site = payload.get("site") or event.get("site")
        sensors = payload.get("supported_sensors") or []
        names = []
        sensor_algo_lines = []
        if isinstance(sensors, list):
            for sensor in sensors:
                if isinstance(sensor, str):
                    names.append(sensor)
                elif isinstance(sensor, dict) and sensor.get("name"):
                    name = sensor.get("name")
                    names.append(name)
                    computations = sensor.get("computations") or []
                    algo_names = []
                    if isinstance(computations, list):
                        for comp in computations:
                            if isinstance(comp, str):
                                algo_names.append(comp)
                            elif isinstance(comp, dict) and comp.get("name"):
                                algo_names.append(comp.get("name"))
                    if algo_names:
                        sensor_algo_lines.append(f"{name} supports {', '.join(algo_names)}")
                    else:
                        sensor_algo_lines.append(f"{name} supports no computations")
        sensor_list = ", ".join(names) if names else "no sensors"
        site_text = f" at {site}" if site else ""
        if sensor_algo_lines:
            algo_text = ". ".join(sensor_algo_lines)
            self._maybe_speak(f"Server is ready{site_text}. {algo_text}.")
        else:
            self._maybe_speak(f"Server is ready{site_text}. Supported sensors: {sensor_list}.")
        self._awaiting_server_ready_until = 0.0
