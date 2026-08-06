from __future__ import annotations

import hashlib
import secrets

from pwdlib import PasswordHash

MINIMO_CARACTERES_CONTRASENA = 12
GESTOR_CONTRASENAS = PasswordHash.recommended()


def validar_contrasena_segura(contrasena: str) -> None:
    if len(contrasena) < MINIMO_CARACTERES_CONTRASENA:
        raise ValueError(
            "La contraseña debe tener al menos "
            f"{MINIMO_CARACTERES_CONTRASENA} caracteres."
        )

    if not contrasena.strip():
        raise ValueError("La contraseña no puede contener únicamente espacios.")


def crear_hash_contrasena(contrasena: str) -> str:
    validar_contrasena_segura(contrasena)
    return GESTOR_CONTRASENAS.hash(contrasena)


def verificar_contrasena(
    contrasena: str,
    hash_contrasena: str,
) -> bool:
    return GESTOR_CONTRASENAS.verify(
        contrasena,
        hash_contrasena,
    )


def crear_token_sesion() -> str:
    return secrets.token_urlsafe(32)


def crear_hash_token_sesion(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
