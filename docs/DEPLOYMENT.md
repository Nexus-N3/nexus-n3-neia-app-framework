# RS Nexus NEIA - Offline Edge Deployment

This guide covers deploying NEIA to an edge device for offline use.

## 0) Build the API wheel (on a dev machine)

Build the NEIA API wheel before deployment:

```bash
cd nexus-n3-neia-app-framework/neia-api
python3 -m build --wheel
```

This creates a wheel under `nexus-n3-neia-app-framework/neia-api/dist/`.

## 1) Build UI assets (on a dev machine)
Build the dashboard UI so the API can serve static files offline:
```bash
cd nexus-n3-neia-app-framework/neia-ui
npm install
npm run build
```
This creates `nexus-n3-neia-app-framework/neia-ui/dist/`.

## 2) Build app UI assets (if any apps use a build step)
For each app that has a UI build (e.g. React apps), build into `ui/assets/`:
```bash
cd nexus-n3-neia-app-framework/apps/registry/app_react_template/ui
npm install
npm run build
```

## 3) Ensure app manifests are offline-safe
For each `apps/registry/<app_id>/app.json`:
- `entry_ui` and `style` must be local paths (no CDN URLs).
- `dev_entry_ui` can remain, but it is ignored when `NEIA_DEV=0`.

## 4) (Optional) Pre-install apps
Apps are considered "installed" if their ID is in `apps/installed.json`.
If you want apps to appear as installed immediately after deployment, edit:
```
nexus-n3-neia-app-framework/apps/installed.json
```
Example:
```json
[
  "app_template",
  "app_react_template"
]
```

You can also install apps later via the UI or API (see below), so this step
is only needed for pre-provisioning.

## 5) Copy to the edge device
Copy the full `nexus-n3-neia-app-framework` folder to the device (including `neia-ui/dist`
and any app `ui/assets/`).

## 6) Install API dependencies on the edge device
```bash
cd nexus-n3-neia-app-framework/neia-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 7) Run the API in offline mode
Ensure dev mode is off so the API uses built assets:
```bash
NEIA_DEV=0 python -m app.daemon --host 0.0.0.0 --port 8080
```

Open:
```
http://<edge-device-ip>:8080
```

## Installing apps after deployment
If an app exists in `apps/registry/<app_id>`, you can install it:
- From the dashboard (Available Apps -> Install)
- Or via API:
```
POST /api/v1/apps/install/<app_id>
```

Installed apps are tracked in `apps/installed.json`.
