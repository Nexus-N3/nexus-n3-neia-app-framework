from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR
from .control_center_store import ControlCenterStore
from .core_state_store import CoreStateStore
from .gateway.manager import create_gateway_manager
from .registry import AppRegistry
from .runtime_settings import save_gateway_runtime_settings
from .voice import create_voice_manager

BUILT_IN_APP_IDS = {"nexus"}

registry = AppRegistry(excluded_app_ids=BUILT_IN_APP_IDS)
gateway_manager = create_gateway_manager()
control_center_store = ControlCenterStore()
core_state_store = CoreStateStore()
voice_manager = create_voice_manager(
    BASE_DIR,
    send_command=gateway_manager.send_command,
    broadcast_event=gateway_manager.broadcast_event,
)
gateway_manager.add_event_listener(voice_manager.handle_gateway_event)
gateway_manager.add_event_listener(control_center_store.handle_gateway_event)
gateway_manager.add_event_listener(core_state_store.handle_gateway_event)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await gateway_manager.start()
    voice_manager.start_if_enabled()
    yield
    voice_manager.stop()
    await gateway_manager.stop()


app = FastAPI(title="NEIA API", version="0.1.1", lifespan=lifespan)

api_v1 = FastAPI()


@api_v1.get("/apps/installed")
def list_installed_apps():
    return registry.list_installed()


@api_v1.get("/apps/available")
def list_available_apps():
    return registry.list_available()


@api_v1.get("/apps/catalog")
def get_apps_catalog():
    return control_center_store.build_app_catalog(registry)


@api_v1.get("/apps/{app_id}")
def get_app(app_id: str):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=404, detail="Built-in applications are part of NEIA")
    try:
        info = registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    if not info.installed:
        raise HTTPException(status_code=404, detail="App not installed")
    return info


@api_v1.post("/apps/install/{app_id}")
def install_app(app_id: str):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=400, detail="Built-in applications cannot be installed")
    try:
        return registry.install(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")


@api_v1.post("/apps/uninstall/{app_id}")
def uninstall_app(app_id: str):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=400, detail="Built-in applications cannot be uninstalled")
    try:
        info = registry.uninstall(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    if info.installed:
        raise HTTPException(status_code=500, detail="Failed to uninstall app")
    return info


@api_v1.post("/gateway/command")
def send_gateway_command(command: dict):
    gateway_manager.send_command(command)
    return {"status": "sent"}


@api_v1.get("/gateway/status")
def gateway_status():
    return {"gateway": gateway_manager.gateway_type}


@api_v1.get("/core/connection")
def core_connection():
    return core_state_store.connection_snapshot(gateway_manager.gateway_settings())


@api_v1.put("/core/connection")
async def update_core_connection(payload: dict):
    return await _update_gateway_target(payload)


@api_v1.post("/core/connection/retry")
def retry_core_connection():
    core_state_store.begin_connection_attempt()
    try:
        gateway_manager.send_command({"type": "is_server_ready", "payload": {}})
        gateway_manager.send_command({"type": "get_usb_status", "payload": {}})
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(status_code=503, detail="Failed to contact Nexus N3 Core")
    return core_state_store.connection_snapshot(gateway_manager.gateway_settings())


@api_v1.get("/core/capabilities")
def core_capabilities():
    return core_state_store.capabilities_snapshot()


@api_v1.get("/core/status")
def core_status():
    return core_state_store.status_snapshot(gateway_manager.gateway_settings())


@api_v1.get("/settings/gateway")
def get_gateway_settings():
    return gateway_manager.gateway_settings()


@api_v1.post("/settings/gateway")
async def update_gateway_settings(payload: dict):
    return await _update_gateway_target(payload)


async def _update_gateway_target(payload: dict):
    if gateway_manager.gateway_type != "zeromq":
        raise HTTPException(status_code=400, detail="Gateway host switching is only supported for zeromq")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    target_host = payload.get("target_host")
    if not isinstance(target_host, str) or not target_host.strip():
        raise HTTPException(status_code=400, detail="Missing target_host")
    current_settings = gateway_manager.gateway_settings()
    cmd_port = payload.get("cmd_port", current_settings.get("cmd_port"))
    event_port = payload.get("event_port", current_settings.get("event_port"))
    if not isinstance(cmd_port, int) or cmd_port <= 0:
        raise HTTPException(status_code=400, detail="Invalid cmd_port")
    if not isinstance(event_port, int) or event_port <= 0:
        raise HTTPException(status_code=400, detail="Invalid event_port")
    settings = save_gateway_runtime_settings(
        target_host=target_host.strip(),
        cmd_port=cmd_port,
        event_port=event_port,
    )
    core_state_store.begin_connection_attempt()
    result = await gateway_manager.reconfigure_zeromq_target(
        target_host=settings.target_host,
        cmd_port=settings.cmd_port,
        event_port=settings.event_port,
    )
    try:
        gateway_manager.send_command({"type": "is_server_ready", "payload": {}})
        gateway_manager.send_command({"type": "get_usb_status", "payload": {}})
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(status_code=503, detail="Core target updated but retry failed")
    return core_state_store.connection_snapshot(result)


@api_v1.post("/control-center/messages")
def ingest_control_center_message(message: dict):
    result = control_center_store.ingest_message(message)
    status = result.get("status")
    if status == "rejected":
        raise HTTPException(status_code=400, detail=result.get("reason", "invalid_message"))
    if status == "accepted":
        gateway_manager.broadcast_event(
            {
                "type": "control_center_message",
                "payload": message,
            }
        )
    return result


@api_v1.get("/control-center/catalog")
def get_control_center_catalog():
    return control_center_store.build_subject_catalog()


@api_v1.post("/gateway/purge")
def gateway_purge():
    if gateway_manager.gateway_type != "lavinmq":
        raise HTTPException(status_code=400, detail="Purge only supported for LavinMQ")
    gateway_manager.purge_queues()
    return {"status": "purged"}


@api_v1.get("/steps")
def get_steps():
    steps_path = BASE_DIR / "shared" / "steps.json"
    return FileResponse(steps_path)


@api_v1.get("/voice/status")
def voice_status():
    return voice_manager.status()


@api_v1.get("/voice/last")
def voice_last():
    return voice_manager.last()

@api_v1.post("/voice/reset")
def voice_reset():
    return voice_manager.reset()


@api_v1.post("/voice/enable")
def voice_enable():
    return voice_manager.enable()

@api_v1.post("/voice/activate")
def voice_activate():
    voice_manager.set_flow_active(True)
    return voice_manager.enable()

@api_v1.post("/voice/deactivate")
def voice_deactivate():
    return voice_manager.set_flow_active(False)


@api_v1.post("/voice/disable")
def voice_disable():
    return voice_manager.disable()


@api_v1.post("/voice/tts")
def voice_tts(payload: dict):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    enabled = payload.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="Missing enabled")
    return voice_manager.set_tts_enabled(bool(enabled))


@api_v1.post("/voice/speak")
def voice_speak(payload: dict):
    text = payload.get("text") if isinstance(payload, dict) else None
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    wait = bool(payload.get("wait")) if isinstance(payload, dict) else False
    ok, error = voice_manager._maybe_speak(text, wait=wait)
    if not ok and error == "TTS disabled":
        raise HTTPException(status_code=400, detail=error)
    if error:
        raise HTTPException(status_code=500, detail=error)
    return {"status": "spoken", "wait": wait}


@api_v1.websocket("/gateway/events")
async def gateway_events(ws: WebSocket):
    await ws.accept()
    await gateway_manager.broadcaster.register(ws)
    try:
        await ws.send_json({"type": "voice_status", "payload": voice_manager.status()})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await gateway_manager.broadcaster.unregister(ws)


@api_v1.get("/apps/{app_id}/asset/{asset_path:path}")
def get_app_asset(app_id: str, asset_path: str):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=404, detail="Built-in application assets are served by NEIA")
    try:
        info = registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    app_dir = registry.resolve_app_dir(app_id).resolve()
    candidate = (app_dir / asset_path).resolve()
    if app_dir not in candidate.parents and candidate != app_dir:
        raise HTTPException(status_code=400, detail="Invalid asset path")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(
        candidate,
        headers={
            "Cache-Control": "public, max-age=300",
        },
    )


@api_v1.get("/health")
def api_health():
    return {
        "status": "ok",
        "ui_dist_available": (BASE_DIR / "neia-ui" / "dist").exists(),
        "registry_dir": str(registry.registry_dir),
        "installed_file": str(registry.installed_file),
    }


app.mount("/api/v1", api_v1)

# Serve the UI shell (built assets) from neia-ui/dist
ui_dist = BASE_DIR / "neia-ui" / "dist"
if ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(ui_dist), html=True), name="ui")
