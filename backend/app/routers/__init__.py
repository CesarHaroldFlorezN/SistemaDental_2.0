from .autenticacion import router as autenticacion_router
from .citas import router as citas_router
from .clinica import router as clinica_router
from .documentos import router as documentos_router
from .finanzas import router as finanzas_router
from .odontograma import router as odontograma_router
from .pacientes import router as pacientes_router
from .salud import router as salud_router

__all__ = [
    "autenticacion_router",
    "citas_router",
    "clinica_router",
    "documentos_router",
    "finanzas_router",
    "odontograma_router",
    "pacientes_router",
    "salud_router",
]
