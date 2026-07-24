from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

from .config import AMQP_URL, BASE_DIR, NEIA_GATEWAY, NEIA_SITE


@dataclass
class GatewayRuntimeSettings:
    gateway_type: str
    site: str
    target_host: str
    cmd_port: int
    event_port: int
    amqp_url: str | None = None

    def as_public_dict(self) -> dict[str, object]:
        return {
            "gateway": self.gateway_type,
            "site": self.site,
            "target_host": self.target_host,
            "cmd_port": self.cmd_port,
            "event_port": self.event_port,
            "amqp_url": self.amqp_url,
        }


def _settings_path(base_dir: Path = BASE_DIR) -> Path:
    return base_dir / ".neia_gateway_settings.json"


def _parse_tcp_endpoint(raw: str | None, fallback_host: str, fallback_port: int) -> tuple[str, int]:
    if not raw:
        return fallback_host, fallback_port
    parsed = urlparse(raw)
    host = parsed.hostname or fallback_host
    port = parsed.port or fallback_port
    return host, port


def _default_gateway_settings() -> GatewayRuntimeSettings:
    cmd_host, cmd_port = _parse_tcp_endpoint(
        os.getenv("ZEROMQ_CMD_CONNECT"),
        "localhost",
        5555,
    )
    event_host, event_port = _parse_tcp_endpoint(
        os.getenv("ZEROMQ_EVENT_CONNECT"),
        cmd_host,
        5556,
    )
    return GatewayRuntimeSettings(
        gateway_type=NEIA_GATEWAY,
        site=NEIA_SITE,
        target_host=cmd_host,
        cmd_port=cmd_port,
        event_port=event_port,
        amqp_url=AMQP_URL,
    )


def load_gateway_runtime_settings(base_dir: Path = BASE_DIR) -> GatewayRuntimeSettings:
    settings = _default_gateway_settings()
    path = _settings_path(base_dir)
    if not path.exists():
        return settings
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return settings
    if not isinstance(payload, dict):
        return settings
    target_host = payload.get("target_host")
    cmd_port = payload.get("cmd_port")
    event_port = payload.get("event_port")
    if isinstance(target_host, str) and target_host.strip():
        settings.target_host = target_host.strip()
    if isinstance(cmd_port, int) and cmd_port > 0:
        settings.cmd_port = cmd_port
    if isinstance(event_port, int) and event_port > 0:
        settings.event_port = event_port
    gateway_type = payload.get("gateway")
    if isinstance(gateway_type, str) and gateway_type.strip():
        settings.gateway_type = gateway_type.strip().lower()
    site = payload.get("site")
    if isinstance(site, str) and site.strip():
        settings.site = site.strip()
    amqp_url = payload.get("amqp_url")
    if isinstance(amqp_url, str) and amqp_url.strip():
        settings.amqp_url = amqp_url.strip()
    return settings


def save_gateway_runtime_settings(
    *,
    target_host: str,
    cmd_port: int,
    event_port: int,
    base_dir: Path = BASE_DIR,
) -> GatewayRuntimeSettings:
    settings = load_gateway_runtime_settings(base_dir=base_dir)
    settings.target_host = target_host.strip()
    settings.cmd_port = cmd_port
    settings.event_port = event_port
    path = _settings_path(base_dir)
    path.write_text(json.dumps(asdict(settings), indent=2), encoding="utf-8")
    return settings
