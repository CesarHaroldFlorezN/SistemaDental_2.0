from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import UsuarioDB
from .services import (
    SesionInvalidaError,
    obtener_usuario_por_token,
)

COOKIE_SESION = "dentalpro_sesion"

BaseDatosDep = Annotated[
    Session,
    Depends(get_db),
]


def obtener_usuario_actual(
    request: Request,
    db: BaseDatosDep,
) -> UsuarioDB:
    token = request.cookies.get(
        COOKIE_SESION,
        "",
    )

    try:
        return obtener_usuario_por_token(
            db,
            token,
        )
    except SesionInvalidaError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para continuar.",
        ) from error


def exigir_roles(
    *roles_permitidos: str,
) -> Callable[..., UsuarioDB]:
    roles = frozenset(roles_permitidos)

    def comprobar_rol(
        usuario: Annotated[
            UsuarioDB,
            Depends(obtener_usuario_actual),
        ],
    ) -> UsuarioDB:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción.",
            )

        return usuario

    return comprobar_rol


exigir_administrador = exigir_roles(
    "administrador",
)
exigir_personal_clinico = exigir_roles(
    "administrador",
    "odontologo",
)
