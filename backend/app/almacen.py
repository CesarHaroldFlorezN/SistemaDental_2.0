"""Migración segura del almacén clínico hacia su ubicación oficial."""

from __future__ import annotations

import os
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path


def validar_base_sqlite(ruta: Path) -> bool:
    """Comprueba una base existente sin crearla ni modificarla."""

    if not ruta.is_file() or ruta.stat().st_size == 0:
        return False

    uri = f"{ruta.resolve().as_uri()}?mode=ro"
    try:
        with closing(sqlite3.connect(uri, uri=True)) as conexion:
            resultado = conexion.execute("PRAGMA quick_check").fetchone()
    except sqlite3.DatabaseError:
        return False

    return bool(resultado and resultado[0] == "ok")


def _copiar_base_consistente(origen: Path, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    uri = f"{origen.resolve().as_uri()}?mode=ro"

    with (
        closing(sqlite3.connect(uri, uri=True)) as conexion_origen,
        closing(sqlite3.connect(str(destino))) as conexion_destino,
    ):
        conexion_origen.backup(conexion_destino)

    if not validar_base_sqlite(destino):
        destino.unlink(missing_ok=True)
        raise RuntimeError("La copia de dentalpro.db no superó la validación.")


def migrar_datos_heredados(
    origen: Path,
    destino: Path,
) -> bool:
    """Importa la base y documentos antiguos sin reemplazar datos existentes."""

    origen = origen.resolve()
    destino = destino.resolve()
    base_origen = origen / "dentalpro.db"
    base_destino = destino / "dentalpro.db"

    if origen == destino or base_destino.exists():
        return False
    if not base_origen.exists():
        return False
    if not validar_base_sqlite(base_origen):
        raise RuntimeError(
            "La base data\\dentalpro.db incluida en el paquete no es válida."
        )

    destino.mkdir(parents=True, exist_ok=True)
    temporal = destino / ".instalacion-temporal"
    shutil.rmtree(temporal, ignore_errors=True)
    temporal.mkdir(parents=True)

    try:
        base_temporal = temporal / "dentalpro.db"
        _copiar_base_consistente(base_origen, base_temporal)

        documentos_origen = origen / "documentos"
        documentos_temporales = temporal / "documentos"
        if documentos_origen.is_dir():
            shutil.copytree(documentos_origen, documentos_temporales)

        marca = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
        respaldo_temporal = temporal / f"dentalpro-instalacion-{marca}.db"
        _copiar_base_consistente(base_temporal, respaldo_temporal)

        if documentos_temporales.is_dir():
            shutil.copytree(
                documentos_temporales,
                destino / "documentos",
                dirs_exist_ok=True,
            )

        respaldos = destino / "respaldos"
        respaldos.mkdir(parents=True, exist_ok=True)
        os.replace(
            respaldo_temporal,
            respaldos / respaldo_temporal.name,
        )
        os.replace(base_temporal, base_destino)
    finally:
        shutil.rmtree(temporal, ignore_errors=True)

    return True
