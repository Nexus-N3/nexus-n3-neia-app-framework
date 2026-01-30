from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict

from ..config import (
    NEIA_VOICE_DEVICE,
    NEIA_VOICE_DEBUG,
    NEIA_VOICE_DEVICE_AUTO,
    NEIA_VOICE_ENABLED,
    NEIA_VOICE_MODEL_PATH,
    NEIA_VOICE_SAMPLE_RATE,
    NEIA_VOICE_WAKEWORD_ALIASES,
    NEIA_VOICE_WAKEWORD,
    NEIA_VOICE_TTS_BIN,
    NEIA_VOICE_TTS_ENGINE,
    NEIA_VOICE_TTS_ENABLED,
    NEIA_VOICE_TTS_PIPER_BIN,
    NEIA_VOICE_TTS_PIPER_MODEL,
    NEIA_VOICE_TTS_PIPER_PLAYER,
    NEIA_VOICE_TTS_VOICE,
)
from .manager import VoiceManager


def create_voice_manager(
    base_dir: Path,
    send_command: Callable[[Dict[str, Any]], None],
    broadcast_event: Callable[[Dict[str, Any]], None],
) -> VoiceManager:
    return VoiceManager(
        base_dir=base_dir,
        send_command=send_command,
        broadcast_event=broadcast_event,
        wakeword=NEIA_VOICE_WAKEWORD,
        wakeword_aliases=NEIA_VOICE_WAKEWORD_ALIASES,
        model_path=NEIA_VOICE_MODEL_PATH,
        device=NEIA_VOICE_DEVICE,
        sample_rate=NEIA_VOICE_SAMPLE_RATE,
        debug=NEIA_VOICE_DEBUG,
        device_auto=NEIA_VOICE_DEVICE_AUTO,
        tts_enabled=NEIA_VOICE_TTS_ENABLED,
        tts_engine=NEIA_VOICE_TTS_ENGINE,
        tts_bin=NEIA_VOICE_TTS_BIN,
        tts_voice=NEIA_VOICE_TTS_VOICE,
        tts_piper_bin=NEIA_VOICE_TTS_PIPER_BIN,
        tts_piper_model=NEIA_VOICE_TTS_PIPER_MODEL,
        tts_piper_player=NEIA_VOICE_TTS_PIPER_PLAYER,
        enabled=NEIA_VOICE_ENABLED,
    )
