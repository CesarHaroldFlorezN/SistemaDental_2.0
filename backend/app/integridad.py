from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from .config import DB_PATH


@dataclass(frozen=True, slots=True)
class ResultadoIntegridad:
    errores: tuple[str, ...]

    @property
    def es_valida(self) -> bool:
        return not self.errores


class ErrorIntegridadBaseDatos(RuntimeError):
    """Indica que SQLite contiene daños o relaciones inválidas."""


def comprobar_integridad_sqlite(
    ruta_bd: Path = DB_PATH,
) -> ResultadoIntegridad:
    """Comprueba estructura interna y claves foráneas."""

    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return ResultadoIntegridad(errores=())

    errores: list[str] = []

    try:
        with closing(
            sqlite3.connect(
                str(ruta_bd),
                timeout=5,
            )
        ) as conexion:
            comprobacion = conexion.execute("PRAGMA quick_check").fetchall()

            for resultado in comprobacion:
                if resultado[0] != "ok":
                    errores.append(f"Error interno de SQLite: {resultado[0]}")

            violaciones = conexion.execute("PRAGMA foreign_key_check").fetchall()

            for (
                tabla,
                fila,
                referencia,
                restriccion,
            ) in violaciones:
                errores.append(
                    "Clave foránea inválida: "
                    f"tabla={tabla}, "
                    f"fila={fila}, "
                    f"referencia={referencia}, "
                    f"restricción={restriccion}"
                )
    except sqlite3.DatabaseError as error:
        errores.append(f"SQLite no pudo leer la base: {error}")

    return ResultadoIntegridad(
        errores=tuple(errores),
    )


def exigir_integridad_sqlite(
    ruta_bd: Path = DB_PATH,
) -> None:
    """Detiene el proceso si la base no es válida."""

    resultado = comprobar_integridad_sqlite(ruta_bd)

    if not resultado.es_valida:
        detalle = " | ".join(resultado.errores)

        raise ErrorIntegridadBaseDatos(
            f"La base de datos no superó la validación: {detalle}"
        )
