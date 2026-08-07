from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import COOKIE_SESION
from ..schemas import (
    CredencialesPayload,
    SesionResponse,
    UsuarioSesionResponse,
)
from ..services import (
    DURACION_SESION_HORAS,
    CredencialesInvalidasError,
    SesionInvalidaError,
    UsuarioBloqueadoError,
    iniciar_sesion,
    obtener_usuario_por_token,
    revocar_sesion,
)

DURACION_SESION_SEGUNDOS = DURACION_SESION_HORAS * 60 * 60

router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticación"],
)


def crear_respuesta_sesion(usuario) -> SesionResponse:
    return SesionResponse(
        usuario=UsuarioSesionResponse.model_validate(usuario),
    )


@router.post(
    "/login",
    response_model=SesionResponse,
)
def login(
    payload: CredencialesPayload,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        usuario, token = iniciar_sesion(
            db,
            nombre_usuario=payload.nombre_usuario,
            contrasena=payload.contrasena,
        )
    except UsuarioBloqueadoError as error:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(error),
        ) from error
    except CredencialesInvalidasError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error

    response.set_cookie(
        key=COOKIE_SESION,
        value=token,
        max_age=DURACION_SESION_SEGUNDOS,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/",
    )

    return crear_respuesta_sesion(usuario)


@router.get(
    "/me",
    response_model=SesionResponse,
)
def obtener_sesion_actual(
    request: Request,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_SESION, "")

    try:
        usuario = obtener_usuario_por_token(
            db,
            token,
        )
    except SesionInvalidaError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida o vencida.",
        ) from error

    return crear_respuesta_sesion(usuario)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_SESION, "")

    revocar_sesion(
        db,
        token,
    )

    response.delete_cookie(
        key=COOKIE_SESION,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/",
    )

    return {
        "message": "Sesión cerrada correctamente.",
    }
