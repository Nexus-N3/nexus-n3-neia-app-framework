import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from app.repositories.core_state_store import CoreStateStore
from app.services.core_connection import update_core_role


def _services(*, session_state="inactive"):
    store = CoreStateStore()
    store.handle_gateway_event({
        "type": "server_ready",
        "payload": {
            "role": "standalone",
            "site": "test",
            "archive_service": {
                "available": True,
                "scheme": "http",
                "port": 9000,
                "list_path": "/api/outputs",
                "download_path": "/api/outputs/download",
            },
        },
    })
    if session_state != "inactive":
        store.handle_gateway_event({
            "type": "system_initialized",
            "payload": {"session_id": "session-1"},
        })
    gateway = SimpleNamespace(gateway_settings=lambda: {"target_host": "edge.local"})
    return SimpleNamespace(core_state_store=store, gateway_manager=gateway)


def test_role_change_proxies_to_core_admin_and_marks_reconnecting():
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == httpx.URL("http://edge.local:9000/api/server/role")
        assert request.content == b'{"role":"master"}'
        return httpx.Response(200, json={"role": "master", "restarting": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    services = _services()
    result = asyncio.run(update_core_role({"role": "master"}, services, client=client))

    assert result == {"role": "master", "restarting": True}
    assert services.core_state_store.connection_snapshot(
        services.gateway_manager.gateway_settings()
    )["state"] == "connecting"
    asyncio.run(client.aclose())


def test_role_change_rejects_busy_core_and_non_ui_roles():
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(500))
    )
    with pytest.raises(HTTPException) as busy:
        asyncio.run(
            update_core_role(
                {"role": "master"}, _services(session_state="initialized"), client=client
            )
        )
    assert busy.value.status_code == 409

    with pytest.raises(HTTPException) as worker:
        asyncio.run(update_core_role({"role": "worker"}, _services(), client=client))
    assert worker.value.status_code == 400
    asyncio.run(client.aclose())
