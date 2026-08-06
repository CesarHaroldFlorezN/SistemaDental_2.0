import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from backend.app.integridad import (
    ErrorIntegridadBaseDatos,
    comprobar_integridad_sqlite,
    exigir_integridad_sqlite,
)


def test_aceptar_base_sqlite_valida(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "valida.db"

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        conexion.execute("CREATE TABLE pacientes (id INTEGER PRIMARY KEY)")
        conexion.commit()

    resultado = comprobar_integridad_sqlite(ruta_bd)

    assert resultado.es_valida
    assert resultado.errores == ()


def test_detectar_archivo_sqlite_corrupto(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "corrupta.db"
    ruta_bd.write_text(
        "Este archivo no es una base SQLite.",
        encoding="utf-8",
    )

    resultado = comprobar_integridad_sqlite(ruta_bd)

    assert not resultado.es_valida
    assert resultado.errores

    with pytest.raises(ErrorIntegridadBaseDatos):
        exigir_integridad_sqlite(ruta_bd)


def test_detectar_clave_foranea_invalida(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "relaciones.db"

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        conexion.execute("CREATE TABLE pacientes (id INTEGER PRIMARY KEY)")
        conexion.execute(
            """
            CREATE TABLE citas (
                id INTEGER PRIMARY KEY,
                paciente_id INTEGER,
                FOREIGN KEY (paciente_id)
                    REFERENCES pacientes (id)
            )
            """
        )
        conexion.execute("INSERT INTO citas (paciente_id) VALUES (999)")
        conexion.commit()

    resultado = comprobar_integridad_sqlite(ruta_bd)

    assert not resultado.es_valida
    assert any("Clave foránea inválida" in error for error in resultado.errores)
