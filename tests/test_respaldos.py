import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from backend.app.respaldos import (
    crear_respaldo_sqlite,
    restaurar_base_sqlite,
    validar_base_sqlite,
)


def crear_base_prueba(ruta: Path) -> None:
    with closing(sqlite3.connect(str(ruta))) as conexion:
        conexion.execute(
            """
            CREATE TABLE pacientes (
                id INTEGER PRIMARY KEY,
                nombre TEXT NOT NULL
            )
            """
        )
        conexion.execute(
            "INSERT INTO pacientes (nombre) VALUES (?)",
            ("Paciente de respaldo",),
        )
        conexion.commit()


def test_crear_respaldo_conserva_datos(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    directorio = tmp_path / "respaldos"

    crear_base_prueba(ruta_bd)

    respaldo = crear_respaldo_sqlite(
        ruta_bd=ruta_bd,
        directorio=directorio,
        max_respaldos=3,
    )

    assert respaldo is not None
    assert respaldo.is_file()
    assert validar_base_sqlite(respaldo)

    with closing(sqlite3.connect(str(respaldo))) as conexion:
        paciente = conexion.execute("SELECT nombre FROM pacientes").fetchone()

    assert paciente == ("Paciente de respaldo",)


def test_no_crear_respaldo_si_no_existe_base(
    tmp_path: Path,
) -> None:
    resultado = crear_respaldo_sqlite(
        ruta_bd=tmp_path / "inexistente.db",
        directorio=tmp_path / "respaldos",
    )

    assert resultado is None


def test_limitar_cantidad_de_respaldos(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    directorio = tmp_path / "respaldos"

    crear_base_prueba(ruta_bd)

    for numero in range(3):
        with closing(sqlite3.connect(str(ruta_bd))) as conexion:
            conexion.execute(
                "UPDATE pacientes SET nombre = ?",
                (f"Paciente {numero}",),
            )
            conexion.commit()

        crear_respaldo_sqlite(
            ruta_bd=ruta_bd,
            directorio=directorio,
            max_respaldos=2,
        )

    respaldos = list(directorio.glob("dentalpro-*.db"))

    assert len(respaldos) == 2
    assert all(validar_base_sqlite(respaldo) for respaldo in respaldos)


def obtener_nombre_paciente(ruta: Path) -> str:
    with closing(sqlite3.connect(str(ruta))) as conexion:
        resultado = conexion.execute("SELECT nombre FROM pacientes").fetchone()

    assert resultado is not None
    return resultado[0]


def test_restaurar_respaldo_y_conservar_base_actual(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    directorio = tmp_path / "respaldos"

    crear_base_prueba(ruta_bd)

    respaldo = crear_respaldo_sqlite(
        ruta_bd=ruta_bd,
        directorio=directorio,
        max_respaldos=5,
    )

    assert respaldo is not None

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        conexion.execute(
            "UPDATE pacientes SET nombre = ?",
            ("Paciente modificado",),
        )
        conexion.commit()

    respaldo_emergencia = restaurar_base_sqlite(
        ruta_respaldo=respaldo,
        ruta_bd=ruta_bd,
        directorio_respaldos=directorio,
        max_respaldos=5,
    )

    assert obtener_nombre_paciente(ruta_bd) == ("Paciente de respaldo")

    assert respaldo_emergencia is not None
    assert validar_base_sqlite(respaldo_emergencia)
    assert obtener_nombre_paciente(respaldo_emergencia) == ("Paciente modificado")


def test_rechazar_respaldo_invalido_sin_alterar_base(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    respaldo_invalido = tmp_path / "archivo-invalido.db"

    crear_base_prueba(ruta_bd)
    respaldo_invalido.write_text(
        "Este archivo no es SQLite.",
        encoding="utf-8",
    )

    with pytest.raises(
        ValueError,
        match="no es un respaldo válido",
    ):
        restaurar_base_sqlite(
            ruta_respaldo=respaldo_invalido,
            ruta_bd=ruta_bd,
            directorio_respaldos=tmp_path / "respaldos",
        )

    assert obtener_nombre_paciente(ruta_bd) == ("Paciente de respaldo")
