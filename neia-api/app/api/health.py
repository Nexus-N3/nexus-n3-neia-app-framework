# api/health.py

from fastapi import APIRouter, Depends

from ..app import AppServices, get_services
from ..config import BASE_DIR


router = APIRouter(
    prefix="/health",
    tags=["health"],
)


@router.get("")
def api_health(
    services: AppServices = Depends(get_services),
):
    return {
        "status": "ok",
        "ui_dist_available": (BASE_DIR / "neia-ui" / "dist").exists(),
        "registry_dir": str(services.registry.registry_dir),
        "installed_file": str(services.registry.installed_file),
    }