from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core_state_store import CoreStateStore


SETTINGS = {
    "gateway": "zeromq",
    "site": "test-site",
    "target_host": "nexus-n3-master.local",
    "cmd_port": 5555,
    "event_port": 5556,
}


def test_initial_state_is_disconnected_and_unknown() -> None:
    store = CoreStateStore()

    connection = store.connection_snapshot(SETTINGS)
    status = store.status_snapshot(SETTINGS)

    assert connection["state"] == "disconnected"
    assert connection["available"] is False
    assert status["endpoint"] == "nexus-n3-master.local"
    assert status["usb"]["state"] == "unknown"
    assert status["ble"]["backend"] is None
    assert status["azure_bridge"]["state"] == "unknown"


def test_server_ready_normalizes_capabilities_and_status() -> None:
    store = CoreStateStore()
    store.begin_connection_attempt()
    store.handle_gateway_event(
        {
            "type": "server_ready",
            "payload": {
                "site": "lab",
                "core_version": "3.2.1",
                "ready": True,
                "supported_sensors": [
                    {
                        "id": "movella-dot",
                        "name": "Movella DOT",
                        "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                        "computations": [
                            {
                                "name": "loading",
                                "result_stages": ["realtime", "consolidated"],
                                "inputs": {"window": 10},
                            }
                        ],
                    }
                ],
                "ble": {
                    "backend": "gateway",
                    "adapter_state": "connected",
                    "gateway_state": "available",
                },
                "azure_bridge": {"connected": False},
            },
        }
    )

    connection = store.connection_snapshot(SETTINGS)
    capabilities = store.capabilities_snapshot()
    status = store.status_snapshot(SETTINGS)

    assert connection["state"] == "connected"
    assert connection["available"] is True
    assert capabilities["sensors"] == [
        {
            "id": "movella-dot",
            "display_name": "Movella DOT",
            "supported_locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
            "supported_algorithms": ["loading"],
            "available": True,
        }
    ]
    assert capabilities["algorithms"][0]["compatible_sensor_types"] == [
        "movella-dot"
    ]
    assert capabilities["algorithms"][0]["result_stages"] == [
        "realtime",
        "consolidated",
    ]
    assert capabilities["algorithms"][0]["inputs"] == {"window": 10}
    assert status["version"] == "3.2.1"
    assert status["readiness"] == "ready"
    assert status["ble"]["backend"] == "gateway"
    assert status["azure_bridge"]["state"] == "unavailable"


def test_missing_capabilities_are_safe_empty_lists() -> None:
    store = CoreStateStore()
    store.handle_gateway_event({"type": "server_ready", "payload": {}})

    capabilities = store.capabilities_snapshot()

    assert capabilities["sensors"] == []
    assert capabilities["algorithms"] == []
    assert capabilities["available"] is True


def test_usb_and_active_session_events_update_status() -> None:
    store = CoreStateStore()
    store.handle_gateway_event(
        {
            "type": "usb_status",
            "payload": {
                "present": True,
                "mounted": True,
                "capacity_bytes": 1000,
                "available_bytes": 400,
            },
        }
    )
    store.handle_gateway_event(
        {
            "type": "stream_official_started",
            "payload": {"session_id": "session-42"},
        }
    )

    status = store.status_snapshot(SETTINGS)

    assert status["usb"]["state"] == "available"
    assert status["usb"]["mounted"] is True
    assert status["usb"]["capacity_bytes"] == 1000
    assert status["active_session"] == {
        "state": "active",
        "session_id": "session-42",
    }


def test_malformed_events_do_not_clear_existing_state() -> None:
    store = CoreStateStore()
    store.handle_gateway_event(
        {"type": "server_ready", "payload": {"core_version": "1.0"}}
    )
    store.handle_gateway_event({"type": "usb_status", "payload": "invalid"})
    store.handle_gateway_event({"payload": {}})

    status = store.status_snapshot(SETTINGS)

    assert status["version"] == "1.0"
    assert status["connection"]["state"] == "connected"


def test_connection_attempt_expires_when_core_does_not_report_readiness() -> None:
    store = CoreStateStore()
    store.begin_connection_attempt()
    store._attempt_started_at = datetime.now(timezone.utc) - timedelta(seconds=9)

    connection = store.connection_snapshot(SETTINGS)

    assert connection["state"] == "disconnected"
    assert connection["available"] is False
    assert connection["error"] == "Nexus N3 Core did not report readiness."
