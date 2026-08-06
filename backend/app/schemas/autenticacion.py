from pydantic import BaseModel, ConfigDict, Field


class CredencialesPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nombre_usuario: str = Field(
        alias="nombreUsuario",
        min_length=1,
        max_length=80,
    )
    contrasena: str = Field(
        min_length=1,
        max_length=256,
    )


class UsuarioSesionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    nombre: str
    nombre_usuario: str = Field(
        serialization_alias="nombreUsuario",
    )
    rol: str


class SesionResponse(BaseModel):
    usuario: UsuarioSesionResponse
