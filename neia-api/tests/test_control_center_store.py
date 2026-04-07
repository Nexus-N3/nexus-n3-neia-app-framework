from __future__ import annotations

import json
from pathlib import Path

from app.control_center_store import ControlCenterStore
from app.registry import AppRegistry


def _write_app_manifest(registry_dir: Path, app_id: str, name: str, *, app_type: str = "workflow") -> None:
    app_dir = registry_dir / app_id
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "app.json").write_text(
        json.dumps(
            {
                "id": app_id,
                "name": name,
                "version": "0.1.0",
                "app_type": app_type,
                "supports_online": True,
                "supports_offline": True,
                "layout_mode": "framed",
            }
        ),
        encoding="utf-8",
    )


def test_store_ignores_messages_without_explicit_target() -> None:
    store = ControlCenterStore()

    result = store.ingest_message(
        {
            "type": "app_catalog_update",
            "payload": {"apps": [{"id": "nexus", "control_center_enabled": True}]},
        }
    )

    assert result["status"] == "ignored"
    assert result["reason"] == "message_not_targeted_for_neia"


def test_store_merges_control_center_app_metadata_with_local_registry(tmp_path: Path) -> None:
    registry_dir = tmp_path / "registry"
    installed_file = tmp_path / "installed.json"
    _write_app_manifest(registry_dir, "nexus", "Nexus")
    _write_app_manifest(registry_dir, "nexus_load", "Nexus Load")
    installed_file.write_text(json.dumps(["nexus"]), encoding="utf-8")

    registry = AppRegistry(registry_dir=registry_dir, installed_file=installed_file)
    store = ControlCenterStore()

    result = store.ingest_message(
        {
            "type": "app_catalog_update",
            "target": "neia.control_center",
            "payload": {
                "apps": [
                    {"id": "nexus", "control_center_enabled": True, "display_order": 2},
                    {"id": "ignored_remote_only", "control_center_enabled": False},
                ]
            },
        }
    )
    catalog = store.build_app_catalog(registry)

    assert result["status"] == "accepted"
    assert catalog["control_center_state"]["cloud_app_count"] == 2
    assert [item["id"] for item in catalog["apps"]] == ["nexus", "nexus_load"]
    assert catalog["apps"][0]["installed"] is True
    assert catalog["apps"][0]["control_center_enabled"] is True
    assert catalog["apps"][0]["display_order"] == 2
    assert catalog["apps"][0]["compatible_with_subject_delivery"] is True
    assert catalog["apps"][1]["installed"] is False


def test_store_accepts_subject_catalog_updates() -> None:
    store = ControlCenterStore()

    result = store.ingest_message(
        {
            "type": "subject_catalog_update",
            "target": "neia.control_center",
            "payload": {
                "customer_id": "customer-dlr",
                "site_id": "local_home",
                "groups": [
                    {
                        "group_id": "iss_astronauts",
                        "label": "ISS Astronauts",
                        "subjects": [
                            {
                                "subject_id": "subject-a",
                                "display_name": "Astronaut A",
                                "subject_type": "astronaut",
                            }
                        ]
                    }
                ],
            },
        }
    )

    catalog = store.build_subject_catalog()

    assert result["status"] == "accepted"
    assert result["reason"] == "subject_catalog_updated"
    assert catalog["customer_id"] == "customer-dlr"
    assert catalog["groups"][0]["subjects"][0]["subject_type"] == "astronaut"


def test_store_accepts_session_config_updates_independently() -> None:
    store = ControlCenterStore()

    result = store.ingest_message(
        {
            "type": "session_config_update",
            "target": "neia.control_center",
            "payload": {
                "customer_id": "customer-dlr",
                "site_id": "local_home",
                "session_configs": [
                    {
                        "session_config_id": "cfg-1",
                        "name": "ISS Gait Capture",
                        "app_id": "nexus",
                        "subject_ids": ["subject-a", "subject-b"],
                    }
                ],
            },
        }
    )

    catalog = store.build_subject_catalog()

    assert result["status"] == "accepted"
    assert result["reason"] == "session_config_updated"
    assert catalog["session_configs"][0]["session_config_id"] == "cfg-1"


def test_store_derives_subjects_from_session_config_when_subject_catalog_is_empty() -> None:
    store = ControlCenterStore()

    result = store.ingest_message(
        {
            "type": "session_config_update",
            "target": "neia.control_center",
            "payload": {
                "customer_id": "customer-dlr",
                "site_id": "local_home",
                "session_configs": [
                    {
                        "session_config_id": "cfg-1",
                        "name": "ISS Gait Capture",
                        "subject_group_id": "iss_astronauts",
                        "subject_group_name": "ISS Astronauts",
                        "app_id": "nexus",
                        "subject_ids": ["subject-a"],
                        "subjects": [
                            {
                                "subject_id": "subject-a",
                                "display_name": "Astronaut A",
                                "subject_type": "astronaut",
                            }
                        ],
                    }
                ],
            },
        }
    )

    catalog = store.build_subject_catalog()

    assert result["status"] == "accepted"
    assert catalog["groups"][0]["group_id"] == "iss_astronauts"
    assert catalog["groups"][0]["subjects"][0]["subject_id"] == "subject-a"
    assert catalog["groups"][0]["subjects"][0]["display_name"] == "Astronaut A"


def test_store_clears_session_config_catalog_and_derived_subjects() -> None:
    store = ControlCenterStore()

    store.ingest_message(
        {
            "type": "session_config_update",
            "target": "neia.control_center",
            "payload": {
                "customer_id": "customer-dlr",
                "site_id": "local_home",
                "session_configs": [
                    {
                        "session_config_id": "cfg-1",
                        "name": "ISS Gait Capture",
                        "subject_group_id": "iss_astronauts",
                        "subject_group_name": "ISS Astronauts",
                        "subject_ids": ["subject-a"],
                        "subjects": [
                            {
                                "subject_id": "subject-a",
                                "display_name": "Astronaut A",
                                "subject_type": "astronaut",
                            }
                        ],
                    }
                ],
            },
        }
    )

    result = store.ingest_message(
        {
            "type": "session_config_update",
            "target": "neia.control_center",
            "payload": {
                "customer_id": "customer-dlr",
                "site_id": "local_home",
                "session_configs": [],
            },
        }
    )

    catalog = store.build_subject_catalog()

    assert result["status"] == "accepted"
    assert result["session_config_count"] == 0
    assert catalog["session_configs"] == []
    assert catalog["groups"] == []
