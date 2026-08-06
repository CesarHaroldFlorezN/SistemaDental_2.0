from collections.abc import Callable
from datetime import datetime

from sqlalchemy.engine import Connection, Engine

from . import models
from .config import RESPALDAR_AL_INICIAR
from .database import Base, engine
from .integridad import exigir_integridad_sqlite
from .respaldos import crear_respaldo_sqlite

NombreMigracion = tuple[
    int,
    str,
    Callable[[Connection], None],
]


def _existe_tabla(
    connection: Connection,
    nombre: str,
) -> bool:
    resultado = connection.exec_driver_sql(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (nombre,),
    ).fetchone()

    return resultado is not None


def _columnas_tabla(
    connection: Connection,
    tabla: str,
) -> set[str]:
    return {
        fila[1]
        for fila in connection.exec_driver_sql(f"PRAGMA table_info({tabla})").fetchall()
    }


def migracion_001_compatibilidad_citas(
    connection: Connection,
) -> None:
    """Incorpora columnas históricas faltantes en citas."""

    columnas = _columnas_tabla(connection, "citas")

    cambios = (
        (
            "servicios",
            "ALTER TABLE citas ADD COLUMN servicios JSON",
        ),
        (
            "horaFin",
            "ALTER TABLE citas ADD COLUMN horaFin VARCHAR(50)",
        ),
        (
            "duracionMinutos",
            "ALTER TABLE citas ADD COLUMN duracionMinutos INTEGER",
        ),
    )

    for columna, sentencia in cambios:
        if columna not in columnas:
            connection.exec_driver_sql(sentencia)


MIGRACIONES: tuple[NombreMigracion, ...] = (
    (
        1,
        "compatibilidad_columnas_citas",
        migracion_001_compatibilidad_citas,
    ),
)


def _validar_registro_migraciones() -> None:
    versiones = [version for version, _, _ in MIGRACIONES]

    if versiones != sorted(set(versiones)):
        raise RuntimeError("Las versiones de migración deben ser únicas y ordenadas.")


def _crear_tabla_migraciones(
    connection: Connection,
) -> None:
    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            aplicada_en VARCHAR(50) NOT NULL
        )
        """
    )


def obtener_versiones_aplicadas(
    connection: Connection,
) -> set[int]:
    if not _existe_tabla(connection, "schema_migrations"):
        return set()

    return {
        fila[0]
        for fila in connection.exec_driver_sql(
            "SELECT version FROM schema_migrations"
        ).fetchall()
    }


def hay_migraciones_pendientes(
    motor: Engine = engine,
) -> bool:
    _validar_registro_migraciones()

    with motor.connect() as connection:
        aplicadas = obtener_versiones_aplicadas(connection)

    return any(version not in aplicadas for version, _, _ in MIGRACIONES)


def aplicar_migraciones(
    connection: Connection,
) -> None:
    _validar_registro_migraciones()
    _crear_tabla_migraciones(connection)

    aplicadas = obtener_versiones_aplicadas(connection)

    for version, nombre, migracion in MIGRACIONES:
        if version in aplicadas:
            continue

        migracion(connection)

        connection.exec_driver_sql(
            """
            INSERT INTO schema_migrations (
                version,
                nombre,
                aplicada_en
            )
            VALUES (?, ?, ?)
            """,
            (
                version,
                nombre,
                datetime.now().astimezone().isoformat(timespec="seconds"),
            ),
        )


def inicializar_base_datos() -> None:
    """Respalda y aplica únicamente migraciones pendientes."""

    # El import de models registra todas las tablas en Base.
    _ = models

    exigir_integridad_sqlite()

    if RESPALDAR_AL_INICIAR and hay_migraciones_pendientes():
        crear_respaldo_sqlite()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        aplicar_migraciones(connection)
    exigir_integridad_sqlite()
