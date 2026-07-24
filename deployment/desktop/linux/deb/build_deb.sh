#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: build_deb.sh [options]

Options:
  --version VERSION   Override package version
  --output DIR        Output directory for the built .deb
  --skip-ui-build     Reuse the existing neia-ui/dist without rebuilding
  --help              Show this help
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRAMEWORK_ROOT="$(cd "${LINUX_DIR}/../../.." && pwd)"
DESKTOP_DIR="$(cd "${LINUX_DIR}/.." && pwd)"
BUILD_ROOT="${LINUX_DIR}/.build/deb"
PKG_NAME="nexus-n3-neia-app-framework"
OUTPUT_DIR="${LINUX_DIR}/dist"
VERSION=""
ICON_SOURCE="${DESKTOP_DIR}/icon/NX_icon_dark.png"
SKIP_UI_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="${2:-}"
      shift 2
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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd dpkg-deb
require_cmd fakeroot
require_cmd install
require_cmd sed
require_cmd tar
require_cmd find
require_cmd chmod
require_cmd python3

if [[ "${SKIP_UI_BUILD}" -eq 0 ]]; then
  require_cmd npm
  (
    cd "${FRAMEWORK_ROOT}/neia-ui"
    npm run build
  )
fi

if [[ -z "${VERSION}" ]]; then
  VERSION="$(
    sed -n 's/^version = "\(.*\)"/\1/p' "${FRAMEWORK_ROOT}/neia-api/pyproject.toml" | head -n 1
  )"
fi

if [[ -z "${VERSION}" ]]; then
  echo "Could not determine package version." >&2
  exit 1
fi

WHEEL_PATH=""
if compgen -G "${FRAMEWORK_ROOT}/neia-api/dist/*.whl" >/dev/null 2>&1; then
  WHEEL_PATH="$(find "${FRAMEWORK_ROOT}/neia-api/dist" -maxdepth 1 -type f -name '*.whl' | sort | tail -n 1)"
fi
if [[ -z "${WHEEL_PATH}" ]]; then
  echo "Missing wheel under neia-api/dist. Build one first, for example:" >&2
  echo "  cd ${FRAMEWORK_ROOT}/neia-api && python3 -m build --wheel" >&2
  exit 1
fi

PKG_ROOT="${BUILD_ROOT}/${PKG_NAME}_${VERSION}"
DEBIAN_DIR="${PKG_ROOT}/DEBIAN"

rm -rf "${PKG_ROOT}"
mkdir -p "${DEBIAN_DIR}" "${OUTPUT_DIR}"

install_tree() {
  local src_rel="$1"
  local dest_rel="$2"
  if [[ ! -e "${FRAMEWORK_ROOT}/${src_rel}" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "${PKG_ROOT}/${dest_rel}")"
  (
    cd "${FRAMEWORK_ROOT}"
    tar \
      --exclude='neia-api/.venv' \
      --exclude='neia-api/.pytest_cache' \
      --exclude='neia-api/__pycache__' \
      --exclude='neia-api/app/__pycache__' \
      --exclude='neia-ui/node_modules' \
      --exclude='neia-ui/src' \
      --exclude='apps/*/ui/node_modules' \
      --exclude='apps/*/ui/src' \
      --exclude='apps/*/ui/.vite' \
      -cf - \
      "${src_rel}" \
    ) | (
      cd "${PKG_ROOT}/opt/nexus-n3-neia-app-framework"
      tar -xf -
    )
}

mkdir -p "${PKG_ROOT}/opt/nexus-n3-neia-app-framework"
mkdir -p "${PKG_ROOT}/etc/nexus-n3-neia-app-framework"
mkdir -p "${PKG_ROOT}/lib/systemd/system"
mkdir -p "${PKG_ROOT}/usr/bin"
mkdir -p "${PKG_ROOT}/usr/share/applications"
mkdir -p "${PKG_ROOT}/usr/share/metainfo"
mkdir -p "${PKG_ROOT}/usr/share/icons/hicolor/256x256/apps"
mkdir -p "${PKG_ROOT}/opt/nexus-n3-neia-app-framework/neia-api/dist"

install_tree "apps" "opt/nexus-n3-neia-app-framework/apps"
install_tree "shared" "opt/nexus-n3-neia-app-framework/shared"
install_tree "neia-api" "opt/nexus-n3-neia-app-framework/neia-api"
install_tree "neia-ui/dist" "opt/nexus-n3-neia-app-framework/neia-ui/dist"
install_tree "docs" "opt/nexus-n3-neia-app-framework/docs"
install_tree "models" "opt/nexus-n3-neia-app-framework/models"

install -m 0644 "${WHEEL_PATH}" "${PKG_ROOT}/opt/nexus-n3-neia-app-framework/neia-api/dist/$(basename "${WHEEL_PATH}")"
install -m 0644 "${LINUX_DIR}/neia-desktop.env.example" "${PKG_ROOT}/etc/nexus-n3-neia-app-framework/neia-desktop.env"

sed \
  -e 's|@SERVICE_USER@|neia|g' \
  -e 's|@SERVICE_GROUP@|neia|g' \
  -e 's|@INSTALL_ROOT@|/opt/nexus-n3-neia-app-framework|g' \
  -e 's|@ENV_FILE@|/etc/nexus-n3-neia-app-framework/neia-desktop.env|g' \
  -e 's|@VENV_PYTHON@|/opt/nexus-n3-neia-app-framework/neia-api/.venv/bin/python|g' \
  "${LINUX_DIR}/nexus-n3-neia-app-framework.service" > "${PKG_ROOT}/lib/systemd/system/nexus-n3-neia-app-framework.service"

install -m 0755 "${LINUX_DIR}/open-neia.sh" "${PKG_ROOT}/usr/bin/open-neia"
install -m 0644 "${LINUX_DIR}/neia.desktop" "${PKG_ROOT}/usr/share/applications/neia.desktop"
install -m 0644 "${SCRIPT_DIR}/neia.metainfo.xml" "${PKG_ROOT}/usr/share/metainfo/neia.metainfo.xml"
python3 - "${ICON_SOURCE}" "${PKG_ROOT}/usr/share/icons/hicolor/256x256/apps/neia.png" <<'PY'
from PIL import Image
import sys

src, dst = sys.argv[1], sys.argv[2]
canvas_size = 512
padding = 48
max_size = canvas_size - (padding * 2)

image = Image.open(src).convert("RGBA")
width, height = image.size
scale = min(max_size / width, max_size / height)
resized = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)

canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
offset = ((canvas_size - resized.width) // 2, (canvas_size - resized.height) // 2)
canvas.paste(resized, offset, resized)
canvas.save(dst)
PY

sed -i 's|@LAUNCHER_PATH@|/usr/bin/open-neia|g' "${PKG_ROOT}/usr/share/applications/neia.desktop"

sed "s|@VERSION@|${VERSION}|g" "${SCRIPT_DIR}/control" > "${DEBIAN_DIR}/control"
install -m 0644 "${SCRIPT_DIR}/conffiles" "${DEBIAN_DIR}/conffiles"
install -m 0755 "${SCRIPT_DIR}/postinst" "${DEBIAN_DIR}/postinst"
install -m 0755 "${SCRIPT_DIR}/prerm" "${DEBIAN_DIR}/prerm"
install -m 0755 "${SCRIPT_DIR}/postrm" "${DEBIAN_DIR}/postrm"

find "${PKG_ROOT}" -type d -exec chmod 0755 {} +
DEB_PATH="${OUTPUT_DIR}/${PKG_NAME}_${VERSION}_all.deb"
fakeroot dpkg-deb --build "${PKG_ROOT}" "${DEB_PATH}"

echo "Built package:"
echo "  ${DEB_PATH}"
