from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from .finanzas import TipoPago

EstadoCita = Literal[
    "pendiente",
    "confirmada",
    "en_espera",
    "en_atencion",
    "completada",
    "no_asistio",
    "cancelada",
]


class ServicioCitaPayload(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    costo: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)


class CitaPagoPayload(BaseModel):
    pacienteId: int = Field(gt=0)
    planId: int | None = Field(default=None, gt=0)
    citaBaseId: int | None = Field(default=None, gt=0)

    fecha: str = Field(min_length=10, max_length=10)
    hora: str = Field(min_length=5, max_length=5)
    horaFin: str | None = Field(
        default=None,
        min_length=5,
        max_length=5,
    )
    duracionMinutos: int = Field(default=60, ge=5, le=720)
    procedimiento: str = Field(min_length=2, max_length=200)
    servicios: list[ServicioCitaPayload] = Field(
        default_factory=list,
        max_length=20,
    )
    notas: str = Field(default="", max_length=5000)
    estado: EstadoCita = "pendiente"

    costo: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    tipoPago: TipoPago = "contado"
    montoPagado: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    metodoPago: str = Field(default="Efectivo", max_length=50)

    sesionNum: int = Field(default=1, ge=1)
    totalSesiones: int = Field(default=1, ge=1)


class CambioEstadoPayload(BaseModel):
    estado: EstadoCita


class ReprogramarCitaPayload(BaseModel):
    fecha: str = Field(min_length=10, max_length=10)
    hora: str = Field(min_length=5, max_length=5)
    horaFin: str | None = Field(
        default=None,
        min_length=5,
        max_length=5,
    )
    duracionMinutos: int = Field(default=60, ge=5, le=720)
