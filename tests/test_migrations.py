from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from backend.app.migrations import (
    aplicar_migraciones,
    hay_migraciones_pendientes,
)


def crear_motor_temporal(
    tmp_path: Path,
) -> Engine:
    ruta_bd = tmp_path / "migraciones.db"

    return create_engine(f"sqlite:///{ruta_bd.as_posix()}")


def crear_tabla_citas_antigua(
    motor: Engine,
) -> None:
    with motor.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE citas (
                id INTEGER PRIMARY KEY,
                fecha VARCHAR(50)
            )
            """
        )


def test_aplicar_migracion_y_registrar_version(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_tabla_citas_antigua(motor)

    assert hay_migraciones_pendientes(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

        columnas = {
            fila[1]
            for fila in connection.exec_driver_sql(
                "PRAGMA table_info(citas)"
            ).fetchall()
        }

        versiones = connection.exec_driver_sql(
            """
            SELECT version, nombre
            FROM schema_migrations
            """
        ).fetchall()

    assert "servicios" in columnas
    assert "horaFin" in columnas
    assert "duracionMinutos" in columnas
    assert versiones == [(1, "compatibilidad_columnas_citas")]
    assert not hay_migraciones_pendientes(motor)

    motor.dispose()


def test_no_repetir_migracion_aplicada(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_tabla_citas_antigua(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

        cantidad = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM schema_migrations"
        ).scalar_one()

    assert cantidad == 1

    motor.dispose()
