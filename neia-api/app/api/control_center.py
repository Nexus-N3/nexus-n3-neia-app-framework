# api/control_center.py

from fastapi import APIRouter, Depends, HTTPException
from ..app import AppServices, get_services

router = APIRouter(
    prefix="/control-center",
    tags=["control-center"],
)


@router.post("/messages")
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


@router.get("/catalog")
def get_control_center_catalog(services: AppServices = Depends(get_services)):
    return services.control_center_store.build_subject_catalog()