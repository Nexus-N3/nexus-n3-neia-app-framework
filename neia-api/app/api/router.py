from fastapi import APIRouter

from .health import router as health_router
from .gateway import router as gateway_router
from .apps import router as apps_router
from .core import router as core_router
from .voice import router as voice_router
from .control_center import router as control_center_router
from .settings import router as settings_router
from .steps import router as steps_router
from .workflows import router as workflows_router
from .help import router as help_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(gateway_router)
api_router.include_router(apps_router)
api_router.include_router(core_router)
api_router.include_router(voice_router)
api_router.include_router(control_center_router)
api_router.include_router(settings_router)
api_router.include_router(steps_router)
api_router.include_router(workflows_router)
api_router.include_router(help_router)
