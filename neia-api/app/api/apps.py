# api/apps.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..app import AppServices, BUILT_IN_APP_IDS, get_services


router = APIRouter(
    prefix="/apps",
    tags=["apps"],
)


@router.get("/installed")
def list_installed_apps(
    services: AppServices = Depends(get_services),
):
    return services.registry.list_installed()


@router.get("/available")
def list_available_apps(
    services: AppServices = Depends(get_services),
):
    return services.registry.list_available()


@router.get("/catalog")
def get_apps_catalog(
    services: AppServices = Depends(get_services),
):
    return services.control_center_store.build_app_catalog(
        services.registry
    )


@router.get("/{app_id}")
def get_app(
    app_id: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(
            status_code=404,
            detail="Built-in applications are part of NEIA",
        )

    try:
        info = services.registry.get_app_info(app_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="App not found",
        ) from exc

    if not info.installed:
        raise HTTPException(
            status_code=404,
            detail="App not installed",
        )

    return info


@router.post("/install/{app_id}")
def install_app(
    app_id: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(
            status_code=400,
            detail="Built-in applications cannot be installed",
        )

    try:
        return services.registry.install(app_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="App not found",
        ) from exc


@router.post("/uninstall/{app_id}")
def uninstall_app(
    app_id: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(
            status_code=400,
            detail="Built-in applications cannot be uninstalled",
        )

    try:
        info = services.registry.uninstall(app_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="App not found",
        ) from exc

    if info.installed:
        raise HTTPException(
            status_code=500,
            detail="Failed to uninstall app",
        )

    return info


@router.get("/{app_id}/asset/{asset_path:path}")
def get_app_asset(
    app_id: str,
    asset_path: str,
    services: AppServices = Depends(get_services),
):
    if app_id in BUILT_IN_APP_IDS:
        raise HTTPException(
            status_code=404,
            detail="Built-in application assets are served by NEIA",
        )

    try:
        services.registry.get_app_info(app_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="App not found",
        ) from exc

    app_dir = services.registry.resolve_app_dir(app_id).resolve()
    candidate = (app_dir / asset_path).resolve()

    if candidate != app_dir and app_dir not in candidate.parents:
        raise HTTPException(
            status_code=400,
            detail="Invalid asset path",
        )

    if not candidate.is_file():
        raise HTTPException(
            status_code=404,
            detail="Asset not found",
        )

    return FileResponse(
        candidate,
        headers={
            "Cache-Control": "public, max-age=300",
        },
    )