from __future__ import annotations

import os
import socket
import time
from typing import Optional
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]
APPS_DIR = BASE_DIR / "apps"
REGISTRY_DIR = APPS_DIR / "registry"
INSTALLED_FILE = APPS_DIR / "installed.json"

def _default_piper_model_path() -> str:
    models_dir = BASE_DIR / "models" / "piper"
    preferred = [
        models_dir / "en_GB-southern_english_female-low.onnx",
        models_dir / "en_US-amy-medium.onnx",
    ]
    for path in preferred:
        if path.exists():
            return str(path)
    fallback = sorted(models_dir.glob("*.onnx"))
    return str(fallback[0]) if fallback else ""

NEIA_DEV = os.getenv("NEIA_DEV", "0") == "1"
NEIA_DEV_FALLBACK = os.getenv("NEIA_DEV_FALLBACK", "1") == "1"

NEIA_VOICE_ENABLED = os.getenv("NEIA_VOICE_ENABLED", "0") == "1"
NEIA_VOICE_WAKEWORD = os.getenv("NEIA_VOICE_WAKEWORD", "nexus")
NEIA_VOICE_WAKEWORD_ALIASES = os.getenv("NEIA_VOICE_WAKEWORD_ALIASES", "")
NEIA_VOICE_MODEL_PATH = os.getenv("NEIA_VOICE_MODEL_PATH", "")
NEIA_VOICE_DEVICE = os.getenv("NEIA_VOICE_DEVICE", "sennheiser")
NEIA_VOICE_SAMPLE_RATE = int(os.getenv("NEIA_VOICE_SAMPLE_RATE", "16000"))
NEIA_VOICE_DEBUG = os.getenv("NEIA_VOICE_DEBUG", "0") == "1"
NEIA_VOICE_DEVICE_AUTO = os.getenv("NEIA_VOICE_DEVICE_AUTO", "1") == "1"
NEIA_VOICE_STT_ENGINE = os.getenv("NEIA_VOICE_STT_ENGINE", "vosk").lower()
NEIA_VOICE_STT_MODEL = os.getenv("NEIA_VOICE_STT_MODEL", "base")
NEIA_VOICE_STT_DEVICE = os.getenv("NEIA_VOICE_STT_DEVICE", "cpu")
NEIA_VOICE_STT_COMPUTE_TYPE = os.getenv("NEIA_VOICE_STT_COMPUTE_TYPE", "int8")
NEIA_VOICE_STT_LANGUAGE = os.getenv("NEIA_VOICE_STT_LANGUAGE", "en")
NEIA_VOICE_STT_CHUNK_SECONDS = float(os.getenv("NEIA_VOICE_STT_CHUNK_SECONDS", "1.2"))
NEIA_VOICE_TTS_ENABLED = os.getenv("NEIA_VOICE_TTS_ENABLED", "1") == "1"
NEIA_VOICE_TTS_ENGINE = os.getenv("NEIA_VOICE_TTS_ENGINE", "piper").lower()
NEIA_VOICE_TTS_BIN = os.getenv("NEIA_VOICE_TTS_BIN", "espeak-ng")
NEIA_VOICE_TTS_VOICE = os.getenv("NEIA_VOICE_TTS_VOICE", "en-us")
NEIA_VOICE_TTS_PIPER_BIN = os.getenv("NEIA_VOICE_TTS_PIPER_BIN", "piper")
NEIA_VOICE_TTS_PIPER_MODEL = os.getenv("NEIA_VOICE_TTS_PIPER_MODEL", _default_piper_model_path())
NEIA_VOICE_TTS_PIPER_PLAYER = os.getenv("NEIA_VOICE_TTS_PIPER_PLAYER", "aplay")
NEIA_VOICE_TTS_PIPER_PLAYER_DEVICE = os.getenv("NEIA_VOICE_TTS_PIPER_PLAYER_DEVICE", "plughw:0,0")
NEIA_VOICE_TTS_PIPER_PLAYER_ARGS = os.getenv("NEIA_VOICE_TTS_PIPER_PLAYER_ARGS", "")
NEIA_VOICE_TTS_PAD_LEAD_MS = int(os.getenv("NEIA_VOICE_TTS_PAD_LEAD_MS", "520"))
NEIA_VOICE_TTS_PAD_TAIL_MS = int(os.getenv("NEIA_VOICE_TTS_PAD_TAIL_MS", "320"))
NEIA_VOICE_TTS_OUTPUT_LATENCY_MS = int(os.getenv("NEIA_VOICE_TTS_OUTPUT_LATENCY_MS", "1200"))
NEIA_VOICE_FLOW_STEP_DELAY_MS = int(os.getenv("NEIA_VOICE_FLOW_STEP_DELAY_MS", "120"))
NEIA_VOICE_FLOW_MODE = os.getenv("NEIA_VOICE_FLOW_MODE", "ui").strip().lower()
NEIA_GATEWAY = os.getenv("NEIA_GATEWAY", "zeromq").lower()
NEIA_SITE = os.getenv("NEIA_SITE", "my_house")
NEIA_AI_NODE = os.getenv("NEIA_AI_NODE", "0") == "1"
NEIA_DISCOVER_MASTER = os.getenv("NEIA_DISCOVER_MASTER", "1") == "1"
NEIA_MASTER_DISCOVERY_TIMEOUT = float(os.getenv("NEIA_MASTER_DISCOVERY_TIMEOUT", "5"))
NEIA_MASTER_HOST = os.getenv("NEIA_MASTER_HOST", "rs-nexus-master.local")
NEIA_MASTER_CMD_PORT = int(os.getenv("NEIA_MASTER_CMD_PORT", "5555"))
NEIA_MASTER_EVENT_PORT = int(os.getenv("NEIA_MASTER_EVENT_PORT", "5556"))
NEIA_MASTER_AMQP_URL = os.getenv("NEIA_MASTER_AMQP_URL")

def _maybe_set_env(key: str, value: str) -> None:
    if not os.getenv(key):
        os.environ[key] = value

def _resolve_master_host(host: str) -> str:
    try:
        socket.gethostbyname(host)
    except Exception:
        return host
    return host

def _discover_master_ip(timeout: float) -> Optional[str]:
    try:
        from zeroconf import Zeroconf, ServiceBrowser
    except Exception:
        return None

    class MasterListener:
        def __init__(self) -> None:
            self.master_ip = None

        def add_service(self, zc, type_, name):
            info = zc.get_service_info(type_, name)
            if info and info.addresses:
                self.master_ip = socket.inet_ntoa(info.addresses[0])

        def update_service(self, zc, type_, name):
            return None

        def remove_service(self, zc, type_, name):
            return None

    zc = Zeroconf()
    listener = MasterListener()
    ServiceBrowser(zc, "_rsnexus._tcp.local.", listener)
    start = time.time()
    try:
        while time.time() - start < timeout:
            if listener.master_ip:
                return listener.master_ip
            time.sleep(0.1)
    finally:
        zc.close()
    return None

if NEIA_AI_NODE and NEIA_GATEWAY == "zeromq":
    master_host = None
    if NEIA_DISCOVER_MASTER and not os.getenv("ZEROMQ_CMD_CONNECT"):
        master_host = _discover_master_ip(NEIA_MASTER_DISCOVERY_TIMEOUT)
    if not master_host:
        master_host = _resolve_master_host(NEIA_MASTER_HOST)
    _maybe_set_env("ZEROMQ_CMD_CONNECT", f"tcp://{master_host}:{NEIA_MASTER_CMD_PORT}")
    _maybe_set_env("ZEROMQ_EVENT_CONNECT", f"tcp://{master_host}:{NEIA_MASTER_EVENT_PORT}")

if NEIA_AI_NODE and NEIA_GATEWAY == "lavinmq" and not os.getenv("AMQP_URL"):
    if NEIA_MASTER_AMQP_URL:
        _maybe_set_env("AMQP_URL", NEIA_MASTER_AMQP_URL)

AMQP_URL = os.getenv("AMQP_URL")
