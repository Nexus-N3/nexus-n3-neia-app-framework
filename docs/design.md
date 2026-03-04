# NEIA Design (v0.1)

## Purpose
NEIA is a Python-based application framework that interfaces with rs-nexus-os via
ZeroMQ or LavinMQ. It hosts installable apps (plugins) built on a fixed, generic
step model and provides a UI dashboard to install, select, and run apps.

Key goals:
- Offline-friendly operation on edge (Ubuntu/Linux).
- No persistence across runs (for now).
- Apps are plugins (similar to sensor plugins) and are installable/uninstallable.
- Apps do not care about transport (ZeroMQ vs LavinMQ).

## Repository Layout
```
rs-nexus-neia/
  neia-api/          # FastAPI service (API + static UI + plugin assets)
  neia-ui/           # React + Vite shell UI
  apps/              # Registry + installed apps
  shared/            # Shared schemas (steps)
  docs/              # Contracts and design docs
```

## App Plugin Model
Apps live under `apps/registry/<app_id>` and include a manifest (`app.json`) plus
optional UI assets.

Example:
```
apps/registry/gait_analysis/
  app.json
  ui/assets/index.js
  ui/assets/index.css
```

`app.json` fields:
- `id`, `name`, `version` (required)
- `description`
- `entry_ui`, `style`, `mount` (static bundle)
- `dev_entry_ui`, `dev_mount` (dev server support)

Install state is tracked in `apps/installed.json`. Only installed apps are
accessible via the API and UI.

## Step Model
Steps are generic and shared across apps. Apps decide which command variants
and payloads to send within each step.

Step schema: `shared/steps.json`
Step contract: `docs/step_api_contract.md`

Current steps:
0) Check Server Readiness (CMD_IS_SERVER_READY)
0a) (Optional) Pre-init Battery Check (CMD_CHECK_BATTERY -> EVT_BATTERY_CHECK)
1) Who + Session Label (UI-only)
2) Subjects (UI-only)
3) Sensors (UI-only)
4) Locations (UI-only)
5) Algorithms + Init System (CMD_INIT_SYSTEM)
6) Discover (CMD_DISCOVER_SENSORS / CMD_DISCOVER_SENSORS_FOR_SUBJECTS)
7) Connect (CMD_CONNECT_TO_ALL / CMD_CONNECT_SUBJECTS)
8) Identify Sensors (CMD_IDENTIFY_SENSOR)
9) Start Stream + Live Results (CMD_START_STREAM_FOR_ALL / _FOR_SUBJECTS)
10) Stop Stream (CMD_STOP_STREAM_FOR_ALL / _FOR_SUBJECTS)
11) View Final Results (UI-only)
12) Disconnect (CMD_DISCONNECT_ALL / CMD_DISCONNECT_SUBJECTS)
13) Repeat or Re-Initialize (UI-only)

## Transport-Agnostic Gateway API
Apps use a single API regardless of transport:
- `POST /api/v1/gateway/command` (send command)
- `GET /api/v1/gateway/events` (WebSocket stream of events)
- `POST /api/v1/gateway/purge` (LavinMQ only)
- `GET /api/v1/gateway/status`

Config:
- `NEIA_GATEWAY` = `zeromq` or `lavinmq`
- `NEIA_SITE` (LavinMQ queue prefix)
- `AMQP_URL` (LavinMQ)
- `ZEROMQ_CMD_CONNECT`, `ZEROMQ_EVENT_CONNECT`

Gateway docs: `docs/gateway_api.md`

## UI Shell
The shell UI is React + Vite. It provides:
- Installed app list
- Available app list (install/uninstall)
- App runner panel to load plugin UIs

Plugin UIs can be static bundles or dev server URLs. The shell loads the bundle
and calls the `mount` entry point.

## UI Screen Size Guidelines
NEIA apps and the dashboard are expected to run on:
- Edge screens as small as ~5" (often low-res or narrow viewports)
- Laptops/desktops

Guidelines:
- Treat 480px width as the minimum supported viewport; ensure all core flows work.
- Support both portrait and landscape at small sizes; avoid layouts that require
  fixed widths or horizontal scrolling.
- Prefer single-column layouts under ~900px and progressive disclosure for
  secondary panels/sidebars.
- Use large touch targets and avoid hover-only interactions for edge screens.
- Provide a "full-screen app" path in the shell so apps can run with minimal
  chrome on small displays.

Deterministic profile override:
- Use `display_profile` (URL), `window.__NEXUS_DISPLAY_PROFILE`, or `VITE_DISPLAY_PROFILE`
  to apply an explicit body class (`display-profile-<value>`).
- Keep media queries as fallback, but ship tuned profile classes for known hardware
  (for example `1920x1080`, `800x400`) to avoid browser/device reporting variance.

If specific edge hardware differs (e.g., 800x480 or 720p), update these targets
and re-validate the dashboard + app templates.

## Dev Workflow (Apps)
- Build a plugin UI with any framework.
- During dev, run a dev server and set `dev_entry_ui` in `app.json`.
- With `NEIA_DEV=1`, the shell loads the dev URL (hot reload).
- For install, build to static assets and copy into `apps/registry/<app_id>`.

## Current Limitations
- No persistence (sessions, subjects, step state)
- No auth or RBAC
- No app sandboxing
- No backend plugin hooks (UI-only for now)

## Next Milestones
- Step runner UI bound to step contract
- Gateway connectivity verification (end-to-end with rs-nexus-os)
- Optional backend plugin hooks
- Optional PWA support for stronger offline behavior
