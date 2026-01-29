# NEIA Step API Contract (v1)

This document defines the generic step model and how apps should map each step
into the concrete gateway commands/events. Steps are intentionally generic; apps
choose which command variant to send within a step.

## Conventions
- Commands/events are rs-nexus-os message types.
- Payloads are passed through to the gateway.
- Steps that do not require gateway calls are UI-only.

## Step List + Mappings

### 0) Check Server Readiness
- Command: `CMD_IS_SERVER_READY`
- Event: `EVT_SERVER_READY`
- Purpose: confirm core is ready and learn supported sensors/algorithms/gateways.

### 1) Who + Session Label (UI-only)
- Input: `init_label` string in the format `who_session` (e.g., `Anna_baseline`).
- Output: stored for later use in `CMD_INIT_SYSTEM`.

### 2) Subjects (UI-only)
- Input: subject count and IDs.
- Output: subject list used in `CMD_INIT_SYSTEM` payload.

### 3) Sensors (UI-only)
- Input: sensor type(s) per subject.
- Source of truth: `EVT_SERVER_READY.supported_sensors`.

### 4) Locations (UI-only)
- Input: locations per sensor.
- Source of truth: supported sensor locations (from `EVT_SERVER_READY`).

### 5) Algorithms + Init System
- Command: `CMD_INIT_SYSTEM`
- Event: `EVT_SYSTEM_INITIALIZED`
- Payload: subjects + init_label

Example payload:
```
{
  "init_label": "Anna_bdc",
  "subjects": [
    {
      "subject_id": "subject1",
      "sensors": [
        {
          "local_name": "Movella DOT",
          "number_of": 2,
          "compute_algorithm": {
            "name": "standard_loading_intensity",
            "inputs": { "gravity": 9.80665 }
          },
          "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
        }
      ]
    }
  ]
}
```

### 6) Discover
- Command variants:
  - `CMD_DISCOVER_SENSORS` (all subjects)
  - `CMD_DISCOVER_SENSORS_FOR_SUBJECTS` (selected subjects)
- Event:
  - `EVT_SENSORS_DISCOVERED`
  - `EVT_SENSORS_DISCOVERED_FOR_SUBJECT`

### 7) Connect
- Command variants:
  - `CMD_CONNECT_TO_ALL`
  - `CMD_CONNECT_SUBJECTS`
- Event: `EVT_SENSOR_CONNECTED`

### 8) Identify Sensors (Assign Locations)
- Command: `CMD_IDENTIFY_SENSOR`
- Payload: `subject_id`, `location`
- Event: none expected (sensor flashes)

### 9) Start Stream + Live Results
- Command variants:
  - `CMD_START_STREAM_FOR_ALL`
  - `CMD_START_STREAM_FOR_SUBJECTS`
- Event: `EVT_STREAM_STARTED`
- Live events: `EVT_COMPUTE_RESULT`, `EVT_INTERMEDIATE_RESULT`

### 10) Stop Stream
- Command variants:
  - `CMD_STOP_STREAM_FOR_ALL`
  - `CMD_STOP_STREAM_FOR_SUBJECTS`
- Event: `EVT_STREAM_STOPPED`

### 11) View Final Results (UI-only)
- Available when all subjects are stopped.

### 12) Disconnect
- Command variants:
  - `CMD_DISCONNECT_ALL`
  - `CMD_DISCONNECT_SUBJECTS`
- Event: `EVT_SENSOR_DISCONNECTED`

### 13) Repeat or Re-Initialize (UI-only)
- Repeat: return to Step 9 with same subjects/sensors.
- Re-Initialize: return to Step 1 with new session/subjects.

## Errors
- Any command may emit `EVT_ERROR` with a payload string or dict.

## Notes
- No persistence across runs.
- If using LavinMQ, purge queues at start of a session.
- Steps are generic: apps select the appropriate command variant per step.
