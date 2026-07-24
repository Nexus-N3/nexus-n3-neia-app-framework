from __future__ import annotations

import json
from pathlib import Path

from app.registry import AppRegistry


def test_registry_reads_manifests_from_custom_registry_dir(tmp_path: Path) -> None:
    registry_dir = tmp_path / "custom-registry"
    app_dir = registry_dir / "nexus"
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "app.json").write_text(
        json.dumps(
            {
                "id": "nexus",
                "name": "Nexus",
                "version": "0.1.0",
                "entry_ui": "ui/assets/index.js",
                "mount": "NexusMount",
            }
        ),
        encoding="utf-8",
    )

    registry = AppRegistry(registry_dir=registry_dir, installed_file=tmp_path / "installed.json")
    manifest = registry.load_manifest("nexus")

    assert manifest.id == "nexus"
    assert registry.resolve_app_dir("nexus") == app_dir


def test_registry_uses_custom_installed_file(tmp_path: Path) -> None:
    registry_dir = tmp_path / "registry"
    app_dir = registry_dir / "nexus"
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "app.json").write_text(
        json.dumps(
            {
                "id": "nexus",
                "name": "Nexus",
                "version": "0.1.0",
            }
        ),
        encoding="utf-8",
    )
    installed_file = tmp_path / "state" / "installed.json"

    registry = AppRegistry(registry_dir=registry_dir, installed_file=installed_file)
    registry.install("nexus")

    assert installed_file.exists()
    assert json.loads(installed_file.read_text(encoding="utf-8")) == ["nexus"]
