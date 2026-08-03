#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "configure_macos_desktop.sh must run as root." >&2
  exit 1
fi

TARGET_USER="${1:-}"
if [[ -z "${TARGET_USER}" || "${TARGET_USER}" == "root" || "${TARGET_USER}" == "loginwindow" ]]; then
  echo "A logged-in macOS user is required to configure NEIA." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTENT_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"
TARGET_UID="$(id -u "${TARGET_USER}")"
TARGET_GROUP="$(id -gn "${TARGET_USER}")"
TARGET_HOME="$(dscl . -read "/Users/${TARGET_USER}" NFSHomeDirectory | awk '{print $2}')"
DATA_ROOT="${TARGET_HOME}/Library/Application Support/Nexus N3 NEIA"
STATE_DIR="${DATA_ROOT}/state"
RUN_DIR="${DATA_ROOT}/run"
WORKFLOWS_DIR="${STATE_DIR}/workflows"
LOG_DIR="${TARGET_HOME}/Library/Logs/Nexus N3 NEIA"
VENV_ROOT="${DATA_ROOT}/.venv"
VENV_PYTHON="${VENV_ROOT}/bin/python"
LAUNCH_AGENTS_DIR="${TARGET_HOME}/Library/LaunchAgents"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/com.rsnexus.neia.plist"

PYTHON_BIN=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [[ -x "${candidate}" ]] && "${candidate}" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then
    PYTHON_BIN="${candidate}"
    break
  fi
done
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "Python 3.10 or newer is required. Install it before installing NEIA." >&2
  exit 1
fi

install -d -o "${TARGET_USER}" -g "${TARGET_GROUP}" -m 0755 \
  "${DATA_ROOT}" "${STATE_DIR}" "${RUN_DIR}" "${WORKFLOWS_DIR}" "${LOG_DIR}" "${LAUNCH_AGENTS_DIR}"

if [[ ! -f "${STATE_DIR}/installed.json" ]]; then
  install -o "${TARGET_USER}" -g "${TARGET_GROUP}" -m 0644 \
    "${CONTENT_ROOT}/apps/installed.json" "${STATE_DIR}/installed.json"
fi
if [[ -z "$(find "${WORKFLOWS_DIR}" -mindepth 1 -print -quit)" && -d "${CONTENT_ROOT}/workflows" ]]; then
  ditto "${CONTENT_ROOT}/workflows" "${WORKFLOWS_DIR}"
fi
chown -R "${TARGET_USER}:${TARGET_GROUP}" "${DATA_ROOT}" "${LOG_DIR}"

if [[ ! -x "${VENV_PYTHON}" ]]; then
  sudo -u "${TARGET_USER}" "${PYTHON_BIN}" -m venv "${VENV_ROOT}"
fi
sudo -u "${TARGET_USER}" "${VENV_PYTHON}" -m pip install --upgrade pip
wheel_path="$(find "${CONTENT_ROOT}/neia-api/dist" -maxdepth 1 -type f -name '*.whl' | sort | tail -n 1)"
if [[ -z "${wheel_path}" ]]; then
  echo "The packaged neia-api wheel is missing." >&2
  exit 1
fi
sudo -u "${TARGET_USER}" "${VENV_PYTHON}" -m pip install --force-reinstall "${wheel_path}"

sudo -u "${TARGET_USER}" "${VENV_PYTHON}" - "${STATE_DIR}/installed.json" <<'PY'
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
try:
    installed = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    raise SystemExit(0)
if isinstance(installed, list) and "nexus" in installed:
    path.write_text(
        json.dumps([app_id for app_id in installed if app_id != "nexus"], indent=2) + "\n",
        encoding="utf-8",
    )
PY

sed \
  -e "s|@VENV_PYTHON@|${VENV_PYTHON}|g" \
  -e "s|@VENV_BIN@|${VENV_ROOT}/bin|g" \
  -e "s|@CONTENT_ROOT@|${CONTENT_ROOT}|g" \
  -e "s|@STATE_DIR@|${STATE_DIR}|g" \
  -e "s|@LOG_DIR@|${LOG_DIR}|g" \
  -e "s|@RUN_DIR@|${RUN_DIR}|g" \
  -e "s|@WORKFLOWS_DIR@|${WORKFLOWS_DIR}|g" \
  "${SCRIPT_DIR}/com.rsnexus.neia.plist.template" > "${PLIST_PATH}"
chown "${TARGET_USER}:${TARGET_GROUP}" "${PLIST_PATH}"
chmod 0644 "${PLIST_PATH}"

launchctl bootout "gui/${TARGET_UID}/com.rsnexus.neia" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${TARGET_UID}" "${PLIST_PATH}"
launchctl kickstart -k "gui/${TARGET_UID}/com.rsnexus.neia"

echo "Configured Nexus N3 NEIA for ${TARGET_USER}"
