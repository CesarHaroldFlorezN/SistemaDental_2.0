from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validar_fecha_nacimiento(valor: str | None) -> str | None:
    if valor in {None, ""}:
        return valor
    try:
        fecha = date.fromisoformat(valor)
    except ValueError as error:
        raise ValueError(
            "La fecha de nacimiento debe usar el formato AAAA-MM-DD."
        ) from error
    if fecha > datetime.now().astimezone().date():
        raise ValueError("La fecha de nacimiento no puede estar en el futuro.")
    return fecha.isoformat()


def _validar_correo(valor: str | None) -> str | None:
    if valor in {None, ""}:
        return valor
    usuario, separador, dominio = valor.partition("@")
    if not separador or not usuario or "." not in dominio:
        raise ValueError("El correo electrónico no tiene un formato válido.")
    return valor


class PacienteCrearPayload(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    nombre: str = Field(min_length=2, max_length=100)
    cedula: str = Field(default="", max_length=50)
    fechaNacimiento: str = Field(default="", max_length=10)
    genero: str = Field(default="", max_length=50)
    telefono: str = Field(default="", max_length=50)
    correo: str = Field(default="", max_length=100)
    codigo_ficha: str = Field(default="", max_length=50)
    direccion: str = Field(default="", max_length=200)
    alergias: str = Field(default="", max_length=5000)
    medicamentos: str = Field(default="", max_length=5000)

    _fecha_valida = field_validator("fechaNacimiento")(_validar_fecha_nacimiento)
    _correo_valido = field_validator("correo")(_validar_correo)


class PacienteActualizarPayload(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    cedula: str | None = Field(default=None, max_length=50)
    fechaNacimiento: str | None = Field(default=None, max_length=10)
    genero: str | None = Field(default=None, max_length=50)
    telefono: str | None = Field(default=None, max_length=50)
    correo: str | None = Field(default=None, max_length=100)
    codigo_ficha: str | None = Field(default=None, max_length=50)
    direccion: str | None = Field(default=None, max_length=200)
    alergias: str | None = Field(default=None, max_length=5000)
    medicamentos: str | None = Field(default=None, max_length=5000)

    _fecha_valida = field_validator("fechaNacimiento")(_validar_fecha_nacimiento)
    _correo_valido = field_validator("correo")(_validar_correo)
