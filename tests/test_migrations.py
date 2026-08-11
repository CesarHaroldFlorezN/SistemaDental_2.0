from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from backend.app.migrations import (
    aplicar_migraciones,
    hay_migraciones_pendientes,
)


def crear_motor_temporal(
    tmp_path: Path,
) -> Engine:
    ruta_bd = tmp_path / "migraciones.db"

    return create_engine(f"sqlite:///{ruta_bd.as_posix()}")


def crear_esquema_antiguo(
    motor: Engine,
) -> None:
    with motor.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE pacientes (
                id INTEGER PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                cedula VARCHAR(50),
                codigo_ficha VARCHAR(50)
            )
            """
        )
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
    crear_esquema_antiguo(motor)

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
            ORDER BY version
            """
        ).fetchall()

    assert "servicios" in columnas
    assert "horaFin" in columnas
    assert "duracionMinutos" in columnas
    assert "casoClinicoId" in columnas
    assert "sesionPlanId" in columnas
    assert "tipoCita" in columnas
    assert versiones == [
        (1, "compatibilidad_columnas_citas"),
        (2, "identificadores_unicos_pacientes"),
        (3, "usuarios_y_sesiones"),
        (4, "flujo_clinico_financiero"),
    ]
    assert not hay_migraciones_pendientes(motor)

    motor.dispose()


def test_no_repetir_migracion_aplicada(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_antiguo(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

        cantidad = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM schema_migrations"
        ).scalar_one()

    assert cantidad == 4

    motor.dispose()


def test_identificadores_de_pacientes_son_unicos(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_antiguo(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)
        connection.exec_driver_sql(
            """
            INSERT INTO pacientes (
                id,
                nombre,
                cedula,
                codigo_ficha
            )
            VALUES (?, ?, ?, ?)
            """,
            (1, "Paciente original", "DNI-001", "FICHA-001"),
        )

    with pytest.raises(IntegrityError), motor.begin() as connection:
        connection.exec_driver_sql(
            """
                INSERT INTO pacientes (
                    id,
                    nombre,
                    cedula,
                    codigo_ficha
                )
                VALUES (?, ?, ?, ?)
                """,
            (2, "Cédula duplicada", " dni-001 ", "FICHA-002"),
        )

    with pytest.raises(IntegrityError), motor.begin() as connection:
        connection.exec_driver_sql(
            """
                INSERT INTO pacientes (
                    id,
                    nombre,
                    cedula,
                    codigo_ficha
                )
                VALUES (?, ?, ?, ?)
                """,
            (3, "Ficha duplicada", "DNI-003", " ficha-001 "),
        )

    with motor.begin() as connection:
        connection.exec_driver_sql(
            """
            INSERT INTO pacientes (
                id,
                nombre,
                cedula,
                codigo_ficha
            )
            VALUES (?, ?, ?, ?)
            """,
            (4, "Paciente sin identificadores 1", "", ""),
        )
        connection.exec_driver_sql(
            """
            INSERT INTO pacientes (
                id,
                nombre,
                cedula,
                codigo_ficha
            )
            VALUES (?, ?, ?, ?)
            """,
            (5, "Paciente sin identificadores 2", " ", " "),
        )

        cantidad = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM pacientes"
        ).scalar_one()

    assert cantidad == 3

    motor.dispose()


def test_crear_esquema_de_autenticacion(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_antiguo(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)

        tablas = {
            fila[0]
            for fila in connection.exec_driver_sql(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                """
            ).fetchall()
        }

        indices = {
            fila[0]
            for fila in connection.exec_driver_sql(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'index'
                """
            ).fetchall()
        }

        claves_foraneas = connection.exec_driver_sql(
            "PRAGMA foreign_key_list(sesiones)"
        ).fetchall()

    assert "usuarios" in tablas
    assert "sesiones" in tablas
    assert "ux_usuarios_nombre_usuario_normalizado" in indices
    assert "ux_sesiones_token_hash" in indices
    assert "ix_sesiones_usuario_id" in indices
    assert "ix_sesiones_expira_en" in indices
    assert any(
        fila[2] == "usuarios" and fila[6] == "CASCADE" for fila in claves_foraneas
    )

    with motor.begin() as connection:
        connection.exec_driver_sql(
            """
            INSERT INTO usuarios (
                id,
                nombre,
                nombre_usuario,
                contrasena_hash,
                rol,
                creado_en,
                actualizado_en
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "Administrador",
                "admin",
                "hash-seguro",
                "administrador",
                "2036-01-01T08:00:00-05:00",
                "2036-01-01T08:00:00-05:00",
            ),
        )

    with pytest.raises(IntegrityError), motor.begin() as connection:
        connection.exec_driver_sql(
            """
            INSERT INTO usuarios (
                nombre,
                nombre_usuario,
                contrasena_hash,
                rol,
                creado_en,
                actualizado_en
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "Usuario duplicado",
                " ADMIN ",
                "otro-hash",
                "recepcion",
                "2036-01-01T08:00:00-05:00",
                "2036-01-01T08:00:00-05:00",
            ),
        )

    with pytest.raises(IntegrityError), motor.begin() as connection:
        connection.exec_driver_sql(
            """
            INSERT INTO usuarios (
                nombre,
                nombre_usuario,
                contrasena_hash,
                rol,
                creado_en,
                actualizado_en
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "Rol inválido",
                "usuario-invalido",
                "otro-hash",
                "superusuario",
                "2036-01-01T08:00:00-05:00",
                "2036-01-01T08:00:00-05:00",
            ),
        )

    motor.dispose()


def test_crear_esquema_de_casos_y_sesiones(
    tmp_path: Path,
) -> None:
    motor = crear_motor_temporal(tmp_path)
    crear_esquema_antiguo(motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)
        tablas = {
            fila[0]
            for fila in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        indices = {
            fila[0]
            for fila in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type = 'index'"
            ).fetchall()
        }

    assert "casosClinicos" in tablas
    assert "sesionesPlan" in tablas
    assert "ix_casos_clinicos_paciente" in indices
    assert "ux_sesiones_plan_numero" in indices
    motor.dispose()
