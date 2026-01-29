from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR
from .gateway.manager import create_gateway_manager
from .registry import AppRegistry

registry = AppRegistry()
gateway_manager = create_gateway_manager()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await gateway_manager.start()
    yield
    await gateway_manager.stop()


app = FastAPI(title="NEIA API", version="0.1.0", lifespan=lifespan)

api_v1 = FastAPI()


@api_v1.get("/apps/installed")
def list_installed_apps():
    return registry.list_installed()


@api_v1.get("/apps/available")
def list_available_apps():
    return registry.list_available()


@api_v1.get("/apps/{app_id}")
def get_app(app_id: str):
    try:
        info = registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    if not info.installed:
        raise HTTPException(status_code=404, detail="App not installed")
    return info


@api_v1.post("/apps/install/{app_id}")
def install_app(app_id: str):
    try:
        return registry.install(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")


@api_v1.post("/apps/uninstall/{app_id}")
def uninstall_app(app_id: str):
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


@api_v1.websocket("/gateway/events")
async def gateway_events(ws: WebSocket):
    await ws.accept()
    await gateway_manager.broadcaster.register(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await gateway_manager.broadcaster.unregister(ws)


@api_v1.get("/apps/{app_id}/asset/{asset_path:path}")
def get_app_asset(app_id: str, asset_path: str):
    try:
        info = registry.get_app_info(app_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="App not found")
    app_dir = (BASE_DIR / "apps" / "registry" / app_id).resolve()
    candidate = (app_dir / asset_path).resolve()
    if app_dir not in candidate.parents and candidate != app_dir:
        raise HTTPException(status_code=400, detail="Invalid asset path")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(candidate)


app.mount("/api/v1", api_v1)

# Serve the UI shell (built assets) from neia-ui/dist
ui_dist = BASE_DIR / "neia-ui" / "dist"
if ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(ui_dist), html=True), name="ui")
