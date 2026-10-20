from __future__ import annotations

from .app import create_app
from .api.router import api_router


# create the app 
app = create_app(api_router)
