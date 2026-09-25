#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install_linux_desktop.sh [options]

Options:
  --no-start       Install/update without starting the service
  --force-env      Overwrite the existing installed env file
  --rebuild-venv   Recreate the application virtualenv
  --skip-ui-build  Reuse the existing refactored neia-ui/dist build
  --help           Show this help
EOF
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

INSTALL_ROOT="${NEIA_INSTALL_ROOT:-/opt/nexus-n3-neia-app-framework}"
STATE_ROOT="${NEIA_STATE_ROOT:-/var/lib/nexus-n3-neia-app-framework}"
LOG_ROOT="${NEIA_LOG_ROOT:-/var/log/nexus-n3-neia-app-framework}"
RUN_ROOT="${NEIA_RUN_ROOT:-/run/nexus-n3-neia-app-framework}"
CONFIG_ROOT="${NEIA_CONFIG_ROOT:-/etc/nexus-n3-neia-app-framework}"
BIN_ROOT="${NEIA_BIN_ROOT:-/usr/local/bin}"
APPLICATIONS_ROOT="${NEIA_APPLICATIONS_ROOT:-/usr/share/applications}"
SERVICE_NAME="${NEIA_SERVICE_NAME:-nexus-n3-neia-app-framework.service}"
SERVICE_USER="${NEIA_SERVICE_USER:-${SUDO_USER:-$USER}}"
SERVICE_GROUP="${NEIA_SERVICE_GROUP:-${SERVICE_USER}}"
HOST="${NEIA_HOST:-127.0.0.1}"
PORT="${NEIA_PORT:-8080}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_ROOT="${INSTALL_ROOT}/neia-api/.venv"
VENV_PYTHON="${VENV_ROOT}/bin/python"
ENV_FILE="${CONFIG_ROOT}/neia-desktop.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"
LAUNCHER_PATH="${BIN_ROOT}/open-neia"
DESKTOP_FILE="${APPLICATIONS_ROOT}/neia.desktop"
START_SERVICE=1
FORCE_ENV=0
REBUILD_VENV=0
SKIP_UI_BUILD=0
CREATED_ENV=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-start)
      START_SERVICE=0
      shift
      ;;
    --force-env)
      FORCE_ENV=1
      shift
      ;;
    --rebuild-venv)
      REBUILD_VENV=1
      shift
      ;;
    --skip-ui-build)
      SKIP_UI_BUILD=1
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

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "Service user ${SERVICE_USER} does not exist." >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd "${PYTHON_BIN}"
require_cmd systemctl
require_cmd install
require_cmd cp
require_cmd sed
require_cmd tar
require_cmd chown
require_cmd find
require_cmd grep

if [[ "${SKIP_UI_BUILD}" -eq 0 ]]; then
  require_cmd npm
  if [[ "${SERVICE_USER}" != "root" ]]; then
    require_cmd sudo
    sudo -u "${SERVICE_USER}" npm --prefix "${FRAMEWORK_ROOT}/neia-ui" run build
  else
    npm --prefix "${FRAMEWORK_ROOT}/neia-ui" run build
  fi
fi

if [[ ! -f "${FRAMEWORK_ROOT}/neia-ui/dist/index.html" ]]; then
  echo "Missing neia-ui/dist/index.html; build the refactored NEIA UI first." >&2
  exit 1
fi

install_tree() {
  local src_rel="$1"
  local dest_rel="$2"
  if [[ ! -e "${FRAMEWORK_ROOT}/${src_rel}" ]]; then
    return 0
  fi
  rm -rf "${INSTALL_ROOT:?}/${dest_rel}"
  mkdir -p "$(dirname "${INSTALL_ROOT}/${dest_rel}")"
  (
    cd "${FRAMEWORK_ROOT}"
    tar \
      --exclude='neia-api/.venv' \
      --exclude='neia-api/.pytest_cache' \
      --exclude='neia-api/__pycache__' \
      --exclude='neia-api/app/__pycache__' \
      --exclude='neia-ui/node_modules' \
      --exclude='neia-ui/src' \
      --exclude='apps/registry/*/ui/node_modules' \
      --exclude='apps/registry/*/ui/src' \
      --exclude='apps/registry/*/ui/.vite' \
      --exclude='models/ollama' \
      -cf - \
      "${src_rel}" \
    ) | (
      cd "${INSTALL_ROOT}"
      tar -xf -
    )
}

if systemctl list-unit-files | grep -Fq "^${SERVICE_NAME}"; then
  systemctl stop "${SERVICE_NAME}" || true
fi

mkdir -p "${INSTALL_ROOT}" "${STATE_ROOT}" "${LOG_ROOT}" "${CONFIG_ROOT}" "${BIN_ROOT}" "${APPLICATIONS_ROOT}"
install -d -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" -m 0755 "${STATE_ROOT}" "${LOG_ROOT}"

install_tree "apps" "apps"
install_tree "shared" "shared"
install_tree "neia-api" "neia-api"
install_tree "neia-ui/dist" "neia-ui/dist"
install_tree "docs" "docs"
install_tree "models" "models"
install_tree "workflows" "workflows"

if [[ ! -f "${STATE_ROOT}/installed.json" && -f "${FRAMEWORK_ROOT}/apps/installed.json" ]]; then
  install -o "${SERVICE_USER}" -g "${SERVICE_GROUP}" -m 0644 "${FRAMEWORK_ROOT}/apps/installed.json" "${STATE_ROOT}/installed.json"
fi
"${PYTHON_BIN}" - "${STATE_ROOT}/installed.json" <<'PY'
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
if path.is_file():
    try:
        installed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        installed = None
    if isinstance(installed, list) and "nexus" in installed:
        path.write_text(
            json.dumps([app_id for app_id in installed if app_id != "nexus"], indent=2) + "\n",
            encoding="utf-8",
        )
PY

mkdir -p "${STATE_ROOT}/workflows"
if [[ -z "$(find "${STATE_ROOT}/workflows" -mindepth 1 -print -quit)" && -d "${FRAMEWORK_ROOT}/workflows" ]]; then
  cp -R "${FRAMEWORK_ROOT}/workflows/." "${STATE_ROOT}/workflows/"
fi

if [[ "${REBUILD_VENV}" -eq 1 ]]; then
  rm -rf "${VENV_ROOT}"
fi

if [[ ! -x "${VENV_PYTHON}" ]]; then
  "${PYTHON_BIN}" -m venv "${VENV_ROOT}"
fi

"${VENV_PYTHON}" -m pip install --upgrade pip
WHEEL_PATH=""
if compgen -G "${INSTALL_ROOT}/neia-api/dist/*.whl" >/dev/null 2>&1; then
  WHEEL_PATH="$(find "${INSTALL_ROOT}/neia-api/dist" -maxdepth 1 -type f -name '*.whl' | sort | tail -n 1)"
fi
if [[ -n "${WHEEL_PATH}" ]]; then
  "${VENV_PYTHON}" -m pip install --force-reinstall "${WHEEL_PATH}"
else
  "${VENV_PYTHON}" -m pip install --force-reinstall "${INSTALL_ROOT}/neia-api"
fi

if [[ ! -f "${ENV_FILE}" || "${FORCE_ENV}" -eq 1 ]]; then
  install -o root -g root -m 0644 "${SCRIPT_DIR}/neia-desktop.env.example" "${ENV_FILE}"
  CREATED_ENV=1
fi
sed -i \
  -e "s|^NEIA_CONTENT_ROOT=.*|NEIA_CONTENT_ROOT=${INSTALL_ROOT}|" \
  -e "s|^NEIA_REGISTRY_DIR=.*|NEIA_REGISTRY_DIR=${INSTALL_ROOT}/apps/registry|" \
  -e "s|^NEIA_INSTALLED_FILE=.*|NEIA_INSTALLED_FILE=${STATE_ROOT}/installed.json|" \
  -e "s|^NEIA_STATE_DIR=.*|NEIA_STATE_DIR=${STATE_ROOT}|" \
  -e "s|^NEIA_LOG_DIR=.*|NEIA_LOG_DIR=${LOG_ROOT}|" \
  -e "s|^NEIA_RUN_DIR=.*|NEIA_RUN_DIR=${RUN_ROOT}|" \
  -e "s|^NEIA_WORKFLOWS_DIR=.*|NEIA_WORKFLOWS_DIR=${STATE_ROOT}/workflows|" \
  "${ENV_FILE}"
if ! grep -Eq '^NEIA_WORKFLOWS_DIR=' "${ENV_FILE}"; then
  printf 'NEIA_WORKFLOWS_DIR=%s/workflows\n' "${STATE_ROOT}" >> "${ENV_FILE}"
fi
if [[ "${FORCE_ENV}" -eq 1 || "${CREATED_ENV}" -eq 1 ]]; then
  sed -i \
    -e "s|^NEIA_HOST=.*|NEIA_HOST=${HOST}|" \
    -e "s|^NEIA_PORT=.*|NEIA_PORT=${PORT}|" \
    "${ENV_FILE}"
fi

sed \
  -e "s|@SERVICE_USER@|${SERVICE_USER}|g" \
  -e "s|@SERVICE_GROUP@|${SERVICE_GROUP}|g" \
  -e "s|@INSTALL_ROOT@|${INSTALL_ROOT}|g" \
  -e "s|@ENV_FILE@|${ENV_FILE}|g" \
  -e "s|@VENV_PYTHON@|${VENV_PYTHON}|g" \
  "${SCRIPT_DIR}/nexus-n3-neia-app-framework.service" > "${SERVICE_FILE}"

install -o root -g root -m 0755 "${SCRIPT_DIR}/open-neia.sh" "${LAUNCHER_PATH}"
sed \
  -e "s|@LAUNCHER_PATH@|${LAUNCHER_PATH}|g" \
  "${SCRIPT_DIR}/neia.desktop" > "${DESKTOP_FILE}"

chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${INSTALL_ROOT}"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
if [[ "${START_SERVICE}" -eq 1 ]]; then
  systemctl restart "${SERVICE_NAME}"
fi

echo "Installed Nexus N3 NEIA desktop service"
echo "Service: ${SERVICE_NAME}"
echo "Launcher: ${LAUNCHER_PATH}"
echo "URL: http://${HOST}:${PORT}"
if [[ -n "${WHEEL_PATH}" ]]; then
  echo "Install source: ${WHEEL_PATH}"
else
  echo "Install source: ${INSTALL_ROOT}/neia-api"
fi
