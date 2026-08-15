from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

from .auditoria import auditar_datos_sqlite
from .config import DB_PATH, RESPALDOS_DIR
from .importacion_oficial import (
    ErrorImportacionOficial,
    importar_json_oficial,
    preparar_json_oficial,
)
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


def _mostrar_resumen_json(datos) -> None:
    print(f"JSON oficial: {datos.nombre_archivo}")
    print(f"Versión: {datos.version}")
    print(f"Fecha de origen: {datos.fecha_fuente}")
    print(f"SHA-256: {datos.sha256}")
    print(
        "Registros: "
        + ", ".join(
            f"{coleccion}={cantidad}" for coleccion, cantidad in datos.conteos.items()
        )
    )

    if datos.ajustes:
        print("Ajustes técnicos previstos:")
        for ajuste in datos.ajustes:
            print(f"- {ajuste}")

    if datos.advertencias:
        print("ADVERTENCIAS DE DATOS:")
        for advertencia in datos.advertencias:
            print(f"- {advertencia}")


def ejecutar_validacion_json_oficial(
    archivo: str,
    resolver_duplicados_ficha: bool,
) -> int:
    try:
        datos = preparar_json_oficial(
            Path(archivo).expanduser(),
            resolver_duplicados_ficha=resolver_duplicados_ficha,
        )
    except (ErrorImportacionOficial, OSError) as error:
        print(f"JSON oficial inválido: {error}", file=sys.stderr)
        return 1

    _mostrar_resumen_json(datos)
    print("Validación estructural completada sin modificar la base activa.")
    return 0


def ejecutar_importacion_json_oficial(
    archivo: str,
    confirmacion: str | None,
    servidor_detenido: bool,
    resolver_duplicados_ficha: bool,
    aceptar_advertencias: bool,
    ruta_bd: Path = DB_PATH,
    directorio: Path = RESPALDOS_DIR,
) -> int:
    if confirmacion != "REEMPLAZAR":
        print(
            "Importación cancelada: falta confirmar REEMPLAZAR.",
            file=sys.stderr,
        )
        return 2

    if not servidor_detenido:
        print(
            "Importación cancelada: debes confirmar que el servidor está detenido.",
            file=sys.stderr,
        )
        return 2

    try:
        resultado = importar_json_oficial(
            Path(archivo).expanduser(),
            ruta_bd=ruta_bd,
            directorio_respaldos=directorio,
            resolver_duplicados_ficha=resolver_duplicados_ficha,
            aceptar_advertencias=aceptar_advertencias,
        )
    except (
        ErrorImportacionOficial,
        OSError,
        RuntimeError,
        sqlite3.Error,
    ) as error:
        print(f"Importación cancelada: {error}", file=sys.stderr)
        return 1

    _mostrar_resumen_json(resultado.datos)
    print("Reemplazo oficial completado correctamente.")
    print(f"Base activa: {ruta_bd}")
    print(f"Usuarios conservados: {resultado.usuarios_conservados}")
    print(
        "Servicios del catálogo conservados: "
        f"{resultado.servicios_catalogo_conservados}"
    )
    print("Las sesiones anteriores fueron revocadas; inicia sesión nuevamente.")

    if resultado.respaldo_previo is not None:
        print(f"Respaldo previo conservado: {resultado.respaldo_previo}")

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

    validar_json = comandos.add_parser(
        "validar-json-oficial",
        help="Valida una exportación JSON oficial sin modificar la base.",
    )
    validar_json.add_argument("archivo")
    validar_json.add_argument(
        "--resolver-duplicados-ficha",
        action="store_true",
        help="Diferencia fichas repetidas con un sufijo auditable.",
    )

    importar_json = comandos.add_parser(
        "importar-json-oficial",
        help="Reemplaza los datos clínicos y financieros desde un JSON oficial.",
    )
    importar_json.add_argument("archivo")
    importar_json.add_argument("--confirmar")
    importar_json.add_argument(
        "--servidor-detenido",
        action="store_true",
    )
    importar_json.add_argument(
        "--resolver-duplicados-ficha",
        action="store_true",
        help="Diferencia fichas repetidas con un sufijo auditable.",
    )
    importar_json.add_argument(
        "--aceptar-advertencias",
        action="store_true",
        help="Acepta fechas o estados financieros heredados que requieren revisión.",
    )

    return parser


def main(argumentos: list[str] | None = None) -> int:
    opciones = crear_parser().parse_args(argumentos)

    if opciones.comando == "listar":
        return ejecutar_listado()

    if opciones.comando == "auditar":
        return ejecutar_auditoria()

    if opciones.comando == "validar-json-oficial":
        return ejecutar_validacion_json_oficial(
            archivo=opciones.archivo,
            resolver_duplicados_ficha=opciones.resolver_duplicados_ficha,
        )

    if opciones.comando == "importar-json-oficial":
        return ejecutar_importacion_json_oficial(
            archivo=opciones.archivo,
            confirmacion=opciones.confirmar,
            servidor_detenido=opciones.servidor_detenido,
            resolver_duplicados_ficha=opciones.resolver_duplicados_ficha,
            aceptar_advertencias=opciones.aceptar_advertencias,
        )

    return ejecutar_restauracion(
        archivo=opciones.archivo,
        confirmacion=opciones.confirmar,
        servidor_detenido=opciones.servidor_detenido,
    )


if __name__ == "__main__":
    raise SystemExit(main())
