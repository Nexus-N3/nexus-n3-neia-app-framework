# api/gateway.py

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse
from ..app import AppServices, get_services
from ..config import BASE_DIR


router = APIRouter(
    prefix="/gateway",
    tags=["gateway"],
)

@router.post("/command")
def send_gateway_command(command: dict, services: AppServices = Depends(get_services)):
    services.gateway_manager.send_command(command)
    return {"status": "sent"}


@router.get("/status")
def gateway_status(services: AppServices = Depends(get_services)):
    return {"gateway": services.gateway_manager.gateway_type}


## deprectated
@router.post("/purge")
def gateway_purge(services: AppServices = Depends(get_services)):
    if services.gateway_manager.gateway_type != "lavinmq":
        raise HTTPException(status_code=400, detail="Purge only supported for LavinMQ")
    services.gateway_manager.purge_queues()
    return {"status": "purged"}


@router.websocket("/events")
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