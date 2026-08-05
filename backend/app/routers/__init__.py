from .citas import router as citas_router
from .crud import router as crud_router
from .finanzas import router as finanzas_router


__all__ = [
    "citas_router",
    "crud_router",
    "finanzas_router",
]