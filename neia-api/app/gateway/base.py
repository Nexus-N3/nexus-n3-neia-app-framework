from __future__ import annotations

from typing import Callable, Protocol


class GatewayClient(Protocol):
    def start(self, on_event: Callable[[dict], None]) -> None:
        ...

    def stop(self) -> None:
        ...

    def send_command(self, command: dict) -> None:
        ...

    def purge_queues(self) -> None:
        ...

    @property
    def gateway_type(self) -> str:
        ...
