from __future__ import annotations

import argparse
import getpass
import hmac
import sys
from collections.abc import Callable

from sqlalchemy.exc import SQLAlchemyError

from .database import SessionLocal
from .migrations import inicializar_base_datos
from .services.usuarios import crear_usuario

LectorContrasena = Callable[[str], str]


def solicitar_contrasena(
    lector: LectorContrasena = getpass.getpass,
) -> str:
    contrasena = lector("Contraseña: ")
    confirmacion = lector("Repite la contraseña: ")

    if not hmac.compare_digest(
        contrasena.encode("utf-8"),
        confirmacion.encode("utf-8"),
    ):
        raise ValueError("Las contraseñas no coinciden.")

    return contrasena


def ejecutar_creacion_administrador(
    *,
    nombre: str,
    nombre_usuario: str,
    contrasena: str,
    fabrica_sesiones=SessionLocal,
) -> int:
    try:
        with fabrica_sesiones.begin() as db:
            usuario = crear_usuario(
                db,
                nombre=nombre,
                nombre_usuario=nombre_usuario,
                contrasena=contrasena,
                rol="administrador",
            )

            resumen = (
                usuario.nombre_usuario,
                usuario.nombre,
            )
    except (ValueError, SQLAlchemyError) as error:
        print(
            f"No se pudo crear el administrador: {error}",
            file=sys.stderr,
        )
        return 1

    print(f"Administrador creado correctamente: {resumen[0]} ({resumen[1]}).")
    return 0


def crear_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gestión segura de usuarios de DentalPro."
    )

    comandos = parser.add_subparsers(
        dest="comando",
        required=True,
    )

    crear_admin = comandos.add_parser(
        "crear-admin",
        help="Crea una cuenta con permisos de administrador.",
    )
    crear_admin.add_argument(
        "--nombre",
        required=True,
        help="Nombre completo del administrador.",
    )
    crear_admin.add_argument(
        "--usuario",
        required=True,
        help="Nombre utilizado para iniciar sesión.",
    )

    return parser


def main(argumentos: list[str] | None = None) -> int:
    opciones = crear_parser().parse_args(argumentos)

    try:
        inicializar_base_datos()
        contrasena = solicitar_contrasena()
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Operación cancelada: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nOperación cancelada.", file=sys.stderr)
        return 130

    return ejecutar_creacion_administrador(
        nombre=opciones.nombre,
        nombre_usuario=opciones.usuario,
        contrasena=contrasena,
    )


if __name__ == "__main__":
    raise SystemExit(main())
