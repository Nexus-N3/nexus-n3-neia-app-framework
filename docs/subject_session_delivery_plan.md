# NEIA Subject And Session Delivery Plan

## Purpose
This note captures the next integration slice between Control Center, the Azure bridge,
`rs-nexus-os`, and `rs-nexus-neia`.

The goal is to allow Control Center to push subject groups and session configuration
down to the deployed edge environment so the NEIA dashboard can surface the available
operators and launch the correct workflow apps with pre-defined configuration.

This work applies to:
- `nexus`
- `nexus_load`

This does not currently apply to:
- `neia_voice_assistant`

## Operational Model
The runtime site is already known by deployment:
- `customer_id`
- `site_id`
- optional `site_name`

What NEIA additionally needs is:
- a current list of available subjects or subject groups for that site
- optional session configurations associated with a subject or subject group
- the ability to discover which apps are actually deployed and runnable on that device

The expected examples are:
- `ISS astronauts`
- `Lunar spacesuit testing`

In practice, the pushed payload may contain:
- a group label
- one or more subjects
- zero or more session configs

Offline mode remains valid. In offline mode, subjects may still be simple local values
such as `subject-1`, `subject-2`, and session configs may be absent or minimal.

## User Flow
The intended operator flow on the NEIA device is:

1. The main dashboard shows the current site context and the available subject groups.
2. The operator selects a subject or subject group.
3. If session configs exist for that selection, NEIA indicates that clearly.
4. Selecting the subject opens the existing apps screen.
5. The apps screen shows the deployed apps that are compatible with that subject context.
6. If one or more session configs exist, the UI exposes a clear tab or section showing
   that pre-defined sessions are available.
7. Selecting a session config launches the associated app with the config payload.
8. The app uses that config to move the operator directly into the normal sensor placement
   and activity-start flow, with earlier decisions already defined.
9. The rest of the workflow proceeds as normal operation.

## NEIA Dashboard Changes
The dashboard should gain a new operational surface for subjects.

Expected behavior:
- show current site heading
- show subject groups or available subjects as large touch-friendly cards
- show whether session configs are available for each entry
- allow direct selection into the app launcher view

For the compact `800x480` display profile:
- keep this as a primary dashboard panel, not a deep settings flow
- use one-column card layout
- prioritize large touch targets and short labels
- avoid requiring text entry
- keep supporting metadata terse

## Apps Screen Changes
The current app screen already exists. It should be extended, not replaced.

New behavior:
- preserve the current deployed-app launcher behavior
- when a subject is selected, carry that subject context into the app screen
- show only relevant apps if session configs specify allowed apps
- add a tab, badge, or other compact affordance that makes it obvious when session
  configs are available for the selected subject

For `800x480`, the recommended interaction is:
- default tab: `Apps`
- second tab: `Session Configs`

The `Session Configs` tab should:
- list available session config names
- show the associated app
- allow a single-tap launch

This is important because the screen is too small to mix app browsing and config
details in one dense layout.

## App Launch Contract
When a session config is chosen, NEIA should launch the target app with enough context
to bypass the earlier setup decisions that are already known.

The launch context should include:
- `customer_id`
- `site_id`
- selected `subject_ids`
- optional `subject_group_id`
- `session_config_id`
- `session_config_name`
- `app_id`
- workflow-specific configuration payload

The associated app then becomes responsible for:
- loading the provided config
- presenting the operator with the next practical step
- guiding the user to place sensors
- starting the activity with the pre-defined workflow inputs

On initialization, the app must also identify itself to `rs-nexus-os` so downstream
events can be attributed to the app that generated the workflow.

Minimum app identity fields:
- `app_id`
- `app_name`
- optional `session_config_id`
- optional `session_config_name`

This should be sent as part of the initialization or session-start command path, not
left for later event producers to infer.

This means:
- `nexus` must support a config-driven entry path
- `nexus_load` must support a config-driven entry path
- neither app should force the operator back through choices that were already decided
  by Control Center

## App Identity Propagation To rs-nexus-os
`rs-nexus-os` should know which app is currently driving the workflow as early as
initialization time.

That means the app-to-gateway command contract should include:
- `app_id`
- `app_name`
- `customer_id`
- `site_id`
- selected `subject_ids`
- optional `session_config_id`

Expected behavior:
- `nexus` initializes `rs-nexus-os` with `app_id = nexus`
- `nexus_load` initializes `rs-nexus-os` with `app_id = nexus_load`
- subsequent events emitted by `rs-nexus-os` should include that app identity in the
  event envelope or payload context

This is needed so analytics can answer:
- which app generated a given event stream
- which app produced a session archive
- which app was active when telemetry, lifecycle, or compute events were emitted

Recommended rule:
- `app_id` is required on workflow initialization
- `app_name` is optional but preferred for readability
- if a session config launched the flow, `session_config_id` should also be carried

For offline mode, the same rule should apply. Even if the subject list is local and
session configs are minimal, the app should still identify itself to `rs-nexus-os`
when starting the workflow.

## Subject Delivery Model
Subjects should be delivered to the edge as a site-scoped set.

The payload should support:
- direct subject list delivery
- grouped display labels
- optional config associations

Recommended shape:

```json
{
  "type": "subject_catalog_update",
  "payload": {
    "customer_id": "customer-dlr",
    "site_id": "local_home",
    "groups": [
      {
        "group_id": "iss_astronauts",
        "label": "ISS Astronauts",
        "subjects": [
          {
            "subject_id": "subject-a",
            "display_name": "Astronaut A"
          }
        ],
        "session_configs": [
          {
            "session_config_id": "config-iss-gait",
            "name": "ISS Gait Capture",
            "app_id": "nexus"
          }
        ]
      }
    ]
  }
}
```

This should be treated as the active in-memory subject/session catalog for the site.

## Session Config Delivery Model
Session configs should arrive already associated with the app they are intended for.

Minimum required fields:
- `session_config_id`
- `name`
- `app_id`
- `subject_ids` or a group association
- app-specific configuration payload

Optional fields:
- `description`
- `program_id`
- `program_name`
- `location_ids`
- `sensor_expectations`
- `algorithm_set`

`program_id` remains optional metadata. NEIA should not depend on program modeling
to render the workflow. It should render what is actually usable on the device:
- subjects
- apps
- runnable session configs

## Azure Bridge Integration
The Azure bridge should gain message handling for subject and session delivery from
Control Center.

At minimum, the bridge needs to support:
- receiving subject catalog updates
- receiving session config updates
- making those available to NEIA through a stable local API or event stream
- preserving app identity context when workflow initialization commands are forwarded
  into `rs-nexus-os`

The bridge should not require NEIA to understand raw cloud message formats directly.
It should normalize them into an edge-local contract.

## NEIA Framework API Additions
NEIA needs a way to surface both deployment state and available app capability.

Current limitation:
- `apps/installed.json` only indicates which apps are installed/deployed
- richer app metadata is stored per app in `apps/registry/<app_id>/app.json`

The framework should add a command or API endpoint that returns the deployed app catalog
with manifest metadata merged in.

Recommended response shape:

```json
{
  "apps": [
    {
      "id": "nexus",
      "name": "Nexus Session Management",
      "app_type": "service",
      "supports_online": true,
      "supports_offline": true,
      "layout_mode": "framed",
      "installed": true
    }
  ]
}
```

This is needed so:
- the dashboard can show what is actually available on the device
- subject/session configs can be matched to a deployed app
- the app launcher can filter to runnable options only

Recommended additions:
- `GET /api/v1/apps/catalog`
- or a gateway-style command such as `get_installed_app_catalog`

For NEIA, the API endpoint is probably simpler than inventing a new transport command
unless the same information must also be consumed by another runtime component.

## State Management
For the first implementation, in-memory state is acceptable inside NEIA.

That state should include:
- current subject catalog
- current session config catalog
- current merged app catalog
- selected subject or subject group

This keeps the first slice aligned with the current NEIA design, which still states
that persistence is not required yet.

## App Compatibility Rules
Session configs should only be surfaced when:
- the referenced app exists in the registry
- the app is installed on the device
- the app is one of the supported workflow apps for this feature

For the first pass:
- allow `nexus`
- allow `nexus_load`
- ignore `neia_voice_assistant`
- ignore unknown app ids

## Suggested Implementation Order
1. Add a NEIA in-memory subject/session catalog store.
2. Add Azure bridge message handlers that populate that catalog.
3. Add a NEIA API endpoint exposing the current subject/session catalog.
4. Add a NEIA API endpoint exposing the merged installed app catalog.
5. Update the dashboard to show subject groups on the main screen.
6. Update the app launcher screen to show subject context and a `Session Configs` tab.
7. Add config-driven launch support to `nexus`, including `app_id` propagation into
   `rs-nexus-os`.
8. Add config-driven launch support to `nexus_load`, including `app_id` propagation
   into `rs-nexus-os`.
9. Update `rs-nexus-os` event context rules so app identity is attached to emitted
   events after initialization.
10. Validate the compact `800x480` interaction flow on device.

## Open Questions For Tomorrow
- What exact cloud-to-edge message shape should Control Center use for subject and
  session delivery through the Azure bridge?
- Should subject delivery replace the full site catalog each time, or allow partial
  patch updates?
- Should selecting a subject immediately open the app screen, or should group selection
  expand into subjects first when multiple subjects are present?
- What is the minimal config payload each app needs to skip directly to sensor placement
  and activity start?
- Which exact initialization command should carry `app_id` and `app_name` into
  `rs-nexus-os`, and should that be standardized across all NEIA workflow apps?
- Should NEIA cache the most recent catalog across restart, or remain strictly in-memory
  for this phase?

## Summary
The next NEIA slice is to make the edge UI aware of:
- who can use the device at this site
- what session configs are available for them
- which deployed apps can execute those configs
- which app is responsible for the events emitted by `rs-nexus-os`

That should be exposed through:
- subject groups on the main dashboard
- a session-config-aware app launcher
- config-driven entry paths in `nexus` and `nexus_load`

This keeps the operator workflow compact and practical on the `800x480` device while
preserving the normal runtime behavior once the session begins.
