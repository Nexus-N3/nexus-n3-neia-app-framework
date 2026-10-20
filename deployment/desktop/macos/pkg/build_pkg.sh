#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: build_pkg.sh [options]

Options:
  --version VERSION   Override the package version
  --output DIR        Output directory
  --skip-ui-build     Reuse the existing neia-ui/dist
  --skip-api-build    Reuse the existing neia-api wheel
  --sign IDENTITY     Sign with an Apple Installer certificate
  --help              Show this help
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACOS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_DIR="$(cd "${MACOS_DIR}/.." && pwd)"
FRAMEWORK_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"
BUILD_ROOT="${DESKTOP_DIR}/.build/macos-pkg"
PKG_ROOT="${BUILD_ROOT}/root"
SCRIPTS_ROOT="${BUILD_ROOT}/scripts"
APP_ROOT="${PKG_ROOT}/Applications/Nexus N3 NEIA.app"
CONTENTS_ROOT="${APP_ROOT}/Contents"
RESOURCES_ROOT="${CONTENTS_ROOT}/Resources"
OUTPUT_DIR="${MACOS_DIR}/dist"
VERSION=""
SIGN_IDENTITY=""
SKIP_UI_BUILD=0
SKIP_API_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --output) OUTPUT_DIR="${2:-}"; shift 2 ;;
    --skip-ui-build) SKIP_UI_BUILD=1; shift ;;
    --skip-api-build) SKIP_API_BUILD=1; shift ;;
    --sign) SIGN_IDENTITY="${2:-}"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The macOS .pkg must be built on macOS." >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd pkgbuild
require_cmd productbuild
require_cmd rsync
require_cmd plutil
require_cmd python3

if [[ "${SKIP_UI_BUILD}" -eq 0 ]]; then
  require_cmd npm
  npm --prefix "${FRAMEWORK_ROOT}/neia-ui" run build
fi
if [[ ! -f "${FRAMEWORK_ROOT}/neia-ui/dist/index.html" ]]; then
  echo "Missing neia-ui/dist/index.html." >&2
  exit 1
fi

if [[ "${SKIP_API_BUILD}" -eq 0 ]]; then
  (
    cd "${FRAMEWORK_ROOT}/neia-api"
    python3 -m build --wheel
  )
fi
if ! compgen -G "${FRAMEWORK_ROOT}/neia-api/dist/*.whl" >/dev/null 2>&1; then
  echo "Missing neia-api wheel under neia-api/dist." >&2
  exit 1
fi

if [[ -z "${VERSION}" ]]; then
  VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' "${FRAMEWORK_ROOT}/neia-api/pyproject.toml" | head -n 1)"
fi
if [[ -z "${VERSION}" ]]; then
  echo "Could not determine package version." >&2
  exit 1
fi

rm -rf "${BUILD_ROOT}"
mkdir -p "${CONTENTS_ROOT}/MacOS" "${RESOURCES_ROOT}" "${SCRIPTS_ROOT}" "${OUTPUT_DIR}"

copy_tree() {
  local relative_path="$1"
  shift
  local source_path="${FRAMEWORK_ROOT}/${relative_path}"
  local destination_path="${RESOURCES_ROOT}/${relative_path}"
  [[ -e "${source_path}" ]] || return 0
  mkdir -p "${destination_path}"
  rsync -a --delete "$@" "${source_path}/" "${destination_path}/"
}

copy_tree "apps" \
  --exclude='registry/*/ui/node_modules/' \
  --exclude='registry/*/ui/src/' \
  --exclude='registry/*/ui/.vite/'
copy_tree "shared" --exclude='node_modules/'
copy_tree "neia-api" \
  --exclude='.venv/' \
  --exclude='.pytest_cache/' \
  --exclude='__pycache__/' \
  --exclude='build/'
copy_tree "neia-ui/dist"
copy_tree "docs"
copy_tree "models" --exclude='ollama/'
copy_tree "workflows"
copy_tree "deployment/desktop/macos" \
  --exclude='pkg/' \
  --exclude='dist/' \
  --exclude='.build/'

sed "s|@APP_VERSION@|${VERSION}|g" "${MACOS_DIR}/Info.plist.template" > "${CONTENTS_ROOT}/Info.plist"
install -m 0755 "${MACOS_DIR}/open-neia.sh" "${CONTENTS_ROOT}/MacOS/NEIA"
install -m 0644 "${DESKTOP_DIR}/icon/NX_icon_dark.png" "${RESOURCES_ROOT}/NX_icon_dark.png"
install -m 0755 "${SCRIPT_DIR}/scripts/preinstall" "${SCRIPTS_ROOT}/preinstall"
install -m 0755 "${SCRIPT_DIR}/scripts/postinstall" "${SCRIPTS_ROOT}/postinstall"
find "${RESOURCES_ROOT}/deployment/desktop/macos" -type f -name '*.sh' -exec chmod 0755 {} +

plutil -lint "${CONTENTS_ROOT}/Info.plist"
plutil -lint "${RESOURCES_ROOT}/deployment/desktop/macos/com.rsnexus.neia.plist.template"

component_pkg="${BUILD_ROOT}/nexus-n3-neia-component.pkg"
pkgbuild \
  --root "${PKG_ROOT}" \
  --scripts "${SCRIPTS_ROOT}" \
  --identifier "com.rsnexus.neia.pkg" \
  --version "${VERSION}" \
  --install-location "/" \
  "${component_pkg}"

output_pkg="${OUTPUT_DIR}/Nexus-N3-NEIA-${VERSION}.pkg"
product_args=(--package "${component_pkg}")
if [[ -n "${SIGN_IDENTITY}" ]]; then
  product_args+=(--sign "${SIGN_IDENTITY}")
fi
productbuild "${product_args[@]}" "${output_pkg}"

echo "Built macOS installer:"
echo "  ${output_pkg}"
