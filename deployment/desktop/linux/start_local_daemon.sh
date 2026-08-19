#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRAMEWORK_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"
RUNTIME_ROOT="${NEIA_DESKTOP_RUNTIME_ROOT:-${DESKTOP_DIR}/.runtime/linux-local}"
STATE_DIR="${NEIA_STATE_DIR:-${RUNTIME_ROOT}/state}"
LOG_DIR="${NEIA_LOG_DIR:-${RUNTIME_ROOT}/logs}"
RUN_DIR="${NEIA_RUN_DIR:-${RUNTIME_ROOT}/run}"
PID_FILE="${RUN_DIR}/neia-daemon.pid"
LOG_FILE="${LOG_DIR}/neia-daemon.log"
INSTALLED_FILE="${NEIA_INSTALLED_FILE:-${STATE_DIR}/installed.json}"
PYTHON_BIN="${PYTHON_BIN:-${FRAMEWORK_ROOT}/neia-api/.venv/bin/python}"
HOST="${NEIA_HOST:-127.0.0.1}"
PORT="${NEIA_PORT:-8080}"
SKIP_UI_BUILD="${NEIA_SKIP_UI_BUILD:-0}"

if [[ "${SKIP_UI_BUILD}" != "1" ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "Missing required command: npm (or set NEIA_SKIP_UI_BUILD=1 to use the existing build)" >&2
    exit 1
  fi
  (
    cd "${FRAMEWORK_ROOT}/neia-ui"
    npm run build
  )
fi

if [[ ! -f "${FRAMEWORK_ROOT}/neia-ui/dist/index.html" ]]; then
  echo "Missing neia-ui/dist/index.html; build the refactored NEIA UI first." >&2
  exit 1
fi

mkdir -p "${STATE_DIR}" "${LOG_DIR}" "${RUN_DIR}"

if [[ ! -f "${INSTALLED_FILE}" && -f "${FRAMEWORK_ROOT}/apps/installed.json" ]]; then
  cp "${FRAMEWORK_ROOT}/apps/installed.json" "${INSTALLED_FILE}"
fi

if [[ -f "${PID_FILE}" ]]; then
  existing_pid="$(cat "${PID_FILE}")"
  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
    echo "NEIA daemon already running with PID ${existing_pid}"
    echo "URL: http://${HOST}:${PORT}"
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Missing python executable at ${PYTHON_BIN}" >&2
  exit 1
fi

# Nexus N3 is compiled into neia-ui after the refactor and must not remain in
# the mutable optional-app list created by older desktop runs.
"${PYTHON_BIN}" - "${INSTALLED_FILE}" <<'PY'
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
if not path.is_file():
    raise SystemExit(0)
try:
    installed = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    raise SystemExit(0)
if not isinstance(installed, list) or "nexus" not in installed:
    raise SystemExit(0)
path.write_text(
    json.dumps([app_id for app_id in installed if app_id != "nexus"], indent=2) + "\n",
    encoding="utf-8",
)
PY

if "${PYTHON_BIN}" - "${HOST}" "${PORT}" 2>/dev/null <<'PY'
import socket
import sys

host, port = sys.argv[1], int(sys.argv[2])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.settimeout(0.25)
    raise SystemExit(0 if sock.connect_ex((host, port)) == 0 else 1)
PY
then
  echo "Cannot start the refactored NEIA daemon: http://${HOST}:${PORT} is already in use." >&2
  echo "Stop the older NEIA process/service, or choose another port with NEIA_PORT." >&2
  exit 1
fi

export NEIA_CONTENT_ROOT="${NEIA_CONTENT_ROOT:-${FRAMEWORK_ROOT}}"
export NEIA_REGISTRY_DIR="${NEIA_REGISTRY_DIR:-${FRAMEWORK_ROOT}/apps/registry}"
export NEIA_INSTALLED_FILE="${INSTALLED_FILE}"
export NEIA_STATE_DIR="${STATE_DIR}"
export NEIA_LOG_DIR="${LOG_DIR}"
export NEIA_RUN_DIR="${RUN_DIR}"
export NEIA_WORKFLOWS_DIR="${NEIA_WORKFLOWS_DIR:-${FRAMEWORK_ROOT}/workflows}"
export NEIA_HOST="${HOST}"
export NEIA_PORT="${PORT}"

cd "${FRAMEWORK_ROOT}/neia-api"
if command -v setsid >/dev/null 2>&1; then
  nohup setsid "${PYTHON_BIN}" -m app.daemon --host "${HOST}" --port "${PORT}" >>"${LOG_FILE}" 2>&1 </dev/null &
else
  nohup "${PYTHON_BIN}" -m app.daemon --host "${HOST}" --port "${PORT}" >>"${LOG_FILE}" 2>&1 </dev/null &
fi
daemon_pid=$!
echo "${daemon_pid}" > "${PID_FILE}"

sleep 1
if ! kill -0 "${daemon_pid}" 2>/dev/null; then
  rm -f "${PID_FILE}"
  echo "NEIA daemon exited during startup. Recent log output:" >&2
  tail -n 20 "${LOG_FILE}" >&2 || true
  exit 1
fi

echo "Started NEIA daemon"
echo "PID: ${daemon_pid}"
echo "URL: http://${HOST}:${PORT}"
echo "Log: ${LOG_FILE}"
