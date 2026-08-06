from . import models
from .config import RESPALDAR_AL_INICIAR
from .database import Base, engine
from .respaldos import crear_respaldo_sqlite


def asegurar_compatibilidad_esquema() -> None:
    """Agrega columnas faltantes sin borrar datos existentes."""

    with engine.begin() as connection:
        columnas_citas = {
            fila[1]
            for fila in connection.exec_driver_sql(
                "PRAGMA table_info(citas)"
            ).fetchall()
        }

        if "servicios" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN servicios JSON")

        if "horaFin" not in columnas_citas:
            connection.exec_driver_sql(
                "ALTER TABLE citas ADD COLUMN horaFin VARCHAR(50)"
            )

        if "duracionMinutos" not in columnas_citas:
            connection.exec_driver_sql(
                "ALTER TABLE citas ADD COLUMN duracionMinutos INTEGER"
            )


def inicializar_base_datos() -> None:
    """Respalda, crea y actualiza el esquema SQLite."""

    # El import de models registra todas las tablas en Base.
    _ = models

    if RESPALDAR_AL_INICIAR:
        crear_respaldo_sqlite()

    Base.metadata.create_all(bind=engine)
    asegurar_compatibilidad_esquema()
