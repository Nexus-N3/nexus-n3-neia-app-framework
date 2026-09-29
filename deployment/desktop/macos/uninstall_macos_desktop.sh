#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: sudo uninstall_macos_desktop.sh [--keep-data] [--keep-app]"
}

KEEP_DATA=0
KEEP_APP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-data) KEEP_DATA=1 ;;
    --keep-app) KEEP_APP=1 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root with sudo." >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-$(stat -f '%Su' /dev/console)}"
TARGET_UID="$(id -u "${TARGET_USER}")"
TARGET_HOME="$(dscl . -read "/Users/${TARGET_USER}" NFSHomeDirectory | awk '{print $2}')"
DATA_ROOT="${TARGET_HOME}/Library/Application Support/Nexus N3 NEIA"
LOG_ROOT="${TARGET_HOME}/Library/Logs/Nexus N3 NEIA"
PLIST_PATH="${TARGET_HOME}/Library/LaunchAgents/com.rsnexus.neia.plist"
APP_ROOT="/Applications/Nexus N3 NEIA.app"

launchctl bootout "gui/${TARGET_UID}/com.rsnexus.neia" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"
if [[ "${KEEP_APP}" -eq 0 ]]; then
  rm -rf "${APP_ROOT}"
fi
if [[ "${KEEP_DATA}" -eq 0 ]]; then
  rm -rf "${DATA_ROOT}" "${LOG_ROOT}"
fi
pkgutil --forget com.rsnexus.neia.pkg >/dev/null 2>&1 || true

echo "Removed Nexus N3 NEIA macOS desktop assets"
