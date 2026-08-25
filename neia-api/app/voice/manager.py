from __future__ import annotations

import json
import queue
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from .nlu import parse_intent
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
        # API is speech-engine only; UI owns conversation flow.
        self._flow_mode = "ui"
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
        self._pending_tts: Optional[str] = None
        self._tts_lock = threading.Lock()
        self._last_partial: Optional[str] = None
        self._last_partial_time: float = 0.0
        # Backwards-compatible flag for UI lifecycle visibility only.
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

    def speak(self, text: str, *, wait: bool = False):
        return self._maybe_speak(text, wait=wait)

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
        self._pending_tts = None
        self._emit_status_event()
        return self.last()

    def set_flow_active(self, active: bool) -> Dict[str, Any]:
        # Compatibility flag consumed by UI lifecycle.
        self._flow_active = active
        self._emit_status_event()
        return self.status()

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
        return self._base_dir / "models" / "vosk-model"

    def _resolve_input_device(self, sd) -> Optional[int]:
        device: Optional[int] = None
        if self._device:
            if self._device.isdigit():
                device = int(self._device)
            else:
                lowered = self._device.lower()
                if lowered in {"pulse", "default", "system"}:
                    device = None
                else:
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
        if device is None and self._device and self._device.lower() not in {"pulse", "default", "system"}:
            raise ValueError(f"No input device matching '{self._device}'")
        return device

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
            device = self._resolve_input_device(sd)
            stream_sample_rate = self._sample_rate
            try:
                import sounddevice as _sd  # type: ignore
                _sd.check_input_settings(device=device, samplerate=stream_sample_rate, channels=1, dtype="int16")
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
                last_wake_broadcast = 0.0
                command_window_until = 0.0
                while not self._stop_event.is_set():
                    try:
                        data = q.get(timeout=0.1)
                    except queue.Empty:
                        if (not awaiting_wakeword) and command_window_until and time.time() > command_window_until:
                            if self._flow_active:
                                command_window_until = time.time() + self._command_window_seconds
                            else:
                                awaiting_wakeword = True
                        continue

                    if self._is_speaking() or time.time() < self._mute_until:
                        recognizer.Reset()
                        continue

                    if recognizer.AcceptWaveform(data):
                        result = json.loads(recognizer.Result())
                        text = (result.get("text") or "").strip().lower()
                        if not text and self._last_partial and (time.time() - self._last_partial_time < 1.5):
                            text = self._last_partial
                        if len(text.split()) < 2 and self._last_partial and (time.time() - self._last_partial_time < 1.5):
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
                                remaining = text.replace(wakeword_hit, "").strip(" ,.\t")
                                awaiting_wakeword = False
                                self._last_wake_time = time.time()
                                command_window_until = self._last_wake_time + self._command_window_seconds
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
                                awaiting_wakeword = False
                                self._last_wake_time = time.time()
                                command_window_until = self._last_wake_time + self._command_window_seconds
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
            device = self._resolve_input_device(sd)
            stream_sample_rate = self._sample_rate
            try:
                import sounddevice as _sd  # type: ignore
                _sd.check_input_settings(device=device, samplerate=stream_sample_rate, channels=1, dtype="int16")
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
                    try:
                        data = q.get(timeout=0.1)
                    except queue.Empty:
                        if (not awaiting_wakeword) and command_window_until and time.time() > command_window_until:
                            if self._flow_active:
                                command_window_until = time.time() + self._command_window_seconds
                            else:
                                awaiting_wakeword = True
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
                        wakeword_hit = next((w for w in self._wakeword_aliases if w in text), None)
                        if wakeword_hit:
                            now = time.time()
                            if now - last_wake_broadcast > 1.2:
                                logger.info("Wakeword heard: %s", wakeword_hit)
                                self._broadcast_event({"type": "voice_wakeword", "payload": {"text": wakeword_hit}})
                                last_wake_broadcast = now
                            remaining = text.replace(wakeword_hit, "").strip(" ,.\t")
                            awaiting_wakeword = False
                            self._last_wake_time = time.time()
                            command_window_until = self._last_wake_time + self._command_window_seconds
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

    def _handle_command(self, text: str) -> bool:
        cleaned = text
        for alias in self._wakeword_aliases:
            if alias in cleaned:
                cleaned = cleaned.replace(alias, " ")
        cleaned = " ".join(cleaned.split()).strip()
        if not cleaned or cleaned in self._wakeword_aliases:
            return True

        self._last_transcript = cleaned
        self._broadcast_event({"type": "voice_transcript", "payload": {"text": cleaned, "raw": text}})

        intent = parse_intent(cleaned)
        if not intent or intent.get("intent") == "empty":
            intent = {"intent": "free_text", "text": cleaned}
        intent["_raw_text"] = cleaned

        self._last_command = intent
        self._broadcast_event(
            {"type": "voice_command", "payload": {"text": cleaned, "status": "matched", "command": intent}}
        )
        return True

    def _maybe_speak(self, text: str, wait: bool = False) -> tuple[bool, str | None]:
        if not text:
            return False, "No text provided"

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

    def handle_gateway_event(self, event: Dict[str, Any]) -> None:
        # Speech-engine only: UI owns flow orchestration.
        return
