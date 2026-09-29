"""HTTP proxy client for the archive service advertised by Nexus N3 Core."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable

import httpx

from ..repositories.core_state_store import CoreStateStore


class ArchiveProxyError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass
class ArchiveDownload:
    response: httpx.Response

    @property
    def headers(self) -> dict[str, str]:
        allowed = {"content-type", "content-length", "content-disposition", "cache-control"}
        return {key: value for key, value in self.response.headers.items() if key.lower() in allowed}

    async def chunks(self) -> AsyncIterator[bytes]:
        try:
            async for chunk in self.response.aiter_bytes():
                yield chunk
        finally:
            await self.response.aclose()


class ArchiveProxyService:
    def __init__(
        self,
        core_state_store: CoreStateStore,
        gateway_settings: Callable[[], dict[str, Any]],
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._core_state_store = core_state_store
        self._gateway_settings = gateway_settings
        self._client = client or httpx.AsyncClient(follow_redirects=False)
        self._owns_client = client is None

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def list_archives(self) -> dict[str, Any]:
        url, site = self._service_context("list_path")
        try:
            response = await self._client.get(url, params={"site": site}, timeout=5.0)
        except httpx.TimeoutException as exc:
            raise ArchiveProxyError(504, "The Core archive service timed out.") from exc
        except httpx.HTTPError as exc:
            raise ArchiveProxyError(502, "The Core archive service could not be reached.") from exc
        self._raise_for_upstream(response)
        try:
            payload = response.json()
        except ValueError as exc:
            raise ArchiveProxyError(502, "The Core archive service returned invalid data.") from exc
        return self._normalize_listing(payload, expected_site=site)

    async def inspect_download(
        self, archive_id: str, storage_source: str, site: str
    ) -> dict[str, str]:
        response = await self._request_download(
            "HEAD", archive_id, storage_source, site, stream=False
        )
        try:
            return self._safe_headers(response)
        finally:
            await response.aclose()

    async def open_download(
        self, archive_id: str, storage_source: str, site: str
    ) -> ArchiveDownload:
        response = await self._request_download(
            "GET", archive_id, storage_source, site, stream=True
        )
        return ArchiveDownload(response)

    async def _request_download(
        self,
        method: str,
        archive_id: str,
        storage_source: str,
        site: str,
        *,
        stream: bool,
    ) -> httpx.Response:
        url, active_site = self._service_context("download_path", requested_site=site)
        request = self._client.build_request(
            method,
            url,
            params={
                "archive_id": archive_id,
                "storage_source": storage_source,
                "site": active_site,
            },
            timeout=30.0,
        )
        try:
            response = await self._client.send(request, stream=stream, follow_redirects=False)
        except httpx.TimeoutException as exc:
            raise ArchiveProxyError(504, "The Core archive service timed out.") from exc
        except httpx.HTTPError as exc:
            raise ArchiveProxyError(502, "The Core archive service could not be reached.") from exc
        try:
            self._raise_for_upstream(response)
        except Exception:
            await response.aclose()
            raise
        return response

    def _service_context(
        self, path_key: str, requested_site: str | None = None
    ) -> tuple[httpx.URL, str]:
        service = self._core_state_store.archive_service_snapshot()
        settings = self._gateway_settings()
        host = settings.get("target_host")
        site = service.get("site")
        if (
            service.get("available") is not True
            or not isinstance(site, str)
            or not site
            or not isinstance(host, str)
            or not host
        ):
            raise ArchiveProxyError(503, "Archive service is unavailable. Ensure the Core Admin API is running.")
        if requested_site is not None and requested_site != site:
            raise ArchiveProxyError(409, "The Core site changed; refresh the archive list.")
        return (
            httpx.URL(
                scheme=service["scheme"],
                host=host,
                port=service["port"],
                path=service[path_key],
            ),
            site,
        )

    @staticmethod
    def _safe_headers(response: httpx.Response) -> dict[str, str]:
        allowed = {"content-type", "content-length", "content-disposition", "cache-control"}
        return {key: value for key, value in response.headers.items() if key.lower() in allowed}

    @staticmethod
    def _raise_for_upstream(response: httpx.Response) -> None:
        status = response.status_code
        if 200 <= status < 300:
            return
        if status == 404:
            raise ArchiveProxyError(404, "The archive was not found.")
        if status == 409:
            raise ArchiveProxyError(409, "Archive storage changed; refresh the archive list.")
        if 300 <= status < 400:
            raise ArchiveProxyError(502, "The Core archive service returned an unsafe redirect.")
        raise ArchiveProxyError(502, "The Core archive service returned an error.")

    @staticmethod
    def _normalize_listing(payload: Any, *, expected_site: str) -> dict[str, Any]:
        if (
            not isinstance(payload, dict)
            or payload.get("site") != expected_site
            or payload.get("storage_source") not in {"internal", "usb"}
        ):
            raise ArchiveProxyError(502, "The Core archive service returned invalid data.")
        raw_archives = payload.get("archives")
        if not isinstance(raw_archives, list):
            raise ArchiveProxyError(502, "The Core archive service returned invalid data.")
        archives = []
        for item in raw_archives:
            if not isinstance(item, dict):
                continue
            archive_id = item.get("id")
            filename = item.get("filename")
            size_bytes = item.get("size_bytes")
            modified_at = item.get("modified_at")
            if (
                not isinstance(archive_id, str) or not archive_id
                or not isinstance(filename, str) or not filename
                or isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 0
                or not isinstance(modified_at, str)
            ):
                continue
            archives.append({
                "id": archive_id,
                "filename": filename,
                "size_bytes": size_bytes,
                "modified_at": modified_at,
            })
        return {
            "site": expected_site,
            "storage_source": payload["storage_source"],
            "archives": archives,
        }
