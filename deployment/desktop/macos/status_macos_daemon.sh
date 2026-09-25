#!/usr/bin/env bash
set -euo pipefail

LABEL="com.rsnexus.neia"
USER_ID="$(id -u)"
if launchctl print "gui/${USER_ID}/${LABEL}" >/dev/null 2>&1; then
  echo "NEIA LaunchAgent is loaded"
  launchctl print "gui/${USER_ID}/${LABEL}" | sed -n '/state =/p;/pid =/p'
  echo "URL: http://127.0.0.1:8080"
  exit 0
fi
echo "NEIA LaunchAgent is not loaded"
exit 1
