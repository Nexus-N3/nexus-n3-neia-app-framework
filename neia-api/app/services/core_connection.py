import asyncio

from fastapi import HTTPException

from ..app import AppServices
from ..runtime_settings import save_gateway_runtime_settings

CORE_STATUS_COMMANDS = (
    "is_server_ready",
    "get_usb_status",
    "get_device_info",
)


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