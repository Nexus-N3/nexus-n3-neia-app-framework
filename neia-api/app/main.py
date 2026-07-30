from __future__ import annotations

import asyncio

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse

from .app import AppServices, BUILT_IN_APP_IDS, create_app, get_services
from .config import BASE_DIR
from .runtime_settings import save_gateway_runtime_settings

BUILT_IN_APP_IDS = {"nexus"}

api_v1 = APIRouter()

# routes
@api_v1.get("/apps/installed")
def list_installed_apps(
    services: AppServices = Depends(get_services),
):
    return services.registry.list_installed()


@api_v1.get("/apps/available")
def list_available_apps(
    services: AppServices = Depends(get_services),
):
    return services.registry.list_available()


@api_v1.get("/apps/catalog")
def get_apps_catalog(
    services: AppServices = Depends(get_services),
):
    return services.control_center_store.build_app_catalog(services.registry)


@api_v1.get("/apps/{app_id}")
def get_app(
    app_id: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=404, detail="Built-in applications are part of NEIA")
    try:
        info = services.registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    if not info.installed:
        raise HTTPException(status_code=404, detail="App not installed")
    return info


@api_v1.post("/apps/install/{app_id}")
def install_app(
    app_id: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=400, detail="Built-in applications cannot be installed")
    try:
        return services.registry.install(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")


@api_v1.post("/apps/uninstall/{app_id}")
def uninstall_app(
    app_id: str,
    services: AppServices = Depends(get_services)
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=400, detail="Built-in applications cannot be uninstalled")
    try:
        info = services.registry.uninstall(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    if info.installed:
        raise HTTPException(status_code=500, detail="Failed to uninstall app")
    return info


@api_v1.post("/gateway/command")
def send_gateway_command(command: dict, services: AppServices = Depends(get_services)):
    services.gateway_manager.send_command(command)
    return {"status": "sent"}


@api_v1.get("/gateway/status")
def gateway_status(services: AppServices = Depends(get_services)):
    return {"gateway": services.gateway_manager.gateway_type}


@api_v1.get("/core/connection")
def core_connection(services: AppServices = Depends(get_services)):
    return services.core_state_store.connection_snapshot(services.gateway_manager.gateway_settings())


@api_v1.put("/core/connection")
async def update_core_connection(payload: dict):
    return await _update_gateway_target(payload)


@api_v1.post("/core/connection/retry")
def retry_core_connection(services: AppServices = Depends(get_services)):
    gateway_manager = services.gateway_manager
    core_state_store = services.core_state_store

    core_state_store.begin_connection_attempt()
    
    try:
        gateway_manager.send_command({"type": "is_server_ready", "payload": {}})
        gateway_manager.send_command({"type": "get_usb_status", "payload": {}})
        gateway_manager.send_command({"type": "get_device_info", "payload": {}})
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(status_code=503, detail="Failed to contact Nexus N3 Core")
    return core_state_store.connection_snapshot(gateway_manager.gateway_settings())


@api_v1.get("/core/capabilities")
def core_capabilities(services: AppServices = Depends(get_services)):
    return services.core_state_store.capabilities_snapshot()


@api_v1.get("/core/status")
def core_status(services: AppServices = Depends(get_services)):
    return services.core_state_store.status_snapshot(services.gateway_manager.gateway_settings())


@api_v1.get("/settings/gateway")
def get_gateway_settings(services: AppServices = Depends(get_services)):
    return services.gateway_manager.gateway_settings()


@api_v1.post("/settings/gateway")
async def update_gateway_settings(payload: dict):
    return await _update_gateway_target(payload)


async def _update_gateway_target(payload: dict, services: AppServices = Depends(get_services)):
    gateway_manager = services.gateway_manager
    core_state_store = services.core_state_store

    if gateway_manager.gateway_type != "zeromq":
        raise HTTPException(
            status_code=400,
            detail="Gateway host switching is only supported for zeromq",
        )

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

    # Allow the new ZeroMQ sockets to establish their connections.
    await asyncio.sleep(1.0)

    try:
        gateway_manager.send_command(
            {"type": "is_server_ready", "payload": {}}
        )
        gateway_manager.send_command(
            {"type": "get_usb_status", "payload": {}}
        )
        gateway_manager.send_command(
            {"type": "get_device_info", "payload": {}}
        )
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(
            status_code=503,
            detail="Core target updated but readiness request failed",
        )

    return core_state_store.connection_snapshot(result)


@api_v1.post("/control-center/messages")
def ingest_control_center_message(message: dict, services: AppServices = Depends(get_services)):

    result = services.control_center_store.ingest_message(message)
    status = result.get("status")
    if status == "rejected":
        raise HTTPException(status_code=400, detail=result.get("reason", "invalid_message"))
    if status == "accepted":
        services.gateway_manager.broadcast_event(
            {
                "type": "control_center_message",
                "payload": message,
            }
        )
    return result


@api_v1.get("/control-center/catalog")
def get_control_center_catalog(services: AppServices = Depends(get_services)):
    return services.control_center_store.build_subject_catalog()


@api_v1.post("/gateway/purge")
def gateway_purge(services: AppServices = Depends(get_services)):
    if services.gateway_manager.gateway_type != "lavinmq":
        raise HTTPException(status_code=400, detail="Purge only supported for LavinMQ")
    services.gateway_manager.purge_queues()
    return {"status": "purged"}


@api_v1.get("/steps")
def get_steps():
    steps_path = BASE_DIR / "shared" / "steps.json"
    return FileResponse(steps_path)


@api_v1.get("/voice/status")
def voice_status(services: AppServices = Depends(get_services)):
    return services.voice_manager.status()


@api_v1.get("/voice/last")
def voice_last(services: AppServices = Depends(get_services)):
    return services.voice_manager.last()

@api_v1.post("/voice/reset")
def voice_reset(services: AppServices = Depends(get_services)):
    return services.voice_manager.reset()


@api_v1.post("/voice/enable")
def voice_enable(services: AppServices = Depends(get_services)):
    return services.voice_manager.enable()

@api_v1.post("/voice/activate")
def voice_activate(services: AppServices = Depends(get_services)):
    voice_manager = services.voice_manager
    voice_manager.set_flow_active(True)
    return voice_manager.enable()

@api_v1.post("/voice/deactivate")
def voice_deactivate(services: AppServices = Depends(get_services)):
    return services.voice_manager.set_flow_active(False)


@api_v1.post("/voice/disable")
def voice_disable(services: AppServices = Depends(get_services)):
    return services.voice_manager.disable()


@api_v1.post("/voice/tts")
def voice_tts(payload: dict, services: AppServices = Depends(get_services)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    enabled = payload.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="Missing enabled")
    return services.voice_manager.set_tts_enabled(bool(enabled))


@api_v1.post("/voice/speak")
def voice_speak(payload: dict, services: AppServices = Depends(get_services)):
    text = payload.get("text") if isinstance(payload, dict) else None
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    wait = bool(payload.get("wait")) if isinstance(payload, dict) else False
    ok, error = services.voice_manager._maybe_speak(text, wait=wait)
    if not ok and error == "TTS disabled":
        raise HTTPException(status_code=400, detail=error)
    if error:
        raise HTTPException(status_code=500, detail=error)
    return {"status": "spoken", "wait": wait}


@api_v1.websocket("/gateway/events")
async def gateway_events(ws: WebSocket):
    services: AppServices = ws.app.state.services
    gateway_manager = services.gateway_manager
    voice_manager = services.voice_manager

    await ws.accept()
    await gateway_manager.broadcaster.register(ws)

    try:
        await ws.send_json(
            {
                "type": "voice_status",
                "payload": voice_manager.status(),
            }
        )

        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await gateway_manager.broadcaster.unregister(ws)


@api_v1.get("/apps/{app_id}/asset/{asset_path:path}")
def get_app_asset(app_id: str, asset_path: str, services: AppServices = Depends(get_services)):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(status_code=404, detail="Built-in application assets are served by NEIA")
    try:
        info = services.registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    app_dir = services.registry.resolve_app_dir(app_id).resolve()
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
def api_health(services: AppServices = Depends(get_services)):
    return {
        "status": "ok",
        "ui_dist_available": (BASE_DIR / "neia-ui" / "dist").exists(),
        "registry_dir": str(services.registry.registry_dir),
        "installed_file": str(services.registry.installed_file),
    }

# create the app 
app = create_app(api_v1)
