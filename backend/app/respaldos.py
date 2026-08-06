from __future__ import annotations

import os
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from .config import DB_PATH, MAX_RESPALDOS, RESPALDOS_DIR

PREFIJO_RESPALDO = "dentalpro-"
PREFIJO_PRE_RESTAURACION = "dentalpro-pre-restauracion-"


def validar_base_sqlite(ruta: Path) -> bool:
    """Comprueba que un archivo sea una base SQLite válida."""

    if not ruta.is_file():
        return False

    try:
        with closing(sqlite3.connect(str(ruta))) as conexion:
            resultado = conexion.execute("PRAGMA quick_check").fetchone()
    except sqlite3.DatabaseError:
        return False

    return bool(resultado and resultado[0] == "ok")


def limpiar_respaldos_antiguos(
    directorio: Path,
    max_respaldos: int,
) -> None:
    """Conserva únicamente los respaldos más recientes."""

    if max_respaldos < 1:
        raise ValueError("Debe conservarse al menos un respaldo.")

    respaldos = sorted(
        directorio.glob(f"{PREFIJO_RESPALDO}*.db"),
        reverse=True,
    )

    for respaldo in respaldos[max_respaldos:]:
        respaldo.unlink(missing_ok=True)


def crear_respaldo_sqlite(
    ruta_bd: Path = DB_PATH,
    directorio: Path = RESPALDOS_DIR,
    max_respaldos: int = MAX_RESPALDOS,
    prefijo: str = PREFIJO_RESPALDO,
) -> Path | None:
    """Crea y valida una copia consistente de la base SQLite."""

    if not prefijo or "/" in prefijo or "\\" in prefijo:
        raise ValueError("El prefijo del respaldo no es válido.")

    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return None

    directorio.mkdir(parents=True, exist_ok=True)

    marca_tiempo = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    destino = directorio / f"{prefijo}{marca_tiempo}.db"

    try:
        with (
            closing(sqlite3.connect(str(ruta_bd))) as origen,
            closing(sqlite3.connect(str(destino))) as copia,
        ):
            origen.backup(copia)

        if not validar_base_sqlite(destino):
            raise RuntimeError("El respaldo SQLite no superó la validación.")

        limpiar_respaldos_antiguos(directorio, max_respaldos)
    except (OSError, RuntimeError, sqlite3.Error):
        destino.unlink(missing_ok=True)
        raise

    return destino


def _eliminar_archivos_transitorios_sqlite(
    ruta_bd: Path,
) -> None:
    for sufijo in ("-shm", "-wal"):
        Path(f"{ruta_bd}{sufijo}").unlink(missing_ok=True)


def restaurar_base_sqlite(
    ruta_respaldo: Path,
    ruta_bd: Path = DB_PATH,
    directorio_respaldos: Path = RESPALDOS_DIR,
    max_respaldos: int = MAX_RESPALDOS,
) -> Path | None:
    """Restaura SQLite conservando previamente la base actual."""

    ruta_respaldo = ruta_respaldo.resolve()
    ruta_bd = ruta_bd.resolve()

    if ruta_respaldo == ruta_bd:
        raise ValueError("El respaldo y la base actual no pueden ser el mismo archivo.")

    if not validar_base_sqlite(ruta_respaldo):
        raise ValueError("El archivo seleccionado no es un respaldo válido.")

    ruta_bd.parent.mkdir(parents=True, exist_ok=True)

    respaldo_emergencia = crear_respaldo_sqlite(
        ruta_bd=ruta_bd,
        directorio=directorio_respaldos,
        max_respaldos=max_respaldos,
        prefijo=PREFIJO_PRE_RESTAURACION,
    )

    temporal = ruta_bd.with_name(f".{ruta_bd.name}.restauracion-temporal")
    temporal.unlink(missing_ok=True)

    reemplazo_realizado = False

    try:
        shutil.copy2(ruta_respaldo, temporal)

        if not validar_base_sqlite(temporal):
            raise RuntimeError("La copia temporal de restauración no es válida.")

        os.replace(temporal, ruta_bd)
        reemplazo_realizado = True

        _eliminar_archivos_transitorios_sqlite(ruta_bd)

        if not validar_base_sqlite(ruta_bd):
            raise RuntimeError("La base restaurada no superó la validación.")
    except (OSError, RuntimeError, sqlite3.Error):
        temporal.unlink(missing_ok=True)

        if reemplazo_realizado and respaldo_emergencia is not None:
            shutil.copy2(respaldo_emergencia, temporal)
            os.replace(temporal, ruta_bd)

        raise

    return respaldo_emergencia
