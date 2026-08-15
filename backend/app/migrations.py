import json
from collections.abc import Callable
from datetime import datetime

from sqlalchemy.engine import Connection, Engine

from . import models
from .catalogo_inicial import (
    CODIGO_POR_ALIAS,
    SERVICIOS_INICIALES,
    normalizar_clave_servicio,
)
from .config import DB_PATH, RESPALDAR_AL_INICIAR, RESPALDOS_DIR
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


def migracion_005_odontograma_y_detalle_financiero(
    connection: Connection,
) -> None:
    """Conserva el detalle del cobro y versiones inalterables del odontograma."""

    if _existe_tabla(connection, "pagos"):
        columnas = _columnas_tabla(connection, "pagos")
        if "servicios" not in columnas:
            connection.exec_driver_sql("ALTER TABLE pagos ADD COLUMN servicios JSON")

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS odontogramas (
            id INTEGER PRIMARY KEY,
            pacienteId INTEGER NOT NULL,
            motivo VARCHAR(80) NOT NULL,
            denticion VARCHAR(20) NOT NULL DEFAULT 'permanente',
            hallazgos JSON NOT NULL,
            especificaciones TEXT,
            observaciones TEXT,
            norma VARCHAR(100) NOT NULL DEFAULT 'NTS 188-MINSA/DGIESP-2022',
            profesionalId INTEGER NOT NULL,
            profesionalNombre VARCHAR(120) NOT NULL,
            creadoEn VARCHAR(50) NOT NULL
        )
        """
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_odontogramas_paciente ON odontogramas (pacienteId)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_odontogramas_fecha ON odontogramas (creadoEn)"
    )


def migracion_006_trazabilidad_importaciones_oficiales(
    connection: Connection,
) -> None:
    """Registra el origen y los ajustes de cada reemplazo oficial."""

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS importacionesOficiales (
            id INTEGER PRIMARY KEY,
            versionFuente INTEGER NOT NULL,
            fechaFuente VARCHAR(50) NOT NULL,
            nombreArchivo VARCHAR(250) NOT NULL,
            sha256 VARCHAR(64) NOT NULL,
            conteos JSON NOT NULL,
            advertencias JSON NOT NULL,
            ajustes JSON NOT NULL,
            importadaEn VARCHAR(50) NOT NULL
        )
        """
    )
    connection.exec_driver_sql(
        """
        CREATE INDEX IF NOT EXISTS ix_importaciones_oficiales_sha256
        ON importacionesOficiales (sha256)
        """
    )


def migracion_007_contrasena_temporal_usuarios(
    connection: Connection,
) -> None:
    """Obliga a reemplazar las claves temporales creadas desde la interfaz."""

    if not _existe_tabla(connection, "usuarios"):
        return

    columnas = _columnas_tabla(connection, "usuarios")
    if "debe_cambiar_contrasena" not in columnas:
        connection.exec_driver_sql(
            "ALTER TABLE usuarios ADD COLUMN "
            "debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT 0"
        )


def _normalizar_detalle_servicios_historico(
    connection: Connection,
) -> None:
    filas_catalogo = connection.exec_driver_sql(
        "SELECT id, codigo, nombre FROM serviciosCatalogo"
    ).fetchall()
    catalogo_por_codigo = {
        fila[1]: {"id": fila[0], "nombre": fila[2]} for fila in filas_catalogo
    }
    catalogo_por_id = {fila[0]: fila[2] for fila in filas_catalogo}

    for tabla, campo_resumen in (("citas", "procedimiento"), ("pagos", "concepto")):
        if not _existe_tabla(connection, tabla):
            continue
        columnas = _columnas_tabla(connection, tabla)
        if "servicios" not in columnas:
            continue

        filas = connection.exec_driver_sql(
            f"SELECT id, servicios FROM {tabla} WHERE servicios IS NOT NULL"
        ).fetchall()
        for registro_id, valor_json in filas:
            try:
                servicios = (
                    json.loads(valor_json)
                    if isinstance(valor_json, str)
                    else valor_json
                )
            except (TypeError, json.JSONDecodeError):
                continue
            if not isinstance(servicios, list):
                continue

            cambio = False
            nombres: list[str] = []
            for servicio in servicios:
                if not isinstance(servicio, dict):
                    continue
                servicio_id = servicio.get("servicioId")
                nombre_catalogo = catalogo_por_id.get(servicio_id)
                if nombre_catalogo is None:
                    codigo = CODIGO_POR_ALIAS.get(
                        normalizar_clave_servicio(servicio.get("nombre", ""))
                    )
                    catalogo = catalogo_por_codigo.get(codigo)
                    if catalogo:
                        servicio_id = catalogo["id"]
                        nombre_catalogo = catalogo["nombre"]

                if nombre_catalogo:
                    if servicio.get("servicioId") != servicio_id:
                        servicio["servicioId"] = servicio_id
                        cambio = True
                    if servicio.get("nombre") != nombre_catalogo:
                        servicio["nombre"] = nombre_catalogo
                        cambio = True

                nombre = str(servicio.get("nombre") or "").strip()
                if nombre:
                    nombres.append(nombre)

            if not cambio:
                continue

            resumen = " + ".join(nombres)[:200]
            if campo_resumen in columnas and resumen:
                connection.exec_driver_sql(
                    f"UPDATE {tabla} SET servicios = ?, {campo_resumen} = ? WHERE id = ?",
                    (
                        json.dumps(
                            servicios, ensure_ascii=False, separators=(",", ":")
                        ),
                        resumen,
                        registro_id,
                    ),
                )
            else:
                connection.exec_driver_sql(
                    f"UPDATE {tabla} SET servicios = ? WHERE id = ?",
                    (
                        json.dumps(
                            servicios, ensure_ascii=False, separators=(",", ":")
                        ),
                        registro_id,
                    ),
                )


def migracion_008_catalogo_servicios(
    connection: Connection,
) -> None:
    """Crea un catálogo canónico y vincula variantes históricas conocidas."""

    connection.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS serviciosCatalogo (
            id INTEGER PRIMARY KEY,
            codigo VARCHAR(80) NOT NULL UNIQUE,
            nombre VARCHAR(150) NOT NULL,
            claveNormalizada VARCHAR(180) NOT NULL UNIQUE,
            categoria VARCHAR(100) NOT NULL,
            precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
            activo BOOLEAN NOT NULL DEFAULT 1,
            creadoEn VARCHAR(50) NOT NULL,
            actualizadoEn VARCHAR(50) NOT NULL
        )
        """
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_catalogo_categoria "
        "ON serviciosCatalogo (categoria)"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_catalogo_activo ON serviciosCatalogo (activo)"
    )

    ahora = datetime.now().astimezone().isoformat(timespec="seconds")
    for codigo, nombre, categoria in SERVICIOS_INICIALES:
        connection.exec_driver_sql(
            """
            INSERT OR IGNORE INTO serviciosCatalogo (
                codigo,
                nombre,
                claveNormalizada,
                categoria,
                precio,
                activo,
                creadoEn,
                actualizadoEn
            )
            VALUES (?, ?, ?, ?, 0, 1, ?, ?)
            """,
            (
                codigo,
                nombre,
                normalizar_clave_servicio(nombre),
                categoria,
                ahora,
                ahora,
            ),
        )

    _normalizar_detalle_servicios_historico(connection)


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
    (
        5,
        "odontograma_y_detalle_financiero",
        migracion_005_odontograma_y_detalle_financiero,
    ),
    (
        6,
        "trazabilidad_importaciones_oficiales",
        migracion_006_trazabilidad_importaciones_oficiales,
    ),
    (
        7,
        "contrasena_temporal_usuarios",
        migracion_007_contrasena_temporal_usuarios,
    ),
    (
        8,
        "catalogo_servicios_canonico",
        migracion_008_catalogo_servicios,
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


def inicializar_base_datos(
    motor: Engine = engine,
    *,
    ruta_bd=DB_PATH,
    directorio_respaldos=RESPALDOS_DIR,
) -> None:
    """Respalda y aplica únicamente migraciones pendientes."""

    # El import de models registra todas las tablas en Base.
    _ = models

    exigir_integridad_sqlite(ruta_bd)

    if RESPALDAR_AL_INICIAR and hay_migraciones_pendientes(motor):
        crear_respaldo_sqlite(
            ruta_bd=ruta_bd,
            directorio=directorio_respaldos,
        )

    Base.metadata.create_all(bind=motor)

    with motor.begin() as connection:
        aplicar_migraciones(connection)
    exigir_integridad_sqlite(ruta_bd)
