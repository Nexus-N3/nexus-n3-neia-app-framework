#!/usr/bin/env bash
set -euo pipefail

LABEL="com.rsnexus.neia"
USER_ID="$(id -u)"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
URL="http://127.0.0.1:8080"

if ! launchctl print "gui/${USER_ID}/${LABEL}" >/dev/null 2>&1; then
  if [[ ! -f "${PLIST_PATH}" ]]; then
    osascript -e 'display dialog "NEIA is not configured for this user. Reinstall the package." buttons {"OK"} default button "OK" with icon stop'
    exit 1
  fi
  launchctl bootstrap "gui/${USER_ID}" "${PLIST_PATH}"
fi
launchctl kickstart -k "gui/${USER_ID}/${LABEL}"
sleep 1
open "${URL}"
