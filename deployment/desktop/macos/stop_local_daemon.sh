#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_ROOT="${NEIA_DESKTOP_RUNTIME_ROOT:-${DESKTOP_DIR}/.runtime/macos-local}"
PID_FILE="${NEIA_RUN_DIR:-${RUNTIME_ROOT}/run}/neia-daemon.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "NEIA daemon is not running"
  exit 0
fi

daemon_pid="$(cat "${PID_FILE}")"
if [[ -n "${daemon_pid}" ]] && kill -0 "${daemon_pid}" 2>/dev/null; then
  kill "${daemon_pid}"
  echo "Stopped NEIA daemon PID ${daemon_pid}"
else
  echo "NEIA daemon PID ${daemon_pid} is not running"
fi
rm -f "${PID_FILE}"
