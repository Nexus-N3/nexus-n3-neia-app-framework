# RS Nexus NEIA

NEIA is a Python-based application framework that interfaces with rs-nexus-os via ZeroMQ or LavinMQ.
It hosts installable apps (plugins) built on a fixed step model, and exposes a UI dashboard for
selecting, installing, and running apps.

This repo contains:
- neia-api: FastAPI service (API + static UI + plugin assets)
- neia-ui: UI shell (React + Vite)
- apps: app registry and installed app list
- shared: shared schemas and step definitions
- docs: authoring and integration docs

Quick start docs live in docs/.
UI screen size guidelines: see `docs/design.md`.
UI-owned voice flow design: see `docs/voice_flow_ui.md`.
Offline deployment guide: see `DEPLOYMENT.md`.
Ansible deployment guide: see `deployment/ansible/README.md`.

## Run locally

API (FastAPI):
```bash
cd neia-api
python -m venv .venv


pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8050
```

Enable dev mode (loads `dev_entry_ui` when present):
```bash
NEIA_DEV=1 uvicorn app.main:app --reload --host 0.0.0.0 --port 8050
```

UI (Vite dev server):
```bash
cd neia-ui
npm install
npm run dev
```

### UI display profiles (explicit, non-media-query)

Both `neia-ui` and `neia_voice_assistant` support an explicit display profile class on
`<body>` so screen tuning is deterministic.

Resolution priority:
1. URL query: `?display_profile=1920x1080`
2. Runtime global: `window.__NEXUS_DISPLAY_PROFILE`
3. Build/dev env: `VITE_DISPLAY_PROFILE`
4. Local storage cache: `nexus_display_profile`

Examples:
```bash
# NEIA shell
cd rs-nexus-neia/neia-ui
VITE_DISPLAY_PROFILE=1920x1080 npm run dev

# Voice assistant UI (standalone dev server)
cd rs-nexus-neia/apps/registry/neia_voice_assistant/ui
VITE_DISPLAY_PROFILE=1920x1080 npm run dev
```

Or override from browser URL:
```text
http://localhost:3000/?display_profile=1920x1080
```

### Dev mode with `neia_voice_assistant`

`neia_voice_assistant` uses a separate dev UI entry (`http://localhost:3002/src/main.tsx`), so run 3 processes:

Terminal 1 (API):
```bash
cd rs-nexus-neia/neia-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8050
```

Terminal 2 (Dashboard shell):
```bash
cd rs-nexus-neia/neia-ui
npm install
npm run dev
```

Terminal 3 (Voice assistant app dev server):
```bash
cd rs-nexus-neia/apps/registry/neia_voice_assistant/ui
npm install
npm run dev
```

Open `http://localhost:3000` and launch the NEIA Voice Assistant app.

### Per-box audio setup (Linux and Jetson)

Audio device naming can differ by machine. USB devices visible in `lsusb` may not match names seen by Python `sounddevice`.

1) Verify what `sounddevice` sees for input devices:
```bash
python3 - << 'PY'
import sounddevice as sd
for i, d in enumerate(sd.query_devices()):
    if d["max_input_channels"] > 0:
        print(i, d["name"])
PY
```

2) Verify Pulse sources (often includes USB mic names not shown above):
```bash
pactl list short sources
```

Recommended `NEIA_VOICE_DEVICE` setup:
- Linux desktop/laptop (Pulse/PipeWire): use `NEIA_VOICE_DEVICE=pulse` (or `default`) and set system default source with `pactl set-default-source <source_name>`.
- Jetson or ALSA-forward setups where USB name is directly visible in `sounddevice`: set exact name or numeric index.

Example:
```bash
# Pulse bridge (cross-machine stable)
NEIA_VOICE_DEVICE=pulse
NEIA_VOICE_DEVICE_AUTO=0
NEIA_VOICE_FLOW_MODE=ui

# Or explicit index from sounddevice query
# NEIA_VOICE_DEVICE=3
```

TTS output device notes:
- `NEIA_VOICE_TTS_PIPER_PLAYER=aplay`: `NEIA_VOICE_TTS_PIPER_PLAYER_DEVICE` should be an ALSA PCM (for example `plughw:1,0`).
- `NEIA_VOICE_TTS_PIPER_PLAYER=paplay`: leave `NEIA_VOICE_TTS_PIPER_PLAYER_DEVICE` empty.

Optional API env vars:
- `NEIA_DEV=1` to load app `dev_entry_ui` (hot reload)
- `NEIA_DEV_FALLBACK=1` to fall back to built `entry_ui` if the dev UI is not reachable (default on)
- `NEIA_GATEWAY=zeromq|lavinmq`
- `NEIA_AI_NODE=1` to auto-point gateway connections at the master node
- `NEIA_DISCOVER_MASTER=1` to resolve the master via mDNS when `NEIA_AI_NODE=1`
- `NEIA_MASTER_DISCOVERY_TIMEOUT=5` (seconds)
- `NEIA_MASTER_HOST=rs-nexus-master.local` (used when `NEIA_AI_NODE=1`)
- `NEIA_MASTER_CMD_PORT=5555` (ZeroMQ command port)
- `NEIA_MASTER_EVENT_PORT=5556` (ZeroMQ event port)
- `NEIA_MASTER_AMQP_URL=<amqp_url>` (LavinMQ fallback when `AMQP_URL` is not set)
- `NEIA_SITE=<site_name>`
- `AMQP_URL=<amqp_url>` (when using LavinMQ)
- `NEIA_VOICE_ENABLED=1` to start the offline voice worker
- `NEIA_VOICE_WAKEWORD=nexus`
- `NEIA_VOICE_WAKEWORD_ALIASES=next us,neck sus,nekksus`
- `NEIA_VOICE_MODEL_PATH=/path/to/vosk/model`
- `NEIA_VOICE_DEVICE=<device index|device name|pulse|default>`
- `NEIA_VOICE_SAMPLE_RATE=16000`
- `NEIA_VOICE_DEBUG=1` to emit partial transcripts
- `NEIA_VOICE_TTS_ENABLED=1` to enable spoken confirmations (espeak-ng)
- `NEIA_VOICE_TTS_ENGINE=espeak|piper`
- `NEIA_VOICE_TTS_BIN=espeak-ng`
- `NEIA_VOICE_TTS_VOICE=en-us`
- `NEIA_VOICE_TTS_PIPER_BIN=piper`
- `NEIA_VOICE_TTS_PIPER_MODEL=/path/to/piper.onnx`
- `NEIA_VOICE_TTS_PIPER_PLAYER=aplay`
- `NEIA_VOICE_DEVICE_AUTO=1` to auto-pick a USB mic (prefers Sennheiser/USB Audio)
- `POST /api/v1/voice/tts` with `{ "enabled": false }` to disable API TTS when using browser speech
- `NEIA_VOICE_STT_ENGINE=vosk|faster_whisper`
- `NEIA_VOICE_STT_MODEL=base` (faster-whisper model name)
- `NEIA_VOICE_STT_DEVICE=cpu|cuda`
- `NEIA_VOICE_STT_COMPUTE_TYPE=int8|float16|float32`
- `NEIA_VOICE_STT_LANGUAGE=en`
- `NEIA_VOICE_STT_CHUNK_SECONDS=1.2`
- `NEIA_VOICE_FLOW_MODE=ui|backend` (`ui` default; `neia_voice_assistant` flow control runs in UI)
- `VITE_DISPLAY_PROFILE=1920x1080` (applies when building/running the React UI bundles)
- `VITE_GATEWAY_WS_URL=ws://<host>:<port>/api/v1/gateway/events` (optional WS endpoint override for UI)

Use a `.env` file in `rs-nexus-neia/neia-api/` to avoid long command lines:
```bash
cp rs-nexus-neia/neia-api/.env.example rs-nexus-neia/neia-api/.env
# edit rs-nexus-neia/neia-api/.env to match your device + model paths
```

For TTS on Linux:
```
sudo apt-get install espeak-ng
```

Example (local dev with voice + TTS):
```bash
NEIA_VOICE_ENABLED=1 \
NEIA_VOICE_WAKEWORD="nexus" \
NEIA_VOICE_WAKEWORD_ALIASES="next us,neck sus,nekksus" \
NEIA_VOICE_DEVICE="Sennheiser XS LAV USB-C: Audio (hw:1,0)" \
NEIA_VOICE_DEBUG=1 \
NEIA_VOICE_TTS_ENABLED=1 \
NEIA_VOICE_TTS_ENGINE=piper \
NEIA_VOICE_TTS_PIPER_MODEL="/home/mike/Desktop/apps/dev/rs-nexus-project/rs-nexus-neia/models/piper/en_GB-southern_english_female-low.onnx" \
NEIA_DEV=1 \
uvicorn app.main:app --reload --host 0.0.0.0 --port 8050 --log-level info
```

Piper setup (download a model + binary):
```bash
# Install Piper (Python package) and download a model into the repo.
pip install piper-tts
python3 -m piper.download_voices --data-dir rs-nexus-neia/models/piper en_US-lessac-medium

# Models will be placed under:
# rs-nexus-neia/models/piper/en_US-lessac-medium.onnx
# rs-nexus-neia/models/piper/en_US-lessac-medium.onnx.json

# To fetch additional voices:
python3 -m piper.download_voices --list
python3 -m piper.download_voices --data-dir rs-nexus-neia/models/piper en_US-amy-medium
python3 -m piper.download_voices --data-dir rs-nexus-neia/models/piper en_GB-southern_english_female-low
```

Faster-Whisper setup (local STT alternative to Vosk):
```bash
pip install faster-whisper

# Example: use faster-whisper instead of Vosk
NEIA_VOICE_STT_ENGINE=faster_whisper
NEIA_VOICE_STT_MODEL=base
NEIA_VOICE_STT_DEVICE=cpu
NEIA_VOICE_STT_COMPUTE_TYPE=int8
NEIA_VOICE_STT_LANGUAGE=en
NEIA_VOICE_STT_CHUNK_SECONDS=1.2
```

Note: if wakeword reliability becomes an issue, we could explore a dedicated wakeword engine
like OpenWakeWord (offline, low-latency) and use Vosk/Whisper only for command transcription.

## App templates
- `apps/registry/app_template` (vanilla JS)
- `apps/registry/app_react_template` (React)

## Offline development notes
- Avoid CDN dependencies in app UI bundles.
- Bundle React (or any framework) into the app `ui/assets/` output.
- Ensure `app.json` only references local `entry_ui` and `style` paths when offline.
  - The React template includes local UMD builds under `ui/assets/`.
