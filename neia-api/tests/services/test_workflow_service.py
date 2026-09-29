import pytest

from app.models.workflows import (
    WorkflowSensorConfig,
    WorkflowSubjectInput,
    WorkflowLoadRequest,
    WorkflowLoadSubject,
    WorkflowSaveRequest,
    WorkflowSensorConfig,
    WorkflowSubjectInput,
    WorkflowAlgorithmCapability,
    WorkflowCapabilitySnapshot,
    WorkflowSensorCapability,
    
)
from app.services.workflow_service import (
    WorkflowSubjectMappingError,
    build_requirements,
    map_workflow_subjects,
    normalize_subjects,
    WorkflowService,
    check_workflow_compatibility,
    WorkflowCompatibilityError,
    WorkflowCoreUnavailableError,
)

from app.repositories.workflow_store import WorkflowStore

class FakeCoreStateStore:
    def __init__(self, snapshot: dict | None = None) -> None:
        self.snapshot = snapshot or {
            "connection_state": "connected",
            "available": True,
            "sensors": [],
            "algorithms": [],
        }

    def capabilities_snapshot(self) -> dict:
        return self.snapshot

def make_compatible_core_store() -> FakeCoreStateStore:
    return FakeCoreStateStore(
        {
            "connection_state": "connected",
            "available": True,
            "sensors": [
                {
                    "id": "Movella DOT",
                    "available": True,
                    "supported_locations": [
                        "HEAD",
                        "LEFT_ANKLE",
                    ],
                    "supported_algorithms": [
                        "standard_loading_intensity",
                    ],
                }
            ],
            "algorithms": [
                {
                    "id": "standard_loading_intensity",
                    "available": True,
                }
            ],
        }
    )

def test_normalize_subjects_replaces_application_subject_ids():
    subjects = [
        WorkflowSubjectInput(
            subject_id="Subject_1",
            sensors=[
                WorkflowSensorConfig(
                    sensor_type="Movella DOT",
                    location="HEAD",
                    algorithms=["standard_loading_intensity"],
                )
            ],
        ),
        WorkflowSubjectInput(
            subject_id="Subject_2",
            sensors=[
                WorkflowSensorConfig(
                    sensor_type="Movesense",
                    location="CHEST",
                    algorithms=["ecg_rhythm_metrics"],
                )
            ],
        ),
    ]

    result = normalize_subjects(subjects)

    assert list(result) == ["s1", "s2"]
    assert result["s1"][0].sensor_type == "Movella DOT"
    assert result["s2"][0].sensor_type == "Movesense"


def test_single_subject_workflow_applies_to_every_current_subject():
    workflow_subjects = {
        "s1": [
            WorkflowSensorConfig(
                sensor_type="Movella DOT",
                location="HEAD",
                algorithms=["standard_loading_intensity"],
            )
        ]
    }

    result = map_workflow_subjects(
        workflow_subjects,
        ["Subject_1", "Subject_2"],
    )

    assert list(result) == ["Subject_1", "Subject_2"]
    assert result["Subject_1"][0].sensor_type == "Movella DOT"
    assert result["Subject_2"][0].sensor_type == "Movella DOT"


def test_two_subject_workflow_repeats_across_four_subjects():
    workflow_subjects = {
        "s1": [
            WorkflowSensorConfig(
                sensor_type="Movella DOT",
                location="HEAD",
                algorithms=["standard_loading_intensity"],
            )
        ],
        "s2": [
            WorkflowSensorConfig(
                sensor_type="Movesense",
                location="CHEST",
                algorithms=["ecg_rhythm_metrics"],
            )
        ],
    }

    result = map_workflow_subjects(
        workflow_subjects,
        [
            "Subject_1",
            "Subject_2",
            "Subject_3",
            "Subject_4",
        ],
    )

    assert result["Subject_1"][0].sensor_type == "Movella DOT"
    assert result["Subject_2"][0].sensor_type == "Movesense"
    assert result["Subject_3"][0].sensor_type == "Movella DOT"
    assert result["Subject_4"][0].sensor_type == "Movesense"

def test_two_subject_workflow_rejects_three_current_subjects():
    workflow_subjects = {
        "s1": [],
        "s2": [],
    }

    with pytest.raises(WorkflowSubjectMappingError) as exc_info:
        map_workflow_subjects(
            workflow_subjects,
            ["Subject_1", "Subject_2", "Subject_3"],
        )

    assert exc_info.value.workflow_subject_count == 2
    assert exc_info.value.current_subject_count == 3

def test_build_requirements_deduplicates_capabilities():
    workflow_subjects = {
        "s1": [
            WorkflowSensorConfig(
                sensor_type="Movella DOT",
                location="HEAD",
                algorithms=["standard_loading_intensity"],
            )
        ],
        "s2": [
            WorkflowSensorConfig(
                sensor_type="Movella DOT",
                location="LEFT_ANKLE",
                algorithms=[
                    "standard_loading_intensity",
                    "generic_data_summary",
                ],
            )
        ],
    }

    result = build_requirements(workflow_subjects)

    assert result.sensors == ["Movella DOT"]
    assert result.algorithms == [
        "generic_data_summary",
        "standard_loading_intensity",
    ]


def test_create_workflow_saves_normalized_artifact(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore(),
    )

    request = WorkflowSaveRequest(
        name="DOT Head Loading",
        subjects=[
            WorkflowSubjectInput(
                subject_id="Subject_1",
                sensors=[
                    WorkflowSensorConfig(
                        sensor_type="Movella DOT",
                        location="HEAD",
                        algorithms=["standard_loading_intensity"],
                    )
                ],
            )
        ],
    )

    result = service.create_workflow(request)

    assert result.name == "DOT Head Loading"
    assert result.subject_count == 1
    assert list(result.subjects) == ["s1"]
    assert result.requirements.sensors == ["Movella DOT"]
    assert result.requirements.algorithms == [
        "standard_loading_intensity"
    ]

    assert store.get(result.id) == result


def test_service_maps_saved_workflow_to_current_subjects(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=make_compatible_core_store(),
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="DOT Head Loading",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Original_Subject",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=["standard_loading_intensity"],
                        )
                    ],
                )
            ],
        )
    )

    result = service.map_workflow(
        workflow.id,
        WorkflowLoadRequest(
            subjects=[
                WorkflowLoadSubject(subject_id="Subject_1"),
                WorkflowLoadSubject(subject_id="Subject_2"),
            ]
        ),
    )

    assert list(result) == ["Subject_1", "Subject_2"]
    assert result["Subject_1"][0].sensor_type == "Movella DOT"
    assert result["Subject_2"][0].sensor_type == "Movella DOT"

def test_changed_workflow_does_not_overwrite_original(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore(),
    )

    original = service.create_workflow(
        WorkflowSaveRequest(
            name="Original",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=["standard_loading_intensity"],
                        )
                    ],
                )
            ],
        )
    )

    changed = service.create_workflow(
        WorkflowSaveRequest(
            name="Changed",
            derived_from=original.id,
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="LEFT_ANKLE",
                            algorithms=["standard_loading_intensity"],
                        )
                    ],
                )
            ],
        )
    )

    assert changed.id != original.id
    assert changed.derived_from == original.id
    assert service.get_workflow(original.id).name == "Original"
    assert service.get_workflow(changed.id).name == "Changed"
    assert len(service.list_workflows()) == 2

def test_compatible_workflow_has_no_issues(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore(),
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="Compatible workflow",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=[
                                "standard_loading_intensity"
                            ],
                        )
                    ],
                )
            ],
        )
    )

    capabilities = WorkflowCapabilitySnapshot(
        sensors=[
            WorkflowSensorCapability(
                id="Movella DOT",
                available=True,
                supported_locations=[
                    "HEAD",
                    "LEFT_ANKLE",
                ],
                supported_algorithms=[
                    "standard_loading_intensity"
                ],
            )
        ],
        algorithms=[
            WorkflowAlgorithmCapability(
                id="standard_loading_intensity",
                available=True,
            )
        ],
    )

    result = check_workflow_compatibility(
        workflow,
        capabilities,
    )

    assert result.compatible is True
    assert result.issues == []

def test_missing_sensor_is_incompatible(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore,
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="Missing sensor",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movesense",
                            location="CHEST",
                            algorithms=["ecg_rhythm_metrics"],
                        )
                    ],
                )
            ],
        )
    )

    capabilities = WorkflowCapabilitySnapshot(
        sensors=[],
        algorithms=[
            WorkflowAlgorithmCapability(
                id="ecg_rhythm_metrics",
                available=True,
            )
        ],
    )

    result = check_workflow_compatibility(
        workflow,
        capabilities,
    )

    assert result.compatible is False
    assert result.issues[0].code == "missing_sensor"
    assert result.issues[0].sensor_type == "Movesense"

def test_unsupported_location_is_incompatible(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore,
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="Unsupported location",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="CHEST",
                            algorithms=[
                                "standard_loading_intensity"
                            ],
                        )
                    ],
                )
            ],
        )
    )

    capabilities = WorkflowCapabilitySnapshot(
        sensors=[
            WorkflowSensorCapability(
                id="Movella DOT",
                available=True,
                supported_locations=["HEAD"],
                supported_algorithms=[
                    "standard_loading_intensity"
                ],
            )
        ],
        algorithms=[
            WorkflowAlgorithmCapability(
                id="standard_loading_intensity",
                available=True,
            )
        ],
    )

    result = check_workflow_compatibility(
        workflow,
        capabilities,
    )

    assert result.compatible is False
    assert result.issues[0].code == "unsupported_location"

def test_unsupported_sensor_algorithm_is_incompatible(
    tmp_path,
):
    store = WorkflowStore(tmp_path / "workflows")
    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore,
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="Unsupported combination",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=["ecg_rhythm_metrics"],
                        )
                    ],
                )
            ],
        )
    )

    capabilities = WorkflowCapabilitySnapshot(
        sensors=[
            WorkflowSensorCapability(
                id="Movella DOT",
                available=True,
                supported_locations=["HEAD"],
                supported_algorithms=[
                    "standard_loading_intensity"
                ],
            )
        ],
        algorithms=[
            WorkflowAlgorithmCapability(
                id="ecg_rhythm_metrics",
                available=True,
            )
        ],
    )

    result = check_workflow_compatibility(
        workflow,
        capabilities,
    )

    assert result.compatible is False
    assert any(
        issue.code == "unsupported_sensor_algorithm"
        for issue in result.issues
    )

def test_map_workflow_rejects_disconnected_core(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")

    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore(
            {
                "connection_state": "disconnected",
                "available": False,
                "sensors": [],
                "algorithms": [],
            }
        ),
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="DOT workflow",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=[
                                "standard_loading_intensity"
                            ],
                        )
                    ],
                )
            ],
        )
    )

    with pytest.raises(
        WorkflowCoreUnavailableError
    ) as exc_info:
        service.map_workflow(
            workflow.id,
            WorkflowLoadRequest(
                subjects=[
                    WorkflowLoadSubject(
                        subject_id="Subject_1"
                    )
                ]
            ),
        )

    assert exc_info.value.connection_state == "disconnected"

def test_map_workflow_rejects_incompatible_capabilities(
    tmp_path,
):
    store = WorkflowStore(tmp_path / "workflows")

    service = WorkflowService(
        store=store,
        core_state_store=FakeCoreStateStore(
            {
                "connection_state": "connected",
                "available": True,
                "sensors": [
                    {
                        "id": "Movesense",
                        "available": True,
                        "supported_locations": ["CHEST"],
                        "supported_algorithms": [
                            "ecg_rhythm_metrics"
                        ],
                    }
                ],
                "algorithms": [
                    {
                        "id": "ecg_rhythm_metrics",
                        "available": True,
                    }
                ],
            }
        ),
    )

    workflow = service.create_workflow(
        WorkflowSaveRequest(
            name="DOT workflow",
            subjects=[
                WorkflowSubjectInput(
                    subject_id="Subject_1",
                    sensors=[
                        WorkflowSensorConfig(
                            sensor_type="Movella DOT",
                            location="HEAD",
                            algorithms=[
                                "standard_loading_intensity"
                            ],
                        )
                    ],
                )
            ],
        )
    )

    with pytest.raises(
        WorkflowCompatibilityError
    ) as exc_info:
        service.map_workflow(
            workflow.id,
            WorkflowLoadRequest(
                subjects=[
                    WorkflowLoadSubject(
                        subject_id="Subject_1"
                    )
                ]
            ),
        )

    assert exc_info.value.result.compatible is False
    assert any(
        issue.code == "missing_sensor"
        for issue in exc_info.value.result.issues
    )