from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
APPS_DIR = BASE_DIR / "apps"
REGISTRY_DIR = APPS_DIR / "registry"
INSTALLED_FILE = APPS_DIR / "installed.json"

NEIA_DEV = os.getenv("NEIA_DEV", "0") == "1"
NEIA_DEV_FALLBACK = os.getenv("NEIA_DEV_FALLBACK", "1") == "1"
NEIA_GATEWAY = os.getenv("NEIA_GATEWAY", "zeromq").lower()
NEIA_SITE = os.getenv("NEIA_SITE", "my_house")
AMQP_URL = os.getenv("AMQP_URL")
