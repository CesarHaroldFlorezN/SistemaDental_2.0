from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ServicioCatalogoPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nombre: str = Field(min_length=2, max_length=150)
    categoria: str = Field(min_length=2, max_length=100)
    precio: Decimal = Field(default=0, ge=0, max_digits=10, decimal_places=2)
    activo: bool = True


class ServicioCatalogoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    categoria: str
    precio: Decimal
    activo: bool
    creadoEn: str
    actualizadoEn: str
