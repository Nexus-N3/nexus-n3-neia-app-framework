from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse

from ..app import AppServices, get_services
from ..services.archive_proxy import ArchiveProxyError


router = APIRouter(prefix="/archives", tags=["archives"])


def _http_error(exc: ArchiveProxyError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("")
async def list_archives(response: Response, services: AppServices = Depends(get_services)):
    try:
        payload = await services.archive_proxy.list_archives()
        response.headers["Cache-Control"] = "no-store"
        return payload
    except ArchiveProxyError as exc:
        raise _http_error(exc) from exc


@router.head("/{archive_id}/download")
async def inspect_archive(
    archive_id: str,
    storage_source: str,
    site: str,
    services: AppServices = Depends(get_services),
):
    try:
        return Response(
            headers=await services.archive_proxy.inspect_download(
                archive_id, storage_source, site
            )
        )
    except ArchiveProxyError as exc:
        raise _http_error(exc) from exc


@router.get("/{archive_id}/download")
async def download_archive(
    archive_id: str,
    storage_source: str,
    site: str,
    services: AppServices = Depends(get_services),
):
    try:
        download = await services.archive_proxy.open_download(
            archive_id, storage_source, site
        )
    except ArchiveProxyError as exc:
        raise _http_error(exc) from exc
    return StreamingResponse(download.chunks(), headers=download.headers)
