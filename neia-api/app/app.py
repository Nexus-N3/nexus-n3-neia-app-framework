# Main Entry Point to NEIA API

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, WORKFLOWS_DIR
from .repositories.control_center_store import ControlCenterStore
from .repositories.core_state_store import CoreStateStore
from .gateway.manager import create_gateway_manager
from .repositories.registry import AppRegistry
from .voice import create_voice_manager
from .repositories.workflow_store import WorkflowStore
from .services.workflow_service import WorkflowService
from .services.archive_proxy import ArchiveProxyService
from .help import HelpManager


BUILT_IN_APP_IDS = {"nexus"}


# data class to hold the runtime services
@dataclass
class AppServices:
    registry: AppRegistry
    gateway_manager: Any
    control_center_store: ControlCenterStore
    core_state_store: CoreStateStore
    voice_manager: Any
    workflow_store: WorkflowStore
    workflow_service: WorkflowService
    help_manager: Any
    archive_proxy: ArchiveProxyService


def create_services() -> AppServices:
    registry = AppRegistry(excluded_app_ids=BUILT_IN_APP_IDS)
    gateway_manager = create_gateway_manager()
    control_center_store = ControlCenterStore()
    core_state_store = CoreStateStore()

    voice_manager = create_voice_manager(
        BASE_DIR,
        send_command=gateway_manager.send_command,
        broadcast_event=gateway_manager.broadcast_event,
    )

    gateway_manager.add_event_listener(
        voice_manager.handle_gateway_event
    )
    gateway_manager.add_event_listener(
        control_center_store.handle_gateway_event
    )
    gateway_manager.add_event_listener(
        core_state_store.handle_gateway_event
    )

    workflow_store = WorkflowStore(WORKFLOWS_DIR)
    workflow_service = WorkflowService(
        store=workflow_store,
        core_state_store=core_state_store,
    )
    help_manager = HelpManager(BASE_DIR)
    archive_proxy = ArchiveProxyService(core_state_store, gateway_manager.gateway_settings)

    return AppServices(
        registry=registry,
        gateway_manager=gateway_manager,
        control_center_store=control_center_store,
        core_state_store=core_state_store,
        voice_manager=voice_manager,
        workflow_store=workflow_store,
        workflow_service=workflow_service,
        help_manager=help_manager,
        archive_proxy=archive_proxy,
    )

def get_services(request: Request) -> AppServices:
    return request.app.state.services

# creates the application (the api)
def create_app(api_v1: APIRouter) -> FastAPI:
    services = create_services()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await services.gateway_manager.start()
        services.voice_manager.start_if_enabled()

        try:
            yield
        finally:
            services.voice_manager.stop()
            await services.archive_proxy.close()
            await services.gateway_manager.stop()

    app = FastAPI(
        title="NEIA API",
        version="0.1.1",
        lifespan=lifespan,
    )

    # Requests to normal app routes see this state.
    app.state.services = services

    app.include_router(api_v1, prefix="/api/v1")

    ui_dist = BASE_DIR / "neia-ui" / "dist"
    if ui_dist.exists():
        app.mount(
            "/",
            StaticFiles(directory=str(ui_dist), html=True),
            name="ui",
        )

    return app
