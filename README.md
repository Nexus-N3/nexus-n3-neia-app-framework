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

Optional API env vars:
- `NEIA_DEV=1` to load app `dev_entry_ui` (hot reload)
- `NEIA_DEV_FALLBACK=1` to fall back to built `entry_ui` if the dev UI is not reachable (default on)
- `NEIA_GATEWAY=zeromq|lavinmq`
- `NEIA_SITE=<site_name>`
- `AMQP_URL=<amqp_url>` (when using LavinMQ)
- `NEIA_VOICE_ENABLED=1` to start the offline voice worker
- `NEIA_VOICE_WAKEWORD=nexus`
- `NEIA_VOICE_WAKEWORD_ALIASES=next us,neck sus,nekksus`
- `NEIA_VOICE_MODEL_PATH=/path/to/vosk/model`
- `NEIA_VOICE_DEVICE=<device index>`
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
```

## App templates
- `apps/registry/app_template` (vanilla JS)
- `apps/registry/app_react_template` (React)

## Offline development notes
- Avoid CDN dependencies in app UI bundles.
- Bundle React (or any framework) into the app `ui/assets/` output.
- Ensure `app.json` only references local `entry_ui` and `style` paths when offline.
  - The React template includes local UMD builds under `ui/assets/`.
