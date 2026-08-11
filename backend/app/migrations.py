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


def migracion_002_identificadores_unicos_pacientes(
    connection: Connection,
) -> None:
    """Impide identificadores duplicados sin bloquear valores vacíos."""

    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_pacientes_cedula_normalizada
        ON pacientes (LOWER(TRIM(cedula)))
        WHERE TRIM(COALESCE(cedula, '')) <> ''
        """
    )
    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_pacientes_codigo_ficha_normalizado
        ON pacientes (LOWER(TRIM(codigo_ficha)))
        WHERE TRIM(COALESCE(codigo_ficha, '')) <> ''
        """
    )


def migracion_003_usuarios_y_sesiones(
    connection: Connection,
) -> None:
    """Crea usuarios, roles y sesiones revocables."""

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY,
            nombre VARCHAR(120) NOT NULL,
            nombre_usuario VARCHAR(80) NOT NULL,
            contrasena_hash VARCHAR(255) NOT NULL,
            rol VARCHAR(30) NOT NULL,
            activo BOOLEAN NOT NULL DEFAULT 1,
            intentos_fallidos INTEGER NOT NULL DEFAULT 0,
            bloqueado_hasta VARCHAR(50),
            creado_en VARCHAR(50) NOT NULL,
            actualizado_en VARCHAR(50) NOT NULL,
            ultimo_acceso_en VARCHAR(50),
            CONSTRAINT ck_usuarios_nombre_usuario_no_vacio
                CHECK (TRIM(nombre_usuario) <> ''),
            CONSTRAINT ck_usuarios_rol_valido
                CHECK (
                    rol IN (
                        'administrador',
                        'odontologo',
                        'recepcion'
                    )
                )
        )
        """
    )

    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS
            ux_usuarios_nombre_usuario_normalizado
        ON usuarios (LOWER(TRIM(nombre_usuario)))
        """
    )

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS sesiones (
            id INTEGER PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            creada_en VARCHAR(50) NOT NULL,
            expira_en VARCHAR(50) NOT NULL,
            revocada_en VARCHAR(50),
            FOREIGN KEY (usuario_id)
                REFERENCES usuarios(id)
                ON DELETE CASCADE
        )
        """
    )

    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_sesiones_token_hash
        ON sesiones (token_hash)
        """
    )
    connection.exec_driver_sql(
        """
        CREATE INDEX IF NOT EXISTS ix_sesiones_usuario_id
        ON sesiones (usuario_id)
        """
    )
    connection.exec_driver_sql(
        """
        CREATE INDEX IF NOT EXISTS ix_sesiones_expira_en
        ON sesiones (expira_en)
        """
    )


def migracion_004_flujo_clinico_financiero(
    connection: Connection,
) -> None:
    """Añade casos clínicos, sesiones planificadas y vínculos financieros."""

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS casosClinicos (
            id INTEGER PRIMARY KEY,
            pacienteId INTEGER NOT NULL,
            planId INTEGER,
            titulo VARCHAR(180) NOT NULL,
            tipo VARCHAR(50) NOT NULL DEFAULT 'procedimiento',
            motivoConsulta TEXT,
            piezaDental VARCHAR(30),
            diagnostico TEXT,
            estado VARCHAR(50) NOT NULL DEFAULT 'abierto',
            creadoEn VARCHAR(50) NOT NULL,
            actualizadoEn VARCHAR(50)
        )
        """
    )
    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS sesionesPlan (
            id INTEGER PRIMARY KEY,
            planId INTEGER NOT NULL,
            numero INTEGER NOT NULL,
            titulo VARCHAR(180) NOT NULL,
            estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
            citaId INTEGER,
            fechaProgramada VARCHAR(50),
            cuotaNum INTEGER,
            notas TEXT,
            creadoEn VARCHAR(50) NOT NULL,
            actualizadoEn VARCHAR(50)
        )
        """
    )

    cambios_por_tabla = {
        "citas": (
            ("casoClinicoId", "ALTER TABLE citas ADD COLUMN casoClinicoId INTEGER"),
            ("sesionPlanId", "ALTER TABLE citas ADD COLUMN sesionPlanId INTEGER"),
            (
                "tipoCita",
                "ALTER TABLE citas ADD COLUMN tipoCita VARCHAR(50) DEFAULT 'procedimiento'",
            ),
            ("motivoConsulta", "ALTER TABLE citas ADD COLUMN motivoConsulta TEXT"),
            ("piezaDental", "ALTER TABLE citas ADD COLUMN piezaDental VARCHAR(30)"),
        ),
        "planes": (
            (
                "casoClinicoId",
                "ALTER TABLE planes ADD COLUMN casoClinicoId INTEGER",
            ),
            ("pagoId", "ALTER TABLE planes ADD COLUMN pagoId INTEGER"),
        ),
        "pagos": (
            (
                "casoClinicoId",
                "ALTER TABLE pagos ADD COLUMN casoClinicoId INTEGER",
            ),
            ("planId", "ALTER TABLE pagos ADD COLUMN planId INTEGER"),
        ),
        "planPagos": (
            (
                "casoClinicoId",
                "ALTER TABLE planPagos ADD COLUMN casoClinicoId INTEGER",
            ),
            ("planId", "ALTER TABLE planPagos ADD COLUMN planId INTEGER"),
            (
                "origen",
                "ALTER TABLE planPagos ADD COLUMN origen VARCHAR(50) DEFAULT 'procedimiento'",
            ),
        ),
        "movimientosCuenta": (
            (
                "casoClinicoId",
                "ALTER TABLE movimientosCuenta ADD COLUMN casoClinicoId INTEGER",
            ),
            (
                "planId",
                "ALTER TABLE movimientosCuenta ADD COLUMN planId INTEGER",
            ),
        ),
    }

    for tabla, cambios in cambios_por_tabla.items():
        if not _existe_tabla(connection, tabla):
            continue
        columnas = _columnas_tabla(connection, tabla)
        for columna, sentencia in cambios:
            if columna not in columnas:
                connection.exec_driver_sql(sentencia)

    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_casos_clinicos_paciente ON casosClinicos (pacienteId)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_casos_clinicos_estado ON casosClinicos (estado)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_sesiones_plan_plan ON sesionesPlan (planId)"
    )
    connection.exec_driver_sql(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_sesiones_plan_numero ON sesionesPlan (planId, numero)"
    )


MIGRACIONES: tuple[NombreMigracion, ...] = (
    (
        1,
        "compatibilidad_columnas_citas",
        migracion_001_compatibilidad_citas,
    ),
    (
        2,
        "identificadores_unicos_pacientes",
        migracion_002_identificadores_unicos_pacientes,
    ),
    (
        3,
        "usuarios_y_sesiones",
        migracion_003_usuarios_y_sesiones,
    ),
    (
        4,
        "flujo_clinico_financiero",
        migracion_004_flujo_clinico_financiero,
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
