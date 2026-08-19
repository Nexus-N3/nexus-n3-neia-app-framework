from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from typing import Any
from urllib.parse import urlsplit


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _first(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def _state(value: Any) -> str | None:
    if isinstance(value, bool):
        return "available" if value else "unavailable"
    return _string(value)


class CoreStateStore:
    """Normalizes the latest Nexus N3 Core events for read-only shell views."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._attempt_started_at: datetime | None = None
        self._connection: dict[str, Any] = {
            "state": "disconnected",
            "available": False,
            "error": None,
            "last_event_at": None,
            "last_ready_at": None,
        }
        self._capabilities: dict[str, Any] = {
            "sensors": [],
            "algorithms": [],
            "updated_at": None,
        }
        self._archive_service: dict[str, Any] = {"available": False}
        self._status: dict[str, Any] = {
            "version": None,
            "readiness": "unknown",
            "usb": {
                "state": "unknown",
                "present": None,
                "mounted": None,
                "capacity_bytes": None,
                "available_bytes": None,
                "error": None,
            },
            "ble": {
                "backend": None,
                "adapter_state": "unknown",
                "gateway_state": "unknown",
            },
            "azure_bridge": {"state": "unknown"},
            "active_session": {"state": "inactive", "session_id": None},
            "services": [],
            "updated_at": None,
        }

    def begin_connection_attempt(self) -> None:
        with self._lock:
            self._attempt_started_at = datetime.now(timezone.utc)
            self._connection.update(
                {
                    "state": "connecting",
                    "available": False,
                    "error": None,
                }
            )

    def mark_connection_error(self, error: str) -> None:
        with self._lock:
            self._attempt_started_at = None
            self._connection.update(
                {
                    "state": "error",
                    "available": False,
                    "error": error,
                }
            )

    def handle_gateway_event(self, event: dict[str, Any]) -> None:
        #print(f"gateway event", event)
        if not isinstance(event, dict):
            return
        event_type = _string(event.get("type"))
        if not event_type:
            return

        payload = _record(event.get("payload"))
        received_at = _utc_now_iso()
        with self._lock:
            self._connection["last_event_at"] = received_at

            if event_type == "server_ready":
                #print(f"server ready payload", payload)
                self._ingest_server_ready(payload, received_at)
            if event_type == "device_info":
                # should ingest the device info payload
                self._ingest_device_info(payload, received_at)
            elif event_type in {"usb_status", "usb_disk_inserted", "usb_disk_removed"}:
                self._ingest_usb(event_type, payload, received_at)
            elif event_type in {"ble_status", "ble_backend_status", "ble_gateway_status"}:
                self._ingest_ble(payload, received_at)
            elif event_type in {"azure_bridge_status", "azure_status"}:
                self._ingest_azure(payload, received_at)
            elif event_type in {"service_health", "services_health"}:
                self._ingest_services(payload, received_at)
            elif event_type in {
                "system_initialized",
                "stream_started",
                "stream_warmup_started",
                "stream_official_started",
            }:
                self._set_active_session(event_type, payload, received_at)
            elif event_type in {"stream_drained", "session_completed", "system_reset"}:
                self._status["active_session"] = {
                    "state": "completed" if event_type != "system_reset" else "inactive",
                    "session_id": _first(payload, "session_id", "id"),
                }
                self._status["updated_at"] = received_at
            elif event_type == "error" and self._connection["state"] == "connecting":
                error = event.get("payload")
                self._connection.update(
                    {
                        "state": "error",
                        "available": False,
                        "error": error if isinstance(error, str) else "Core connection error",
                    }
                )

    def connection_snapshot(self, settings: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._expire_connection_attempt()
            return {**deepcopy(settings), **deepcopy(self._connection)}

    def capabilities_snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._expire_connection_attempt()
            return {
                **deepcopy(self._capabilities),
                "connection_state": self._connection["state"],
                "available": self._connection["available"],
            }

    def status_snapshot(self, settings: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._expire_connection_attempt()
            return {
                "endpoint": settings.get("target_host"),
                "cmd_port": settings.get("cmd_port"),
                "event_port": settings.get("event_port"),
                "gateway": settings.get("gateway"),
                "connection": deepcopy(self._connection),
                **deepcopy(self._status),
            }

    def archive_service_snapshot(self) -> dict[str, Any]:
        """Return only validated archive-service discovery metadata."""
        with self._lock:
            return deepcopy(self._archive_service)

    def _ingest_server_ready(self, payload: dict[str, Any], received_at: str) -> None:
        self._attempt_started_at = None
        self._connection.update(
            {
                "state": "connected",
                "available": True,
                "error": None,
                "last_ready_at": received_at,
            }
        )
        sensors, algorithms = self._normalize_capabilities(payload)
        self._capabilities = {
            "sensors": sensors,
            "algorithms": algorithms,
            "updated_at": received_at,
        }
        raw_readiness = _first(payload, "readiness", "ready", "state")
        readiness = (
            "ready"
            if raw_readiness is True
            else "not_ready"
            if raw_readiness is False
            else _state(raw_readiness) or "ready"
        )
        self._status.update(
            {
                "version": _first(payload, "version", "core_version", "server_version"),
                "readiness": readiness,
                "updated_at": received_at,
            }
        )
        self._archive_service = self._normalize_archive_service(
            payload.get("archive_service"),
            payload.get("site"),
        )
        self._ingest_embedded_status(payload)

    @staticmethod
    def _normalize_archive_service(value: Any, site_value: Any) -> dict[str, Any]:
        service = _record(value)
        site = _string(site_value)
        unavailable = {"available": False, **({"site": site} if site else {})}
        if service.get("available") is not True:
            return unavailable
        scheme = _string(service.get("scheme"))
        port = service.get("port")
        list_path = _string(service.get("list_path"))
        download_path = _string(service.get("download_path"))
        if not site or scheme not in {"http", "https"}:
            return unavailable
        if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
            return unavailable
        if not CoreStateStore._safe_service_path(list_path):
            return unavailable
        if not CoreStateStore._safe_service_path(download_path):
            return unavailable
        return {
            "available": True,
            "site": site,
            "scheme": scheme,
            "port": port,
            "list_path": list_path,
            "download_path": download_path,
        }

    @staticmethod
    def _safe_service_path(path: str | None) -> bool:
        if not path or not path.startswith("/") or "\\" in path:
            return False
        parts = urlsplit(path)
        if parts.scheme or parts.netloc or parts.query or parts.fragment:
            return False
        return all(segment not in {".", ".."} for segment in parts.path.split("/"))

    def _expire_connection_attempt(self) -> None:
        if self._connection["state"] != "connecting" or not self._attempt_started_at:
            return
        elapsed = (datetime.now(timezone.utc) - self._attempt_started_at).total_seconds()
        if elapsed < 8:
            return
        self._attempt_started_at = None
        self._connection.update(
            {
                "state": "disconnected",
                "available": False,
                "error": "Nexus N3 Core did not report readiness.",
            }
        )

    def _normalize_capabilities(
        self, payload: dict[str, Any]
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        raw_sensors = _first(payload, "supported_sensors", "sensors", "sensor_types")
        sensors: list[dict[str, Any]] = []
        algorithms_by_id: dict[str, dict[str, Any]] = {}

        if not isinstance(raw_sensors, list):
            raw_sensors = []

        for raw_sensor in raw_sensors:
            if isinstance(raw_sensor, str):
                raw_sensor = {"name": raw_sensor}
            sensor = _record(raw_sensor)
            sensor_id = _string(
                _first(sensor, "id", "sensor_id", "type", "name", "local_name")
            )
            if not sensor_id:
                continue
            display_name = (
                _string(_first(sensor, "display_name", "label", "name")) or sensor_id
            )
            raw_locations = _first(sensor, "locations", "supported_locations")
            locations = (
                [item for item in raw_locations if isinstance(item, str)]
                if isinstance(raw_locations, list)
                else []
            )
            raw_algorithms = _first(
                sensor, "algorithms", "supported_algorithms", "computations"
            )
            algorithm_ids: list[str] = []
            if not isinstance(raw_algorithms, list):
                raw_algorithms = []
            for raw_algorithm in raw_algorithms:
                if isinstance(raw_algorithm, str):
                    raw_algorithm = {"name": raw_algorithm}
                algorithm = _record(raw_algorithm)
                algorithm_id = _string(
                    _first(algorithm, "id", "algorithm_id", "name")
                )
                if not algorithm_id:
                    continue
                algorithm_ids.append(algorithm_id)
                entry = algorithms_by_id.setdefault(
                    algorithm_id,
                    {
                        "id": algorithm_id,
                        "display_name": _string(
                            _first(algorithm, "display_name", "label", "name")
                        )
                        or algorithm_id,
                        "compatible_sensor_types": [],
                        "result_stages": [],
                        "output_types": [],
                        "inputs": deepcopy(_record(algorithm.get("inputs"))),
                        "available": True,
                    },
                )
                if sensor_id not in entry["compatible_sensor_types"]:
                    entry["compatible_sensor_types"].append(sensor_id)
                stages = _first(algorithm, "result_stages", "stages")
                outputs = _first(algorithm, "output_types", "outputs")
                if isinstance(stages, list):
                    entry["result_stages"] = [
                        value for value in stages if isinstance(value, str)
                    ]
                if isinstance(outputs, list):
                    entry["output_types"] = [
                        value for value in outputs if isinstance(value, str)
                    ]
                inputs = algorithm.get("inputs")
                if isinstance(inputs, dict):
                    entry["inputs"] = deepcopy(inputs)
                availability = _first(
                    algorithm, "available", "installed", "is_available"
                )
                if isinstance(availability, bool):
                    entry["available"] = availability

            availability = _first(sensor, "available", "installed", "is_available")
            sensors.append(
                {
                    "id": sensor_id,
                    "display_name": display_name,
                    "supported_locations": locations,
                    "supported_algorithms": algorithm_ids,
                    "available": availability
                    if isinstance(availability, bool)
                    else True,
                }
            )

        raw_algorithms = _first(payload, "supported_algorithms", "algorithms")
        if isinstance(raw_algorithms, list):
            for raw_algorithm in raw_algorithms:
                if isinstance(raw_algorithm, str):
                    raw_algorithm = {"name": raw_algorithm}
                algorithm = _record(raw_algorithm)
                algorithm_id = _string(
                    _first(algorithm, "id", "algorithm_id", "name")
                )
                if not algorithm_id:
                    continue
                entry = algorithms_by_id.setdefault(
                    algorithm_id,
                    {
                        "id": algorithm_id,
                        "display_name": algorithm_id,
                        "compatible_sensor_types": [],
                        "result_stages": [],
                        "output_types": [],
                        "inputs": deepcopy(_record(algorithm.get("inputs"))),
                        "available": True,
                    },
                )
                entry["display_name"] = (
                    _string(_first(algorithm, "display_name", "label", "name"))
                    or entry["display_name"]
                )
                compatible = _first(
                    algorithm, "compatible_sensor_types", "sensor_types"
                )
                if isinstance(compatible, list):
                    entry["compatible_sensor_types"] = [
                        value for value in compatible if isinstance(value, str)
                    ]
                stages = _first(algorithm, "result_stages", "stages")
                outputs = _first(algorithm, "output_types", "outputs")
                if isinstance(stages, list):
                    entry["result_stages"] = [
                        value for value in stages if isinstance(value, str)
                    ]
                if isinstance(outputs, list):
                    entry["output_types"] = [
                        value for value in outputs if isinstance(value, str)
                    ]
                inputs = algorithm.get("inputs")
                if isinstance(inputs, dict):
                    entry["inputs"] = deepcopy(inputs)

        return sensors, list(algorithms_by_id.values())

    def _ingest_embedded_status(self, payload: dict[str, Any]) -> None:
        usb = _record(_first(payload, "usb", "usb_status", "usb_storage"))
        if usb:
            self._update_usb_from_payload(usb)
        ble = _record(_first(payload, "ble", "ble_status"))
        if ble:
            self._update_ble_from_payload(ble)
        azure = _record(_first(payload, "azure_bridge", "azure", "active_bridge"))
        if azure:
            self._update_azure_from_payload(azure)
        services = _first(payload, "services", "service_health")
        if isinstance(services, list):
            self._status["services"] = deepcopy(services)

    def _ingest_usb(
        self, event_type: str, payload: dict[str, Any], received_at: str
    ) -> None:
        if event_type == "usb_disk_inserted":
            payload = {**payload, "present": True}
        elif event_type == "usb_disk_removed":
            payload = {**payload, "present": False, "mounted": False}
        self._update_usb_from_payload(payload)
        self._status["updated_at"] = received_at

    def _update_usb_from_payload(self, payload: dict[str, Any]) -> None:
        present = _first(payload, "present", "connected", "disk_connected")
        mounted = _first(payload, "mounted", "is_mounted")
        self._status["usb"] = {
            "state": _state(_first(payload, "state", "status"))
            or (
                "available"
                if present is True
                else "unavailable"
                if present is False
                else "unknown"
            ),
            "present": present if isinstance(present, bool) else None,
            "mounted": mounted if isinstance(mounted, bool) else None,
            "capacity_bytes": _first(
                payload, "capacity_bytes", "total_bytes", "capacity"
            ),
            "available_bytes": _first(
                payload, "available_bytes", "free_bytes", "free"
            ),
            "error": _string(payload.get("error")),
        }

    def _ingest_ble(self, payload: dict[str, Any], received_at: str) -> None:
        self._update_ble_from_payload(payload)
        self._status["updated_at"] = received_at

    def _update_ble_from_payload(self, payload: dict[str, Any]) -> None:
        self._status["ble"] = {
            "backend": _first(payload, "backend", "active_backend", "type"),
            "adapter_state": _state(
                _first(payload, "adapter_state", "host_adapter_state", "adapter")
            )
            or "unknown",
            "gateway_state": _state(
                _first(payload, "gateway_state", "ble_gateway_state", "gateway")
            )
            or "unknown",
        }

    def _update_azure_from_payload(self, payload: dict[str, Any]) -> None:
        device = _record(payload.get("device"))
        raw_state = (
            _first(device, "active_bridge")
            if device
            else _first(payload, "active_bridge", "connected", "state", "status")
        )

        self._status["azure_bridge"] = {
            "state": (
                "not_set"
                if device and raw_state is False
                else _state(raw_state) or "unknown"
            )
        }

    def _ingest_device_info(self, payload: dict[str, Any], recieved_at: str) -> None:
        version = _first(payload["device"], "software_version")
        ble_adater = payload["ble"]["backend_label"]

        self._status["version"] = version
        self._status["ble"]["adapter_state"] = ble_adater
        
        # ingest the azure piece
        self._ingest_azure(payload, recieved_at)
        

    def _ingest_azure(self, payload: dict[str, Any], received_at: str) -> None:
        self._update_azure_from_payload(payload)
        self._status["updated_at"] = received_at

    def _ingest_services(self, payload: dict[str, Any], received_at: str) -> None:
        services = _first(payload, "services", "health")
        if isinstance(services, list):
            self._status["services"] = deepcopy(services)
        elif payload:
            self._status["services"] = [
                {"name": key, "state": value} for key, value in payload.items()
            ]
        self._status["updated_at"] = received_at

    def _set_active_session(
        self, event_type: str, payload: dict[str, Any], received_at: str
    ) -> None:
        states = {
            "system_initialized": "initialized",
            "stream_started": "starting",
            "stream_warmup_started": "warming_up",
            "stream_official_started": "active",
        }
        self._status["active_session"] = {
            "state": states[event_type],
            "session_id": _first(payload, "session_id", "id", "init_label"),
        }
        self._status["updated_at"] = received_at
