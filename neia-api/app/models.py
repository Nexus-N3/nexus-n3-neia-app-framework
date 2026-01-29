from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class AppManifest(BaseModel):
    id: str
    name: str
    version: str
    description: Optional[str] = None
    app_type: Optional[str] = None
    developer: Optional[str] = None
    icon: Optional[str] = None
    entry_ui: Optional[str] = None
    style: Optional[str] = None
    mount: Optional[str] = None
    dev_entry_ui: Optional[str] = None
    dev_mount: Optional[str] = None


class AppInfo(BaseModel):
    manifest: AppManifest
    installed: bool = Field(default=False)
    resolved_entry_ui: Optional[str] = None
    resolved_mount: Optional[str] = None
