# api/core.py

from fastapi import APIRouter, Depends, HTTPException
from ..app import AppServices, get_services
from ..runtime_settings import save_gateway_runtime_settings
from ..services.core_connection import (
    request_core_status,
    update_core_role,
    update_gateway_target,
)


router = APIRouter(
    prefix="/core",
    tags=["core"],
)


@router.get("/connection")
def core_connection(services: AppServices = Depends(get_services)):
    return services.core_state_store.connection_snapshot(services.gateway_manager.gateway_settings())


@router.put("/connection")
async def update_core_connection(payload: dict, services: AppServices = Depends(get_services),):
    return await update_gateway_target(payload, services)


@router.put("/role")
async def update_role(payload: dict, services: AppServices = Depends(get_services)):
    return await update_core_role(payload, services)


@router.post("/connection/retry")
def retry_core_connection(services: AppServices = Depends(get_services)):
    gateway_manager = services.gateway_manager
    core_state_store = services.core_state_store

    core_state_store.begin_connection_attempt()
    
    try:
        request_core_status(gateway_manager)
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(status_code=503, detail="Failed to contact Nexus N3 Core")
    return core_state_store.connection_snapshot(gateway_manager.gateway_settings())


@router.get("/capabilities")
def core_capabilities(services: AppServices = Depends(get_services)):
    return services.core_state_store.capabilities_snapshot()


@router.get("/status")
def core_status(services: AppServices = Depends(get_services)):
    return services.core_state_store.status_snapshot(services.gateway_manager.gateway_settings())

