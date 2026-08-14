from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..database import (
    COOKIE_ENTORNO_DATOS,
    ENTORNO_OFICIAL,
    ENTORNO_PRUEBAS,
    entorno_desde_request,
    fabrica_sesiones_entorno,
    get_db,
)
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
    buscar_usuario_por_nombre,
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


def _resolver_entorno_inicio_sesion(nombre_usuario: str) -> str:
    coincidencias: list[tuple[str, bool]] = []

    for entorno in (ENTORNO_OFICIAL, ENTORNO_PRUEBAS):
        fabrica_sesiones = fabrica_sesiones_entorno(entorno)
        try:
            with fabrica_sesiones() as db:
                usuario = buscar_usuario_por_nombre(db, nombre_usuario)
        except ValueError:
            return ENTORNO_OFICIAL

        if usuario is not None:
            coincidencias.append((entorno, bool(usuario.activo)))

    activas = [entorno for entorno, activa in coincidencias if activa]

    if len(activas) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La cuenta está activa en más de una base de datos. "
                "Un administrador debe corregir su asignación."
            ),
        )

    if activas:
        return activas[0]

    if len(coincidencias) == 1:
        return coincidencias[0][0]

    return ENTORNO_OFICIAL


def crear_respuesta_sesion(usuario, entorno: str) -> SesionResponse:
    return SesionResponse(
        usuario=UsuarioSesionResponse(
            id=usuario.id,
            nombre=usuario.nombre,
            nombre_usuario=usuario.nombre_usuario,
            rol=usuario.rol,
            entorno_datos=entorno,
            es_propietario=es_administrador_propietario(usuario, entorno),
            debe_cambiar_contrasena=bool(usuario.debe_cambiar_contrasena),
        ),
    )


def _configurar_cookies_sesion(
    response: Response,
    *,
    token: str,
    entorno: str,
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
    response.set_cookie(
        key=COOKIE_ENTORNO_DATOS,
        value=entorno,
        **opciones,
    )


def _eliminar_cookies_sesion(response: Response) -> None:
    for cookie in (COOKIE_SESION, COOKIE_ENTORNO_DATOS):
        response.delete_cookie(
            key=cookie,
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
):
    entorno = _resolver_entorno_inicio_sesion(payload.nombre_usuario)
    fabrica_sesiones = fabrica_sesiones_entorno(entorno)

    try:
        with fabrica_sesiones() as db:
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
        entorno=entorno,
    )

    return crear_respuesta_sesion(usuario, entorno)


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

    return crear_respuesta_sesion(
        usuario,
        entorno_desde_request(request),
    )


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
