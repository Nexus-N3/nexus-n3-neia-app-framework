# api/workflows.py

from ..app import AppServices,  get_services
from fastapi import APIRouter

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
)

