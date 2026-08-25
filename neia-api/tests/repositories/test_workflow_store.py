from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.workflows import (
    StoredWorkflow,
    WorkflowRequirements,
    WorkflowSensorConfig,
)
from app.repositories.workflow_store import (
    WorkflowNotFoundError,
    WorkflowStore,
)

def make_workflow(
    *,
    name: str = "DOT Head Loading",
    modified_at: datetime | None = None,
) -> StoredWorkflow:
    now = modified_at or datetime.now(timezone.utc)

    return StoredWorkflow(
        id=uuid4(),
        name=name,
        created_at=now,
        modified_at=now,
        subject_count=1,
        subjects={
            "s1": [
                WorkflowSensorConfig(
                    sensor_type="Movella DOT",
                    location="HEAD",
                    algorithms=["standard_loading_intensity"],
                )
            ]
        },
        requirements=WorkflowRequirements(
            sensors=["Movella DOT"],
            algorithms=["standard_loading_intensity"],
        ),
    )

def test_store_creates_workflow_directory(tmp_path):
    workflows_dir = tmp_path / "nested" / "workflows"

    assert not workflows_dir.exists()

    WorkflowStore(workflows_dir)

    assert workflows_dir.is_dir()


def test_save_and_get_workflow(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    workflow = make_workflow()

    saved = store.save(workflow)
    loaded = store.get(workflow.id)

    assert saved == workflow
    assert loaded == workflow
    assert (tmp_path / "workflows" / f"{workflow.id}.json").is_file()

def test_initialization_preserves_existing_workflows(tmp_path):
    workflows_dir = tmp_path / "workflows"
    store = WorkflowStore(workflows_dir)
    workflow = make_workflow()

    store.save(workflow)

    second_store = WorkflowStore(workflows_dir)

    assert second_store.get(workflow.id) == workflow

def test_list_returns_workflows_newest_first(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    now = datetime.now(timezone.utc)

    older = make_workflow(
        name="Older workflow",
        modified_at=now - timedelta(hours=1),
    )
    newer = make_workflow(
        name="Newer workflow",
        modified_at=now,
    )

    store.save(older)
    store.save(newer)

    result = store.list()

    assert [workflow.id for workflow in result] == [
        newer.id,
        older.id,
    ]

def test_delete_removes_workflow(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    workflow = make_workflow()

    store.save(workflow)
    store.delete(workflow.id)

    assert store.list() == []

    with pytest.raises(WorkflowNotFoundError):
        store.get(workflow.id)

def test_get_missing_workflow_raises_not_found(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    missing_id = uuid4()

    with pytest.raises(WorkflowNotFoundError) as exc_info:
        store.get(missing_id)

    assert exc_info.value.workflow_id == missing_id

def test_export_path_returns_saved_file(tmp_path):
    store = WorkflowStore(tmp_path / "workflows")
    workflow = make_workflow()

    store.save(workflow)

    export_path = store.export_path(workflow.id)

    assert export_path.is_file()
    assert export_path.name == f"{workflow.id}.json"