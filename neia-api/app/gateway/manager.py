from __future__ import annotations

import asyncio
import logging
from typing import Callable, List

from fastapi import WebSocket

from .base import GatewayClient
from .lavinmq_client import LavinMQClient
from .zeromq_client import ZeroMQClient
from ..runtime_settings import GatewayRuntimeSettings, load_gateway_runtime_settings


class EventBroadcaster:
    def __init__(self) -> None:
        self._clients: List[WebSocket] = []

    async def register(self, ws: WebSocket) -> None:
        self._clients.append(ws)

    async def unregister(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)

    async def broadcast(self, event: dict) -> None:
        dead = []
        for ws in self._clients:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.unregister(ws)


class GatewayManager:
    def __init__(self, settings: GatewayRuntimeSettings) -> None:
        self._settings = settings
        self._client = _create_gateway_client(settings)
        self._loop: asyncio.AbstractEventLoop | None = None
        self.broadcaster = EventBroadcaster()
        self._event_listeners: List[Callable[[dict], None]] = []
        self._logger = logging.getLogger("uvicorn.error")

    @property
    def gateway_type(self) -> str:
        return self._client.gateway_type

    def gateway_settings(self) -> dict[str, object]:
        return self._settings.as_public_dict()

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._client.start(self._on_event)

    def _on_event(self, event: dict) -> None:
        if not self._loop:
            return
        for listener in list(self._event_listeners):
            try:
                listener(event)
            except Exception:
                self._logger.exception("Gateway event listener failed")
        asyncio.run_coroutine_threadsafe(self.broadcaster.broadcast(event), self._loop)

    async def stop(self) -> None:
        self._client.stop()

    async def reconfigure_zeromq_target(self, *, target_host: str, cmd_port: int, event_port: int) -> dict[str, object]:
        if self._settings.gateway_type != "zeromq":
            raise ValueError("Gateway target changes are only supported for zeromq deployments")
        next_settings = GatewayRuntimeSettings(
            gateway_type=self._settings.gateway_type,
            site=self._settings.site,
            target_host=target_host,
            cmd_port=cmd_port,
            event_port=event_port,
            amqp_url=self._settings.amqp_url,
        )
        self._client.stop()
        self._settings = next_settings
        self._client = _create_gateway_client(next_settings)
        if self._loop:
            self._client.start(self._on_event)
        return self.gateway_settings()

    def send_command(self, command: dict) -> None:
        self._client.send_command(command)

    def broadcast_event(self, event: dict) -> None:
        if not self._loop:
            return
        asyncio.run_coroutine_threadsafe(self.broadcaster.broadcast(event), self._loop)

    def add_event_listener(self, listener: Callable[[dict], None]) -> None:
        self._event_listeners.append(listener)

    def purge_queues(self) -> None:
        self._client.purge_queues()


def create_gateway_manager() -> GatewayManager:
    return GatewayManager(load_gateway_runtime_settings())


def _create_gateway_client(settings: GatewayRuntimeSettings) -> GatewayClient:
    if settings.gateway_type == "lavinmq":
        return LavinMQClient(site=settings.site, amqp_url=settings.amqp_url)
    return ZeroMQClient(
        cmd_connect=f"tcp://{settings.target_host}:{settings.cmd_port}",
        event_connect=f"tcp://{settings.target_host}:{settings.event_port}",
    )
