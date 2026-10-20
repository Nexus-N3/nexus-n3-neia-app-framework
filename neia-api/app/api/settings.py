# api/settings.py

from fastapi import APIRouter, Depends, HTTPException
from ..app import AppServices, get_services
from ..runtime_settings import save_gateway_runtime_settings
from ..services.core_connection import update_gateway_target

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

@router.get("/gateway")
def get_gateway_settings(services: AppServices = Depends(get_services)):
    return services.gateway_manager.gateway_settings()


@router.post("/gateway")
async def update_gateway_settings(payload: dict, services: AppServices = Depends(get_services)):
    return await update_gateway_target(payload, services)


