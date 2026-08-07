from __future__ import annotations

import argparse
import getpass
import hmac
import sys
from collections.abc import Callable

from sqlalchemy.exc import SQLAlchemyError

from .database import SessionLocal
from .migrations import inicializar_base_datos
from .services.usuarios import cambiar_contrasena_usuario, crear_usuario

LectorContrasena = Callable[[str], str]

ROLES_CLI = (
    "administrador",
    "odontologo",
    "recepcion",
)

NOMBRES_ROL = {
    "administrador": "Administrador",
    "odontologo": "Odontólogo",
    "recepcion": "Recepción",
}


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


def _ejecutar_creacion_usuario(
    *,
    nombre: str,
    nombre_usuario: str,
    contrasena: str,
    rol: str,
    etiqueta: str,
    fabrica_sesiones=SessionLocal,
) -> int:
    try:
        with fabrica_sesiones.begin() as db:
            usuario = crear_usuario(
                db,
                nombre=nombre,
                nombre_usuario=nombre_usuario,
                contrasena=contrasena,
                rol=rol,
            )

            resumen = (
                usuario.nombre_usuario,
                usuario.nombre,
                usuario.rol,
            )
    except (ValueError, SQLAlchemyError) as error:
        print(
            f"No se pudo crear el {etiqueta.lower()}: {error}",
            file=sys.stderr,
        )
        return 1

    nombre_rol = NOMBRES_ROL.get(resumen[2], resumen[2])
    print(
        f"{etiqueta} creado correctamente: "
        f"{resumen[0]} ({resumen[1]}). Rol: {nombre_rol}."
    )
    return 0


def ejecutar_creacion_usuario(
    *,
    nombre: str,
    nombre_usuario: str,
    contrasena: str,
    rol: str,
    fabrica_sesiones=SessionLocal,
) -> int:
    return _ejecutar_creacion_usuario(
        nombre=nombre,
        nombre_usuario=nombre_usuario,
        contrasena=contrasena,
        rol=rol,
        etiqueta="Usuario",
        fabrica_sesiones=fabrica_sesiones,
    )


def ejecutar_creacion_administrador(
    *,
    nombre: str,
    nombre_usuario: str,
    contrasena: str,
    fabrica_sesiones=SessionLocal,
) -> int:
    return _ejecutar_creacion_usuario(
        nombre=nombre,
        nombre_usuario=nombre_usuario,
        contrasena=contrasena,
        rol="administrador",
        etiqueta="Administrador",
        fabrica_sesiones=fabrica_sesiones,
    )


def ejecutar_cambio_contrasena(
    *,
    nombre_usuario: str,
    nueva_contrasena: str,
    fabrica_sesiones=SessionLocal,
) -> int:
    try:
        with fabrica_sesiones.begin() as db:
            usuario = cambiar_contrasena_usuario(
                db,
                nombre_usuario=nombre_usuario,
                nueva_contrasena=nueva_contrasena,
            )
            usuario_actualizado = usuario.nombre_usuario
    except (ValueError, SQLAlchemyError) as error:
        print(
            f"No se pudo cambiar la contraseña: {error}",
            file=sys.stderr,
        )
        return 1

    print(
        "Contraseña actualizada correctamente para "
        f"'{usuario_actualizado}'. Las sesiones abiertas fueron cerradas."
    )
    return 0


def _agregar_argumentos_cuenta(
    comando: argparse.ArgumentParser,
    *,
    tipo_usuario: str,
) -> None:
    comando.add_argument(
        "--nombre",
        required=True,
        help=f"Nombre completo del {tipo_usuario}.",
    )
    comando.add_argument(
        "--usuario",
        required=True,
        help="Nombre utilizado para iniciar sesión.",
    )


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
    _agregar_argumentos_cuenta(
        crear_admin,
        tipo_usuario="administrador",
    )

    crear_cuenta = comandos.add_parser(
        "crear-usuario",
        help="Crea una cuenta seleccionando su rol.",
    )
    _agregar_argumentos_cuenta(
        crear_cuenta,
        tipo_usuario="usuario",
    )
    crear_cuenta.add_argument(
        "--rol",
        required=True,
        choices=ROLES_CLI,
        help="Permisos asignados a la cuenta.",
    )

    cambiar_clave = comandos.add_parser(
        "cambiar-clave",
        help="Cambia la contraseña y cierra las sesiones abiertas.",
    )
    cambiar_clave.add_argument(
        "--usuario",
        required=True,
        help="Nombre de la cuenta que será actualizada.",
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

    if opciones.comando == "crear-admin":
        return ejecutar_creacion_administrador(
            nombre=opciones.nombre,
            nombre_usuario=opciones.usuario,
            contrasena=contrasena,
        )

    if opciones.comando == "crear-usuario":
        return ejecutar_creacion_usuario(
            nombre=opciones.nombre,
            nombre_usuario=opciones.usuario,
            contrasena=contrasena,
            rol=opciones.rol,
        )

    return ejecutar_cambio_contrasena(
        nombre_usuario=opciones.usuario,
        nueva_contrasena=contrasena,
    )


if __name__ == "__main__":
    raise SystemExit(main())
