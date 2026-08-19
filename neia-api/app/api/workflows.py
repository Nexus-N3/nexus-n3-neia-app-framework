from __future__ import annotations

from typing import Annotated
from uuid import UUID
from collections import Counter

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from fastapi.responses import FileResponse

from ..app import AppServices, get_services
from ..models.workflows import (
    StoredWorkflow,
    WorkflowListResponse,
    WorkflowLoadRequest,
    WorkflowLoadResponse,
    WorkflowSaveRequest,
    WorkflowSummary,
)
from ..repositories.workflow_store import WorkflowNotFoundError
from ..services.workflow_service import (
    WorkflowCompatibilityError,
    WorkflowCoreUnavailableError,
    WorkflowSubjectMappingError,
)


router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
)

ServicesDependency = Annotated[
    AppServices,
    Depends(get_services),
]


def _workflow_summary(
    workflow: StoredWorkflow,
) -> WorkflowSummary:
    return WorkflowSummary(
        id=workflow.id,
        name=workflow.name,
        subject_count=workflow.subject_count,
        sensor_count=sum(
            len(sensor_configs)
            for sensor_configs in workflow.subjects.values()
        ),
        subjects={
            subject_id: [
                sensor.model_copy(deep=True)
                for sensor in sensor_configs
            ]
            for subject_id, sensor_configs
            in workflow.subjects.items()
        },
        created_at=workflow.created_at,
        modified_at=workflow.modified_at,
        derived_from=workflow.derived_from,
    )

def _workflow_not_found(
    workflow_id: UUID,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "workflow_not_found",
            "message": f"Workflow '{workflow_id}' was not found.",
        },
    )


# endpoints
@router.post(
    "",
    response_model=WorkflowSummary,
    status_code=status.HTTP_201_CREATED,
)
def save_workflow(
    request: WorkflowSaveRequest,
    services: ServicesDependency,
) -> WorkflowSummary:
    workflow = services.workflow_service.create_workflow(
        request
    )

    return _workflow_summary(workflow)

@router.get(
    "",
    response_model=WorkflowListResponse,
)
def list_workflows(
    services: ServicesDependency,
) -> WorkflowListResponse:
    workflows = services.workflow_service.list_workflows()

    return WorkflowListResponse(
        workflows=[
            _workflow_summary(workflow)
            for workflow in workflows
        ]
    )

@router.post(
    "/{workflow_id}/load",
    response_model=WorkflowLoadResponse,
)
def load_workflow(
    workflow_id: UUID,
    request: WorkflowLoadRequest,
    services: ServicesDependency,
) -> WorkflowLoadResponse:
    try:
        mapped_subjects = (
            services.workflow_service.map_workflow(
                workflow_id,
                request,
            )
        )

        workflow = (
            services.workflow_service.get_workflow(
                workflow_id
            )
        )

    except WorkflowNotFoundError:
        raise _workflow_not_found(workflow_id)

    except WorkflowCoreUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "workflow_core_unavailable",
                "message": str(exc),
                "connection_state": exc.connection_state,
            },
        ) from exc

    except WorkflowCompatibilityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "workflow_incompatible",
                "message": str(exc),
                "compatibility": (
                    exc.result.model_dump(mode="json")
                ),
            },
        ) from exc

    except WorkflowSubjectMappingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "workflow_subject_mapping_failed",
                "message": str(exc),
                "workflow_subject_count": (
                    exc.workflow_subject_count
                ),
                "current_subject_count": (
                    exc.current_subject_count
                ),
            },
        ) from exc

    return WorkflowLoadResponse(
        workflow_id=workflow.id,
        workflow_name=workflow.name,
        subjects=mapped_subjects,
    )

@router.get(
    "/{workflow_id}/export",
    response_class=FileResponse,
)
def export_workflow(
    workflow_id: UUID,
    services: ServicesDependency,
) -> FileResponse:
    try:
        workflow = (
            services.workflow_service.get_workflow(
                workflow_id
            )
        )
        path = (
            services.workflow_service
            .export_workflow_path(workflow_id)
        )

    except WorkflowNotFoundError:
        raise _workflow_not_found(workflow_id)

    return FileResponse(
        path=path,
        media_type="application/json",
        filename=f"{workflow.id}.n3workflow.json",
    )

@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_workflow(
    workflow_id: UUID,
    services: ServicesDependency,
) -> Response:
    try:
        services.workflow_service.delete_workflow(
            workflow_id
        )

    except WorkflowNotFoundError:
        raise _workflow_not_found(workflow_id)

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )