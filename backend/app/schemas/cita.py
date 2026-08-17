from datetime import date, time
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

TipoCita = Literal[
    "diagnostico_inicial",
    "urgencia",
    "procedimiento",
    "sesion_tratamiento",
    "control",
]


class ServicioCitaPayload(BaseModel):
    servicioId: int | None = Field(default=None, gt=0)
    nombre: str = Field(min_length=2, max_length=150)
    costo: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)


class HorarioCitaPayload(BaseModel):
    fecha: date
    hora: time
    horaFin: time | None = None

    @property
    def fecha_iso(self) -> str:
        return self.fecha.isoformat()

    @property
    def hora_iso(self) -> str:
        return self.hora.strftime("%H:%M")

    @property
    def hora_fin_iso(self) -> str | None:
        return self.horaFin.strftime("%H:%M") if self.horaFin else None


class CitaPagoPayload(HorarioCitaPayload):
    pacienteId: int = Field(gt=0)
    casoClinicoId: int | None = Field(default=None, gt=0)
    planId: int | None = Field(default=None, gt=0)
    sesionPlanId: int | None = Field(default=None, gt=0)
    citaBaseId: int | None = Field(default=None, gt=0)

    tipoCita: TipoCita = "procedimiento"
    motivoConsulta: str = Field(default="", max_length=5000)
    piezaDental: str = Field(default="", max_length=30)

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


class ReprogramarCitaPayload(HorarioCitaPayload):
    duracionMinutos: int = Field(default=60, ge=5, le=720)
