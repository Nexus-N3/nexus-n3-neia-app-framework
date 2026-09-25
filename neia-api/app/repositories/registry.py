from __future__ import annotations

import json
from socket import timeout as SocketTimeout
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from pathlib import Path
from typing import Dict, List

from ..config import INSTALLED_FILE, NEIA_DEV, NEIA_DEV_FALLBACK, REGISTRY_DIR
from ..models.app import AppInfo, AppManifest


class AppRegistry:
    def __init__(
        self,
        registry_dir: Path = REGISTRY_DIR,
        installed_file: Path = INSTALLED_FILE,
        excluded_app_ids: set[str] | None = None,
    ):
        self.registry_dir = registry_dir
        self.installed_file = installed_file
        self.excluded_app_ids = excluded_app_ids or set()

    def resolve_app_dir(self, app_id: str) -> Path:
        return self.registry_dir / app_id

    def list_registry_app_ids(self) -> List[str]:
        if not self.registry_dir.exists():
            return []
        return sorted(
            [
                path.name
                for path in self.registry_dir.iterdir()
                if path.is_dir() and path.name not in self.excluded_app_ids
            ]
        )

    def load_manifest(self, app_id: str) -> AppManifest:
        manifest_path = self.resolve_app_dir(app_id) / "app.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"app.json not found for {app_id}")
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        return AppManifest(**data)

    def load_installed_ids(self) -> List[str]:
        if not self.installed_file.exists():
            return []
        data = json.loads(self.installed_file.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            return []
        return [str(x) for x in data]

    def save_installed_ids(self, app_ids: List[str]) -> None:
        self.installed_file.parent.mkdir(parents=True, exist_ok=True)
        self.installed_file.write_text(json.dumps(sorted(set(app_ids)), indent=2), encoding="utf-8")

    def get_app_info(self, app_id: str) -> AppInfo:
        manifest = self.load_manifest(app_id)
        installed_ids = set(self.load_installed_ids())
        installed = app_id in installed_ids
        resolved_entry_ui = manifest.entry_ui
        resolved_mount = manifest.mount
        if NEIA_DEV and manifest.dev_entry_ui:
            use_dev = True
            if NEIA_DEV_FALLBACK and manifest.entry_ui and manifest.dev_entry_ui.startswith(("http://", "https://")):
                use_dev = self._dev_ui_available(manifest.dev_entry_ui)
            if use_dev:
                resolved_entry_ui = manifest.dev_entry_ui
                resolved_mount = manifest.dev_mount or manifest.mount
        return AppInfo(
            manifest=manifest,
            installed=installed,
            resolved_entry_ui=resolved_entry_ui,
            resolved_mount=resolved_mount,
        )

    @staticmethod
    def _dev_ui_available(url: str) -> bool:
        try:
            req = Request(url, method="HEAD")
            with urlopen(req, timeout=0.4) as resp:
                return 200 <= resp.status < 400
        except HTTPError as exc:
            if exc.code in (405, 404):
                try:
                    with urlopen(url, timeout=0.4) as resp:
                        return 200 <= resp.status < 400
                except (HTTPError, URLError, SocketTimeout):
                    return False
            return False
        except (URLError, SocketTimeout):
            return False

    def list_all(self) -> List[AppInfo]:
        infos = []
        for app_id in self.list_registry_app_ids():
            infos.append(self.get_app_info(app_id))
        return infos

    def list_installed(self) -> List[AppInfo]:
        installed_ids = set(self.load_installed_ids())
        return [info for info in self.list_all() if info.manifest.id in installed_ids]

    def list_available(self) -> List[AppInfo]:
        installed_ids = set(self.load_installed_ids())
        return [info for info in self.list_all() if info.manifest.id not in installed_ids]

    def install(self, app_id: str) -> AppInfo:
        _ = self.load_manifest(app_id)
        installed_ids = self.load_installed_ids()
        if app_id not in installed_ids:
            installed_ids.append(app_id)
            self.save_installed_ids(installed_ids)
        return self.get_app_info(app_id)

    def uninstall(self, app_id: str) -> AppInfo:
        installed_ids = self.load_installed_ids()
        if app_id in installed_ids:
            installed_ids = [x for x in installed_ids if x != app_id]
            self.save_installed_ids(installed_ids)
        return self.get_app_info(app_id)
