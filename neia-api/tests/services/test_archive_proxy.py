import asyncio

import httpx
import pytest

from app.repositories.core_state_store import CoreStateStore
from app.services.archive_proxy import ArchiveProxyError, ArchiveProxyService


def _ready_store() -> CoreStateStore:
    store = CoreStateStore()
    store.handle_gateway_event({
        "type": "server_ready",
        "payload": {
            "site": "lunar",
            "archive_service": {
                "available": True,
                "scheme": "http",
                "port": 9000,
                "list_path": "/api/outputs",
                "download_path": "/api/outputs/download",
            }
        },
    })
    return store


def test_lists_archives_on_the_configured_core_host() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == httpx.URL("http://edge.local:9000/api/outputs?site=lunar")
        return httpx.Response(200, json={
            "site": "lunar",
            "storage_source": "usb",
            "archives": [{
                "id": "abc",
                "filename": "session.zip",
                "size_bytes": 12,
                "modified_at": "2026-08-03T09:00:00Z",
                "path": "/must/not/pass-through",
            }],
        })

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = ArchiveProxyService(
        _ready_store(), lambda: {"target_host": "edge.local"}, client
    )

    assert asyncio.run(service.list_archives()) == {
        "site": "lunar",
        "storage_source": "usb",
        "archives": [{
            "id": "abc",
            "filename": "session.zip",
            "size_bytes": 12,
            "modified_at": "2026-08-03T09:00:00Z",
        }],
    }
    asyncio.run(client.aclose())


def test_source_change_is_preserved_as_conflict() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["storage_source"] == "internal"
        assert request.url.params["site"] == "lunar"
        return httpx.Response(409)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = ArchiveProxyService(
        _ready_store(), lambda: {"target_host": "edge.local"}, client
    )

    with pytest.raises(ArchiveProxyError) as error:
        asyncio.run(service.inspect_download("abc", "internal", "lunar"))
    assert error.value.status_code == 409
    asyncio.run(client.aclose())


def test_download_rejects_a_site_change_before_contacting_core() -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(500)))
    service = ArchiveProxyService(
        _ready_store(), lambda: {"target_host": "edge.local"}, client
    )

    with pytest.raises(ArchiveProxyError) as error:
        asyncio.run(service.inspect_download("abc", "internal", "old-site"))
    assert error.value.status_code == 409
    asyncio.run(client.aclose())


def test_unavailable_service_does_not_make_an_http_request() -> None:
    service = ArchiveProxyService(
        CoreStateStore(), lambda: {"target_host": "edge.local"}, httpx.AsyncClient()
    )
    with pytest.raises(ArchiveProxyError) as error:
        asyncio.run(service.list_archives())
    assert error.value.status_code == 503
    asyncio.run(service._client.aclose())
