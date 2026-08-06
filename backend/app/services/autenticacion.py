from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import SesionDB, UsuarioDB
from ..seguridad import (
    crear_hash_token_sesion,
    crear_token_sesion,
    verificar_contrasena,
)
from .usuarios import ErrorUsuario, normalizar_nombre_usuario

DURACION_SESION_HORAS = 8
MAX_INTENTOS_FALLIDOS = 5
DURACION_BLOQUEO_MINUTOS = 15


class ErrorAutenticacion(Exception):
    """Error controlado durante la autenticación."""


class CredencialesInvalidasError(ErrorAutenticacion):
    """El usuario o la contraseña no son válidos."""


class UsuarioBloqueadoError(ErrorAutenticacion):
    """El usuario está bloqueado temporalmente."""


class SesionInvalidaError(ErrorAutenticacion):
    """La sesión no existe, venció o fue revocada."""


def normalizar_momento(
    momento: datetime | None = None,
) -> datetime:
    actual = momento or datetime.now(UTC)

    if actual.tzinfo is None:
        raise ValueError("El momento debe incluir zona horaria.")

    return actual.astimezone(UTC)


def convertir_fecha(valor: str) -> datetime:
    fecha = datetime.fromisoformat(valor)

    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=UTC)

    return fecha.astimezone(UTC)


def iniciar_sesion(
    db: Session,
    *,
    nombre_usuario: str,
    contrasena: str,
    momento: datetime | None = None,
) -> tuple[UsuarioDB, str]:
    actual = normalizar_momento(momento)

    try:
        usuario_normalizado = normalizar_nombre_usuario(nombre_usuario)
    except ErrorUsuario as error:
        raise CredencialesInvalidasError("Usuario o contraseña incorrectos.") from error

    usuario = db.scalar(
        select(UsuarioDB).where(
            func.lower(func.trim(UsuarioDB.nombre_usuario)) == usuario_normalizado
        )
    )

    if usuario is None or not usuario.activo:
        raise CredencialesInvalidasError("Usuario o contraseña incorrectos.")

    if usuario.bloqueado_hasta:
        bloqueado_hasta = convertir_fecha(usuario.bloqueado_hasta)

        if bloqueado_hasta > actual:
            raise UsuarioBloqueadoError("Usuario bloqueado temporalmente.")

        usuario.bloqueado_hasta = None
        usuario.intentos_fallidos = 0

    if not verificar_contrasena(
        contrasena,
        usuario.contrasena_hash,
    ):
        usuario.intentos_fallidos += 1
        usuario.actualizado_en = actual.isoformat(timespec="seconds")

        if usuario.intentos_fallidos >= MAX_INTENTOS_FALLIDOS:
            usuario.bloqueado_hasta = (
                actual + timedelta(minutes=DURACION_BLOQUEO_MINUTOS)
            ).isoformat(timespec="seconds")

        db.commit()

        raise CredencialesInvalidasError("Usuario o contraseña incorrectos.")

    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    usuario.ultimo_acceso_en = actual.isoformat(timespec="seconds")
    usuario.actualizado_en = actual.isoformat(timespec="seconds")

    token = crear_token_sesion()

    sesion = SesionDB(
        usuario_id=usuario.id,
        token_hash=crear_hash_token_sesion(token),
        creada_en=actual.isoformat(timespec="seconds"),
        expira_en=(actual + timedelta(hours=DURACION_SESION_HORAS)).isoformat(
            timespec="seconds"
        ),
    )

    db.add(sesion)
    db.commit()
    db.refresh(usuario)

    return usuario, token


def obtener_usuario_por_token(
    db: Session,
    token: str,
    *,
    momento: datetime | None = None,
) -> UsuarioDB:
    if not token:
        raise SesionInvalidaError("Sesión no válida.")

    actual = normalizar_momento(momento)

    sesion = db.scalar(
        select(SesionDB).where(SesionDB.token_hash == crear_hash_token_sesion(token))
    )

    if (
        sesion is None
        or sesion.revocada_en is not None
        or convertir_fecha(sesion.expira_en) <= actual
    ):
        raise SesionInvalidaError("Sesión no válida.")

    usuario = db.get(UsuarioDB, sesion.usuario_id)

    if usuario is None or not usuario.activo:
        raise SesionInvalidaError("Sesión no válida.")

    return usuario


def revocar_sesion(
    db: Session,
    token: str,
    *,
    momento: datetime | None = None,
) -> bool:
    if not token:
        return False

    sesion = db.scalar(
        select(SesionDB).where(SesionDB.token_hash == crear_hash_token_sesion(token))
    )

    if sesion is None or sesion.revocada_en is not None:
        return False

    sesion.revocada_en = normalizar_momento(momento).isoformat(timespec="seconds")
    db.commit()

    return True
