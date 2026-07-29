# NEIA App Framework Open-Source Refactor Plan

## 1. Current Architecture

The repository has three relevant layers:

- The FastAPI host in `neia-api/app/main.py`, which:
  - starts the Nexus N3 gateway and voice manager;
  - exposes app registry, settings, command, WebSocket, voice, and control-centre endpoints;
  - serves the compiled shell UI and registry application assets.
- The React shell in `neia-ui/src/App.tsx`, which:
  - runs the startup animation;
  - optionally intercepts startup for control-centre subject/session selection;
  - displays the current app-centric dashboard;
  - uses hash routes for `/` and `/app/:appId`;
  - dynamically loads installed application scripts and styles into `#app-mount`.
- Registry applications under `apps/registry`:
  - `nexus`: current Nexus session workflow;
  - `osteosense`: optional workflow application;
  - `neia_voice_assistant`: the application referred to as Voice Demo in the requirements.

The backend gateway abstraction already separates ZeroMQ and LavinMQ through
`neia-api/app/gateway/manager.py`. Commands go through
`POST /api/v1/gateway/command`; all raw Core events are forwarded through
`/api/v1/gateway/events`.

## 2. Current Startup and Routing Flow

The current shell flow is:

1. FastAPI starts the gateway client and voice manager.
2. The browser loads the React shell.
3. The startup sequence runs unless previously completed or an app route was
   opened directly.
4. Control-centre subject/session data can redirect the user through:
   - `SubjectSelectionScreen`
   - `SessionConfigScreen`
5. Otherwise, the app-centric `DashboardScreen` is shown.
6. Launching an installed app changes the hash to `#/app/:id`.
7. The shell fetches the manifest, loads its compiled JavaScript and CSS,
   resolves the global mount function, and mounts the app.

The Nexus application then starts its own `BrowserRouter`, with these internal
routes:

- `/`
- `/new-session`
- `/subjects`
- `/config-bootstrap`
- `/sensor-setup`
- `/add-sensor`
- `/session`
- `/assign-sensors`
- `/active-session`
- `/new-activity`
- `/activity/subject/:id`

This nested routing arrangement should be removed for the built-in application.
The main shell should own the built-in session routes.

## 3. Current Registry and Installation Mechanism

`neia-api/app/registry.py` discovers every directory under `apps/registry`,
loads its `app.json`, and compares its ID to `apps/installed.json`.

Existing operations are:

- list installed applications;
- list available applications;
- fetch an installed application;
- install by adding its ID to `installed.json`;
- uninstall by removing its ID;
- serve assets from its registry directory.

There is no separate running-state model or explicit generic stop endpoint.
The Voice Demo has route-exit cleanup, but this is application-specific.

For future catalogue compatibility, the registry loader should become one
implementation of a catalogue data-source interface. Rendering should consume
normalized catalogue records rather than reading registry assumptions directly.

## 4. Current Nexus Workflow and Reusable Behaviour

The current Nexus application already provides most of the lower-level session
lifecycle:

- Core readiness and capability ingestion.
- Subject count or externally selected subjects.
- Session naming.
- Sensor setup creation.
- `init_system`.
- Sensor discovery and connection.
- Sensor identification/location assignment.
- Stream start, warm-up, retry, official-streaming, stop, and drain states.
- Compute and intermediate-result handling.
- Sensor battery and connection tracking.
- Disconnect/reset behaviour.

The workflow is currently unsuitable as-is because:

- `apps/registry/nexus/ui/src/store/atoms.ts` initializes a two-sensor Movella
  default setup.
- `apps/registry/nexus/ui/src/hooks/useServerReadiness.ts` mutates that default
  based on the first Core sensor.
- `apps/registry/nexus/ui/src/screens/AddSensorScreen.tsx` falls back to
  hard-coded sensor types, locations, and a default algorithm.
- `apps/registry/nexus/ui/src/screens/SensorSetupScreen.tsx` silently
  substitutes `standard_loading_intensity`, the first algorithm, or
  `pass_through`.
- One selected setup is replicated across every subject rather than maintaining
  subject-owned sensor rows.
- Result hooks retain specialized compute projections, not a unified event log.
- Compute history is bounded to 50 entries per subject, but other event
  categories are not stored.
- Archive handling only receives `session_archive_exists`; there is no archive
  reference, metadata, or download mechanism.

## 5. Retain, Refactor, Replace, and Add

| Area | Treatment | Existing location or proposed destination |
|---|---|---|
| FastAPI application and static hosting | Retain and extend | `neia-api/app/main.py` |
| ZeroMQ/LavinMQ clients | Retain | `neia-api/app/gateway/` |
| Gateway runtime persistence | Retain and extend validation/error reporting | `neia-api/app/runtime_settings.py` |
| Raw command/event gateway | Retain as low-level transport | Existing gateway endpoints and manager |
| Shell startup sequence | Retain, but make Dashboard the post-startup default | `neia-ui/src/components/StartupSequence.tsx` |
| Dynamic app loader | Retain for Voice Demo and Osteosense | `neia-ui/src/utils/appRuntime.ts` |
| App cards and manifest rendering | Reuse in App Catalog with state-aware actions | `AppCard.tsx`, `useApps.ts` |
| Existing dashboard | Replace its content/navigation structure | `DashboardScreen.tsx` |
| Gateway settings panel | Relocate into Connection view and add retry/state/ports | `GatewaySettingsPanel.tsx` |
| Shell Core status hook | Replace with centralized normalized Core state | `useHostServerStatus.ts` |
| Nexus Jotai session state | Retain concepts and refactor schema | Current Nexus `store/atoms.ts` |
| Nexus gateway socket provider | Relocate and share at shell level | Current `useGatewaySocket.tsx` |
| Readiness/capability parsing | Retain parsing and move into shared Core service | Current `useServerReadiness.ts` |
| Session lifecycle hooks | Retain and relocate | Nexus stream/discovery/connect/identify hooks |
| Current default setup model | Replace | New per-subject logical workflow model |
| Specialized active results screen | Replace with event-centred results; optionally retain charts as secondary views | `ActiveSessionScreen.tsx` |
| Workflow persistence | Add | Backend `workflow_store.py` plus `workflow.json` |
| Core status/capability facade | Add | Backend `core_state_store.py` and frontend `coreApi.ts` |
| Unified event store | Add | Built-in session feature state/services |
| Archive service | Add after Core contract is confirmed | Backend Core/archive facade |
| Remote catalogue, MCP, and AI | Do not implement | Disabled navigation item only |

## 6. Proposed Frontend Routes and Component Hierarchy

Use one shell-level router, preferably `HashRouter`, so static hosting and
refreshes remain safe.

```text
App
└── CoreProvider
    └── ShellLayout
        ├── Header
        │   ├── Logo
        │   └── EndpointConnectionIndicator
        ├── MainMenu
        └── ViewContainer
            ├── /dashboard
            │   └── DashboardView
            │       ├── BuiltInSessionCard
            │       └── CoreStatusSummary
            ├── /connection
            │   └── CoreConnectionView
            ├── /capabilities
            │   └── CoreCapabilitiesView
            ├── /status
            │   └── CoreStatusView
            ├── /catalog
            │   └── AppCatalogView
            ├── /session/*
            │   └── SessionManagementFeature
            └── /app/:appId
                └── OptionalAppHost
```

Proposed built-in session routes:

```text
/session/new
/session/subjects
/session/configure
/session/discover
/session/readiness
/session/active
/session/completed
```

Workflow loading should be part of `/session/configure`, available only after
session creation and subject establishment.

The NEIA AI menu item should be rendered as a disabled control with `Planned` or
equivalent accessible text and no active route.

## 7. State-Management Changes

Use one shared Core connection/event source instead of the shell and mounted
Nexus app opening independent WebSockets.

Recommended state divisions:

- `coreConnectionState`
  - configured endpoint and ports;
  - WebSocket transport state;
  - Core readiness/availability;
  - last error and last event time.
- `coreCapabilitiesState`
  - normalized sensors;
  - algorithms;
  - loading/error/stale metadata.
- `coreStatusState`
  - Core version/readiness;
  - USB;
  - BLE backend/adapter/gateway;
  - Azure bridge;
  - active session;
  - service health.
- `catalogState`
  - normalized optional applications;
  - installed state;
  - runtime state when supported;
  - currently valid actions.
- `sessionDraftState`
  - session metadata;
  - subjects;
  - subject-owned logical sensor rows;
  - validation results;
  - loaded workflow identity.
- `sessionRuntimeState`
  - initialization;
  - discovery/connection/assignment;
  - stream lifecycle;
  - archive state.
- `eventStoreState`
  - bounded normalized events;
  - filters;
  - current page;
  - arrival counters/version.

Existing Jotai state and hooks can be moved into the shell and evolved rather
than rewritten. Core-wide state may be supplied through a provider while
session-specific atoms remain Jotai atoms.

Connection loss must update availability without clearing `sessionDraftState`,
workflows, catalogue records, or captured events.

Optional application runtime state must not be inferred solely from the active
UI route. Phase 3 must implement a framework-level, verifiable optional
application lifecycle contract that defines:

- whether launching only mounts a frontend bundle or also starts backend work;
- what constitutes `running`;
- whether the application can continue running after its view is closed;
- how a generic Stop action requests and confirms shutdown;
- how running state is recovered after a shell reload.

The contract should support at least two explicit lifecycle modes:

- `view`: the application is a frontend bundle with mount/unmount behaviour but
  no framework-managed background runtime;
- `managed`: the application implements the framework lifecycle interface and
  exposes verifiable start, stop, and status behaviour.

Lifecycle capability should be declared in the application manifest and
normalized by the registry. The API should expose authoritative lifecycle
state for managed applications, including at least:

- `stopped`;
- `starting`;
- `running`;
- `stopping`;
- `error`;
- `unknown`.

State responses should include the application ID, lifecycle mode, state,
last transition time, and error information where applicable. Start and Stop
operations must be idempotent, and a successful request must not be presented
as a confirmed state transition until the application or its runtime adapter
reports that state.

The framework should define typed frontend and backend interfaces plus
conformance tests for future optional applications. Voice Demo and Osteosense
will retain their existing view-only behaviour during this refactor and will
be updated separately to implement the managed lifecycle contract. Until an
application conforms, the catalogue may show `Open` or `Active view`, but must
not label it `Running` or offer a generic `Stop` action.

## 8. Core API and Backend Changes

Introduce a normalized NEIA-side facade instead of making UI components
interpret raw Core events independently.

Suggested endpoints:

- `GET /api/v1/core/connection`
- `PUT /api/v1/core/connection`
- `POST /api/v1/core/connection/retry`
- `GET /api/v1/core/capabilities`
- `GET /api/v1/core/status`
- `GET /api/v1/workflows`
- `POST /api/v1/workflows`
- `PUT /api/v1/workflows/{workflowId}` with explicit overwrite confirmation or
  version checking
- `GET /api/v1/sessions/{sessionId}/archive`, or a validated proxy to the
  Core-provided archive reference
- `GET /api/v1/apps/{appId}/runtime`
- `POST /api/v1/apps/{appId}/runtime/start`
- `POST /api/v1/apps/{appId}/runtime/stop`

The existing settings endpoints may initially remain as compatibility aliases.

Add a backend `CoreStateStore` as a gateway event listener. It should cache and
normalize readiness, capabilities, USB, BLE, Azure, service-health,
active-session, and archive events while retaining unknown or missing values as
`null`.

Command submission should return transport errors where possible. The current
endpoint always reports `{"status":"sent"}`, which does not prove Core
availability.

Frontend code should call modules such as:

- `services/coreApi.ts`
- `services/catalogApi.ts`
- `services/workflowApi.ts`
- `services/archiveApi.ts`

UI components should not call raw gateway endpoints directly.

## 9. Proposed `workflow.json` Schema

Store a versioned collection at a state path such as `var/workflow.json`, not
inside the source tree.

```json
{
  "schema_version": "1.0",
  "workflows": [
    {
      "id": "uuid",
      "name": "Bilateral loading",
      "description": "",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601",
      "subjects": [
        {
          "id": "subject-1",
          "display_name": "Subject 1",
          "sensors": [
            {
              "id": "logical-sensor-1",
              "sensor_type_id": "movella-dot",
              "location_id": "LEFT_ANKLE",
              "algorithm_ids": ["standard_loading_intensity"]
            }
          ]
        }
      ]
    }
  ]
}
```

Rules:

- Never store physical addresses, event history, results, archives, or
  connection state.
- Preserve stable logical IDs.
- Allow multiple algorithm IDs even if the first UI supports selecting one.
- Validate subject count and every capability reference before applying.
- Return a compatibility report instead of silently modifying unsupported
  fields.
- Reject duplicate IDs.
- For duplicate names, require rename or explicit overwrite.
- Use atomic file replacement and backend locking to avoid corrupting the file.

## 10. Proposed Event Data Model

```ts
type SessionEventCategory =
  | "system"
  | "diagnostic"
  | "realtime_compute"
  | "intermediate"
  | "consolidated";

type SessionEvent = {
  id: string;
  sequence: number;
  receivedAt: string;
  occurredAt: string | null;
  category: SessionEventCategory;
  sourceType: string;
  name: string;
  summary: string;
  subjectId: string | null;
  sensorId: string | null;
  sensorAddress: string | null;
  sessionId: string | null;
  payload: unknown;
  payloadFormat: "json" | "text" | "binary-metadata" | "unknown";
};
```

Presentation metadata should live in one map:

- System: blue.
- Diagnostic: grey.
- Real-time compute: green.
- Intermediate: orange.
- Consolidated: purple.

Each mapping should also define its label and icon/accessibility text.

Unknown event types should be retained as diagnostic or system events according
to a documented fallback rule, with their original `sourceType` preserved.

## 11. Pagination and Bounded Storage

Recommended initial policy:

- Page size: configurable constant, initially 50.
- In-memory maximum: initially 5,000 normalized events per session.
- Store events in ascending sequence internally for efficient append.
- Derive latest-first pages for display.
- Apply filters before page slicing and timeline aggregation.
- Keep the current page stable when events arrive:
  - on page 1, insert new events at the top;
  - on older pages, increment a `new events available` counter without changing
    the visible slice.
- Clamp the page only when filtering makes the current page invalid.
- Aggregate timeline buckets once event volume exceeds the available pixel
  width.
- Preserve exact individual events in the paginated log until the memory bound
  is reached.
- When trimming is necessary, remove the oldest events and show that earlier
  live history was truncated.

Completed-session review beyond the live-memory bound depends on whether Core
exposes archived event retrieval. That API is unresolved and must be confirmed
before claiming complete long-term review.

## 12. Migration Treatment for `apps/registry/nexus`

Preferred approach: staged relocation into the shell as a built-in feature.

1. Keep the current registry Nexus app operational while shared Core and session
   services are extracted.
2. Move reusable Nexus screens, components, hooks, and atoms into
   `neia-ui/src/features/session-management`.
3. Replace the nested `BrowserRouter` with shell-owned session routes.
4. Change the built-in card to launch `/session/new` directly.
5. Exclude `nexus` from catalogue API results and prevent install/uninstall
   operations for its ID.
6. Remove `nexus` from `apps/installed.json` only after feature parity and
   migration tests pass.
7. Retire `apps/registry/nexus` after the built-in implementation is verified.
   Its source history remains recoverable through Git.

During transition, the backend should explicitly classify `nexus` as built-in
so it cannot accidentally appear as an optional app or be uninstalled.

The user-facing name should come from a built-in application descriptor or
configuration constant, initially `Nexus N3 Session Management`, rather than
being embedded throughout components.

## 13. Voice Demo and Osteosense Compatibility Risks

- Voice Demo maps to the existing `neia_voice_assistant` application.
- Catalogue filtering must explicitly include the intended two optional
  applications and exclude `nexus`.
- Existing app IDs and mount names must remain unchanged:
  - `neia_voice_assistant` / `NeiaVoiceMount`
  - `osteosense` / `OsteosenseMount`
- `app_type` currently drives categories. The new catalogue must not
  accidentally hide Voice because it is `demo` or Osteosense because it is
  `workflow`.
- Optional applications depend on `/api/v1/gateway/command` and
  `/api/v1/gateway/events`; these compatibility endpoints must remain.
- Voice requires deactivation when leaving its view. That cleanup must survive
  the router refactor.
- Nexus and Osteosense contain duplicated session hooks/components. Moving only
  Nexus code must not change Osteosense imports or behaviour.
- Global CSS from dynamically loaded applications can affect the shell. Route
  and style cleanup must be regression-tested.
- Current Nexus and Osteosense mount functions do not retain and explicitly
  unmount their React roots like the Voice application does. Application
  unmount lifecycle should be standardized without changing public mount names.
- No generic backend application runtime or verified running-state contract
  currently exists. This refactor will add the contract and framework
  interfaces, but Voice Demo and Osteosense will remain view-only until they
  are updated separately to conform.
- Removing `nexus` from the installed list must not break incoming
  control-centre session configurations whose `app_id` is currently `nexus`.
  Those records must map to the built-in session route.

## 14. Unresolved Nexus N3 Core Dependencies

These contracts must be confirmed before or during the first phase:

1. Exact `server_ready` capability schema, including stable sensor and algorithm
   identifiers, display names, locations, installation state, result stages,
   and compatibility relationships.
2. Whether algorithm metadata is only nested under sensors or also available as
   an independent catalogue.
3. Core version and readiness fields.
4. USB status/capacity schema and event names.
5. BLE backend, host adapter, and gateway status schemas.
6. Azure bridge status and service-health event schemas.
7. Active-session identity/state representation.
8. Complete mapping from Core events to the five required event categories.
9. Timestamp, subject, sensor, and session identifiers available on each event.
10. Consolidated-result event name and payload.
11. Archive lifecycle event names and fields:
    - pending;
    - available;
    - failed/unavailable;
    - archive ID/name;
    - size;
    - download URL or Core endpoint;
    - authorization requirements.
12. Whether completed session events can be fetched again from Core or only
    observed live.
13. Whether `init_system` accepts multiple algorithms per logical sensor.
14. Whether a logical sensor definition must continue to be grouped as
    `local_name + number_of + locations`, or can be sent as individual logical
    rows.
15. Whether connection retry/reconfiguration has an acknowledgement beyond
    receiving `server_ready`.
16. Whether LavinMQ targets should be editable in the UI; the current
    implementation only supports switching ZeroMQ hosts.
17. The runtime-adapter mechanism future managed applications will use to
    report lifecycle transitions to the framework. The framework contract and
    API are part of this refactor; application-specific adapters are deferred
    until the optional applications are updated.

Until these are resolved, normalization layers should preserve raw payloads and
display missing status fields as unknown.

## 15. Phased Implementation Sequence

### DONE Phase 1: Contracts, Test Foundation, and Shared Core State

- Document observed Core commands and events.
- Add backend Core state normalization.
- Add a single shell-level gateway/Core provider.
- Preserve existing gateway endpoints.
- Add frontend test tooling, since the current React packages have no test
  runner.

Tests:

- Gateway event normalization unit tests.
- Missing and malformed payload tests.
- Connection state transition tests.
- WebSocket reconnect/retry tests.
- Existing FastAPI registry/settings tests.
- Shell production build and Python test suite.

### DONE Phase 2: Main Shell, Routes, Dashboard, Connection, Status, and Capabilities

- Introduce shell-owned routing and persistent layout.
- Add header endpoint/connection indicator.
- Add the required menu and disabled NEIA AI item.
- Replace the dashboard with the two-column built-in card/status layout.
- Move gateway settings into the Connection view.
- Add read-only Capabilities and Status views.

Tests:

- Default route opens Dashboard.
- Menu navigation does not reload the application.
- Endpoint and each connection state render correctly.
- Apply/retry connection behaviour.
- Status fields render healthy, warning, disconnected, and unknown states.
- Capabilities render complete, partial, empty, and disconnected payloads.
- Responsive tests at desktop, tablet, and 800x480.
- Keyboard and accessible-name checks.

### Phase 3: Optional App Catalog and Built-In Boundary

- Introduce a catalogue repository interface backed by the local registry.
- Show only Voice Demo and Osteosense as optional catalogue applications.
- Add valid state-dependent actions.
- Implement the optional-application lifecycle contract, manifest declaration,
  normalized lifecycle state model, runtime adapter interface, and lifecycle
  API.
- Add framework documentation and a conformance test kit for future managed
  optional applications.
- Treat Voice Demo and Osteosense as view-only applications until separate work
  updates them to implement the managed lifecycle contract.
- Classify Nexus as built-in and protect it from uninstall.
- Preserve dynamic optional-app loading and legacy endpoints.

Tests:

- Registry discovery and manifest normalization.
- Built-in Nexus absent from catalogue and uninstall API protected.
- Installed/available action matrix.
- Manifest lifecycle-mode validation.
- Managed runtime state transition and idempotency tests.
- Start/Stop request, acknowledgement, failure, timeout, and recovery tests
  using a test runtime adapter.
- Shell reload and authoritative runtime-state recovery tests.
- Conformance tests proving view-only applications cannot be mislabeled
  `Running` or receive a generic Stop action.
- Voice activation/deactivation on view entry and exit.
- Osteosense launch and return-to-shell smoke test.
- Style/script cleanup and repeated launch tests.
- Incoming `app_id: nexus` maps to the built-in route.

### IMPLEMENTED Phase 4: Built-In Session Workflow and Testable Results

Implemented foundation:

- Relocate the existing Nexus workflow source into `neia-ui` as a built-in
  feature that renders below the persistent NEIA header and menu.

Implemented scope:

- Retain and adapt the existing lifecycle hooks and components where
  appropriate; relocation alone does not complete this requirement.
- Introduce explicit session stages and route guards.
- Replace default setup state with an empty per-subject configuration.
- Add subject-owned sensor rows.
- Populate types, locations, and algorithms exclusively from normalized Core
  capabilities.
- Clear incompatible location and algorithm selections when sensor type
  changes.
- Block progression while any sensor row is incomplete, incompatible, or
  unsupported.
- Preserve the complete session draft across temporary Core disconnects.
- Add normalized event ingestion and bounded event state.
- Implement configurable presentation metadata for all required event
  categories.
- Add the active-session timeline, combined filters, latest-first event log,
  expandable payloads, and pagination.
- Transition the active-session view to a completed-session view without
  clearing captured events.
- Retain existing specialized computation views only as optional secondary
  content.

Tests:

- New session has zero sensors.
- Subject creation and selection.
- Add/remove rows independently for multiple subjects.
- No hard-coded fallbacks when Core capabilities are absent.
- Sensor-type changes invalidate location/algorithm correctly.
- Validation and route-guard tests.
- Correct `init_system` payload generation.
- Discovery, connect, identify, start, stop, drain, disconnect, and reset tests.
- Core disconnection does not erase the draft.
- Mapping for all five event categories.
- Unknown and malformed payload rendering.
- Latest-first stable event ordering.
- Combined type, subject, and sensor filters.
- Timeline/list filter consistency.
- Pagination page numbers at the top right.
- Incoming events on the first page versus older pages.
- Memory-bound trimming and timeline aggregation.
- Accessible non-colour event identification.
- Active-to-completed history retention.
- End-to-end system test covering session creation, per-subject sensor
  configuration, initialization, discovery, assignment, streaming, live
  events, stop/drain, and completed results.

Phase 4 exit criterion:

- A user can complete and test the full built-in Nexus session lifecycle
  against Core without relying on default sensor configuration, hard-coded
  capability fallbacks, or a separate Nexus application build.

Validation status:

- Automated workflow, lifecycle-hook, event-normalization, filtering,
  pagination, disconnect-preservation, backend, typecheck, and production-build
  checks pass.
- A live Nexus N3 Core hardware run remains the final environment-level
  acceptance check; the implementation is ready for that system test.

### Phase 5: Workflow Persistence and Compatibility Validation

- Add versioned backend workflow storage.
- Add list/load/save APIs.
- Validate workflows against subject count and current capabilities.
- Add clear incompatibility reporting.
- Offer save only from the completed-session view.
- Require confirmation for overwrite conflicts.

Tests:

- Schema parsing and version rejection.
- Atomic save and reload.
- Duplicate name/ID handling.
- No results, addresses, events, or archives persisted.
- Subject-count mismatch.
- Missing sensor/location/algorithm capability errors.
- Successful workflow population.
- Persistence across API restarts.
- Concurrent-write and invalid-file recovery tests.

### Phase 6: Archive Download, Migration Cleanup, and Release Hardening

- Implement the archive state machine after the Core contract is confirmed.
- Add download handling and error states.
- Retire the registry Nexus application after parity.
- Update documentation and deployment assets.
- Complete responsive and accessibility regression work.

Tests:

- Pending, available, failed, and unavailable archive states.
- Filename, size, and download reference handling.
- Download success, Core error, network error, and retry.
- Full acceptance-criteria end-to-end flow.
- Voice Demo and Osteosense regression suite.
- Clean install/upgrade with an existing `installed.json`.
- Production builds for the shell and optional applications.
- FastAPI packaging and static-asset serving smoke tests.

## 16. Implementation Assumptions

- Voice Demo refers to `neia_voice_assistant`.
- Workflow persistence belongs to the NEIA backend state directory, with the
  required filename `workflow.json`.
- The FastAPI service should act as the stable Core facade while preserving raw
  transport compatibility.
- The existing Jotai session logic is worth retaining and evolving.
- This refactor will implement an explicit, framework-verifiable optional
  application lifecycle contract. Running and Stop states must not be inferred
  solely from the currently mounted UI route.
- Voice Demo and Osteosense will remain view-only during this refactor and will
  be updated in later work to conform to the managed lifecycle contract.
- The current control-centre subject/session delivery flow remains supported,
  but `app_id: nexus` will launch and populate the built-in session workflow.
- No remote catalogue, object-store bundles, MCP, OpenWeb, or NEIA AI
  implementation will be included.

No implementation work should begin until this plan is approved and the
unresolved Core API dependencies needed by the relevant phase are confirmed.
