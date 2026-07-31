from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field
from typing import Literal

class WorkflowSensorConfig(BaseModel):
    sensor_type: str = Field(min_length=1)
    location: str = Field(min_length=1)
    algorithms: list[str] = Field(default_factory=list, min_length=1)


class WorkflowSubjectInput(BaseModel):
    subject_id: str = Field(min_length=1)
    sensors: list[WorkflowSensorConfig] = Field(min_length=1)


class WorkflowSaveRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    derived_from: UUID | None = None
    subjects: list[WorkflowSubjectInput] = Field(min_length=1)


class WorkflowRequirements(BaseModel):
    sensors: list[str] = Field(default_factory=list)
    algorithms: list[str] = Field(default_factory=list)


class StoredWorkflow(BaseModel):
    schema_version: Literal[1] = 1
    id: UUID
    name: str
    created_at: datetime
    modified_at: datetime
    derived_from: UUID | None = None
    subject_count: int = Field(ge=1)
    subjects: dict[str, list[WorkflowSensorConfig]]
    requirements: WorkflowRequirements


class WorkflowLoadSubject(BaseModel):
    subject_id: str = Field(min_length=1)


class WorkflowLoadRequest(BaseModel):
    subjects: list[WorkflowLoadSubject] = Field(min_length=1)


class WorkflowCompatibilityIssue(BaseModel):
    code: Literal[
        "missing_sensor",
        "sensor_unavailable",
        "missing_algorithm",
        "algorithm_unavailable",
        "unsupported_location",
        "unsupported_sensor_algorithm",
    ]
    template_subject: str
    sensor_type: str
    location: str | None = None
    algorithm: str | None = None
    message: str


class WorkflowCompatibilityResult(BaseModel):
    compatible: bool
    issues: list[WorkflowCompatibilityIssue] = Field(
        default_factory=list
    )

class WorkflowSensorCapability(BaseModel):
    id: str
    available: bool = True
    supported_locations: list[str] = Field(default_factory=list)
    supported_algorithms: list[str] = Field(default_factory=list)


class WorkflowAlgorithmCapability(BaseModel):
    id: str
    available: bool = True


class WorkflowCapabilitySnapshot(BaseModel):
    sensors: list[WorkflowSensorCapability] = Field(
        default_factory=list
    )
    algorithms: list[WorkflowAlgorithmCapability] = Field(
        default_factory=list
    )

# response models
class WorkflowSummary(BaseModel):
    id: UUID
    name: str
    subject_count: int
    sensor_count: int
    subjects: dict[str, list[WorkflowSensorConfig]]
    created_at: datetime
    modified_at: datetime
    derived_from: UUID | None = None


class WorkflowListResponse(BaseModel):
    workflows: list[WorkflowSummary] = Field(default_factory=list)


class WorkflowLoadResponse(BaseModel):
    workflow_id: UUID
    workflow_name: str
    subjects: dict[str, list[WorkflowSensorConfig]]