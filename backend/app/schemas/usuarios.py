from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class UsuarioGestionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    nombre: str
    nombre_usuario: str = Field(serialization_alias="nombreUsuario")
    rol: str
    entorno_datos: Literal["oficial", "pruebas"] = Field(
        serialization_alias="entornoDatos"
    )
    es_propietario: bool = Field(serialization_alias="esPropietario")
    activo: bool
    debe_cambiar_contrasena: bool = Field(serialization_alias="debeCambiarContrasena")
    creado_en: str = Field(serialization_alias="creadoEn")
    ultimo_acceso_en: str | None = Field(
        default=None,
        serialization_alias="ultimoAccesoEn",
    )


class CrearUsuarioPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nombre: str = Field(min_length=1, max_length=120)
    nombre_usuario: str = Field(
        alias="nombreUsuario",
        min_length=3,
        max_length=40,
    )
    rol: str
    entorno_datos: Literal["oficial", "pruebas"] = Field(alias="entornoDatos")
    contrasena_temporal: str = Field(
        alias="contrasenaTemporal",
        min_length=12,
        max_length=256,
    )
    contrasena_administrador: str = Field(
        alias="contrasenaAdministrador",
        min_length=1,
        max_length=256,
    )


class ConfirmacionAdministradorPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    contrasena_administrador: str = Field(
        alias="contrasenaAdministrador",
        min_length=1,
        max_length=256,
    )


class CambiarEstadoUsuarioPayload(ConfirmacionAdministradorPayload):
    activo: bool


class RestablecerContrasenaPayload(ConfirmacionAdministradorPayload):
    contrasena_temporal: str = Field(
        alias="contrasenaTemporal",
        min_length=12,
        max_length=256,
    )


class CambiarContrasenaPropiaPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    contrasena_actual: str = Field(
        alias="contrasenaActual",
        min_length=1,
        max_length=256,
    )
    nueva_contrasena: str = Field(
        alias="nuevaContrasena",
        min_length=12,
        max_length=256,
    )
