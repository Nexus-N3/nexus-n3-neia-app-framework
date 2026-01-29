from __future__ import annotations

import os
import threading
from typing import Callable

import zmq


class ZeroMQClient:
    def __init__(self) -> None:
        cmd_connect = os.environ.get("ZEROMQ_CMD_CONNECT", "tcp://localhost:5555")
        event_connect = os.environ.get("ZEROMQ_EVENT_CONNECT", "tcp://localhost:5556")

        self._ctx = zmq.Context.instance()

        # Publish commands to server's SUB
        self._cmd_pub = self._ctx.socket(zmq.PUB)
        self._cmd_pub.connect(cmd_connect)

        # Subscribe to server's PUB
        self._event_sub = self._ctx.socket(zmq.SUB)
        self._event_sub.connect(event_connect)
        self._event_sub.setsockopt_string(zmq.SUBSCRIBE, "")

        self._running = False
        self._thread: threading.Thread | None = None

    @property
    def gateway_type(self) -> str:
        return "zeromq"

    def start(self, on_event: Callable[[dict], None]) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._recv_loop, args=(on_event,), daemon=True)
        self._thread.start()

    def _recv_loop(self, handler: Callable[[dict], None]) -> None:
        while self._running:
            msg = self._event_sub.recv_json()
            handler(msg)

    def send_command(self, command: dict) -> None:
        self._cmd_pub.send_json(command)

    def purge_queues(self) -> None:
        # ZeroMQ has no server queue to purge
        return None

    def stop(self) -> None:
        self._running = False
