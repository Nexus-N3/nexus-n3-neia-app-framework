from __future__ import annotations

from fastapi import (
    APIRouter,
)

from .app import create_app
from .api.router import api_router

api_v1 = APIRouter()

# create the app 
app = create_app(api_router)
