# CLI Plan

## Goal

Create a repo-local CLI for `rs-nexus-neia` that scaffolds a new app under `apps/registry/<app_id>` with:

- a valid `app.json`
- a working React UI app
- a clean default shell and screen/layout structure
- support for NEIA app display modes
- support for compact and large-screen rendering from the start
- a small, intentional set of shared hooks/components ready to be reused
- a clear split between `workflow` scaffolds and richer `app` scaffolds

The main outcome is that new apps start from a consistent framework contract instead of each app inventing its own shell, routing, and screen layout.

## What The CLI Should Prompt For

Minimum manifest/app metadata:

- `name`
- `id`
- `version`
- `description`
- `developer`
- `app_type`
  - `app`
  - `workflow`
  - `demo`
- `layout_mode`
  - `framed`
  - `takeover`

Optional prompts:

- `display_name` override if different from `name`
- whether to include a UI
- whether to include gateway hooks
- whether to scaffold a compact-first workflow template
- whether to scaffold a richer app template with larger-screen branching
- whether to register the app in `apps/installed.json`
- dev server port

## Generated Output

For a UI app, the CLI should create:

- `apps/registry/<app_id>/app.json`
- `apps/registry/<app_id>/ui/package.json`
- `apps/registry/<app_id>/ui/index.html`
- `apps/registry/<app_id>/ui/vite.config.ts`
- `apps/registry/<app_id>/ui/tsconfig.json`
- `apps/registry/<app_id>/ui/src/main.tsx`
- `apps/registry/<app_id>/ui/src/App.tsx`
- `apps/registry/<app_id>/ui/src/App.css`
- `apps/registry/<app_id>/ui/src/index.css`
- `apps/registry/<app_id>/ui/src/styles/App.compact.css`
- `apps/registry/<app_id>/ui/src/styles/App.1920x1080.css`
- `apps/registry/<app_id>/ui/src/utils/displayProfiles.ts`
- `apps/registry/<app_id>/ui/src/components/`
- `apps/registry/<app_id>/ui/src/screens/`
- `apps/registry/<app_id>/ui/src/hooks/`
- `apps/registry/<app_id>/ui/src/store/`
- `apps/registry/<app_id>/ui/src/assets/`

If the app is not UI-based, the CLI should still generate:

- `app.json`
- a minimal app folder with README/placeholder notes

## Manifest Contract

The CLI should always generate an `app.json` that conforms to the documented app contract:

- `id`
- `name`
- `version`
- `description`
- `developer`
- `app_type`
- `layout_mode`
- `entry_ui`
- `style`
- `mount`
- `dev_entry_ui`

Recommended defaults:

- `layout_mode: "framed"` for workflow/task apps
- `layout_mode: "takeover"` only for immersive apps
- `app_type: "workflow"` for compact standardized operational flows

## App Template Modes

The CLI should support at least 2 UI templates.

### 1. Framed Workflow Template

Use for apps like `nexus_load`.

Characteristics:

- compact-first
- standardized click-through flow
- no free-text input by default
- large footer actions
- one shared screen layout structure
- same workflow at small and large sizes
- larger screens get more spacing, not different workflow branches
- minimal route set
- minimal component set
- intended to be the default scaffold for operational products

Should include:

- root app shell
- header
- route stage
- screen layout
- sample screens
- compact and scale-up CSS layers
- viewport/profile helper
- back/title/footer conventions on every screen

### 2. Framed App Template

Use for apps like `nexus`.

Characteristics:

- starts from the same shell, styles, and profile rules as workflow apps
- may introduce richer routes and screen-specific behavior on larger displays
- may include optional text input and more complex review/detail screens
- can branch UI behavior at larger sizes if the app needs it

Should include:

- everything in the workflow template
- additional placeholder screens for richer app flows
- optional app-specific state/store examples
- optional screen branches that demonstrate larger-screen complexity safely

### 3. Takeover App Template

Use for apps like voice/ambient/immersive apps.

Characteristics:

- fills full framework mount area
- owns all app framing itself
- no bounded inner shell by default

## Screen/Layout Contract For Generated Apps

The CLI should scaffold a shared app-local screen structure instead of raw page markup.

Required structure:

1. App shell
- fills the NEIA mount surface
- owns app background and framing

2. Header
- fixed top region
- logo/title/status/actions

3. Route stage
- remaining app height
- screens render inside this region

4. Screen layout
- shared `header / body / footer` structure
- body scrolls when needed
- footer remains visible and anchored

This is important because the framework app stage is the real design target, not the raw browser viewport.

## Screen Size Rules

The CLI should scaffold apps against explicit NEIA display targets:

- compact embedded target:
  - shell viewport `800x400`
  - usable app stage `800x360`
- large operational target:
  - `1920x1080`

Generated apps should follow these rules:

- compact mode is designed to fit inside the embedded stage
- `App.css` defines the base/default large-screen sizing layer
- `App.compact.css` defines compact sizing and compact flow layout changes
- `App.1920x1080.css` defines targeted `1920x1080` overrides
- `displayProfiles.ts` is the single render-policy entry point for compact vs standard screen decisions
- larger screens may scale spacing, typography, and card width
- larger screens should not automatically introduce more complex workflow branches unless the template explicitly supports that

For workflow apps, the default should be:

- same flow on small and large screens
- compact behavior remains primary
- large screens use a scale-up layer, not a separate desktop UX

For app scaffolds, the default should be:

- same shell and profile system as workflows
- base large-screen layout comes from `App.css`
- optional richer screen behavior is additive, not a separate styling mechanism

## Shared Pieces The CLI Should Use

The CLI should reuse stable shared building blocks where possible rather than copying arbitrary app code.

Initial shared candidates:

- screen shell/layout component
- header component
- status overlay
- error banner
- carousel/pagination helpers
- display profile helpers
- neutral gateway/socket foundation

But the CLI should not depend on unstable app-specific code. If a piece is still Nexus-specific, it should stay in the generated app until the shared boundary is clean.

## Hooks Strategy For Generated Apps

The CLI should scaffold hook structure using the refactor pattern already established:

- core hooks
  - return state and actions
  - do not mutate app store directly
- app layer synchronization
  - `App.tsx` or screen-level effects connect core hook results into local atoms/state when needed

Generated hook folders should reflect this split from the start so new apps do not repeat the store-coupled hook problem.

## Default Generated Flow For Workflow Apps

The workflow template should generate a very small example flow that demonstrates:

- home screen
- selection/count screen
- review/setup screen
- active/session screen

The example should show:

- full-width footer actions
- header/body/footer layout
- compact card/grid behavior
- large-screen spacing override
- shared screen header with title and back affordance
- route stage sizing based on the framework mount area

The example should avoid:

- text input as a primary step
- hidden dependencies on custom routes not present in the template
- unused screens/components

## Default Generated Flow For App Scaffolds

The app template should generate a minimal but richer example than the workflow template:

- home screen
- setup/details screen
- review/session screen
- active screen
- one optional detail screen

The example should show:

- the same shared shell and profile structure as workflows
- how larger screens can add detail without replacing the whole screen system
- how to keep render decisions behind `displayProfiles.ts`

## Shared Library Direction: `shared/nexus-ui-lib`

The clean scaffold target should be a thin generated app that depends on a stable shared UI library instead of copying shell code from `nexus`.

Current repo state:

- `shared/nexus-ui-lib` already exists
- it already contains several reusable components and gateway hooks
- it is the correct long-term place for scaffolded shell primitives

The CLI should eventually prefer importing from `shared/nexus-ui-lib` when a boundary is stable, and only generate app-local code for:

- app manifest and Vite wiring
- routes/screens
- app-local atoms
- app-local feature hooks
- app-specific styling overrides

### Recommended extraction order

1. Stabilize shell primitives in `nexus-ui-lib`
- `ScreenLayout`
- `ScreenHeader`
- `BackButton`
- `InfoButton`
- `ResetButton`
- `SubjectsCarousel`
- `StatusOverlay`
- `ErrorBanner`

2. Move shared profile policy into the library
- `displayProfiles.ts`
- shared screen-size constants
- shared helpers for compact vs standard rendering

3. Stabilize shared base styling contract
- shared class naming for shell/header/footer/body
- shared CSS variables for spacing, type scale, button sizing
- optional shared base stylesheet consumed by generated apps

4. Keep app-local profile overrides small
- `App.css` for base shell sizing
- `App.compact.css` for compact behavior
- `App.1920x1080.css` for targeted large operational overrides

5. Extract only neutral hooks
- `useGatewaySocket`
- `useSystemInitialization`
- `useIdentifySensor`
- `useStartStream`
- `useStopStream`
- future store-agnostic `*Core` hooks once proven stable

6. Do not extract app-specific state ownership
- Jotai atoms remain app-local
- reset/session/result synchronization remains app-local
- workflow-specific routing remains app-local

### CLI implementation phases for a clean scaffold

Phase 1: Template from repo-local starter files
- generate app/workflow from maintained templates in-repo
- enforce the shell/profile/file contract
- avoid direct copying from live apps at generation time

Phase 2: Replace template internals with `nexus-ui-lib`
- generated apps import shared components/helpers from the library
- generated apps keep only app-local screens/styles/store

Phase 3: Library-first scaffold
- CLI generates the thinnest possible app shell
- most shell primitives come from `nexus-ui-lib`
- templates mainly provide route definitions and placeholder screens

### Definition of done for the scaffold architecture

A scaffold is considered clean when:

- app and workflow templates share the same shell contract
- all screen-size render decisions come from one helper module
- style layering is always `App.css` + `App.compact.css` + `App.1920x1080.css`
- generated screens already have title, back button, stage sizing, and footer actions
- generated hooks are store-agnostic by default
- the scaffold does not require copying code out of `nexus` or `nexus_load` manually

## CLI UX

Suggested command shape:

```bash
python -m tools.neia_cli create-app
```

Or:

```bash
./scripts/neia create-app
```

Suggested flow:

1. Prompt for metadata
2. Validate `app_id`
3. Ask for template type
4. Ask whether to install/register immediately
5. Generate files
6. Print next steps

Optional flags:

- `--yes`
- `--template workflow`
- `--layout-mode framed`
- `--app-type workflow`
- `--install`
- `--port 3004`

## Validation The CLI Should Perform

- `app_id` is filesystem-safe
- app folder does not already exist
- `mount` symbol name is unique and valid
- dev port does not conflict with common existing defaults
- manifest fields are complete
- generated files match repo conventions

## Template Quality Bar

The generated app should:

- build immediately
- appear correctly in the NEIA shell
- respect `layout_mode`
- fit the compact stage without clipping
- scale up without changing the core flow
- avoid dead code for unused screens/components

This is the most important quality rule:

The CLI must not generate “generic desktop React app plus a compact stylesheet”. It must generate an app whose structure already respects the NEIA embedded screen contract.

## Implementation Phases

### Phase 1

Create the CLI skeleton.

- decide tool location
- define command structure
- implement prompts
- write manifest generator

### Phase 2

Create the workflow template.

- app shell
- screen layout
- header/footer structure
- compact and scale-up CSS
- minimal routes and screens

### Phase 3

Create the takeover template.

- simpler full-stage app shell
- minimal sample screen/app content

### Phase 4

Extract stable shared pieces.

- move proven components/hooks into `shared`
- update templates to consume them

### Phase 5

Add registration/install integration.

- optional update to `apps/installed.json`
- optional dev port assignment
- optional post-generate build check

## Recommended First Deliverable

The first version of the CLI should only do one thing well:

- scaffold a `framed` `workflow` app that follows the compact Nexus-style contract

That is the highest-value template because it solves the current inconsistency problem directly.

## Open Decisions

- CLI implementation language
  - Python is likely simplest because the repo already has Python infrastructure
  - Node is possible but adds another tooling surface
- exact template source
  - dedicated template files
  - or code-generated strings
- whether to auto-install dependencies
- whether to auto-register in `apps/installed.json`
- whether to maintain a separate shared UI package first or later

## Recommendation

Use a Python CLI with file-based templates stored inside the repo.

Reason:

- easy to run in this repo
- easy to integrate with manifest/install logic later
- easier to keep large scaffold files readable than building them from string concatenation
