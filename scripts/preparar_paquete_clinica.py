"""Prepara una copia privada y consistente de los datos de la clínica.

Este archivo no empaqueta bases auxiliares, respaldos ni registros. El destino
debe permanecer fuera de Git y no debe publicarse como artefacto público.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path


def sha256_archivo(ruta: Path) -> str:
    resumen = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            resumen.update(bloque)
    return resumen.hexdigest()


def validar_base(ruta: Path) -> bool:
    if not ruta.is_file() or ruta.stat().st_size == 0:
        return False

    uri = f"{ruta.resolve().as_uri()}?mode=ro"
    try:
        with closing(sqlite3.connect(uri, uri=True)) as conexion:
            resultado = conexion.execute("PRAGMA quick_check").fetchone()
    except sqlite3.DatabaseError:
        return False

    return bool(resultado and resultado[0] == "ok")


def copiar_base(origen: Path, destino: Path) -> None:
    uri = f"{origen.resolve().as_uri()}?mode=ro"
    destino.parent.mkdir(parents=True, exist_ok=True)

    with (
        closing(sqlite3.connect(uri, uri=True)) as conexion_origen,
        closing(sqlite3.connect(str(destino))) as conexion_destino,
    ):
        conexion_origen.backup(conexion_destino)

    if not validar_base(destino):
        destino.unlink(missing_ok=True)
        raise RuntimeError("La copia privada de dentalpro.db no es válida.")


def preparar(origen: Path, destino: Path) -> Path:
    origen = origen.resolve()
    destino = destino.resolve()
    base_origen = origen / "dentalpro.db"

    if not validar_base(base_origen):
        raise ValueError(
            f"No se encontró una base SQLite válida en {base_origen}."
        )

    if destino == origen or origen in destino.parents:
        raise ValueError("El paquete privado debe generarse fuera de data/.")

    shutil.rmtree(destino, ignore_errors=True)
    destino.mkdir(parents=True)

    base_destino = destino / "dentalpro.db"
    copiar_base(base_origen, base_destino)

    documentos_origen = origen / "documentos"
    if documentos_origen.is_dir():
        shutil.copytree(documentos_origen, destino / "documentos")

    manifiesto = {
        "archivo": "dentalpro.db",
        "sha256": sha256_archivo(base_destino),
        "tamano_bytes": base_destino.stat().st_size,
        "preparado_en": datetime.now().astimezone().isoformat(timespec="seconds"),
        "incluye_documentos": documentos_origen.is_dir(),
        "excluidos": [
            "dentalpro_original.db",
            "dentalpro_pruebas.db",
            "dentalpro_vacia.db",
            "respaldos",
            "logs",
        ],
    }
    ruta_manifiesto = destino / "MANIFIESTO_DATOS.json"
    ruta_manifiesto.write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return ruta_manifiesto


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origen", type=Path, required=True)
    parser.add_argument("--destino", type=Path, required=True)
    args = parser.parse_args()

    manifiesto = preparar(args.origen, args.destino)
    print(f"Paquete privado preparado: {manifiesto.parent}")
    print(f"Manifiesto: {manifiesto}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
