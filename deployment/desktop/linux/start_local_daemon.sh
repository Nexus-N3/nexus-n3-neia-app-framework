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

export NEIA_CONTENT_ROOT="${NEIA_CONTENT_ROOT:-${FRAMEWORK_ROOT}}"
export NEIA_REGISTRY_DIR="${NEIA_REGISTRY_DIR:-${FRAMEWORK_ROOT}/apps/registry}"
export NEIA_INSTALLED_FILE="${INSTALLED_FILE}"
export NEIA_STATE_DIR="${STATE_DIR}"
export NEIA_LOG_DIR="${LOG_DIR}"
export NEIA_RUN_DIR="${RUN_DIR}"
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

echo "Started NEIA daemon"
echo "PID: ${daemon_pid}"
echo "URL: http://${HOST}:${PORT}"
echo "Log: ${LOG_FILE}"
