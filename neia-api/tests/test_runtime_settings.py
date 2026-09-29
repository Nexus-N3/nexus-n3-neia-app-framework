from __future__ import annotations

import json
from pathlib import Path

from app.runtime_settings import load_gateway_runtime_settings, save_gateway_runtime_settings


def test_load_gateway_runtime_settings_defaults_to_localhost_when_no_file(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("ZEROMQ_CMD_CONNECT", raising=False)
    monkeypatch.delenv("ZEROMQ_EVENT_CONNECT", raising=False)

    settings = load_gateway_runtime_settings(base_dir=tmp_path)

    assert settings.target_host == "localhost"
    assert settings.cmd_port == 5555
    assert settings.event_port == 5556


def test_save_gateway_runtime_settings_persists_override(tmp_path: Path) -> None:
    saved = save_gateway_runtime_settings(
        target_host="nexus-n3-master.local",
        cmd_port=5555,
        event_port=5556,
        base_dir=tmp_path,
    )

    assert saved.target_host == "nexus-n3-master.local"
    payload = json.loads((tmp_path / ".neia_gateway_settings.json").read_text(encoding="utf-8"))
    assert payload["target_host"] == "nexus-n3-master.local"

    reloaded = load_gateway_runtime_settings(base_dir=tmp_path)
    assert reloaded.target_host == "nexus-n3-master.local"


def test_save_gateway_runtime_settings_creates_state_directory(tmp_path: Path) -> None:
    state_dir = tmp_path / "var" / "lib" / "neia"

    save_gateway_runtime_settings(
        target_host="localhost",
        cmd_port=5555,
        event_port=5556,
        base_dir=state_dir,
    )

    assert (state_dir / ".neia_gateway_settings.json").is_file()
