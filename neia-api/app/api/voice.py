# api.py

from fastapi import APIRouter, Depends, HTTPException
from ..app import AppServices, get_services
from ..models.requests import VoiceSpeakRequest

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
)


@router.get("/status")
def voice_status(services: AppServices = Depends(get_services)):
    return services.voice_manager.status()


@router.get("/last")
def voice_last(services: AppServices = Depends(get_services)):
    return services.voice_manager.last()

@router.post("/reset")
def voice_reset(services: AppServices = Depends(get_services)):
    return services.voice_manager.reset()


@router.post("/enable")
def voice_enable(services: AppServices = Depends(get_services)):
    return services.voice_manager.enable()

@router.post("/activate")
def voice_activate(services: AppServices = Depends(get_services)):
    voice_manager = services.voice_manager
    voice_manager.set_flow_active(True)
    return voice_manager.enable()

@router.post("/deactivate")
def voice_deactivate(services: AppServices = Depends(get_services)):
    return services.voice_manager.set_flow_active(False)


@router.post("/disable")
def voice_disable(services: AppServices = Depends(get_services)):
    return services.voice_manager.disable()


@router.post("/tts")
def voice_tts(payload: dict, services: AppServices = Depends(get_services)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    enabled = payload.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="Missing enabled")
    return services.voice_manager.set_tts_enabled(bool(enabled))


@router.post("/speak")
def voice_speak(
    payload: VoiceSpeakRequest,
    services: AppServices = Depends(get_services),
):
    ok, error = services.voice_manager.speak(
        payload.text,
        wait=payload.wait,
    )

    if not ok and error == "TTS disabled":
        raise HTTPException(status_code=400, detail=error)

    if error:
        raise HTTPException(status_code=500, detail=error)

    return {
        "status": "spoken",
        "wait": payload.wait,
    }