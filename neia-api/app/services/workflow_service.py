from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4
from typing import Any

from ..models.workflows import (
    StoredWorkflow,
    WorkflowCapabilitySnapshot,
    WorkflowCompatibilityIssue,
    WorkflowCompatibilityResult,
    WorkflowLoadRequest,
    WorkflowRequirements,
    WorkflowSaveRequest,
    WorkflowSensorConfig,
    WorkflowSubjectInput,

)
from ..repositories.workflow_store import WorkflowStore
from ..repositories.core_state_store import CoreStateStore

class WorkflowSubjectMappingError(ValueError):
    def __init__(
        self,
        workflow_subject_count: int,
        current_subject_count: int,
    ) -> None:
        self.workflow_subject_count = workflow_subject_count
        self.current_subject_count = current_subject_count

        super().__init__(
            f"A {workflow_subject_count}-subject workflow cannot be mapped "
            f"to {current_subject_count} current subjects."
        )


def normalize_subjects(
    subjects: Sequence[WorkflowSubjectInput],
) -> dict[str, list[WorkflowSensorConfig]]:
    """
    Convert application subject identifiers into generic workflow identifiers.

    Subject_1 -> s1
    Subject_2 -> s2

    The original subject names are deliberately not retained.
    """
    return {
        f"s{index}": [
            sensor.model_copy(deep=True)
            for sensor in subject.sensors
        ]
        for index, subject in enumerate(subjects, start=1)
    }


def build_requirements(
    subjects: dict[str, list[WorkflowSensorConfig]],
) -> WorkflowRequirements:
    sensors: set[str] = set()
    algorithms: set[str] = set()

    for sensor_configs in subjects.values():
        for sensor in sensor_configs:
            sensors.add(sensor.sensor_type)
            algorithms.update(sensor.algorithms)

    return WorkflowRequirements(
        sensors=sorted(sensors),
        algorithms=sorted(algorithms),
    )


def map_workflow_subjects(
    workflow_subjects: dict[str, list[WorkflowSensorConfig]],
    current_subject_ids: Sequence[str],
) -> dict[str, list[WorkflowSensorConfig]]:
    """
    Repeat the workflow template across the current session subjects.

    Examples:
        1 template subject -> 1, 2, 3... current subjects
        2 template subjects -> 2, 4, 6... current subjects
    """
    template_ids = list(workflow_subjects)
    template_count = len(template_ids)
    current_count = len(current_subject_ids)

    if template_count == 0:
        raise ValueError("Workflow contains no subject templates.")

    if current_count == 0 or current_count % template_count != 0:
        raise WorkflowSubjectMappingError(
            workflow_subject_count=template_count,
            current_subject_count=current_count,
        )

    mapped: dict[str, list[WorkflowSensorConfig]] = {}

    for index, current_subject_id in enumerate(current_subject_ids):
        template_id = template_ids[index % template_count]

        mapped[current_subject_id] = [
            sensor.model_copy(deep=True)
            for sensor in workflow_subjects[template_id]
        ]

    return mapped

def check_workflow_compatibility(
    workflow: StoredWorkflow,
    capabilities: WorkflowCapabilitySnapshot,
) -> WorkflowCompatibilityResult:
    sensor_capabilities = {
        sensor.id: sensor
        for sensor in capabilities.sensors
    }
    algorithm_capabilities = {
        algorithm.id: algorithm
        for algorithm in capabilities.algorithms
    }

    issues: list[WorkflowCompatibilityIssue] = []
    seen_issues: set[tuple[str, ...]] = set()

    def add_issue(
        issue: WorkflowCompatibilityIssue,
        key: tuple[str, ...],
    ) -> None:
        if key in seen_issues:
            return

        seen_issues.add(key)
        issues.append(issue)

    for template_subject, sensor_configs in workflow.subjects.items():
        for sensor_config in sensor_configs:
            sensor = sensor_capabilities.get(
                sensor_config.sensor_type
            )

            if sensor is None:
                add_issue(
                    WorkflowCompatibilityIssue(
                        code="missing_sensor",
                        template_subject=template_subject,
                        sensor_type=sensor_config.sensor_type,
                        location=sensor_config.location,
                        message=(
                            f"Sensor '{sensor_config.sensor_type}' "
                            "is not installed."
                        ),
                    ),
                    (
                        "missing_sensor",
                        sensor_config.sensor_type,
                    ),
                )
                continue

            if not sensor.available:
                add_issue(
                    WorkflowCompatibilityIssue(
                        code="sensor_unavailable",
                        template_subject=template_subject,
                        sensor_type=sensor_config.sensor_type,
                        location=sensor_config.location,
                        message=(
                            f"Sensor '{sensor_config.sensor_type}' "
                            "is installed but unavailable."
                        ),
                    ),
                    (
                        "sensor_unavailable",
                        sensor_config.sensor_type,
                    ),
                )

            if (
                sensor_config.location
                not in sensor.supported_locations
            ):
                add_issue(
                    WorkflowCompatibilityIssue(
                        code="unsupported_location",
                        template_subject=template_subject,
                        sensor_type=sensor_config.sensor_type,
                        location=sensor_config.location,
                        message=(
                            f"Sensor '{sensor_config.sensor_type}' "
                            f"does not support location "
                            f"'{sensor_config.location}'."
                        ),
                    ),
                    (
                        "unsupported_location",
                        sensor_config.sensor_type,
                        sensor_config.location,
                    ),
                )

            for algorithm_id in sensor_config.algorithms:
                algorithm = algorithm_capabilities.get(
                    algorithm_id
                )

                if algorithm is None:
                    add_issue(
                        WorkflowCompatibilityIssue(
                            code="missing_algorithm",
                            template_subject=template_subject,
                            sensor_type=sensor_config.sensor_type,
                            location=sensor_config.location,
                            algorithm=algorithm_id,
                            message=(
                                f"Algorithm '{algorithm_id}' "
                                "is not installed."
                            ),
                        ),
                        (
                            "missing_algorithm",
                            algorithm_id,
                        ),
                    )
                    continue

                if not algorithm.available:
                    add_issue(
                        WorkflowCompatibilityIssue(
                            code="algorithm_unavailable",
                            template_subject=template_subject,
                            sensor_type=sensor_config.sensor_type,
                            location=sensor_config.location,
                            algorithm=algorithm_id,
                            message=(
                                f"Algorithm '{algorithm_id}' "
                                "is installed but unavailable."
                            ),
                        ),
                        (
                            "algorithm_unavailable",
                            algorithm_id,
                        ),
                    )

                if (
                    algorithm_id
                    not in sensor.supported_algorithms
                ):
                    add_issue(
                        WorkflowCompatibilityIssue(
                            code=(
                                "unsupported_sensor_algorithm"
                            ),
                            template_subject=template_subject,
                            sensor_type=sensor_config.sensor_type,
                            location=sensor_config.location,
                            algorithm=algorithm_id,
                            message=(
                                f"Sensor "
                                f"'{sensor_config.sensor_type}' "
                                f"does not support algorithm "
                                f"'{algorithm_id}'."
                            ),
                        ),
                        (
                            "unsupported_sensor_algorithm",
                            sensor_config.sensor_type,
                            algorithm_id,
                        ),
                    )

    return WorkflowCompatibilityResult(
        compatible=not issues,
        issues=issues,
    )

class WorkflowService:
    def __init__(
        self,
        store: WorkflowStore,
        core_state_store: CoreStateStore,
    ) -> None:
        self.store = store
        self.core_state_store = core_state_store

    def create_workflow(
        self,
        request: WorkflowSaveRequest,
    ) -> StoredWorkflow:
        name = request.name.strip()

        if not name:
            raise ValueError("Workflow name cannot be empty.")

        normalized_subjects = normalize_subjects(request.subjects)
        requirements = build_requirements(normalized_subjects)
        now = datetime.now(timezone.utc)

        workflow = StoredWorkflow(
            id=uuid4(),
            name=name,
            created_at=now,
            modified_at=now,
            derived_from=request.derived_from,
            subject_count=len(normalized_subjects),
            subjects=normalized_subjects,
            requirements=requirements,
        )

        return self.store.save(workflow)

    def get_workflow(
        self,
        workflow_id: UUID,
    ) -> StoredWorkflow:
        return self.store.get(workflow_id)

    def list_workflows(self) -> list[StoredWorkflow]:
        return self.store.list()

    def delete_workflow(
        self,
        workflow_id: UUID,
    ) -> None:
        self.store.delete(workflow_id)

    def export_workflow_path(
        self,
        workflow_id: UUID,
    ) -> Path:
        return self.store.export_path(workflow_id)

    def map_workflow(
        self,
        workflow_id: UUID,
        request: WorkflowLoadRequest,
    ) -> dict[str, list[WorkflowSensorConfig]]:
        workflow = self.store.get(workflow_id)

        core_snapshot = self.core_state_store.capabilities_snapshot()

        capabilities = build_workflow_capability_snapshot(
            core_snapshot
        )

        compatibility = check_workflow_compatibility(
            workflow,
            capabilities,
        )

        if not compatibility.compatible:
            raise WorkflowCompatibilityError(
                compatibility
            )

        current_subject_ids = [
            subject.subject_id
            for subject in request.subjects
        ]

        return map_workflow_subjects(
            workflow.subjects,
            current_subject_ids,
        )
class WorkflowCoreUnavailableError(RuntimeError):
    def __init__(self, connection_state: str) -> None:
        self.connection_state = connection_state

        super().__init__(
            "Workflow compatibility cannot be checked because "
            f"Nexus N3 Core is {connection_state}."
        )


class WorkflowCompatibilityError(ValueError):
    def __init__(
        self,
        result: WorkflowCompatibilityResult,
    ) -> None:
        self.result = result

        super().__init__(
            "The workflow is incompatible with the current "
            "Nexus N3 Core capabilities."
        )

def build_workflow_capability_snapshot(
    core_snapshot: dict[str, Any],
) -> WorkflowCapabilitySnapshot:
    connection_state = str(
        core_snapshot.get("connection_state", "disconnected")
    )

    if core_snapshot.get("available") is not True:
        raise WorkflowCoreUnavailableError(connection_state)

    return WorkflowCapabilitySnapshot(
        sensors=core_snapshot.get("sensors", []),
        algorithms=core_snapshot.get("algorithms", []),
    )