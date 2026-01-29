# NEIA App Contract

Apps are plugin folders under `apps/registry/<app_id>`.
Each app provides:
- `app.json` manifest
- optional UI bundle under `ui/`
- optional assets under `assets/`

## Manifest (app.json)
Required fields:
- `id`: unique app id
- `name`: display name
- `version`: semver

Optional fields:
- `description`
- `entry_ui`: path to built JS bundle (relative to app root)
- `style`: path to built CSS (relative to app root)
- `mount`: global function name or custom element name
- `dev_entry_ui`: URL to dev server entry (for local dev)
- `dev_mount`: optional override mount name for dev

Example:
```
{
  "id": "toy_app",
  "name": "Toy App",
  "version": "0.1.0",
  "entry_ui": "ui/assets/index.js",
  "style": "ui/assets/index.css",
  "mount": "NeiaToyMount",
  "dev_entry_ui": "http://localhost:5173/src/main.tsx"
}
```

## Dev workflow
- Run the app UI in dev mode with Vite (or any framework)
- Set `NEIA_DEV=1` when running the API
- The shell UI loads `dev_entry_ui` for hot reload

## Install workflow
- Apps are discovered from `apps/registry/`
- Installed apps are tracked in `apps/installed.json`
- Only installed apps are accessible via the API and UI
