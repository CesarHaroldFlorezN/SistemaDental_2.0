from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from .config import DB_PATH
from .integridad import exigir_integridad_sqlite


@dataclass(frozen=True, slots=True)
class HallazgoAuditoria:
    codigo: str
    descripcion: str
    cantidad: int


@dataclass(frozen=True, slots=True)
class ResultadoAuditoria:
    hallazgos: tuple[HallazgoAuditoria, ...]

    @property
    def saludable(self) -> bool:
        return not self.hallazgos

    @property
    def total(self) -> int:
        return sum(hallazgo.cantidad for hallazgo in self.hallazgos)


Relacion = tuple[str, str, str, str]


RELACIONES: tuple[Relacion, ...] = (
    ("citas", "pacienteId", "pacientes", "id"),
    ("citas", "planId", "planes", "id"),
    ("citas", "citaBaseId", "citas", "id"),
    ("pagos", "pacienteId", "pacientes", "id"),
    ("pagos", "citaId", "citas", "id"),
    ("planes", "pacienteId", "pacientes", "id"),
    ("planPagos", "pacienteId", "pacientes", "id"),
    ("planPagos", "pagoId", "pagos", "id"),
    ("planPagos", "citaId", "citas", "id"),
    (
        "movimientosCuenta",
        "pacienteId",
        "pacientes",
        "id",
    ),
    ("movimientosCuenta", "pagoId", "pagos", "id"),
    ("movimientosCuenta", "citaId", "citas", "id"),
    (
        "documentosPaciente",
        "pacienteId",
        "pacientes",
        "id",
    ),
)


TABLAS_ESPERADAS = {
    "pacientes",
    "citas",
    "pagos",
    "planes",
    "planPagos",
    "movimientosCuenta",
    "documentosPaciente",
}


def _obtener_tablas(
    conexion: sqlite3.Connection,
) -> set[str]:
    return {
        fila[0]
        for fila in conexion.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            """
        ).fetchall()
    }


def _agregar_hallazgo(
    hallazgos: list[HallazgoAuditoria],
    codigo: str,
    descripcion: str,
    cantidad: int,
) -> None:
    if cantidad > 0:
        hallazgos.append(
            HallazgoAuditoria(
                codigo=codigo,
                descripcion=descripcion,
                cantidad=cantidad,
            )
        )


def _auditar_duplicados(
    conexion: sqlite3.Connection,
    hallazgos: list[HallazgoAuditoria],
) -> None:
    campos = (
        (
            "cedula",
            "pacientes_cedula_duplicada",
            "Pacientes adicionales con cédula duplicada",
        ),
        (
            "codigo_ficha",
            "pacientes_codigo_ficha_duplicado",
            "Pacientes adicionales con código de ficha duplicado",
        ),
    )

    for campo, codigo, descripcion in campos:
        cantidad = conexion.execute(
            f"""
            SELECT COALESCE(SUM(cantidad - 1), 0)
            FROM (
                SELECT COUNT(*) AS cantidad
                FROM pacientes
                WHERE TRIM(COALESCE("{campo}", '')) <> ''
                GROUP BY LOWER(TRIM("{campo}"))
                HAVING COUNT(*) > 1
            )
            """
        ).fetchone()[0]

        _agregar_hallazgo(
            hallazgos,
            codigo,
            descripcion,
            int(cantidad),
        )


def _auditar_relaciones(
    conexion: sqlite3.Connection,
    tablas: set[str],
    hallazgos: list[HallazgoAuditoria],
) -> None:
    for (
        tabla_origen,
        columna_origen,
        tabla_destino,
        columna_destino,
    ) in RELACIONES:
        if tabla_origen not in tablas or tabla_destino not in tablas:
            continue

        cantidad = conexion.execute(
            f"""
            SELECT COUNT(*)
            FROM "{tabla_origen}" AS origen
            LEFT JOIN "{tabla_destino}" AS destino
                ON destino."{columna_destino}"
                    = origen."{columna_origen}"
            WHERE origen."{columna_origen}" IS NOT NULL
              AND destino."{columna_destino}" IS NULL
            """
        ).fetchone()[0]

        _agregar_hallazgo(
            hallazgos,
            (f"{tabla_origen}_{columna_origen}_sin_{tabla_destino}"),
            (f"Registros de {tabla_origen} sin relación válida en {tabla_destino}"),
            int(cantidad),
        )


def _auditar_finanzas(
    conexion: sqlite3.Connection,
    hallazgos: list[HallazgoAuditoria],
) -> None:
    reglas = (
        (
            "pagos_valores_negativos",
            "Pagos con valores monetarios negativos",
            """
            SELECT COUNT(*)
            FROM pagos
            WHERE COALESCE(total, 0) < 0
               OR COALESCE(cobrado, 0) < 0
               OR COALESCE(saldo, 0) < 0
               OR COALESCE(devuelto, 0) < 0
               OR COALESCE(creditoFavor, 0) < 0
            """,
        ),
        (
            "pagos_saldo_inconsistente",
            "Pagos donde total - cobrado no coincide con saldo",
            """
            SELECT COUNT(*)
            FROM pagos
            WHERE ABS(
                COALESCE(total, 0)
                - COALESCE(cobrado, 0)
                - COALESCE(saldo, 0)
            ) > 0.01
            """,
        ),
        (
            "planes_pago_saldo_inconsistente",
            "Planes de pago con saldo inconsistente",
            """
            SELECT COUNT(*)
            FROM planPagos
            WHERE ABS(
                COALESCE(totalAcordado, 0)
                - COALESCE(cobrado, 0)
                - COALESCE(saldo, 0)
            ) > 0.01
            """,
        ),
        (
            "movimientos_valores_negativos",
            "Movimientos con cargos o abonos negativos",
            """
            SELECT COUNT(*)
            FROM movimientosCuenta
            WHERE COALESCE(cargo, 0) < 0
               OR COALESCE(abono, 0) < 0
            """,
        ),
        (
            "citas_costo_negativo",
            "Citas con costo negativo",
            """
            SELECT COUNT(*)
            FROM citas
            WHERE COALESCE(costo, 0) < 0
            """,
        ),
    )

    for codigo, descripcion, consulta in reglas:
        cantidad = conexion.execute(consulta).fetchone()[0]

        _agregar_hallazgo(
            hallazgos,
            codigo,
            descripcion,
            int(cantidad),
        )


def auditar_datos_sqlite(
    ruta_bd: Path = DB_PATH,
) -> ResultadoAuditoria:
    """Busca inconsistencias sin modificar la base."""

    exigir_integridad_sqlite(ruta_bd)

    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return ResultadoAuditoria(
            hallazgos=(
                HallazgoAuditoria(
                    codigo="base_ausente",
                    descripcion="La base de datos no existe",
                    cantidad=1,
                ),
            )
        )

    hallazgos: list[HallazgoAuditoria] = []

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        tablas = _obtener_tablas(conexion)

        for tabla in sorted(TABLAS_ESPERADAS - tablas):
            _agregar_hallazgo(
                hallazgos,
                f"tabla_ausente_{tabla}",
                f"No existe la tabla {tabla}",
                1,
            )

        if "pacientes" in tablas:
            _auditar_duplicados(
                conexion,
                hallazgos,
            )

        _auditar_relaciones(
            conexion,
            tablas,
            hallazgos,
        )

        if {
            "pagos",
            "planPagos",
            "movimientosCuenta",
            "citas",
        }.issubset(tablas):
            _auditar_finanzas(
                conexion,
                hallazgos,
            )

    return ResultadoAuditoria(
        hallazgos=tuple(hallazgos),
    )
