from __future__ import annotations

import json
import os
import threading
import time
from typing import Callable

import pika


class LavinMQClient:
    def __init__(self, site: str, amqp_url: str | None = None) -> None:
        self.site = site
        self.amqp_url = amqp_url or os.environ.get("AMQP_URL")
        if not self.amqp_url:
            raise ValueError("Missing AMQP URL. Set AMQP_URL or pass amqp_url.")

        self.cmd_queue = f"{site}_cmds"
        self.event_queue = f"{site}_events"

        self._consume_connection: pika.BlockingConnection | None = None
        self._consume_channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self._publish_connection: pika.BlockingConnection | None = None
        self._publish_channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self._publish_lock = threading.Lock()
        self._running = False

    @property
    def gateway_type(self) -> str:
        return "lavinmq"

    def _connect(self) -> None:
        params = pika.URLParameters(self.amqp_url)
        params.heartbeat = 30
        params.blocked_connection_timeout = 30

        self._consume_connection = pika.BlockingConnection(params)
        self._consume_channel = self._consume_connection.channel()

        self._publish_connection = pika.BlockingConnection(params)
        self._publish_channel = self._publish_connection.channel()

        self._consume_channel.queue_declare(queue=self.cmd_queue, durable=True)
        self._consume_channel.queue_declare(queue=self.event_queue, durable=True)
        self._publish_channel.queue_declare(queue=self.cmd_queue, durable=True)
        self._publish_channel.queue_declare(queue=self.event_queue, durable=True)

    def start(self, on_event: Callable[[dict], None]) -> None:
        self._running = True
        self._connect()
        threading.Thread(target=self._consume_loop, args=(on_event,), daemon=True).start()

    def _consume_loop(self, handler: Callable[[dict], None]) -> None:
        def _callback(ch, method, properties, body):
            try:
                msg = json.loads(body)
                handler(msg)
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception:
                if ch.is_open:
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        self._consume_channel.basic_qos(prefetch_count=1)
        self._consume_channel.basic_consume(queue=self.event_queue, on_message_callback=_callback)

        while self._running:
            try:
                self._consume_connection.process_data_events(time_limit=1)
            except pika.exceptions.AMQPConnectionError:
                time.sleep(1)
                self._connect()

    def send_command(self, command: dict) -> None:
        self._publish(self.cmd_queue, command)

    def _publish(self, queue: str, payload: dict) -> None:
        body = json.dumps(payload)
        with self._publish_lock:
            try:
                if not self._publish_channel or self._publish_channel.is_closed:
                    self._connect()
                self._publish_channel.basic_publish(
                    exchange="",
                    routing_key=queue,
                    body=body,
                    properties=pika.BasicProperties(delivery_mode=2),
                )
            except pika.exceptions.AMQPError:
                self._connect()
                self._publish_channel.basic_publish(
                    exchange="",
                    routing_key=queue,
                    body=body,
                    properties=pika.BasicProperties(delivery_mode=2),
                )

    def purge_queues(self) -> None:
        if not self._publish_channel or self._publish_channel.is_closed:
            self._connect()
        self._publish_channel.queue_purge(queue=self.cmd_queue)
        self._publish_channel.queue_purge(queue=self.event_queue)

    def stop(self) -> None:
        self._running = False
        if self._consume_connection and self._consume_connection.is_open:
            self._consume_connection.close()
        if self._publish_connection and self._publish_connection.is_open:
            self._publish_connection.close()
