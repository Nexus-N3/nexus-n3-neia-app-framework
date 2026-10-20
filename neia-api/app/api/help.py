# api/settings.py

from fastapi import APIRouter, Depends, HTTPException
from ..app import AppServices, get_services

router = APIRouter(
    prefix="/help",
    tags=["help"],
)

@router.get("/status")
def help_status(services: AppServices = Depends(get_services)):
    return services.help_manager.status()


@router.post("reindex")
def help_reindex(services: AppServices = Depends(get_services)):
    return services.help_manager.reindex()


@router.post("/ask")
def help_ask(payload: dict, services: AppServices = Depends(get_services)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    question = str(payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Missing question")
    top_k_raw = payload.get("top_k")
    top_k = None
    if top_k_raw is not None:
        try:
            top_k = int(top_k_raw)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid top_k")
    result = services.help_manager.ask(question, top_k=top_k)
    if result.get("error"):
        if result.get("error") == "Help is disabled":
            raise HTTPException(status_code=503, detail=result["error"])
        raise HTTPException(status_code=400, detail=result["error"])
    return result