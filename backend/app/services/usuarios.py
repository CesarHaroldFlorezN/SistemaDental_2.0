from __future__ import annotations

import re

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..models import SesionDB, UsuarioDB
from ..seguridad import crear_hash_contrasena
from .comun import ahora_iso

ROLES_VALIDOS = frozenset(
    {
        "administrador",
        "odontologo",
        "recepcion",
    }
)

PATRON_NOMBRE_USUARIO = re.compile(r"^[a-z0-9._-]{3,40}$")


class ErrorUsuario(ValueError):
    """Error controlado durante la gestión de usuarios."""


class UsuarioDuplicadoError(ErrorUsuario):
    """El nombre de usuario ya está registrado."""


class UsuarioNoEncontradoError(ErrorUsuario):
    """El nombre de usuario no está registrado."""


def normalizar_nombre_usuario(nombre_usuario: str) -> str:
    normalizado = nombre_usuario.strip().lower()

    if not PATRON_NOMBRE_USUARIO.fullmatch(normalizado):
        raise ErrorUsuario(
            "El usuario debe tener entre 3 y 40 caracteres y utilizar "
            "únicamente letras, números, punto, guion o guion bajo."
        )

    return normalizado


def validar_rol(rol: str) -> str:
    rol_normalizado = rol.strip().lower()

    if rol_normalizado not in ROLES_VALIDOS:
        raise ErrorUsuario("Rol de usuario no válido.")

    return rol_normalizado


def crear_usuario(
    db: Session,
    *,
    nombre: str,
    nombre_usuario: str,
    contrasena: str,
    rol: str,
) -> UsuarioDB:
    nombre_limpio = nombre.strip()

    if not nombre_limpio:
        raise ErrorUsuario("El nombre completo es obligatorio.")

    if len(nombre_limpio) > 120:
        raise ErrorUsuario("El nombre completo no puede superar 120 caracteres.")

    usuario_normalizado = normalizar_nombre_usuario(nombre_usuario)
    rol_normalizado = validar_rol(rol)

    usuario_existente = db.scalar(
        select(UsuarioDB.id).where(
            func.lower(func.trim(UsuarioDB.nombre_usuario)) == usuario_normalizado
        )
    )

    if usuario_existente is not None:
        raise UsuarioDuplicadoError(f"El usuario '{usuario_normalizado}' ya existe.")

    momento = ahora_iso()

    usuario = UsuarioDB(
        nombre=nombre_limpio,
        nombre_usuario=usuario_normalizado,
        contrasena_hash=crear_hash_contrasena(contrasena),
        rol=rol_normalizado,
        activo=True,
        intentos_fallidos=0,
        creado_en=momento,
        actualizado_en=momento,
    )

    db.add(usuario)
    db.flush()

    return usuario


def cambiar_contrasena_usuario(
    db: Session,
    *,
    nombre_usuario: str,
    nueva_contrasena: str,
) -> UsuarioDB:
    usuario_normalizado = normalizar_nombre_usuario(nombre_usuario)

    usuario = db.scalar(
        select(UsuarioDB).where(
            func.lower(func.trim(UsuarioDB.nombre_usuario)) == usuario_normalizado
        )
    )

    if usuario is None:
        raise UsuarioNoEncontradoError(f"El usuario '{usuario_normalizado}' no existe.")

    momento = ahora_iso()

    usuario.contrasena_hash = crear_hash_contrasena(nueva_contrasena)
    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    usuario.actualizado_en = momento

    db.execute(
        update(SesionDB)
        .where(
            SesionDB.usuario_id == usuario.id,
            SesionDB.revocada_en.is_(None),
        )
        .values(revocada_en=momento)
    )
    db.flush()

    return usuario
