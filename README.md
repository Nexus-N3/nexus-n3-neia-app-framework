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
source .venv/bin/activate
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

## App templates
- `apps/registry/app_template` (vanilla JS)
- `apps/registry/app_react_template` (React)

## Offline development notes
- Avoid CDN dependencies in app UI bundles.
- Bundle React (or any framework) into the app `ui/assets/` output.
- Ensure `app.json` only references local `entry_ui` and `style` paths when offline.
  - The React template includes local UMD builds under `ui/assets/`.
