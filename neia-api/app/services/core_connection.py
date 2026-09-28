import asyncio

import httpx
from fastapi import HTTPException

from ..app import AppServices
from ..runtime_settings import save_gateway_runtime_settings

CORE_STATUS_COMMANDS = (
    "is_server_ready",
    "get_usb_status",
    "get_device_info",
)

SELECTABLE_CORE_ROLES = frozenset({"standalone", "master"})
IDLE_SESSION_STATES = frozenset({"inactive", "completed"})


def request_core_status(gateway_manager) -> None:
    for command_type in CORE_STATUS_COMMANDS:
        gateway_manager.send_command(
            {
                "type": command_type,
                "payload": {},
            }
        )


async def update_gateway_target(payload: dict, services: AppServices):
    gateway_manager = services.gateway_manager
    core_state_store = services.core_state_store

    if gateway_manager.gateway_type != "zeromq":
        raise HTTPException(
            status_code=400,
            detail="Gateway host switching is only supported for zeromq",
        )

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    target_host = payload.get("target_host")
    if not isinstance(target_host, str) or not target_host.strip():
        raise HTTPException(status_code=400, detail="Missing target_host")

    current_settings = gateway_manager.gateway_settings()
    cmd_port = payload.get("cmd_port", current_settings.get("cmd_port"))
    event_port = payload.get("event_port", current_settings.get("event_port"))

    if not isinstance(cmd_port, int) or cmd_port <= 0:
        raise HTTPException(status_code=400, detail="Invalid cmd_port")

    if not isinstance(event_port, int) or event_port <= 0:
        raise HTTPException(status_code=400, detail="Invalid event_port")

    settings = save_gateway_runtime_settings(
        target_host=target_host.strip(),
        cmd_port=cmd_port,
        event_port=event_port,
    )

    core_state_store.begin_connection_attempt()

    result = await gateway_manager.reconfigure_zeromq_target(
        target_host=settings.target_host,
        cmd_port=settings.cmd_port,
        event_port=settings.event_port,
    )

    # Allow the new ZeroMQ sockets to establish their connections.
    await asyncio.sleep(1.0)

    try:
        gateway_manager.send_command(
            {"type": "is_server_ready", "payload": {}}
        )
        gateway_manager.send_command(
            {"type": "get_usb_status", "payload": {}}
        )
        gateway_manager.send_command(
            {"type": "get_device_info", "payload": {}}
        )
    except Exception as exc:
        core_state_store.mark_connection_error(str(exc))
        raise HTTPException(
            status_code=503,
            detail="Core target updated but readiness request failed",
        )

    return core_state_store.connection_snapshot(result)

async def update_core_role(
    payload: dict,
    services: AppServices,
    client: httpx.AsyncClient | None = None,
):
    role = payload.get("role") if isinstance(payload, dict) else None
    if role not in SELECTABLE_CORE_ROLES:
        raise HTTPException(status_code=400, detail="Role must be standalone or master")

    settings = services.gateway_manager.gateway_settings()
    status = services.core_state_store.status_snapshot(settings)
    if status.get("mode") == role:
        return {"role": role, "restarting": False}
    if status.get("connection", {}).get("available") is not True:
        raise HTTPException(status_code=503, detail="Nexus N3 Core is unavailable")
    if status.get("active_session", {}).get("state") not in IDLE_SESSION_STATES:
        raise HTTPException(status_code=409, detail="Core must be idle before changing mode")

    service = services.core_state_store.archive_service_snapshot()
    host = settings.get("target_host")
    if (
        service.get("available") is not True
        or service.get("scheme") not in {"http", "https"}
        or not isinstance(service.get("port"), int)
        or not isinstance(host, str)
        or not host
    ):
        raise HTTPException(status_code=503, detail="Core Admin API is unavailable")

    url = httpx.URL(
        scheme=service["scheme"],
        host=host,
        port=service["port"],
        path="/api/server/role",
    )
    owns_client = client is None
    active_client = client or httpx.AsyncClient(follow_redirects=False)
    try:
        response = await active_client.put(url, json={"role": role}, timeout=5.0)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Core role change timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Core Admin API could not be reached") from exc
    finally:
        if owns_client:
            await active_client.aclose()

    if not 200 <= response.status_code < 300:
        try:
            upstream_detail = response.json().get("detail")
        except ValueError:
            upstream_detail = None
        detail = upstream_detail if isinstance(upstream_detail, str) else "Core rejected the role change"
        status_code = response.status_code if response.status_code in {400, 409} else 502
        raise HTTPException(status_code=status_code, detail=detail)

    services.core_state_store.begin_connection_attempt()
    return response.json()
