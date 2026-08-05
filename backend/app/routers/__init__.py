from .citas import router as citas_router
from .documentos import router as documentos_router
from .finanzas import router as finanzas_router
from .pacientes import router as pacientes_router
from .salud import router as salud_router

__all__ = [
    "citas_router",
    "documentos_router",
    "finanzas_router",
    "pacientes_router",
    "salud_router",
]
