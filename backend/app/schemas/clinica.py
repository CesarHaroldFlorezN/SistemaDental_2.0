from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

TipoCasoClinico = Literal[
    "diagnostico",
    "urgencia",
    "procedimiento",
    "tratamiento",
    "control",
]

EstadoCasoClinico = Literal[
    "abierto",
    "en_tratamiento",
    "resuelto",
    "cerrado",
]


class CasoClinicoPayload(BaseModel):
    pacienteId: int = Field(gt=0)
    planId: int | None = Field(default=None, gt=0)
    titulo: str = Field(min_length=3, max_length=180)
    tipo: TipoCasoClinico = "procedimiento"
    motivoConsulta: str = Field(default="", max_length=5000)
    piezaDental: str = Field(default="", max_length=30)
    diagnostico: str = Field(default="", max_length=5000)
    estado: EstadoCasoClinico = "abierto"


class PlanTratamientoPayload(BaseModel):
    pacienteId: int = Field(gt=0)
    casoClinicoId: int | None = Field(default=None, gt=0)
    nombre: str = Field(min_length=3, max_length=150)
    tipo: str = Field(default="Tratamiento", max_length=100)
    duracion: str = Field(default="", max_length=50)
    costo: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    nSesiones: int = Field(default=1, ge=1, le=60)
    descripcion: str = Field(default="", max_length=5000)
    estado: str = Field(default="activo", max_length=50)


class DiagnosticoCasoPayload(BaseModel):
    diagnostico: str = Field(min_length=2, max_length=5000)
    estado: EstadoCasoClinico = "abierto"
