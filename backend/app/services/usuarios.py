from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import UsuarioDB
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
