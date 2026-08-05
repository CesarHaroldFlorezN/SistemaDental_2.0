from typing import Literal

from pydantic import BaseModel, Field

TipoPago = Literal[
    "contado",
    "completo",
    "anticipo",
    "cuotas",
    "cortesia",
    "sesion",
]


class OperacionPagoPayload(BaseModel):
    monto: float = Field(gt=0)
    metodo: str = Field(default="Efectivo", max_length=100)
    motivo: str = Field(default="", max_length=1000)
    referencia: str = Field(default="", max_length=150)
    usuario: str = Field(default="Administrador", max_length=100)
