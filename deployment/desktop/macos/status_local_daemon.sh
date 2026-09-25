#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_ROOT="${NEIA_DESKTOP_RUNTIME_ROOT:-${DESKTOP_DIR}/.runtime/macos-local}"
RUN_DIR="${NEIA_RUN_DIR:-${RUNTIME_ROOT}/run}"
LOG_DIR="${NEIA_LOG_DIR:-${RUNTIME_ROOT}/logs}"
PID_FILE="${RUN_DIR}/neia-daemon.pid"
HOST="${NEIA_HOST:-127.0.0.1}"
PORT="${NEIA_PORT:-8080}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "NEIA daemon is not running"
  echo "Expected PID file: ${PID_FILE}"
  exit 0
fi

daemon_pid="$(cat "${PID_FILE}")"
if [[ -n "${daemon_pid}" ]] && kill -0 "${daemon_pid}" 2>/dev/null; then
  echo "NEIA daemon running"
  echo "PID: ${daemon_pid}"
  echo "URL: http://${HOST}:${PORT}"
  echo "Logs: ${LOG_DIR}"
  exit 0
fi

echo "Stale PID file found at ${PID_FILE}"
echo "Logs: ${LOG_DIR}"
exit 1
