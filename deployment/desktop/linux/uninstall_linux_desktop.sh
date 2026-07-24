#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: uninstall_linux_desktop.sh [options]

Options:
  --keep-data  Remove service and installed code but keep /var/lib and /var/log
  --help       Show this help
EOF
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

INSTALL_ROOT="${NEIA_INSTALL_ROOT:-/opt/nexus-n3-neia-app-framework}"
STATE_ROOT="${NEIA_STATE_ROOT:-/var/lib/nexus-n3-neia-app-framework}"
LOG_ROOT="${NEIA_LOG_ROOT:-/var/log/nexus-n3-neia-app-framework}"
CONFIG_ROOT="${NEIA_CONFIG_ROOT:-/etc/nexus-n3-neia-app-framework}"
BIN_ROOT="${NEIA_BIN_ROOT:-/usr/local/bin}"
APPLICATIONS_ROOT="${NEIA_APPLICATIONS_ROOT:-/usr/share/applications}"
SERVICE_NAME="${NEIA_SERVICE_NAME:-nexus-n3-neia-app-framework.service}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"
LAUNCHER_PATH="${BIN_ROOT}/open-neia"
DESKTOP_FILE="${APPLICATIONS_ROOT}/neia.desktop"
KEEP_DATA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-data)
      KEEP_DATA=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop "${SERVICE_NAME}" || true
  systemctl disable "${SERVICE_NAME}" || true
fi

rm -f "${SERVICE_FILE}" "${LAUNCHER_PATH}" "${DESKTOP_FILE}"
rm -rf "${INSTALL_ROOT}" "${CONFIG_ROOT}"
if [[ "${KEEP_DATA}" -eq 0 ]]; then
  rm -rf "${STATE_ROOT}" "${LOG_ROOT}"
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
fi

if [[ "${KEEP_DATA}" -eq 1 ]]; then
  echo "Removed Nexus N3 NEIA desktop service assets and kept application data"
else
  echo "Removed Nexus N3 NEIA desktop service assets"
fi
