from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .registry import AppRegistry


TARGET_ALIASES = {
    "control_center",
    "neia",
    "neia_api",
    "neia.control_center",
    "neia-api.control_center",
}
SUPPORTED_MESSAGE_TYPES = {"app_catalog_update", "subject_catalog_update", "session_config_update"}
WORKFLOW_APP_IDS = {"nexus", "nexus_load"}
FORWARDED_EVENT_TYPES = {"control_center_message", "neia_control_message"}
DUMMY_SUBJECT_CATALOG = {
    "customer_id": "customer-dlr",
    "site_id": "local_home",
    "groups": [
        {
            "group_id": "walking_demo_group",
            "label": "Walking Demo Group",
            "subjects": [
                {
                    "subject_id": "astronaut-a",
                    "display_name": "Astronaut A",
                    "subject_type": "astronaut",
                },
                {
                    "subject_id": "astronaut-b",
                    "display_name": "Astronaut B",
                    "subject_type": "astronaut",
                },
            ],
        }
    ],
}
DUMMY_SESSION_CONFIG_CATALOG = {
    "customer_id": "customer-dlr",
    "site_id": "local_home",
    "session_configs": [
        {
            "session_config_id": "cfg-demo-walking-nexus",
            "name": "Walking Demo",
            "app_id": "nexus",
            "app_name": "Nexus Session Management",
            "subject_ids": ["astronaut-a", "astronaut-b"],
            "activity": "walking",
            "workflow": {
                "setup_id": "default",
                "algorithm_name": "standard_loading_intensity",
                "sensors": [
                    {
                        "local_name": "Movella DOT",
                        "number_of": 2,
                        "compute_algorithm": {
                            "name": "standard_loading_intensity",
                            "inputs": {},
                        },
                        "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                    }
                ],
            },
            "subjects": [
                {
                    "subject_id": "astronaut-a",
                    "display_name": "Astronaut A",
                    "subject_type": "astronaut",
                    "sensors": [
                        {
                            "local_name": "Movella DOT",
                            "number_of": 2,
                            "compute_algorithm": {
                                "name": "standard_loading_intensity",
                                "inputs": {},
                            },
                            "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                        }
                    ],
                },
                {
                    "subject_id": "astronaut-b",
                    "display_name": "Astronaut B",
                    "subject_type": "astronaut",
                    "sensors": [
                        {
                            "local_name": "Movella DOT",
                            "number_of": 2,
                            "compute_algorithm": {
                                "name": "standard_loading_intensity",
                                "inputs": {},
                            },
                            "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                        }
                    ],
                },
            ],
            "init_payload": {
                "init_label": "Walking Demo",
                "app_id": "nexus",
                "app_name": "Nexus Session Management",
                "subjects": [
                    {
                        "subject_id": "astronaut-a",
                        "sensors": [
                            {
                                "local_name": "Movella DOT",
                                "number_of": 2,
                                "compute_algorithm": {
                                    "name": "standard_loading_intensity",
                                    "inputs": {},
                                },
                                "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                            }
                        ],
                    },
                    {
                        "subject_id": "astronaut-b",
                        "sensors": [
                            {
                                "local_name": "Movella DOT",
                                "number_of": 2,
                                "compute_algorithm": {
                                    "name": "standard_loading_intensity",
                                    "inputs": {},
                                },
                                "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                            }
                        ],
                    },
                ],
            },
        }
    ],
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ControlCenterStore:
    def __init__(self) -> None:
        self._cloud_app_metadata: dict[str, dict[str, Any]] = {}
        self._subject_catalog: dict[str, Any] = {
            "customer_id": None,
            "site_id": None,
            "groups": [],
        }
        self._session_config_catalog: dict[str, Any] = {
            "customer_id": None,
            "site_id": None,
            "session_configs": [],
        }
        self._last_message_type: str | None = None
        self._last_updated_at: str | None = None

    def ingest_message(self, message: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(message, dict):
            return {"status": "ignored", "reason": "invalid_message"}

        if not self._is_targeted(message):
            return {"status": "ignored", "reason": "message_not_targeted_for_neia"}

        message_type = str(message.get("type") or "").strip()
        if message_type not in SUPPORTED_MESSAGE_TYPES:
            return {"status": "ignored", "reason": f"unsupported_message_type:{message_type or 'missing'}"}

        payload = message.get("payload")
        if not isinstance(payload, dict):
            return {"status": "rejected", "reason": "invalid_payload"}

        if message_type == "app_catalog_update":
            result = self._ingest_app_catalog(payload)
        elif message_type == "subject_catalog_update":
            result = self._ingest_subject_catalog(payload)
        else:
            result = self._ingest_session_config_catalog(payload)
        self._last_message_type = message_type
        self._last_updated_at = _utc_now_iso()
        return result

    def handle_gateway_event(self, event: dict[str, Any]) -> None:
        if not isinstance(event, dict):
            return
        event_type = str(event.get("type") or "").strip()
        if event_type not in FORWARDED_EVENT_TYPES:
            return
        payload = event.get("payload")
        if isinstance(payload, dict):
            self.ingest_message(payload)

    def build_app_catalog(self, registry: AppRegistry) -> dict[str, Any]:
        apps: list[dict[str, Any]] = []
        for info in registry.list_all():
            manifest = info.manifest
            cloud_metadata = self._cloud_app_metadata.get(manifest.id, {})
            app_entry = {
                "id": manifest.id,
                "name": manifest.name,
                "version": manifest.version,
                "description": manifest.description,
                "app_type": manifest.app_type,
                "developer": manifest.developer,
                "icon": manifest.icon,
                "layout_mode": manifest.layout_mode,
                "supports_online": manifest.supports_online,
                "supports_offline": manifest.supports_offline,
                "installed": info.installed,
                "compatible_with_subject_delivery": manifest.id in WORKFLOW_APP_IDS,
            }
            for key, value in cloud_metadata.items():
                if key in {"id", "installed"}:
                    continue
                app_entry[key] = value
            apps.append(app_entry)

        return {
            "apps": apps,
            "control_center_state": {
                "last_message_type": self._last_message_type,
                "last_updated_at": self._last_updated_at,
                "cloud_app_count": len(self._cloud_app_metadata),
            },
        }

    def build_subject_catalog(self) -> dict[str, Any]:
        return {
            "customer_id": self._subject_catalog.get("customer_id"),
            "site_id": self._subject_catalog.get("site_id"),
            "groups": list(self._subject_catalog.get("groups", [])),
            "session_configs": list(self._session_config_catalog.get("session_configs", [])),
            "control_center_state": {
                "last_message_type": self._last_message_type,
                "last_updated_at": self._last_updated_at,
            },
        }

    def _ingest_app_catalog(self, payload: dict[str, Any]) -> dict[str, Any]:
        apps = payload.get("apps")
        if not isinstance(apps, list):
            return {"status": "rejected", "reason": "invalid_apps_payload"}

        app_metadata: dict[str, dict[str, Any]] = {}
        for item in apps:
            if not isinstance(item, dict):
                continue
            app_id = str(item.get("id") or item.get("app_id") or "").strip()
            if not app_id:
                continue
            app_metadata[app_id] = dict(item)
            app_metadata[app_id]["id"] = app_id

        self._cloud_app_metadata = app_metadata
        return {
            "status": "accepted",
            "reason": "app_catalog_updated",
            "app_count": len(app_metadata),
        }

    def _ingest_subject_catalog(self, payload: dict[str, Any]) -> dict[str, Any]:
        groups = payload.get("groups")
        if not isinstance(groups, list):
            return {"status": "rejected", "reason": "invalid_groups_payload"}

        normalized_groups: list[dict[str, Any]] = []
        subject_count = 0
        for item in groups:
            if not isinstance(item, dict):
                continue
            subjects: list[dict[str, Any]] = []
            for subject in item.get("subjects", []):
                if not isinstance(subject, dict):
                    continue
                subject_id = str(subject.get("subject_id") or "").strip()
                if not subject_id:
                    continue
                subjects.append(
                    {
                        "subject_id": subject_id,
                        "display_name": subject.get("display_name") or subject_id,
                        "subject_type": subject.get("subject_type"),
                    }
                )

            subject_count += len(subjects)
            normalized_groups.append(
                {
                    "group_id": item.get("group_id"),
                    "label": item.get("label") or item.get("group_id") or "Subjects",
                    "subjects": subjects,
                }
            )

        self._subject_catalog = {
            "customer_id": payload.get("customer_id"),
            "site_id": payload.get("site_id"),
            "groups": normalized_groups,
        }
        return {
            "status": "accepted",
            "reason": "subject_catalog_updated",
            "group_count": len(normalized_groups),
            "subject_count": subject_count,
        }

    def _ingest_session_config_catalog(self, payload: dict[str, Any]) -> dict[str, Any]:
        session_configs = payload.get("session_configs")
        if not isinstance(session_configs, list):
            return {"status": "rejected", "reason": "invalid_session_configs_payload"}

        normalized_configs: list[dict[str, Any]] = []
        for config in session_configs:
            if not isinstance(config, dict):
                continue
            session_config_id = str(config.get("session_config_id") or "").strip()
            if not session_config_id:
                continue
            normalized_configs.append(
                {
                    "session_config_id": session_config_id,
                    "name": config.get("name") or session_config_id,
                    "app_id": config.get("app_id"),
                    "app_name": config.get("app_name"),
                    "subject_ids": list(config.get("subject_ids", [])) if isinstance(config.get("subject_ids"), list) else [],
                    "activity": config.get("activity"),
                    "workflow": config.get("workflow") if isinstance(config.get("workflow"), dict) else {},
                    "subjects": list(config.get("subjects", [])) if isinstance(config.get("subjects"), list) else [],
                    "init_payload": config.get("init_payload") if isinstance(config.get("init_payload"), dict) else {},
                }
            )

        self._session_config_catalog = {
            "customer_id": payload.get("customer_id"),
            "site_id": payload.get("site_id"),
            "session_configs": normalized_configs,
        }
        return {
            "status": "accepted",
            "reason": "session_config_updated",
            "session_config_count": len(normalized_configs),
        }

    @staticmethod
    def _is_targeted(message: dict[str, Any]) -> bool:
        targets: set[str] = set()
        for key in ("target", "consumer", "bridge"):
            value = message.get(key)
            if isinstance(value, str):
                normalized = value.strip().lower()
                if normalized:
                    targets.add(normalized)
        for key in ("targets", "consumers"):
            value = message.get(key)
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, str):
                        normalized = item.strip().lower()
                        if normalized:
                            targets.add(normalized)
        return bool(targets & TARGET_ALIASES)
