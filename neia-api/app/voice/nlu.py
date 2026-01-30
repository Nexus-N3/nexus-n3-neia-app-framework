import re
from typing import Any, Dict, Optional, Tuple


def _parse_counts(text: str) -> Tuple[int, int]:
    subjects = 1
    sensors = 1
    match_subjects = re.search(r"(\\d+)\\s+subjects?", text)
    if match_subjects:
        subjects = int(match_subjects.group(1))
    match_sensors = re.search(r"(\\d+)\\s+(?:movella\\s+dots?|dots?|movesense|cameras?|camera)", text)
    if match_sensors:
        sensors = int(match_sensors.group(1))
    return subjects, sensors


def _parse_sensor_name(text: str) -> str:
    if "movesense" in text:
        return "Movesense"
    if "camera" in text:
        return "USB Camera"
    return "Movella DOT"


def _parse_algorithm(text: str) -> Tuple[str, Dict[str, Any]]:
    if "loading" in text:
        return "standard_loading_intensity", {"gravity": 9.80665}
    if "pass through" in text or "passthrough" in text:
        return "pass_through", {}
    return "standard_loading_intensity", {"gravity": 9.80665}


def parse_command(text: str) -> Optional[Dict[str, Any]]:
    cleaned = text.strip().lower()
    if not cleaned:
        return None

    if "server ready" in cleaned or "is the server ready" in cleaned:
        return {"type": "is_server_ready", "payload": {}}

    return None
