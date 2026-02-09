import re
from typing import Any, Dict, Optional, Tuple


def _parse_counts(text: str) -> Tuple[int, Optional[int]]:
    subjects = 1
    sensors: Optional[int] = None
    match_subjects = re.search(r"(\d+)\s+subjects?", text)
    if match_subjects:
        subjects = int(match_subjects.group(1))
    else:
        for word, value in _NUMBER_WORDS.items():
            if re.search(rf"\b{word}\s+subjects?\b", text):
                subjects = value
                break
    match_sensors = re.search(r"(\d+)\s+(?:movella\s+dots?|dots?|movesense|cameras?|camera)", text)
    if match_sensors:
        sensors = int(match_sensors.group(1))
    else:
        for word, value in _NUMBER_WORDS.items():
            if re.search(rf"\b{word}\s+(?:movella\s+dots?|dots?|movesense|cameras?|camera)\b", text):
                sensors = value
                break
        if sensors is None:
            # Fuzzy fallback for ASR variants like "to vuel dots":
            # if a count word exists anywhere and sensor keywords exist anywhere, use it.
            loose_count = _extract_number(text)
            if loose_count and re.search(r"\b(dot|dots|movella|movesense|camera|cameras)\b", text):
                sensors = loose_count
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


_NUMBER_WORDS = {
    "one": 1,
    "won": 1,
    "single": 1,
    "a": 1,
    "an": 1,
    "two": 2,
    "to": 2,
    "too": 2,
    "three": 3,
    "four": 4,
    "for": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "ate": 8,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}


def _extract_number(text: str) -> Optional[int]:
    match = re.search(r"(\d+)", text)
    if match:
        return int(match.group(1))
    for word, value in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", text):
            return value
    return None


#  this is wrong. locations are returned by the init system command
def _extract_locations(text: str) -> list[str]:
    locations = []
    pairs = [
        ("ankle", "ANKLE"),
        ("wrist", "WRIST"),
        ("knee", "KNEE"),
        ("hip", "HIP"),
        ("shoulder", "SHOULDER"),
        ("head", "HEAD"),
        ("elbow", "ELBOW"),
    ]
    for body, token in pairs:
        if f"left {body}" in text:
            locations.append(f"LEFT_{token}")
        if f"right {body}" in text:
            locations.append(f"RIGHT_{token}")
        if f"left and right {body}" in text or f"right and left {body}" in text:
            locations.extend([f"LEFT_{token}", f"RIGHT_{token}"])
        if f"both {body}" in text:
            locations.extend([f"LEFT_{token}", f"RIGHT_{token}"])
        if f"both {body}s" in text:
            locations.extend([f"LEFT_{token}", f"RIGHT_{token}"])
        if f"both {body}es" in text:
            locations.extend([f"LEFT_{token}", f"RIGHT_{token}"])
    # Keep order stable and avoid duplicates from overlapping phrase matches.
    return list(dict.fromkeys(locations))


def parse_locations(text: str) -> list[str]:
    return _extract_locations(text.strip().lower())


def _extract_tag(text: str) -> Optional[str]:
    match = re.search(r"(?:tag|called|name it)\s+(.+)$", text)
    if match:
        return match.group(1).strip().strip("\"'")
    return None


def parse_intent(text: str) -> Dict[str, Any]:
    cleaned = text.strip().lower()
    if not cleaned:
        return {"intent": "empty"}

    if re.search(r"\b(yes|yeah|yep|sure|correct|affirmative)\b", cleaned):
        return {"intent": "affirm"}
    if re.search(r"\b(no|nope|negative|not yet)\b", cleaned):
        return {"intent": "deny"}
    if "retry" in cleaned:
        return {"intent": "retry"}
    if "repeat" in cleaned:
        return {"intent": "repeat"}
    if "cancel" in cleaned or "stop that" in cleaned:
        return {"intent": "cancel"}
    if "change" in cleaned and "input" in cleaned:
        return {"intent": "change_inputs"}

    if "start a new session" in cleaned or "start new session" in cleaned or "start session" in cleaned:
        return {"intent": "start_session"}
    if "server ready" in cleaned or "is the server ready" in cleaned:
        return {"intent": "check_ready"}

    if "session called" in cleaned or "session name" in cleaned or "session label" in cleaned:
        label = re.sub(r"^.*?(session called|session name|session label)\s+", "", cleaned).strip()
        return {"intent": "session_label", "label": label or cleaned}
    if "my name is" in cleaned or "this is" in cleaned or "i am" in cleaned:
        name = re.sub(r"^.*?(my name is|this is|i am)\s+", "", cleaned).strip()
        return {"intent": "session_owner", "name": name or cleaned}

    if "subject" in cleaned and ("how many" in cleaned or _extract_number(cleaned) is not None):
        count = _extract_number(cleaned)
        return {"intent": "subject_count", "count": count}

    if "discover" in cleaned:
        return {"intent": "discover_sensors"}
    if "disconnect" in cleaned:
        return {"intent": "disconnect"}
    if re.search(r"\bconnect(?:\s+sensors?)?\b", cleaned):
        return {"intent": "connect_sensors"}
    if "identify all" in cleaned:
        return {"intent": "identify_all"}
    if cleaned.startswith("identify") or "identify" in cleaned:
        locations = _extract_locations(cleaned)
        return {"intent": "identify", "locations": locations}
    if "start stream" in cleaned or "start streaming" in cleaned:
        return {"intent": "start_stream", "tag": _extract_tag(cleaned)}
    if (
        "stop stream" in cleaned
        or "stop streaming" in cleaned
        or "end stream" in cleaned
        or "end streaming" in cleaned
        or cleaned in {"stop", "stop now"}
    ):
        return {"intent": "stop_stream"}
    if "what's happening" in cleaned or "what is happening" in cleaned or "status" in cleaned:
        return {"intent": "status"}

    if "algorithm" in cleaned or "loading" in cleaned or "pass through" in cleaned or "passthrough" in cleaned:
        algo_name, inputs = _parse_algorithm(cleaned)
        return {"intent": "algorithm", "name": algo_name, "inputs": inputs}

    if "movella" in cleaned or "dot" in cleaned or "dots" in cleaned or "movesense" in cleaned or "camera" in cleaned:
        subject_count, sensor_count = _parse_counts(cleaned)
        sensor_name = _parse_sensor_name(cleaned)
        locations = _extract_locations(cleaned)
        return {
            "intent": "sensor_setup",
            "sensor_name": sensor_name,
            "sensor_count": sensor_count,
            "locations": locations,
            "subject_count": subject_count,
        }

    tag = _extract_tag(cleaned)
    if tag:
        return {"intent": "tag", "tag": tag}

    return {"intent": "free_text", "text": cleaned}


def parse_command(text: str) -> Optional[Dict[str, Any]]:
    intent = parse_intent(text)
    if intent.get("intent") in ("start_session", "check_ready"):
        return {"type": "is_server_ready", "payload": {}}
    return None
