# api/models.py

from pydantic import BaseModel, Field


class GatewayTargetRequest(BaseModel):
    target_host: str = Field(min_length=1)
    cmd_port: int | None = Field(default=None, ge=1, le=65535)
    event_port: int | None = Field(default=None, ge=1, le=65535)


class VoiceTtsRequest(BaseModel):
    enabled: bool


class VoiceSpeakRequest(BaseModel):
    text: str = Field(min_length=1)
    wait: bool = False