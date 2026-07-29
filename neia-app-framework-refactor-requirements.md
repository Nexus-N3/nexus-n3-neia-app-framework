# NEIA App Framework Open-Source Refactor Requirements

## 1. Purpose

Refactor the NEIA App Framework so that it can support a general open-source release.

The current framework is centred around installing and launching user-created applications. The revised framework shall instead be centred around a built-in Nexus N3 session-management application, with optional applications presented through a secondary app catalogue.

This document defines the required UI structure and functional changes. It does not prescribe a specific technical implementation.

## 2. Scope

The refactor covers:

- The main NEIA UI layout.
- The NEIA dashboard.
- Nexus N3 Core connection management.
- Display of Nexus N3 capabilities and status.
- The local application catalogue.
- A new built-in session-management application.
- Workflow creation, loading and saving.
- Session event visualisation.
- Completed-session archive access.
- A disabled placeholder for future NEIA AI provisioning.

The following are outside the scope of this refactor:

- Moving application bundles into an online object store.
- Implementing the future remote `app_catalog.json`.
- Implementing MCP or OpenWeb integration.
- Implementing NEIA AI provisioning.
- Removing the existing Voice Demo or Osteosense applications from `apps/registry`.

## Reuse of Existing Components

The refactor shall build on the current NEIA App Framework implementation rather than replacing it wholesale. Existing components, services, state-management logic, API integrations, application lifecycle mechanisms and session workflow elements shall be reused, updated or reorganised where appropriate. New components shall only be introduced where the existing implementation cannot reasonably support the revised requirements. The implementation plan shall identify which current components will be retained, modified, relocated or replaced, with preference given to incremental changes that preserve existing working behaviour.

## 3. Current Behaviour

The current NEIA UI:

- Runs through a startup sequence.
- Opens a dashboard.
- Allows users to install, uninstall and launch applications.
- Treats user-created applications as the main focus of the interface.
- Provides connection settings for connecting to a Nexus N3 Core instance.

The Nexus N3 Core connection may point to:

- A local Core instance.
- A reachable remote Core instance.
- An mDNS hostname such as `nexus-n3-master.local`.

The current Nexus application is located at:

```text
apps/registry/Nexus
```

Its existing stepped session process shall be used as the functional starting point for the new session-management application.

# Part A: Main NEIA UI

## 4. Main Layout

The main NEIA UI shall contain four primary layout components:

- Header
- Main menu
- View container
- Nexus N3 connection state

### 4.1 Header

The header shall display:

- The NEIA or Nexus N3 logo on the left.
- The currently configured Nexus N3 Core endpoint on the right.
- A visible indication of whether NEIA is connected to that endpoint.

Example connection states may include:

- Connected - green dot
- Connecting - flashing green dot
- Disconnected - orange dot
- Connection error - red dot

### 4.2 Main Menu

The main menu shall appear below the header.

It shall contain the following menu items:

- Dashboard
- Nexus N3 Connection
- Nexus N3 Capabilities
- Nexus N3 Status
- App Catalog
- NEIA AI

The Dashboard shall be the default selected view.

The NEIA AI  item shall be visible but disabled.

The disabled item shall indicate that the feature is planned but not currently available.

### 4.3 View Container

The view container shall render the view associated with the selected menu item.

Changing menu items shall not reload the entire application.

## 5. Dashboard View

The dashboard shall provide simple system awareness and access to the built-in session-management application.

It shall not attempt to reproduce the full Nexus N3 Core administration application.

### 5.1 Dashboard Layout

The main dashboard content shall use a single-row, two-column layout.

The left column shall contain:

- The built-in Nexus N3 Session Management application card.

The right column shall contain:

- Nexus N3 Core connection and status information.

The layout may become vertically stacked on smaller screens.

### 5.2 Session Management Application Card

The built-in application shall initially be named:

```text
Nexus N3 Session Management
```

The implementation may use a different internal identifier, but the user-facing name shall be configurable so that it can be renamed later without structural changes.

The application card shall:

- Be permanently available.
- Launch the session-management workflow.
- Not provide an uninstall action.
- Not depend on the application catalogue.
- Not be treated as an optional registry application.

### 5.3 Core Status Summary

The dashboard status area shall provide a concise summary of the connected Nexus N3 Core.

At minimum, it shall display:

- Configured Core endpoint.
- Core connection state.
- Core availability.
- USB storage state.
- BLE backend.
- Azure bridge state.

The status area should clearly distinguish:

- Available or healthy states.
- Warning states.
- Disconnected or unavailable states.
- Unknown states.

Missing data shall be shown as unknown rather than causing the view to fail.

## 6. Nexus N3 Capabilities View

The Nexus N3 Capabilities view shall display capabilities reported by the connected Core instance.

At minimum, it shall show:

- Available sensor types.
- Available algorithm types.

For each sensor type, the view should show available metadata where provided by Core, including:

- Sensor identifier.
- Display name.
- Supported locations.
- Supported algorithms.
- Availability or installation state.

For each algorithm, the view should show available metadata where provided, including:

- Algorithm identifier.
- Display name.
- Compatible sensor types.
- Result stages or output types, where available.

This view shall be read-only.

The view shall handle an unavailable Core connection without crashing.

## 7. Nexus N3 Status View

The Nexus N3 Status view shall provide more detail than the dashboard status summary.

It shall display, where available:

- Core endpoint.
- Core connection state.
- Core version.
- Core readiness state.
- USB disk connection and capacity information.
- Active BLE backend.
- BLE gateway or host adapter state.
- Azure bridge connection state.
- Active session state.

Relevant service health information exposed by Core.

The status view shall not expose administrative operations unless they are explicitly required in a later change.

## 8. App Catalog View

The App Catalog shall display optional applications.

For this refactor, the only optional applications are:

- Voice Demo
- Osteosense

These applications shall continue to reside in:

```text
apps/registry
```

The catalogue shall distinguish between:

- Installed applications.
- Available applications.
- Running applications, where applicable.

Supported actions may include:

- Install
- Launch
- Stop
- Uninstall

Actions shall only be shown when valid for the current application state.

The built-in Nexus N3 Session Management application shall not appear as an uninstallable catalogue application.

### 8.1 Future Catalogue Compatibility

The catalogue implementation shall be structured so that its data source can later be replaced by:

- A remotely hosted `app_catalog.json`.
- Downloadable application bundles stored in an object store.

This future remote catalogue shall not be implemented as part of the current refactor.

Catalogue rendering and catalogue data loading should remain sufficiently separated to support this future change.

## 9. Nexus N3 Connection View

The Nexus N3 Connection view shall allow the user to configure the Core endpoint used by NEIA.

The user shall be able to enter an endpoint such as:

```text
localhost
```

or:

```text
nexus-n3-master.local
```

The connection view shall provide:

- Endpoint input.
- Any required protocol or port configuration.
- A connect or apply action.
- Current connection state.
- Connection error feedback.
- A way to retry the connection.

The configured endpoint shall be retained across application restarts using the framework's existing settings mechanism or an equivalent persistent configuration mechanism.

Changing the connection shall refresh Core-dependent views and capabilities.

## 10. NEIA AI Provisioning Placeholder

The main menu shall include:

```text
NEIA AI Provisioning
```

The item shall be disabled.

No provisioning, MCP or OpenWeb functionality shall be implemented in this refactor.

The design shall leave space for a future view that may provide:

- OpenWeb access.
- MCP server configuration.
- LLM-assisted session control.
- LLM-assisted diagnostics.

# Part B: Nexus N3 Session Management

## 11. Application Role

The new session-management application shall be a built-in NEIA application.

It shall replace the current Nexus application as the main workflow for configuring and running Nexus N3 sessions.

The current application at:

```text
apps/registry/Nexus
```

shall be reviewed and reused where appropriate.

The new implementation should preserve valid existing session-control behaviour while restructuring the UI and removing assumptions based on default sensor configurations.

## 12. Session Workflow

The application shall remain a stepped workflow.

The workflow shall include the following logical stages:

- Session creation
- Subject selection or creation
- Workflow loading or sensor configuration
- Sensor discovery and connection
- Session readiness
- Active session
- Session completion and results

The exact labels may follow the existing Nexus application where appropriate.

Navigation rules and validation shall prevent the user from advancing when required information is incomplete.

## 13. No Default Sensor Configuration

The sensor setup stage shall not create or load a default sensor configuration.

A new session shall begin with no sensors assigned unless the user loads a saved workflow.

The UI shall not assume:

- A default sensor type.
- A default sensor count.
- A default body location.
- A default algorithm.
- A default subject-to-sensor mapping.

## 14. Subject Configuration

The user shall select or create the required number of subjects during the subject stage.

The sensor configuration interface shall then display configuration areas for the selected subjects.

Each sensor configuration shall belong to exactly one subject.

The interface shall make the active subject clear when configuring sensors.

## 15. Sensor Configuration

For each subject, the user shall be able to add one or more sensor rows.

Selecting an Add Sensor action shall create a new editable row.

Each sensor row shall contain at least:

- Sensor type.
- Sensor location.
- Assigned algorithm or algorithms.
- Remove action.

The row may later include physical sensor assignment or discovered device information, but workflow definitions shall be based on logical sensor configuration rather than a specific physical device address.

### 15.1 Sensor Type

The sensor type shall be selected from the sensor capabilities reported by the connected Core.

No hard-coded sensor list shall be used when Core capability data is available.

### 15.2 Sensor Location

The location shall be selected from the locations supported by the selected sensor type.

Changing the sensor type shall refresh the available locations.

An invalid previous location shall be cleared if the sensor type changes.

### 15.3 Algorithm Assignment

The algorithm choice shall be limited to algorithms supported by the selected sensor type.

Changing the sensor type shall refresh the available algorithms.

Invalid previous algorithm selections shall be cleared if the sensor type changes.

The implementation shall support at least one algorithm per sensor.

The data model should not prevent support for multiple algorithms per sensor if Core supports this.

### 15.4 Validation

A sensor row shall not be considered complete until it contains:

- A sensor type.
- A valid location.
- At least one valid algorithm assignment.

The user shall not be allowed to advance to session readiness while invalid or incomplete sensor rows remain.

# Part C: Workflows

## 16. Workflow Concept

A workflow is a reusable logical session configuration.

A workflow shall define sensor and algorithm combinations for one or more subjects.

It shall not represent:

- A completed session.
- Session result data.
- A specific connected device address.
- A stored session archive.

A workflow may contain:

- Workflow name.
- Workflow identifier.
- Workflow schema version.
- Description.
- Subject definitions.
- Logical sensor definitions.
- Sensor locations.
- Algorithm assignments.
- Creation date.

Last modified date.

## 17. Loading Workflows

A saved workflow may be loaded after:

- The session has been created.
- The required subject configuration has been established.

Loading a workflow shall populate the sensor and algorithm configuration.

The application shall validate that the workflow is compatible with:

- The selected number of subjects.
- The capabilities reported by the connected Core.
- Available sensor types.
- Supported locations.
- Supported algorithms.

Unsupported or missing capabilities shall be clearly reported.

The application shall not silently substitute an unsupported sensor, location or algorithm.

## 18. Saving Workflows

The user shall be offered the option to save the current workflow after a session has completed.

Saved workflows shall be stored through a workflow data file named:

```text
workflow.json
```

The implementation may store a list of workflows in this file or use the file as an index, provided that the chosen structure is documented and versioned.

Saving a workflow shall not include session results or event payloads.

The application shall prevent accidental silent overwriting of another workflow with the same name or identifier.

# Part D: Active Session Results

## 19. Event-Centred Results View

The active session results screen shall be centred around events received from Nexus N3 Core.

It shall contain:

- Event timeline.
- Event filters.
- Paginated event log.
- Expandable event details.

The results view shall be suitable for both active and completed sessions.

## 20. Event Types

The UI shall support the following event categories:

- System events
- Diagnostic events
- Real-time compute results
- Intermediate results
- Consolidated results

The initial colour mapping shall be:

| Event type | Colour |
|---|---|
| System | Blue |
| Diagnostic | Grey |
| Real-time compute | Green |
| Intermediate | Orange |
| Consolidated | Purple |

The colour mapping should be implemented as configurable presentation metadata rather than duplicated throughout components.

Colour shall not be the only method used to identify an event type. Labels, icons or accessible text shall also be provided.

## 21. Event Timeline

A thin event timeline shall appear at the top of the active results view.

The timeline shall be a simple bar-based visualisation of received events.

Each timeline element shall:

- Represent one event or an aggregated event interval.
- Use the colour associated with its event type.
- Preserve chronological order.
- Provide enough metadata to identify the event type.

The timeline shall update as new events are received.

The implementation shall avoid unbounded rendering as event volume increases. Aggregation or windowing may be used where necessary.

## 22. Event Log

Events shall be displayed below the timeline in a list resembling a log stream.

The latest events shall appear at the top.

Each collapsed event entry shall be minimal.

It should display at least:

- Timestamp.
- Event type.
- Subject, when available.
- Sensor, when available.
- Short event name or summary.

Selecting or expanding an event shall show its full received payload.

The expanded payload shall be displayed in a readable structured format, such as formatted JSON.

Malformed or non-JSON payloads shall still be viewable.

## 23. Event Filtering

The event list shall provide a minimum set of filters.

The user shall be able to filter by:

- Event type.
- Subject.
- Sensor.

The event-type filter shall support the five defined event categories.

Filters may be combined.

The UI shall make active filters visible and provide a clear-filter action.

Filtering shall apply consistently to both:

- The event list.
- The event timeline, unless the UI explicitly indicates otherwise.

## 24. Pagination

The event log shall be paginated.

Pagination controls shall:

- Appear at the top right of the event-list view.
- Display page numbers.
- Allow the user to move between pages.
- Preserve the latest-first ordering.
- Continue to behave predictably while new events arrive.

The page size shall be configurable or defined as a constant.

When the user is viewing the first page, new events may be inserted at the top.

When the user is viewing an older page, incoming events shall not unexpectedly replace the currently visible entries.

## 25. Event Storage and State

The UI shall not rely solely on visible rendered components as the event store.

Received events shall be maintained in application state or an appropriate event-store abstraction.

The implementation shall define a bounded-memory strategy for long-running sessions.

The UI shall preserve event history needed for:

- Pagination.
- Filtering.
- Timeline rendering.
- Completed-session review.

# Part E: Session Completion

## 26. Completed Session View

When a session completes, the application shall retain:

- The event timeline.
- The event filters.
- The event log.
- Expandable event payloads.
- Pagination.

The active-session results view shall transition into a completed-session view without discarding the received event history.

## 27. Session Archive Download

When Core reports that the session archive has been stored, the completed-session view shall provide an archive download action.

The UI shall display:

- Archive availability.
- Archive name or identifier.
- Archive size, where available.
- Download action.
- Download error state.

The download action shall use the archive endpoint or reference returned by Nexus N3 Core.

The UI shall not assume that an archive is immediately available at the exact moment the session stops.

It shall support:

- Archive pending.
- Archive available.
- Archive failed.
- Archive unavailable.

## 28. Save Workflow Action

The completed-session view shall provide an action to save the session's logical configuration as a reusable workflow.

The action shall save:

- Subjects.
- Logical sensor types.
- Sensor locations.
- Algorithm assignments.

It shall not save:

- Physical device identifiers unless explicitly required later.
- Session event history.
- Session archive data.
- Runtime connection state.

# Part F: Architecture and Compatibility

## 29. Separation of Concerns

The implementation should separate:

- Main navigation and layout.
- Nexus N3 connection management.
- Core API access.
- Capability data.
- Status data.
- App catalogue data.
- Session workflow state.
- Workflow persistence.
- Event ingestion.
- Event filtering and pagination.
- Archive download handling.

UI components should not call Core endpoints directly where a shared API or service layer can be used.

## 30. Core Disconnection Behaviour

The UI shall remain usable when Nexus N3 Core is unavailable.

On disconnection:

- The current endpoint shall remain visible.
- Connection-dependent actions shall be disabled.
- The application shall show a clear disconnected state.
- Existing locally available catalogue information shall remain viewable.
- Existing saved workflows shall remain viewable.
- The UI shall provide a retry path.

The application shall not clear an in-progress workflow solely because the Core connection is temporarily lost.

## 31. Existing Application Compatibility

The Voice Demo and Osteosense applications shall remain discoverable from `apps/registry`.

The refactor should avoid breaking their existing install and launch mechanisms unless changes are explicitly documented in the implementation plan.

The existing Nexus application may be:

- Refactored into the built-in session-management application.
- Used as the basis for a new built-in module.
- Retired after equivalent functionality has been migrated.

The implementation plan shall identify the preferred migration approach.

## 32. Accessibility and Responsive Behaviour

The main layout shall support normal desktop use.

It should also remain usable at tablet-sized widths.

At minimum:

- Menu items shall remain identifiable.
- Dashboard columns may stack vertically.
- Event payloads shall not break the layout.
- Timeline colours shall have text or icon equivalents.
- Disabled menu items shall be distinguishable.
- Interactive controls shall have clear labels.

# Part G: Acceptance Criteria

## 33. Main UI Acceptance Criteria

The refactor is complete when:

1. NEIA opens to the new dashboard.
2. The dashboard is no longer centred around optional applications.
3. The connected Nexus N3 Core endpoint is shown in the header.
4. The main menu contains all required menu items.
5. NEIA AI Provisioning is visible and disabled.
6. The dashboard displays the built-in session-management card.
7. The built-in session-management application cannot be uninstalled.
8. The dashboard displays a Core status summary.
9. Capabilities and status have separate views.
10. Voice Demo and Osteosense remain available through the App Catalog.
11. The user can change the Nexus N3 Core endpoint.

## 34. Session Management Acceptance Criteria

The session-management refactor is complete when:

1. A new session starts without default sensors.
2. The user can configure one or more subjects.
3. The user can add sensor rows for each subject.
4. Sensor types come from Core capabilities.
5. Locations are limited to those supported by the sensor.
6. Algorithms are limited to those supported by the sensor.
7. Invalid sensor configurations prevent workflow progression.
8. A saved workflow can populate sensor and algorithm configuration.
9. A workflow can be saved after session completion.
10. Workflows are persisted through `workflow.json`.

## 35. Event View Acceptance Criteria

The event view is complete when:

1. Events appear in latest-first order.
2. The five required event categories are supported.
3. Event categories use the required colour mapping.
4. A thin event timeline appears above the log.
5. Event entries can be expanded to show their payload.
6. Events can be filtered by type.
7. Events can be filtered by subject.
8. Events can be filtered by sensor.
9. The event list is paginated.
10. Page numbers appear at the top right of the event list.
11. Event history remains visible after the session completes.
12. The session archive can be downloaded when available.
13. The completed workflow can be saved.

# Part H: Requested Codex Planning Output

Before making code changes, inspect the existing repository and produce an implementation plan.

The plan shall include:

1. A summary of the current NEIA architecture.
2. The current startup and routing flow.
3. The current application registry and installation mechanism.
4. The current Nexus application workflow.
5. Existing Nexus N3 Core API and event integrations.
6. Components that can be retained.
7. Components that should be refactored.
8. Components that should be replaced.
9. Proposed frontend routes and component hierarchy.
10. Proposed state-management changes.
11. Proposed Core API client changes.
12. Proposed workflow schema for `workflow.json`.
13. Proposed event data model.
14. Proposed pagination and bounded event-storage strategy.
15. Migration treatment for `apps/registry/Nexus`.
16. Compatibility risks for Voice Demo and Osteosense.
17. A phased implementation sequence.
18. Tests required for each phase.
19. Any assumptions or unresolved API dependencies.

Do not implement the refactor until the plan has identified the relevant files and current behaviour.

Prefer incremental changes that keep the application runnable between phases.

Do not introduce a remote app catalogue, MCP integration or NEIA AI implementation as part of this work.
