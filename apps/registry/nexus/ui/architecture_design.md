# Nexus UI Architecture Design

## Overview

The Nexus UI is a Vite + React + TypeScript single-page application for configuring subjects and sensors, starting activities, and viewing live and intermediate algorithm results from the RS Nexus edge system.

The application is designed around four architectural layers:

1. `App.tsx` and routing: global shell, route selection, header behavior, and app-wide event subscriptions.
2. Screen components: workflow-oriented pages that orchestrate user interaction.
3. Hooks: gateway-facing command senders and event subscribers that expose values and actions to the UI.
4. Jotai store atoms: lightweight shared state for session data, sensor state, battery status, and streamed results.

The UI is event-driven. Commands are sent to the backend through a REST endpoint exposed by the gateway, while events are received continuously over a shared WebSocket connection.

## Technology Stack

- React 18
- TypeScript
- React Router
- Jotai for shared client state
- Vite for build and development
- CSS in `App.css` and `index.css`

## High-Level Runtime Model

At runtime the UI works like this:

1. `main.tsx` mounts `App`.
2. `App` wraps the router with `GatewaySocketProvider`.
3. `AppContent` installs app-wide listeners:
   - server readiness
   - battery updates
   - connected sensor updates
4. Screen-level hooks send commands such as:
   - `init_system`
   - `discover_sensors`
   - `connect_subjects`
   - `identify_sensor`
   - `start_stream_for_all`
   - `stop_stream_for_all`
   - `disconnect_all`
5. Gateway events are parsed by hooks, synchronized into atoms where appropriate, and screens re-render from atom state.

This architecture keeps most screen components simple: they read state from atoms, invoke hook actions, and perform app-specific state synchronization close to the composition root or workflow screen.

## Project Structure

Path: `rs-nexus-neia/apps/registry/nexus/ui`

Important files:

```text
ui/
  architecture_design.md
  documentation.md
  package.json
  src/
    App.tsx
    App.css
    main.tsx
    index.css
    assets/
    components/
    hooks/
    screens/
    store/
      atoms.ts
```

### `src/components`

Reusable visual building blocks and small interaction widgets.

- `BackButton.tsx`: consistent back navigation affordance.
- `BarGraph.tsx`: grouped bar graph used for real-time and history visualization.
- `BatteryIcon.tsx`: battery display; shows `-` when no battery data is known.
- `BurgerMenu.tsx`: legacy component, no longer used in the header.
- `DeleteButton.tsx`, `EditButton.tsx`, `ToggleSwitch.tsx`: generic controls, some used minimally or reserved for future work.
- `InfoButton.tsx`: contextual info button placeholder.
- `ResetButton.tsx`: global reset control in the app header.
- `RetryServerButton.tsx`: retries server readiness request when the backend is unavailable.
- `ScreenLayout.tsx`: shared page layout wrapper used by screen components needing full-height content alignment.
- `SegmentedControl.tsx`: two-state mode switch used for real-time vs periodic views.
- `SensorRow.tsx`: sensor assignment row including identify/place actions and live battery display.
- `ServerStatus.tsx`: global system status indicator.
- `SubjectsCarousel.tsx`: page/subject navigator used in session and subject detail flows.

### `src/hooks`

Hooks are the main application service layer.

The current direction of the hook layer is:

- gateway transport and event parsing live in reusable hooks
- reusable hooks do not import `store/atoms`
- Jotai synchronization happens in `App.tsx`, workflow screens, or explicit app-state hooks such as reset/result hooks

This refactor is being done inside `nexus/ui` first so the existing application remains the reference implementation while hook boundaries are proven in a real workflow.

- `useGatewaySocket.tsx`
  - Owns the shared WebSocket connection.
  - Exposes `subscribe()` for event listeners.
  - Exposes `sendCommand()` which POSTs commands to `/api/v1/gateway/command`.

- `useServerReadiness.ts`
  - Requests readiness from the backend.
  - Subscribes to `server_ready`.
  - Seeds supported sensors, locations, computations, and site metadata.

- `useSystemInitialization.ts`
  - Sends `init_system`.
  - Used when finalizing session setup.

- `useDiscoverSensorsCore.ts`
  - Handles discover/connect flows.
  - Tracks overlay state for discovery/connection progress.
  - Returns discovered sensor data and flow actions without writing to atoms.

- `useConnectedSensorUpdatesCore.ts`
  - App-wide listener for `sensor_connected` and `sensor_disconnected`.
  - Returns the current connected sensor map without writing to atoms.

- `useBatteryUpdatesCore.ts`
  - App-wide listener for `battery_update`.
  - Returns latest battery status by sensor address without writing to atoms.

- `useIdentifySensor.ts`
  - Sends `identify_sensor` for a subject/location pair.

- `useStartStream.ts`
  - Sends stream start commands for all or specific subjects.

- `useStopStream.ts`
  - Sends stream stop commands for all or specific subjects.

- `useDisconnectSensorsCore.ts`
  - Sends `disconnect_all`.
  - Tracks request lifecycle and error state without writing to atoms.

#### Hook refactor pattern

For reusable sensor and gateway workflows, the codebase now prefers a store-agnostic core pattern:

- core hooks
  - no `store/atoms` imports
  - own local async state
  - parse gateway events
  - return values and actions
- app layer
  - decides what should be persisted in Jotai
  - performs `useEffect`-based synchronization where shared state is needed
  - keeps Nexus-specific state choices out of the reusable boundary

Current core examples:

- `useDisconnectSensorsCore.ts`
- `useBatteryUpdatesCore.ts`
- `useConnectedSensorUpdatesCore.ts`
- `useDiscoverSensorsCore.ts`

Current synchronization points:

- `App.tsx`
  - syncs battery updates from `useBatteryUpdatesCore.ts` into `batteryStatusesAtom`
  - syncs connected sensor updates from `useConnectedSensorUpdatesCore.ts` into `connectedSensorsAtom`
- `SessionScreen.tsx`
  - syncs discovered sensor results from `useDiscoverSensorsCore.ts` into `discoveredSensorsAtom`
- state-owning hooks that are still app-specific
  - `useServerReadiness.ts`
  - `useLatestComputeResults.ts`
  - `useLatestIntermediateResults.ts`
  - `useResetSessionState.ts`

Reasoning:

- Reusable hooks should return values and actions rather than directly mutating global store.
- Sensor workflows such as discover/connect/disconnect are useful beyond the Nexus app, but Jotai atom choices are application-specific.
- Keeping synchronization at the app layer makes ownership of shared state explicit.
- This makes it easier to move stable gateway hooks into a future shared library without dragging in Nexus state architecture.
- It also improves testability because the core workflow can be exercised without mounting the whole app store.

- `useLatestComputeResults.ts`
  - Subscribes to `compute_result`.
  - Maintains:
    - `latestComputeResultsAtom`
    - `computeResultsHistoryAtom`
  - Groups history by subject and `result_count` so left/right sensor results land in the same chart entry when available.
  - Ignores result ingestion when there is no active activity.

- `useLatestIntermediateResults.ts`
  - Subscribes to `intermediate_result`.
  - Stores:
    - latest per-sensor intermediate results
    - latest comparison entries
  - Used by periodic mode in active session and subject detail views.

- `useResetSessionState.ts`
  - Clears session-scoped atoms and returns the UI to a known baseline.

### `src/screens`

Each screen maps closely to one step of the operational workflow.

- `HomeScreen.tsx`
  - Entry screen.
  - Shows the welcome title and the centered start session action.
  - Button is disabled until the backend is ready.

- `NewSessionScreen.tsx`
  - Collects the session label/name.

- `SubjectsRequiredScreen.tsx`
  - Collects subject prefix and subject count.

- `SensorSetupScreen.tsx`
  - Selects or edits a sensor setup template.
  - Uses supported computations returned by the backend.

- `AddSensorScreen.tsx`
  - Adds a sensor definition to a setup.

- `SessionScreen.tsx`
  - Overview of all subjects in the session.
  - Shows required, connected, and placed counts.
  - Allows connect/discover per subject or for all subjects.
  - Entry point into sensor placement for each subject.
  - Synchronizes discovered sensor results from `useDiscoverSensorsCore.ts` into app state.

- `AssignSensorsScreen.tsx`
  - Displays required sensors for a selected subject.
  - Each `SensorRow` supports identify/place actions.
  - Reads app-wide connected sensor state and app-wide battery state.

- `NewActivityScreen.tsx`
  - Starts a streaming activity.
  - Allows custom activity name or quick selection.
  - Resets latest compute results before starting a new activity.

- `ActiveSessionScreen.tsx`
  - Main live monitoring screen.
  - Displays up to four subject cards per page.
  - `Real time` mode uses latest `compute_result`.
  - `Periodic` mode uses latest `intermediate_result`.
  - Each subject card exposes:
    - start/end activity per subject
    - view details
  - Footer can:
    - disconnect sensors
    - manage sensors
    - end activity / start new activity

- `SubjectActivityScreen.tsx`
  - Detailed per-subject analytics screen.
  - Real-time mode:
    - left panel shows running averages derived from compute history
    - right panel shows scrollable grouped bar history for the last 5 result groups
  - Periodic mode:
    - left panel shows intermediate per-sensor summary for the `0-6` band
    - right panel shows comparison summary for the same band
    - no bar graph in periodic mode

## Store Design

All shared state lives in `src/store/atoms.ts`.

### Session and setup atoms

- `siteNameAtom`
- `sessionNameAtom`
- `subjectPrefixAtom`
- `subjectCountAtom`
- `activeActivityAtom`
- `setupsAtom`
- `selectedSetupIdAtom`

These describe the current configured session and selected template/setup.

### Placement and connectivity atoms

- `placedSensorsAtom`
- `discoveredSensorsAtom`
- `connectedSensorsAtom`
- `batteryStatusesAtom`

These track the operational sensor lifecycle from discovered to connected to physically placed.

### Capability and readiness atoms

- `serverReadyAtom`
- `supportedSensorsAtom`
- `supportedLocationsAtom`
- `supportedComputationsAtom`

These are derived from the server readiness event and used to constrain UI choices.

### Result atoms

- `latestComputeResultsAtom`
  - Latest real-time result per subject and address.

- `computeResultsHistoryAtom`
  - Bounded per-subject history of grouped real-time results.
  - Used for the detail screen chart and running averages.

- `latestIntermediateResultsAtom`
  - Latest periodic intermediate sensor summaries per subject.

- `latestIntermediateComparisonsAtom`
  - Latest periodic intermediate comparison entries per subject.

## App-Level Shell and Global Behavior

`App.tsx` is the application composition root.

Responsibilities:

- Creates the router.
- Wraps content in `GatewaySocketProvider`.
- Sets the global header.
- Selects the header title based on route and activity state.
- Redirects to `/` if the server is not ready.
- Installs app-wide event subscriptions:
  - `useServerReadiness()`
  - `useBatteryUpdatesCore()`
  - `useConnectedSensorUpdatesCore()`
- Provides the global reset action.
- Synchronizes long-lived infrastructure event state into atoms:
  - `batteryStatusesAtom`
  - `connectedSensorsAtom`

### Header behavior

Header regions:

- Left: logo
- Center: facility/session/activity title
- Right:
  - server status
  - retry server button when unavailable
  - reset button

### Global reset behavior

The reset button is intentionally stronger than route navigation.

It:

1. checks whether any connected sensors remain in `connectedSensorsAtom`
2. sends `disconnect_all` if needed
3. clears session-scoped atoms through `useResetSessionState`
4. navigates back to `/`

This guarantees the UI can always be returned to a known baseline.

## Event and Command Management

### Command flow

Commands are sent via `sendCommand()` from `useGatewaySocket`.
This uses HTTP POST to the gateway command endpoint. The UI does not write directly to the WebSocket for commands.

Examples:

- `is_server_ready`
- `init_system`
- `discover_sensors`
- `discover_sensors_for_subjects`
- `connect_all`
- `connect_subjects`
- `identify_sensor`
- `start_stream_for_all`
- `start_stream_for_subjects`
- `stop_stream_for_all`
- `stop_stream_for_subjects`
- `disconnect_all`

### Event flow

Events are received over the shared WebSocket and fanned out to any active subscribers.

Important event types:

- `server_ready`
- `sensors_discovered`
- `sensors_discovered_for_subject`
- `sensor_connected`
- `sensor_disconnected`
- `battery_update`
- `compute_result`
- `intermediate_result`
- `error`

### Design principle

Hooks subscribe close to the domain they manage, but long-lived infrastructure events are attached globally in `App.tsx`. This avoids missed updates when a screen mounts after an event has already occurred.

That is why:

- battery updates are global
- connected/disconnected sensor updates are global
- readiness is global

while screen-specific command hooks remain local to the workflow screen using them.

Current ownership rule:

- core hooks may own local ephemeral state needed to model an edge interaction
- shared application state is written in the app layer, not inside reusable core hooks

## Screen-by-Screen Behavioral Design

### 1. Home

Purpose:
- safe entry point
- blocks progress until backend readiness

Design:
- minimal copy
- one primary action
- header still visible so system state is never hidden

### 2. Session creation flow

Screens:
- `NewSessionScreen`
- `SubjectsRequiredScreen`
- `SensorSetupScreen`
- `AddSensorScreen`

Purpose:
- collect session identity
- define subject count and naming
- define the sensor/computation arrangement that will be sent to the backend

Design:
- mostly form-driven
- linear workflow
- shared styling and layout

Compact-screen variation:

- on small `800x400` style displays, the flow is intentionally simplified
- default values are pre-applied so the user can move from Home directly to `SubjectsRequiredScreen`
- the compact flow minimizes text entry and favors click-through selection
- back navigation differs in a few places from desktop because the compact path intentionally skips some setup screens

#### Desktop vs compact flow

| Step | Desktop flow | Compact flow | Reason |
| --- | --- | --- | --- |
| Home start action | `Home -> NewSessionScreen` | `Home -> SubjectsRequiredScreen` | compact mode skips avoidable text entry and applies defaults |
| Session naming | explicit session naming screen | default session naming is applied automatically | small screens favor speed and fewer keyboard interactions |
| Subjects required back action | back to `NewSessionScreen` | back to `Home` | compact mode skipped session naming, so back should follow the actual path taken |
| Form inputs | visible where part of the normal setup flow | hidden or reduced where defaults are safe | constrained environments benefit from click-through interactions |
| Footer actions | more actions may remain visible together | secondary actions may be reduced or hidden | preserve the primary operational action and keep touch targets large |

### 3. Session overview and sensor assignment

Screens:
- `SessionScreen`
- `AssignSensorsScreen`

Purpose:
- connect physical devices to logical subject rows
- confirm sensor placement state before activity start

Design:
- subject-based overview first
- per-subject drill-down for sensor placement
- battery and connection status are part of operational readiness

### 4. Activity monitoring

Screens:
- `NewActivityScreen`
- `ActiveSessionScreen`
- `SubjectActivityScreen`

Purpose:
- start streaming
- inspect live or periodic outputs
- drill into one subject for detailed interpretation

Design:
- subject cards for broad monitoring
- dedicated detail screen for analysis
- segmented controls switch between real-time and periodic result sources

## Result Modeling Design

### Real-time results

Real-time results are sensor-level and location-specific.

The UI stores:
- latest value per subject/address for active-session cards
- grouped history for detail view

Grouping rule:
- if `result_count` is present, left/right sensor results with the same count are grouped together
- if not, fallback grouping still preserves data rather than dropping events

### Intermediate results

Intermediate results are subject-level periodic summaries.

The UI separates them into:
- per-sensor summaries
- comparison entries

This separation is important because periodic mode has two needs:
- active session subject cards need sensor-level summaries only
- periodic subject detail needs both sensor summaries and comparison summaries

## Styling and Layout Design

Styling is primarily centralized in `App.css`.

Patterns:

- one application shell
- screen-specific sections grouped in the same stylesheet
- consistent typography, spacing, button style, and panel treatment
- reusable utility classes for primary/secondary colors and spacing

`index.css` provides document-level normalization and scrollbar styling.

`styles/App.compact.css` provides compact-screen overrides for constrained devices and operator displays.

### Compact-screen design rationale

The compact design is not just a scaled-down desktop UI. It is a simplified operational flow for constrained environments.

Goals:

- reduce operator effort on small touch targets
- keep the main workflow readable at a distance
- minimize keyboard usage and text entry
- make the next action obvious at every step

Screen-size principle:

- larger screens can support more complex features, richer context, and more simultaneous controls without overwhelming the operator
- smaller screens need more standardized flows, fewer branching choices, and stronger prioritization of the next action
- compact mode therefore trades flexibility for clarity, speed, and operational consistency

Design choices:

- larger primary buttons
  - footer CTAs are intentionally tall and easy to hit on small touch displays
  - high-priority actions anchor to the bottom of the screen where possible
- simplified click-through flow
  - compact mode skips avoidable text-input screens when defaults are safe
  - the operator advances through a standardized sequence instead of filling forms
- less typing
  - compact views hide or de-emphasize text inputs where defaults are acceptable
  - subject naming and session naming default to predictable values
- denser but more structured cards
  - compact cards are reorganized rather than uniformly shrunk
  - content is reduced to the operational minimum needed for the current step
- fewer concurrent actions
  - compact screens remove lower-priority controls when they compete with the main workflow
  - examples include removing secondary per-subject actions in compact activity monitoring

This means compact mode is intentionally a different interaction design, not a pixel-for-pixel responsive variant of desktop.

## Architectural Strengths

- Clear separation between screens, hooks, and store.
- Gateway interaction is centralized through one socket/context hook.
- Jotai keeps shared state simple and explicit.
- Event-driven updates fit the edge streaming model well.
- Global listeners for long-lived events avoid screen-mount timing bugs.
- The hook refactor creates a cleaner path to a future shared UI/hook library without breaking the reference app first.
- State ownership is becoming more explicit because reusable gateway hooks no longer mutate Jotai directly.
- Compact mode is now treated as a constrained-environment workflow, which produces clearer operator behavior than a pure responsive shrink.

## Architectural Risks and Tradeoffs

- Some logic is duplicated between screens for metric derivation.
- `App.css` is large and centralized, which is convenient but can become harder to maintain as the UI grows.
- Some legacy components remain in the tree and are no longer used directly.
- The current data model is optimized for the present workflow rather than full generalized analytics.

## Recommended Future Improvements

- Extract derived metric calculations into dedicated utility modules.
- Separate result-domain state into a dedicated store module.
- Split `App.css` into screen- or domain-scoped stylesheets.
- Add typed gateway message definitions shared between backend contract docs and frontend parsing.
- Add a formal error/banner system at the app shell level instead of screen-local duplication.
- Continue moving remaining gateway-facing hooks toward the same store-agnostic core pattern before copying stable APIs into `shared/nexus-ui-lib`.
- Document compact-flow-specific route decisions separately from desktop flow so skipped-screen behavior remains explicit.
- Add integration tests around:
  - connection/disconnection
  - battery propagation
  - compute/intermediate result rendering
  - reset behavior

## Summary

The Nexus UI is a workflow-oriented, event-driven React application built around a shared gateway connection, Jotai atoms for state, and screen-level orchestration hooks. Its architecture is optimized for edge-device monitoring where commands are explicit, results stream continuously, and the UI must remain synchronized with backend state across navigation boundaries.
