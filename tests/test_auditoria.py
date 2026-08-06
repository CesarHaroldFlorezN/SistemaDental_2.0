import sqlite3
from contextlib import closing
from pathlib import Path

from sqlalchemy import create_engine

from backend.app import models
from backend.app.auditoria import auditar_datos_sqlite
from backend.app.database import Base


def crear_base_completa(
    tmp_path: Path,
) -> Path:
    ruta_bd = tmp_path / "auditoria.db"
    motor = create_engine(f"sqlite:///{ruta_bd.as_posix()}")

    _ = models
    Base.metadata.create_all(bind=motor)
    motor.dispose()

    return ruta_bd


def test_auditoria_sin_hallazgos(
    tmp_path: Path,
) -> None:
    ruta_bd = crear_base_completa(tmp_path)

    resultado = auditar_datos_sqlite(ruta_bd)

    assert resultado.saludable
    assert resultado.total == 0
    assert resultado.hallazgos == ()


def test_detectar_inconsistencias_sin_modificar_datos(
    tmp_path: Path,
) -> None:
    ruta_bd = crear_base_completa(tmp_path)

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        conexion.execute(
            """
            INSERT INTO pacientes (
                id,
                nombre,
                cedula,
                codigo_ficha
            )
            VALUES (1, 'Paciente 1', 'DUP-1', 'F-DUP-1')
            """
        )
        conexion.execute(
            """
            INSERT INTO pacientes (
                id,
                nombre,
                cedula,
                codigo_ficha
            )
            VALUES (2, 'Paciente 2', 'DUP-1', 'F-DUP-1')
            """
        )
        conexion.execute(
            """
            INSERT INTO citas (
                id,
                pacienteId,
                costo
            )
            VALUES (1, 999, -10)
            """
        )
        conexion.execute(
            """
            INSERT INTO pagos (
                id,
                pacienteId,
                citaId,
                total,
                cobrado,
                saldo
            )
            VALUES (1, 999, 999, 100, 80, 50)
            """
        )
        conexion.commit()

    resultado = auditar_datos_sqlite(ruta_bd)
    codigos = {hallazgo.codigo for hallazgo in resultado.hallazgos}

    assert not resultado.saludable
    assert "pacientes_cedula_duplicada" in codigos
    assert "pacientes_codigo_ficha_duplicado" in codigos
    assert "citas_pacienteId_sin_pacientes" in codigos
    assert "pagos_saldo_inconsistente" in codigos
    assert "citas_costo_negativo" in codigos

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        cantidad_pacientes = conexion.execute(
            "SELECT COUNT(*) FROM pacientes"
        ).fetchone()[0]

    assert cantidad_pacientes == 2
