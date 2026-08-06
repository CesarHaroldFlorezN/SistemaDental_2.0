from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from .config import DB_PATH, MAX_RESPALDOS, RESPALDOS_DIR

PREFIJO_RESPALDO = "dentalpro-"


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
) -> Path | None:
    """Crea y valida una copia consistente de la base SQLite."""

    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return None

    directorio.mkdir(parents=True, exist_ok=True)

    marca_tiempo = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    destino = directorio / f"{PREFIJO_RESPALDO}{marca_tiempo}.db"

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
