# NEIA App Scaffold (Developer Guide)

This guide describes how to create, run, and publish a new NEIA app UI
independently of the main dashboard.

## Assumptions
- Apps are plugin folders under `apps/registry/<app_id>`.
- Apps must implement the NEIA step model (see `docs/step_api_contract.md`).
- Apps use the NEIA gateway API to send commands and receive events.

## Folder Layout (Recommended)
```
apps/registry/<app_id>/
  app.json
  ui/
    package.json
    vite.config.ts
    src/
      main.tsx
      steps/
      api/
    public/
```

## 1) Create a New App Folder
Choose a unique app id, then create:
```
apps/registry/my_app/
apps/registry/my_app/ui/
```

Create `app.json`:
```
{
  "id": "my_app",
  "name": "My App",
  "version": "0.1.0",
  "description": "My NEIA app.",
  "entry_ui": "ui/assets/index.js",
  "style": "ui/assets/index.css",
  "mount": "NeiaMyAppMount",
  "dev_entry_ui": "http://localhost:5173/src/main.tsx"
}
```

## 2) Build the App UI (Independent)
Use any front-end stack. Vite + React is common.

Your app must expose a global mount function:
```
window.NeiaMyAppMount = (el, props) => {
  // render your app into el
};
```

This makes the app runnable inside the NEIA dashboard when installed.

## 3) Develop and Test (Standalone)
Run the app UI by itself via Vite dev server:
```
cd apps/registry/my_app/ui
npm install
npm run dev
```

Access directly:
- `http://localhost:5173`

During dev, your app should call the NEIA API for gateway commands/events.
Set the API base to the running NEIA API URL (e.g., `http://localhost:8080`).

## 4) Call Gateway API
Send commands:
```
POST /api/v1/gateway/command
{ "type": "discover_sensors", "payload": {} }
```

Stream events:
```
ws://<neia-host>/api/v1/gateway/events
```

Details: `docs/gateway_api.md`.

## 5) Implement the Step Model
Apps must follow the generic step contract:
- Step list: `shared/steps.json`
- Contract: `docs/step_api_contract.md`

Apps choose the command variant per step (e.g., discover all vs per-subject).

## 6) Build and Publish
Build static assets:
```
npm run build
```

Ensure built assets land in `ui/assets/` (as referenced by `entry_ui` and `style`).
Then install by adding the app id to `apps/installed.json`.

## Notes
- Apps should run fully without the NEIA shell during development.
- The shell dashboard is only a launcher/installer.
- No persistence across runs (for now).
- UI must be responsive down to ~480px width to support small edge displays.
