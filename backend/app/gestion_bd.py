from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

from .auditoria import auditar_datos_sqlite
from .config import DB_PATH, RESPALDOS_DIR
from .integridad import ErrorIntegridadBaseDatos
from .respaldos import (
    restaurar_base_sqlite,
    validar_base_sqlite,
)


def resolver_ruta_respaldo(
    valor: str,
    directorio: Path = RESPALDOS_DIR,
) -> Path:
    ruta = Path(valor).expanduser()

    if ruta.is_absolute() or ruta.is_file():
        return ruta.resolve()

    return (directorio / ruta).resolve()


def ejecutar_listado(
    directorio: Path = RESPALDOS_DIR,
) -> int:
    respaldos = sorted(
        directorio.glob("dentalpro-*.db"),
        reverse=True,
    )

    if not respaldos:
        print("No existen respaldos disponibles.")
        return 0

    for respaldo in respaldos:
        estado = "válido" if validar_base_sqlite(respaldo) else "INVÁLIDO"
        fecha = datetime.fromtimestamp(
            respaldo.stat().st_mtime,
            tz=UTC,
        ).astimezone()
        tamano_mb = respaldo.stat().st_size / 1_048_576

        print(
            f"{respaldo.name} | {estado} | "
            f"{tamano_mb:.2f} MB | "
            f"{fecha:%d/%m/%Y %H:%M:%S}"
        )

    return 0


def ejecutar_auditoria(
    ruta_bd: Path = DB_PATH,
) -> int:
    try:
        resultado = auditar_datos_sqlite(ruta_bd)
    except (
        ErrorIntegridadBaseDatos,
        OSError,
        sqlite3.Error,
    ) as error:
        print(
            f"Error durante la auditoría: {error}",
            file=sys.stderr,
        )
        return 2

    if resultado.saludable:
        print("Base saludable: no se encontraron inconsistencias.")
        return 0

    print(f"Auditoría completada con {resultado.total} inconsistencia(s).")

    for hallazgo in resultado.hallazgos:
        print(f"[{hallazgo.codigo}] {hallazgo.cantidad}: {hallazgo.descripcion}")

    return 1


def ejecutar_restauracion(
    archivo: str,
    confirmacion: str | None,
    servidor_detenido: bool,
    ruta_bd: Path = DB_PATH,
    directorio: Path = RESPALDOS_DIR,
) -> int:
    if confirmacion != "RESTAURAR":
        print(
            "Restauración cancelada: falta confirmar RESTAURAR.",
            file=sys.stderr,
        )
        return 2

    if not servidor_detenido:
        print(
            "Restauración cancelada: debes confirmar que el servidor está detenido.",
            file=sys.stderr,
        )
        return 2

    ruta_respaldo = resolver_ruta_respaldo(
        archivo,
        directorio,
    )

    try:
        respaldo_emergencia = restaurar_base_sqlite(
            ruta_respaldo=ruta_respaldo,
            ruta_bd=ruta_bd,
            directorio_respaldos=directorio,
        )
    except (
        OSError,
        RuntimeError,
        ValueError,
        sqlite3.Error,
    ) as error:
        print(f"Error de restauración: {error}", file=sys.stderr)
        return 1

    print("Restauración completada correctamente.")
    print(f"Base activa: {ruta_bd}")

    if respaldo_emergencia is not None:
        print(f"Respaldo previo conservado: {respaldo_emergencia}")

    return 0


def crear_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Administración segura de la base DentalPro."
    )
    comandos = parser.add_subparsers(
        dest="comando",
        required=True,
    )

    comandos.add_parser(
        "listar",
        help="Lista y valida los respaldos disponibles.",
    )

    comandos.add_parser(
        "auditar",
        help="Busca inconsistencias sin modificar datos.",
    )

    restaurar = comandos.add_parser(
        "restaurar",
        help="Restaura un respaldo con confirmación explícita.",
    )
    restaurar.add_argument("archivo")
    restaurar.add_argument("--confirmar")
    restaurar.add_argument(
        "--servidor-detenido",
        action="store_true",
    )

    return parser


def main(argumentos: list[str] | None = None) -> int:
    opciones = crear_parser().parse_args(argumentos)

    if opciones.comando == "listar":
        return ejecutar_listado()

    if opciones.comando == "auditar":
        return ejecutar_auditoria()

    return ejecutar_restauracion(
        archivo=opciones.archivo,
        confirmacion=opciones.confirmar,
        servidor_detenido=opciones.servidor_detenido,
    )


if __name__ == "__main__":
    raise SystemExit(main())
