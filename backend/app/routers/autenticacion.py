from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import COOKIE_SESION
from ..schemas import (
    CambiarContrasenaPropiaPayload,
    CredencialesPayload,
    SesionResponse,
    UsuarioSesionResponse,
)
from ..seguridad import verificar_contrasena
from ..services import (
    DURACION_SESION_HORAS,
    CredencialesInvalidasError,
    SesionInvalidaError,
    UsuarioBloqueadoError,
    cambiar_contrasena_usuario,
    es_administrador_propietario,
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
        usuario=UsuarioSesionResponse(
            id=usuario.id,
            nombre=usuario.nombre,
            nombre_usuario=usuario.nombre_usuario,
            rol=usuario.rol,
            es_propietario=es_administrador_propietario(usuario),
            debe_cambiar_contrasena=bool(usuario.debe_cambiar_contrasena),
        ),
    )


def _configurar_cookies_sesion(
    response: Response,
    *,
    token: str,
) -> None:
    opciones = {
        "max_age": DURACION_SESION_SEGUNDOS,
        "httponly": True,
        "secure": False,
        "samesite": "strict",
        "path": "/",
    }

    response.set_cookie(
        key=COOKIE_SESION,
        value=token,
        **opciones,
    )


def _eliminar_cookies_sesion(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_SESION,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/",
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

    _configurar_cookies_sesion(
        response,
        token=token,
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


@router.post("/cambiar-contrasena")
def cambiar_contrasena_propia(
    payload: CambiarContrasenaPropiaPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_SESION, "")

    try:
        usuario = obtener_usuario_por_token(db, token)
    except SesionInvalidaError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida o vencida.",
        ) from error

    if not verificar_contrasena(
        payload.contrasena_actual,
        usuario.contrasena_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña actual no es correcta.",
        )

    if payload.contrasena_actual == payload.nueva_contrasena:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe ser diferente de la actual.",
        )

    try:
        cambiar_contrasena_usuario(
            db,
            nombre_usuario=usuario.nombre_usuario,
            nueva_contrasena=payload.nueva_contrasena,
        )
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    _eliminar_cookies_sesion(response)
    return {
        "message": "Contraseña actualizada. Inicia sesión nuevamente.",
    }


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

    _eliminar_cookies_sesion(response)

    return {
        "message": "Sesión cerrada correctamente.",
    }
