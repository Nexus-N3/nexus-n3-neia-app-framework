from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
APPS_DIR = BASE_DIR / "apps"
REGISTRY_DIR = APPS_DIR / "registry"
INSTALLED_FILE = APPS_DIR / "installed.json"

NEIA_DEV = os.getenv("NEIA_DEV", "0") == "1"
NEIA_DEV_FALLBACK = os.getenv("NEIA_DEV_FALLBACK", "1") == "1"

NEIA_VOICE_ENABLED = os.getenv("NEIA_VOICE_ENABLED", "0") == "1"
NEIA_VOICE_WAKEWORD = os.getenv("NEIA_VOICE_WAKEWORD", "nexus")
NEIA_VOICE_WAKEWORD_ALIASES = os.getenv("NEIA_VOICE_WAKEWORD_ALIASES", "")
NEIA_VOICE_MODEL_PATH = os.getenv("NEIA_VOICE_MODEL_PATH", "")
NEIA_VOICE_DEVICE = os.getenv("NEIA_VOICE_DEVICE", "")
NEIA_VOICE_SAMPLE_RATE = int(os.getenv("NEIA_VOICE_SAMPLE_RATE", "16000"))
NEIA_VOICE_DEBUG = os.getenv("NEIA_VOICE_DEBUG", "0") == "1"
NEIA_VOICE_DEVICE_AUTO = os.getenv("NEIA_VOICE_DEVICE_AUTO", "0") == "1"
NEIA_VOICE_TTS_ENABLED = os.getenv("NEIA_VOICE_TTS_ENABLED", "0") == "1"
NEIA_VOICE_TTS_ENGINE = os.getenv("NEIA_VOICE_TTS_ENGINE", "espeak").lower()
NEIA_VOICE_TTS_BIN = os.getenv("NEIA_VOICE_TTS_BIN", "espeak-ng")
NEIA_VOICE_TTS_VOICE = os.getenv("NEIA_VOICE_TTS_VOICE", "en-us")
NEIA_VOICE_TTS_PIPER_BIN = os.getenv("NEIA_VOICE_TTS_PIPER_BIN", "piper")
NEIA_VOICE_TTS_PIPER_MODEL = os.getenv("NEIA_VOICE_TTS_PIPER_MODEL", "")
NEIA_VOICE_TTS_PIPER_PLAYER = os.getenv("NEIA_VOICE_TTS_PIPER_PLAYER", "aplay")
NEIA_GATEWAY = os.getenv("NEIA_GATEWAY", "zeromq").lower()
NEIA_SITE = os.getenv("NEIA_SITE", "my_house")
AMQP_URL = os.getenv("AMQP_URL")
