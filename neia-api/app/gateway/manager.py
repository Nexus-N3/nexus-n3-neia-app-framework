from __future__ import annotations

import asyncio
from typing import Callable, List

from fastapi import WebSocket

from .base import GatewayClient
from .lavinmq_client import LavinMQClient
from .zeromq_client import ZeroMQClient
from ..config import NEIA_GATEWAY, NEIA_SITE, AMQP_URL


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
    def __init__(self, client: GatewayClient) -> None:
        self._client = client
        self._loop: asyncio.AbstractEventLoop | None = None
        self.broadcaster = EventBroadcaster()

    @property
    def gateway_type(self) -> str:
        return self._client.gateway_type

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._client.start(self._on_event)

    def _on_event(self, event: dict) -> None:
        if not self._loop:
            return
        asyncio.run_coroutine_threadsafe(self.broadcaster.broadcast(event), self._loop)

    async def stop(self) -> None:
        self._client.stop()

    def send_command(self, command: dict) -> None:
        self._client.send_command(command)

    def purge_queues(self) -> None:
        self._client.purge_queues()


def create_gateway_manager() -> GatewayManager:
    if NEIA_GATEWAY == "lavinmq":
        client = LavinMQClient(site=NEIA_SITE, amqp_url=AMQP_URL)
    else:
        client = ZeroMQClient()
    return GatewayManager(client)
