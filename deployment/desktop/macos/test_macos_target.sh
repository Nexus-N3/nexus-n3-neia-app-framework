#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installed-target test must run on macOS." >&2
  exit 1
fi

LABEL="com.rsnexus.neia"
USER_ID="$(id -u)"
DATA_ROOT="${HOME}/Library/Application Support/Nexus N3 NEIA"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
INSTALLED_FILE="${DATA_ROOT}/state/installed.json"
WORKFLOWS_DIR="${DATA_ROOT}/state/workflows"
URL="http://127.0.0.1:8080"

for command_name in curl python3 launchctl; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

test -d "/Applications/Nexus N3 NEIA.app"
test -f "${PLIST_PATH}"
test -f "${INSTALLED_FILE}"
test -d "${WORKFLOWS_DIR}"

if ! launchctl print "gui/${USER_ID}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootstrap "gui/${USER_ID}" "${PLIST_PATH}"
fi
launchctl kickstart -k "gui/${USER_ID}/${LABEL}"

health_json=""
for _ in {1..100}; do
  if health_json="$(curl -fsS "${URL}/api/v1/health" 2>/dev/null)"; then
    break
  fi
  sleep 0.1
done
if [[ -z "${health_json}" ]]; then
  echo "NEIA did not become healthy at ${URL}." >&2
  exit 1
fi

printf '%s' "${health_json}" | python3 -c '
import json, sys
payload = json.load(sys.stdin)
assert payload["status"] == "ok", payload
assert payload["ui_dist_available"] is True, payload
'

python3 - "${INSTALLED_FILE}" <<'PY'
import json
from pathlib import Path
import sys

installed = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert "nexus" not in installed, installed
PY

index_html="$(curl -fsS "${URL}/")"
asset_path="$(printf '%s' "${index_html}" | sed -n 's|.*src="\([^"]*index-[^"]*\.js\)".*|\1|p' | head -n 1)"
if [[ -z "${asset_path}" ]]; then
  echo "Could not locate the compiled NEIA UI asset." >&2
  exit 1
fi
asset_file="$(mktemp -t neia-ui-asset)"
trap 'rm -f "${asset_file}"' EXIT
curl -fsS "${URL}${asset_path}" -o "${asset_file}"
grep -Fq "Nexus N3 Session Management" "${asset_file}"

echo "macOS target validation passed"
echo "URL: ${URL}"
