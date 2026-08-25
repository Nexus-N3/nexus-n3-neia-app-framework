from __future__ import annotations

import os
import threading
from typing import Callable

import zmq


class ZeroMQClient:
    def __init__(
        self,
        *,
        cmd_connect: str | None = None,
        event_connect: str | None = None,
    ) -> None:
        self._cmd_connect = cmd_connect or os.environ.get(
            "ZEROMQ_CMD_CONNECT",
            "tcp://localhost:5555",
        )
        self._event_connect = event_connect or os.environ.get(
            "ZEROMQ_EVENT_CONNECT",
            "tcp://localhost:5556",
        )

        self._ctx = zmq.Context.instance()

        # The command socket is created and used by the API thread.
        self._cmd_pub = self._ctx.socket(zmq.PUB)
        self._cmd_pub.setsockopt(zmq.LINGER, 0)
        self._cmd_pub.connect(self._cmd_connect)

        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def gateway_type(self) -> str:
        return "zeromq"

    def start(self, on_event: Callable[[dict], None]) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._recv_loop,
            args=(on_event,),
            daemon=True,
            name="zeromq-event-receiver",
        )
        self._thread.start()

    def _recv_loop(self, handler: Callable[[dict], None]) -> None:
        # Create and use the SUB socket entirely within this thread.
        event_sub = self._ctx.socket(zmq.SUB)
        event_sub.setsockopt(zmq.LINGER, 0)
        event_sub.setsockopt(zmq.RCVTIMEO, 250)
        event_sub.setsockopt_string(zmq.SUBSCRIBE, "")
        event_sub.connect(self._event_connect)

        try:
            while not self._stop_event.is_set():
                try:
                    msg = event_sub.recv_json()
                except zmq.Again:
                    continue
                except zmq.ZMQError:
                    if self._stop_event.is_set():
                        break
                    raise

                try:
                    handler(msg)
                except Exception as exc:
                    print(
                        f"[ZeroMQClient] Event handler failed: {exc}",
                        flush=True,
                    )
        finally:
            # The owning receiver thread closes its own socket.
            event_sub.close(linger=0)

    def send_command(self, command: dict) -> None:
        self._cmd_pub.send_json(command)

    def purge_queues(self) -> None:
        return None

    def stop(self) -> None:
        self._stop_event.set()

        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=2.0)

        if thread and thread.is_alive():
            raise RuntimeError(
                "ZeroMQ event receiver did not stop cleanly"
            )

        self._thread = None

        # This socket is owned by the thread calling send_command/stop.
        self._cmd_pub.close(linger=0)