#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${NEIA_SERVICE_NAME:-nexus-n3-neia-app-framework.service}"
HOST="${NEIA_HOST:-127.0.0.1}"
PORT="${NEIA_PORT:-8080}"
URL="http://${HOST}:${PORT}"

if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
    systemctl start "${SERVICE_NAME}"
  fi
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${URL}" >/dev/null 2>&1 &
elif command -v gio >/dev/null 2>&1; then
  gio open "${URL}" >/dev/null 2>&1 &
else
  printf 'Open %s in your browser.\n' "${URL}"
fi
