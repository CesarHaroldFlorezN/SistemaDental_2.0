from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..config import OFFICIAL_OWNER_USERNAME
from ..database import get_db
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
    cambiar_estado_usuario,
    crear_usuario,
    es_administrador_propietario,
    listar_usuarios,
    normalizar_nombre_usuario,
    obtener_usuario,
    restablecer_contrasena_usuario,
)

ROLES_CREABLES = frozenset({"administrador", "odontologo", "recepcion"})
NOMBRES_PROPIETARIOS = frozenset({OFFICIAL_OWNER_USERNAME})

router = APIRouter(
    prefix="/api/usuarios",
    tags=["Usuarios"],
)


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
    administrador: UsuarioDB,
) -> None:
    if es_administrador_propietario(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La cuenta propietaria está protegida y no puede "
                "modificarse desde esta pantalla."
            ),
        )

    if usuario.rol == "administrador" and not es_administrador_propietario(
        administrador
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
) -> UsuarioGestionResponse:
    return UsuarioGestionResponse(
        id=usuario.id,
        nombre=usuario.nombre,
        nombre_usuario=usuario.nombre_usuario,
        rol=usuario.rol,
        es_propietario=es_administrador_propietario(usuario),
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


@router.get("", response_model=list[UsuarioGestionResponse])
def consultar_usuarios(
    _administrador: UsuarioDB = Depends(exigir_administrador),
    db: Session = Depends(get_db),
):
    return [_respuesta_usuario(usuario) for usuario in listar_usuarios(db)]


@router.post(
    "",
    response_model=UsuarioGestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_usuario(
    payload: CrearUsuarioPayload,
    administrador: UsuarioDB = Depends(exigir_administrador),
    db: Session = Depends(get_db),
):
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

    if rol == "administrador" and not es_administrador_propietario(administrador):
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

    try:
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
        return _respuesta_usuario(usuario)
    except (ErrorUsuario, SQLAlchemyError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.patch(
    "/{usuario_id}/estado",
    response_model=UsuarioGestionResponse,
)
def actualizar_estado_usuario(
    usuario_id: int,
    payload: CambiarEstadoUsuarioPayload,
    administrador: UsuarioDB = Depends(exigir_administrador),
    db: Session = Depends(get_db),
):
    _confirmar_administrador(
        administrador,
        payload.contrasena_administrador,
    )

    try:
        objetivo = _obtener_objetivo(db, usuario_id)
        _proteger_cuenta_administradora(objetivo, administrador)

        usuario = cambiar_estado_usuario(
            db,
            usuario_id=usuario_id,
            activo=payload.activo,
        )
        db.commit()
        db.refresh(usuario)
        return _respuesta_usuario(usuario)
    except HTTPException:
        raise
    except (ErrorUsuario, SQLAlchemyError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.post(
    "/{usuario_id}/restablecer-contrasena",
    response_model=UsuarioGestionResponse,
)
def restablecer_contrasena(
    usuario_id: int,
    payload: RestablecerContrasenaPayload,
    administrador: UsuarioDB = Depends(exigir_administrador),
    db: Session = Depends(get_db),
):
    _confirmar_administrador(
        administrador,
        payload.contrasena_administrador,
    )

    try:
        objetivo = _obtener_objetivo(db, usuario_id)
        _proteger_cuenta_administradora(objetivo, administrador)

        usuario = restablecer_contrasena_usuario(
            db,
            usuario_id=usuario_id,
            contrasena_temporal=payload.contrasena_temporal,
        )
        db.commit()
        db.refresh(usuario)
        return _respuesta_usuario(usuario)
    except HTTPException:
        raise
    except (SQLAlchemyError, ValueError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
