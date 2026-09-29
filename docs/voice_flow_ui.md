# Voice Flow UI

This document describes the UI-owned voice flow architecture used by `neia_voice_assistant`.

## Overview

The voice state machine and prompt sequencing are owned by the app UI:
- `apps/registry/neia_voice_assistant/ui/src/App.tsx`

The API voice layer is treated as an engine/capability service:
- STT wakeword/transcript event source
- TTS speak endpoint
- gateway command passthrough

## Runtime mode

Set in `neia-api/.env`:

```bash
NEIA_VOICE_FLOW_MODE=ui
```

With `ui` mode:
- backend still emits `voice_wakeword`, `voice_transcript`, `voice_command`
- backend does not run orchestration flow transitions/prompts
- UI drives flow transitions and all user-facing prompts

`backend` mode remains available for compatibility.

## UI flow states

Primary states used by the app:
- `idle`
- `awaiting_server_ready`
- `awaiting_session_owner`
- `awaiting_session_label`
- `awaiting_subject_count`
- `awaiting_sensor_setup`
- `awaiting_sensor_locations`
- `awaiting_algorithm`
- `initializing`
- `awaiting_sensors_on`
- `discovering`
- `connecting`
- `identifying`
- `awaiting_identify_confirm`
- `awaiting_start_stream`
- `streaming_starting`
- `streaming`
- `stopping`
- `awaiting_disconnect_confirm`
- `disconnecting`
- `error`

## Event contract consumed by UI

WebSocket: `/api/v1/gateway/events`

Consumed event types:
- `voice_wakeword`
- `voice_transcript`
- `voice_command`
- `server_ready`
- `system_initialized`
- `sensors_discovered`
- `sensor_connected`
- `sensor_identified`
- `stream_started`
- `stream_stopped`
- `sensor_disconnected`
- `compute_result`
- `error`

## API endpoints used by UI

Voice:
- `POST /api/v1/voice/enable`
- `POST /api/v1/voice/deactivate`
- `POST /api/v1/voice/reset`
- `GET /api/v1/voice/status`
- `POST /api/v1/voice/speak`

Gateway:
- `POST /api/v1/gateway/command`

## Speaking policy

UI uses API TTS first, browser speech as fallback:
- API success: spoken via backend engine
- API failure/unavailable: browser `speechSynthesis`

This allows cloud deployments (no local speaker) to still provide spoken prompts from the browser.

## Debug checklist

1. Verify flow mode:
```bash
curl -s http://localhost:8080/api/v1/voice/status
```
Expect `"flow_mode": "ui"`.

2. Verify three dev processes for app dev:
- `neia-api` on `8080`
- `neia-ui` on `3000`
- `apps/registry/neia_voice_assistant/ui` on `3002`

3. If no speech:
- confirm `tts_enabled` in `/voice/status`
- check `last_error` in `/voice/status`
- test direct TTS:
```bash
curl -s -X POST http://localhost:8080/api/v1/voice/speak \
  -H 'Content-Type: application/json' \
  -d '{"text":"voice test","wait":true}'
```
