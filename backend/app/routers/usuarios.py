from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError

from ..config import OFFICIAL_OWNER_USERNAME, TEST_ADMIN_USERNAME
from ..database import (
    ENTORNO_OFICIAL,
    ENTORNO_PRUEBAS,
    entorno_desde_request,
    fabrica_sesiones_entorno,
)
from ..dependencias import exigir_administrador
from ..models import UsuarioDB
from ..schemas import (
    CambiarEstadoUsuarioPayload,
    CrearUsuarioPayload,
    RestablecerContrasenaPayload,
    UsuarioGestionResponse,
)
from ..seguridad import verificar_contrasena
from ..services import (
    ErrorUsuario,
    buscar_usuario_por_nombre,
    cambiar_estado_usuario,
    crear_usuario,
    es_administrador_propietario,
    listar_usuarios,
    normalizar_nombre_usuario,
    obtener_usuario,
    restablecer_contrasena_usuario,
)

ROLES_CREABLES = frozenset({"administrador", "odontologo", "recepcion"})
ENTORNOS_VALIDOS = frozenset({ENTORNO_OFICIAL, ENTORNO_PRUEBAS})
NOMBRES_PROPIETARIOS = frozenset({OFFICIAL_OWNER_USERNAME, TEST_ADMIN_USERNAME})

router = APIRouter(
    prefix="/api/usuarios",
    tags=["Usuarios"],
)


def _entornos_administrables(request: Request) -> tuple[str, ...]:
    if entorno_desde_request(request) == ENTORNO_OFICIAL:
        return ENTORNO_OFICIAL, ENTORNO_PRUEBAS
    return (ENTORNO_PRUEBAS,)


def _exigir_entorno_administrable(
    request: Request,
    entorno: str,
) -> str:
    entorno_normalizado = str(entorno or "").strip().lower()

    if entorno_normalizado not in ENTORNOS_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La base seleccionada no es válida.",
        )

    if entorno_normalizado not in _entornos_administrables(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "El Administrador de pruebas no puede modificar usuarios "
                "de la base oficial."
            ),
        )

    return entorno_normalizado


def _confirmar_administrador(
    usuario: UsuarioDB,
    contrasena: str,
) -> None:
    if not verificar_contrasena(contrasena, usuario.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña del administrador no es correcta.",
        )


def _proteger_cuenta_administradora(
    usuario: UsuarioDB,
    entorno_usuario: str,
    administrador: UsuarioDB,
    entorno_administrador: str,
) -> None:
    if es_administrador_propietario(usuario, entorno_usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La cuenta propietaria está protegida y no puede "
                "modificarse desde esta pantalla."
            ),
        )

    if usuario.rol == "administrador" and not es_administrador_propietario(
        administrador,
        entorno_administrador,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo el Administrador propietario puede modificar a otro "
                "administrador."
            ),
        )


def _respuesta_usuario(
    usuario: UsuarioDB,
    entorno: str,
) -> UsuarioGestionResponse:
    return UsuarioGestionResponse(
        id=usuario.id,
        nombre=usuario.nombre,
        nombre_usuario=usuario.nombre_usuario,
        rol=usuario.rol,
        entorno_datos=entorno,
        es_propietario=es_administrador_propietario(usuario, entorno),
        activo=bool(usuario.activo),
        debe_cambiar_contrasena=bool(usuario.debe_cambiar_contrasena),
        creado_en=usuario.creado_en,
        ultimo_acceso_en=usuario.ultimo_acceso_en,
    )


def _obtener_objetivo(db, usuario_id: int) -> UsuarioDB:
    try:
        return obtener_usuario(db, usuario_id)
    except ErrorUsuario as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


def _otro_entorno(entorno: str) -> str:
    return ENTORNO_PRUEBAS if entorno == ENTORNO_OFICIAL else ENTORNO_OFICIAL


def _buscar_usuario_en_entorno(
    entorno: str,
    nombre_usuario: str,
) -> UsuarioDB | None:
    fabrica_sesiones = fabrica_sesiones_entorno(entorno)
    with fabrica_sesiones() as db:
        return buscar_usuario_por_nombre(db, nombre_usuario)


@router.get("", response_model=list[UsuarioGestionResponse])
def consultar_usuarios(
    request: Request,
    _administrador: UsuarioDB = Depends(exigir_administrador),
):
    resultado: list[UsuarioGestionResponse] = []

    for entorno in _entornos_administrables(request):
        fabrica_sesiones = fabrica_sesiones_entorno(entorno)
        with fabrica_sesiones() as db:
            resultado.extend(
                _respuesta_usuario(usuario, entorno) for usuario in listar_usuarios(db)
            )

    return resultado


@router.post(
    "",
    response_model=UsuarioGestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_usuario(
    payload: CrearUsuarioPayload,
    request: Request,
    administrador: UsuarioDB = Depends(exigir_administrador),
):
    entorno = _exigir_entorno_administrable(
        request,
        payload.entorno_datos,
    )
    _confirmar_administrador(
        administrador,
        payload.contrasena_administrador,
    )

    rol = payload.rol.strip().lower()
    if rol not in ROLES_CREABLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El perfil seleccionado no es válido.",
        )

    entorno_administrador = entorno_desde_request(request)
    if rol == "administrador" and not es_administrador_propietario(
        administrador,
        entorno_administrador,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo el Administrador propietario puede crear otro administrador."
            ),
        )

    try:
        nombre_usuario = normalizar_nombre_usuario(payload.nombre_usuario)
    except ErrorUsuario as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    if nombre_usuario in NOMBRES_PROPIETARIOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese nombre de usuario está reservado por el sistema.",
        )

    usuario_otro_entorno = _buscar_usuario_en_entorno(
        _otro_entorno(entorno),
        nombre_usuario,
    )
    if usuario_otro_entorno is not None and usuario_otro_entorno.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ese usuario está activo en la otra base. Desactívalo allí "
                "antes de crearlo en la base seleccionada."
            ),
        )

    fabrica_sesiones = fabrica_sesiones_entorno(entorno)
    try:
        with fabrica_sesiones() as db:
            usuario = crear_usuario(
                db,
                nombre=payload.nombre,
                nombre_usuario=nombre_usuario,
                contrasena=payload.contrasena_temporal,
                rol=rol,
                debe_cambiar_contrasena=True,
            )
            db.commit()
            db.refresh(usuario)
            return _respuesta_usuario(usuario, entorno)
    except (ErrorUsuario, SQLAlchemyError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.patch(
    "/{entorno}/{usuario_id}/estado",
    response_model=UsuarioGestionResponse,
)
def actualizar_estado_usuario(
    entorno: str,
    usuario_id: int,
    payload: CambiarEstadoUsuarioPayload,
    request: Request,
    administrador: UsuarioDB = Depends(exigir_administrador),
):
    entorno = _exigir_entorno_administrable(request, entorno)
    entorno_administrador = entorno_desde_request(request)
    _confirmar_administrador(
        administrador,
        payload.contrasena_administrador,
    )

    fabrica_sesiones = fabrica_sesiones_entorno(entorno)
    try:
        with fabrica_sesiones() as db:
            objetivo = _obtener_objetivo(db, usuario_id)
            _proteger_cuenta_administradora(
                objetivo,
                entorno,
                administrador,
                entorno_administrador,
            )

            if payload.activo:
                usuario_otro_entorno = _buscar_usuario_en_entorno(
                    _otro_entorno(entorno),
                    objetivo.nombre_usuario,
                )
                if usuario_otro_entorno is not None and usuario_otro_entorno.activo:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "No se puede activar porque el mismo usuario ya "
                            "está activo en la otra base."
                        ),
                    )

            usuario = cambiar_estado_usuario(
                db,
                usuario_id=usuario_id,
                activo=payload.activo,
            )
            db.commit()
            db.refresh(usuario)
            return _respuesta_usuario(usuario, entorno)
    except HTTPException:
        raise
    except (ErrorUsuario, SQLAlchemyError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.post(
    "/{entorno}/{usuario_id}/restablecer-contrasena",
    response_model=UsuarioGestionResponse,
)
def restablecer_contrasena(
    entorno: str,
    usuario_id: int,
    payload: RestablecerContrasenaPayload,
    request: Request,
    administrador: UsuarioDB = Depends(exigir_administrador),
):
    entorno = _exigir_entorno_administrable(request, entorno)
    entorno_administrador = entorno_desde_request(request)
    _confirmar_administrador(
        administrador,
        payload.contrasena_administrador,
    )

    fabrica_sesiones = fabrica_sesiones_entorno(entorno)
    try:
        with fabrica_sesiones() as db:
            objetivo = _obtener_objetivo(db, usuario_id)
            _proteger_cuenta_administradora(
                objetivo,
                entorno,
                administrador,
                entorno_administrador,
            )

            usuario = restablecer_contrasena_usuario(
                db,
                usuario_id=usuario_id,
                contrasena_temporal=payload.contrasena_temporal,
            )
            db.commit()
            db.refresh(usuario)
            return _respuesta_usuario(usuario, entorno)
    except HTTPException:
        raise
    except (SQLAlchemyError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
