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
- `layout_mode`: optional app display mode for the shell. Supported values:
  - `takeover`: app fills the full framework mount surface
  - `framed`: app renders its own centered bounded surface within the mount
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
  "layout_mode": "framed",
  "dev_entry_ui": "http://localhost:5173/src/main.tsx"
}
```

## UI layout contract
The NEIA shell should provide a neutral mount surface. It should not guess how an
individual app wants to frame itself.

Rules:
- The shell gives every app a full available mount area.
- The shell should not add app-specific centering, max-width, or aspect-ratio rules.
- The app root is responsible for its own presentation inside that mount area.

Supported layout modes:
- `takeover`
  - App owns the whole mount surface.
  - Use for immersive or ambient apps such as voice assistants.
  - App root should fill width and height.
- `framed`
  - App owns a centered inner shell inside the mount surface.
  - Use for workflow/task apps that should remain visually bounded on large screens.
  - App root should fill the mount; an inner shell should control max width, max height,
    padding, and centering.

Recommended root patterns:
- `takeover`
  - outer root: `width: 100%; height: 100%;`
  - no extra centering wrapper required
- `framed`
  - outer root: `width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;`
  - inner shell: bounded width/height with app-owned padding and spacing

Do not mix these patterns in one app. Each app should choose one mode explicitly.

## Screen-size behavior
Apps must support the standard NEIA display profiles without relying only on browser
media-query behavior.

Primary targets:
- `800x400`
  - constrained operational screen
  - prioritize simplified flows, large touch targets, single-path interactions
  - avoid free-text entry unless essential
- `1920x1080`
  - large-screen operational view
  - allow richer spacing and additional context
  - keep the same primary workflow if the app is intentionally standardized

Layout guidance by mode:
- `takeover`
  - should scale edge-to-edge at all supported display profiles
  - internal content can be centered or structured, but the app owns the entire stage
- `framed`
  - should remain centered at large sizes
  - should relax framing at small sizes so the workflow still fits without clipping
  - should not depend on the shell to create the frame

## Dev workflow
- Run the app UI in dev mode with Vite (or any framework)
- Set `NEIA_DEV=1` when running the API
- The shell UI loads `dev_entry_ui` for hot reload

## Install workflow
- Apps are discovered from `apps/registry/`
- Installed apps are tracked in `apps/installed.json`
- Only installed apps are accessible via the API and UI
