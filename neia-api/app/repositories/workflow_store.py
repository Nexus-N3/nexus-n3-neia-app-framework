from __future__ import annotations

from pathlib import Path
from uuid import UUID

from ..models.workflows import StoredWorkflow


class WorkflowNotFoundError(FileNotFoundError):
    def __init__(self, workflow_id: UUID) -> None:
        self.workflow_id = workflow_id
        super().__init__(f"Workflow not found: {workflow_id}")


class WorkflowStore:
    def __init__(self, workflows_dir: Path) -> None:
        self.workflows_dir = workflows_dir
        self.workflows_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

    def _path_for(self, workflow_id: UUID) -> Path:
        return self.workflows_dir / f"{workflow_id}.json"

    def save(self, workflow: StoredWorkflow) -> StoredWorkflow:
        destination = self._path_for(workflow.id)
        temporary = destination.with_suffix(".json.tmp")

        temporary.write_text(
            workflow.model_dump_json(indent=2),
            encoding="utf-8",
        )

        temporary.replace(destination)

        return workflow

    def get(self, workflow_id: UUID) -> StoredWorkflow:
        path = self._path_for(workflow_id)

        if not path.is_file():
            raise WorkflowNotFoundError(workflow_id)

        return StoredWorkflow.model_validate_json(
            path.read_text(encoding="utf-8")
        )

    def list(self) -> list[StoredWorkflow]:
        workflows: list[StoredWorkflow] = []

        for path in self.workflows_dir.glob("*.json"):
            workflows.append(
                StoredWorkflow.model_validate_json(
                    path.read_text(encoding="utf-8")
                )
            )

        return sorted(
            workflows,
            key=lambda workflow: workflow.modified_at,
            reverse=True,
        )

    def delete(self, workflow_id: UUID) -> None:
        path = self._path_for(workflow_id)

        if not path.is_file():
            raise WorkflowNotFoundError(workflow_id)

        path.unlink()

    def export_path(self, workflow_id: UUID) -> Path:
        path = self._path_for(workflow_id)

        if not path.is_file():
            raise WorkflowNotFoundError(workflow_id)

        return path