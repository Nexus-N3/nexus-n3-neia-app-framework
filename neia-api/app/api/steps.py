# api/gateway.py

from fastapi import (
    APIRouter,
)
from fastapi.responses import FileResponse
from ..config import BASE_DIR


router = APIRouter(
    prefix="/steps",
    tags=["steps"],
)

@router.get("")
def get_steps():
    steps_path = BASE_DIR / "shared" / "steps.json"
    return FileResponse(steps_path)