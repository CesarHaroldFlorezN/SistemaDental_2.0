from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import Counter
from contextlib import closing
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from . import models
from .auditoria import auditar_datos_sqlite
from .database import Base
from .migrations import aplicar_migraciones
from .models import (
    CitaDB,
    ImportacionOficialDB,
    PacienteDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
    ServicioCatalogoDB,
    UsuarioDB,
)
from .respaldos import restaurar_base_sqlite
from .services.catalogo import buscar_servicio_catalogo_por_nombre

VERSION_JSON_SOPORTADA = 1
LIMITE_JSON_BYTES = 50 * 1024 * 1024
COLECCIONES = (
    "pacientes",
    "citas",
    "pagos",
    "planes",
    "planPagos",
)


class ErrorImportacionOficial(ValueError):
    """Indica que el JSON no puede sustituir la base de forma segura."""


@dataclass(frozen=True, slots=True)
class DatosImportacionOficial:
    version: int
    fecha_fuente: str
    nombre_archivo: str
    sha256: str
    pacientes: tuple[dict[str, Any], ...]
    citas: tuple[dict[str, Any], ...]
    pagos: tuple[dict[str, Any], ...]
    planes: tuple[dict[str, Any], ...]
    planes_pago: tuple[dict[str, Any], ...]
    advertencias: tuple[str, ...]
    ajustes: tuple[str, ...]

    @property
    def conteos(self) -> dict[str, int]:
        return {
            "pacientes": len(self.pacientes),
            "citas": len(self.citas),
            "pagos": len(self.pagos),
            "planes": len(self.planes),
            "planPagos": len(self.planes_pago),
        }


@dataclass(frozen=True, slots=True)
class ResultadoImportacionOficial:
    datos: DatosImportacionOficial
    respaldo_previo: Path | None
    usuarios_conservados: int
    servicios_catalogo_conservados: int


def _texto(
    valor: Any,
    campo: str,
    *,
    obligatorio: bool = False,
) -> str:
    if valor is None:
        valor = ""

    if not isinstance(valor, str):
        raise ErrorImportacionOficial(f"{campo} debe ser texto.")

    if obligatorio and not valor.strip():
        raise ErrorImportacionOficial(f"{campo} es obligatorio.")

    return valor


def _entero_positivo(
    valor: Any,
    campo: str,
    *,
    opcional: bool = False,
    cero_como_vacio: bool = False,
) -> int | None:
    if valor is None or (cero_como_vacio and valor == 0):
        if opcional:
            return None
        raise ErrorImportacionOficial(f"{campo} es obligatorio.")

    if isinstance(valor, bool) or not isinstance(valor, int) or valor <= 0:
        raise ErrorImportacionOficial(f"{campo} debe ser un entero positivo.")

    return valor


def _monto(
    valor: Any,
    campo: str,
    *,
    opcional: bool = False,
) -> Decimal | None:
    if valor is None:
        if opcional:
            return None
        valor = 0

    if isinstance(valor, bool):
        raise ErrorImportacionOficial(f"{campo} debe ser un monto válido.")

    try:
        monto = Decimal(str(valor))
    except (InvalidOperation, ValueError) as error:
        raise ErrorImportacionOficial(f"{campo} debe ser un monto válido.") from error

    if not monto.is_finite() or monto < 0:
        raise ErrorImportacionOficial(f"{campo} no puede ser negativo.")

    return monto.quantize(Decimal("0.01"))


def _lista_json(valor: Any, campo: str) -> list[dict[str, Any]]:
    if valor is None:
        return []

    if not isinstance(valor, list) or not all(isinstance(item, dict) for item in valor):
        raise ErrorImportacionOficial(f"{campo} debe ser una lista de objetos.")

    resultado = [dict(item) for item in valor]

    for indice, item in enumerate(resultado):
        prefijo = f"{campo}[{indice}]"
        if "monto" in item:
            _monto(item.get("monto"), f"{prefijo}.monto")
        if "num" in item:
            _entero_positivo(item.get("num"), f"{prefijo}.num")
        if "pagado" in item and not isinstance(item.get("pagado"), bool):
            raise ErrorImportacionOficial(f"{prefijo}.pagado debe ser booleano.")

    return resultado


def _validar_ids(
    coleccion: str,
    filas: list[dict[str, Any]],
) -> set[int]:
    ids = [
        _entero_positivo(fila.get("id"), f"{coleccion}[{indice}].id")
        for indice, fila in enumerate(filas)
    ]

    repetidos = sorted(
        identificador
        for identificador, cantidad in Counter(ids).items()
        if cantidad > 1
    )

    if repetidos:
        raise ErrorImportacionOficial(
            f"{coleccion} contiene ID repetidos: {repetidos}."
        )

    return set(ids)


def _validar_fecha_implausible(
    filas: list[dict[str, Any]],
    campo: str,
    minimo: date,
    maximo: date,
) -> list[int]:
    invalidos: list[int] = []

    for fila in filas:
        valor = fila.get(campo)

        if not valor:
            continue

        try:
            fecha = date.fromisoformat(str(valor))
        except ValueError:
            invalidos.append(int(fila["id"]))
            continue

        if fecha < minimo or fecha > maximo:
            invalidos.append(int(fila["id"]))

    return invalidos


def _resolver_identificadores_pacientes(
    pacientes: list[dict[str, Any]],
    resolver_duplicados_ficha: bool,
) -> list[str]:
    ajustes: list[str] = []
    cedulas: dict[str, int] = {}
    fichas: dict[str, int] = {}

    for paciente in pacientes:
        paciente_id = int(paciente["id"])
        cedula = str(paciente.get("cedula") or "").strip()
        ficha = str(paciente.get("codigo_ficha") or "").strip()

        if cedula:
            clave = cedula.casefold()
            anterior = cedulas.get(clave)
            if anterior is not None:
                raise ErrorImportacionOficial(
                    "La cédula de los pacientes "
                    f"{anterior} y {paciente_id} está duplicada."
                )
            cedulas[clave] = paciente_id

        if not ficha:
            continue

        clave = ficha.casefold()
        anterior = fichas.get(clave)

        if anterior is None:
            fichas[clave] = paciente_id
            continue

        if not resolver_duplicados_ficha:
            raise ErrorImportacionOficial(
                "El código de ficha de los pacientes "
                f"{anterior} y {paciente_id} está duplicado. "
                "Vuelve a validar con --resolver-duplicados-ficha."
            )

        sufijo = f"-DUP-{paciente_id}"
        base = ficha[: max(1, 50 - len(sufijo))]
        candidato = f"{base}{sufijo}"
        contador = 2

        while candidato.casefold() in fichas:
            sufijo = f"-DUP-{paciente_id}-{contador}"
            base = ficha[: max(1, 50 - len(sufijo))]
            candidato = f"{base}{sufijo}"
            contador += 1

        paciente["codigo_ficha"] = candidato
        fichas[candidato.casefold()] = paciente_id
        ajustes.append(
            "Paciente "
            f"{paciente_id}: código de ficha duplicado diferenciado con sufijo."
        )

    return ajustes


def _preparar_pacientes(
    filas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    resultado = []

    for indice, fila in enumerate(filas):
        prefijo = f"pacientes[{indice}]"
        resultado.append(
            {
                "id": _entero_positivo(fila.get("id"), f"{prefijo}.id"),
                "nombre": _texto(
                    fila.get("nombre"),
                    f"{prefijo}.nombre",
                    obligatorio=True,
                ),
                "cedula": _texto(fila.get("cedula"), f"{prefijo}.cedula"),
                "fechaNacimiento": _texto(
                    fila.get("nacimiento"),
                    f"{prefijo}.nacimiento",
                ),
                "genero": _texto(fila.get("genero"), f"{prefijo}.genero"),
                "telefono": _texto(fila.get("telefono"), f"{prefijo}.telefono"),
                "correo": None,
                "codigo_ficha": _texto(
                    fila.get("codigo_ficha"),
                    f"{prefijo}.codigo_ficha",
                ),
                "direccion": _texto(
                    fila.get("direccion"),
                    f"{prefijo}.direccion",
                ),
                "alergias": _texto(
                    fila.get("alergias"),
                    f"{prefijo}.alergias",
                ),
                "medicamentos": _texto(
                    fila.get("medicamentos"),
                    f"{prefijo}.medicamentos",
                ),
                "fechaReg": _texto(
                    fila.get("fechaReg"),
                    f"{prefijo}.fechaReg",
                ),
            }
        )

    return resultado


def _preparar_citas(
    filas: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    resultado = []
    planes_cero = 0

    for indice, fila in enumerate(filas):
        prefijo = f"citas[{indice}]"
        plan_id = _entero_positivo(
            fila.get("planId"),
            f"{prefijo}.planId",
            opcional=True,
            cero_como_vacio=True,
        )

        if fila.get("planId") == 0:
            planes_cero += 1

        resultado.append(
            {
                "id": _entero_positivo(fila.get("id"), f"{prefijo}.id"),
                "pacienteId": _entero_positivo(
                    fila.get("pacienteId"),
                    f"{prefijo}.pacienteId",
                ),
                "casoClinicoId": None,
                "planId": plan_id,
                "sesionPlanId": None,
                "citaBaseId": _entero_positivo(
                    fila.get("citaBaseId"),
                    f"{prefijo}.citaBaseId",
                    opcional=True,
                ),
                "tipoCita": "procedimiento",
                "motivoConsulta": None,
                "piezaDental": None,
                "fecha": _texto(
                    fila.get("fecha"),
                    f"{prefijo}.fecha",
                    obligatorio=True,
                ),
                "hora": _texto(
                    fila.get("hora"),
                    f"{prefijo}.hora",
                    obligatorio=True,
                ),
                "horaFin": None,
                "duracionMinutos": None,
                "procedimiento": _texto(
                    fila.get("procedimiento"),
                    f"{prefijo}.procedimiento",
                ),
                "servicios": None,
                "notas": _texto(fila.get("notas"), f"{prefijo}.notas"),
                "notasFin": fila.get("notasFin"),
                "costo": _monto(fila.get("costo"), f"{prefijo}.costo"),
                "tipoPago": _texto(
                    fila.get("tipoPago"),
                    f"{prefijo}.tipoPago",
                ),
                "estado": _texto(
                    fila.get("estado"),
                    f"{prefijo}.estado",
                    obligatorio=True,
                ),
                "sesionNum": _entero_positivo(
                    fila.get("sesionNum"),
                    f"{prefijo}.sesionNum",
                ),
                "totalSesiones": _entero_positivo(
                    fila.get("totalSesiones"),
                    f"{prefijo}.totalSesiones",
                ),
                "creadaEn": _texto(
                    fila.get("creadaEn"),
                    f"{prefijo}.creadaEn",
                ),
                "inicio": fila.get("inicio"),
                "fin": fila.get("fin"),
                "motivoCancelacion": fila.get("motivoCancelacion"),
                "canceladaEn": fila.get("canceladaEn"),
            }
        )

    return resultado, planes_cero


def _preparar_pagos(
    filas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    resultado = []

    for indice, fila in enumerate(filas):
        prefijo = f"pagos[{indice}]"
        resultado.append(
            {
                "id": _entero_positivo(fila.get("id"), f"{prefijo}.id"),
                "pacienteId": _entero_positivo(
                    fila.get("pacienteId"),
                    f"{prefijo}.pacienteId",
                ),
                "casoClinicoId": None,
                "planId": None,
                "citaId": _entero_positivo(
                    fila.get("citaId"),
                    f"{prefijo}.citaId",
                    opcional=True,
                ),
                "concepto": _texto(
                    fila.get("concepto"),
                    f"{prefijo}.concepto",
                ),
                "fecha": _texto(fila.get("fecha"), f"{prefijo}.fecha"),
                "total": _monto(fila.get("total"), f"{prefijo}.total"),
                "cobrado": _monto(
                    fila.get("cobrado"),
                    f"{prefijo}.cobrado",
                ),
                "saldo": _monto(fila.get("saldo"), f"{prefijo}.saldo"),
                "metodo": _texto(fila.get("metodo"), f"{prefijo}.metodo"),
                "tipoPago": _texto(
                    fila.get("tipoPago"),
                    f"{prefijo}.tipoPago",
                ),
                "servicios": None,
                "cuotas": _lista_json(
                    fila.get("cuotas"),
                    f"{prefijo}.cuotas",
                ),
                "creadoEn": _texto(
                    fila.get("creadoEn"),
                    f"{prefijo}.creadoEn",
                ),
                "fechaUltPago": fila.get("fechaUltPago"),
                "nota": fila.get("nota"),
                "devuelto": _monto(
                    fila.get("devuelto"),
                    f"{prefijo}.devuelto",
                    opcional=True,
                ),
                "creditoFavor": _monto(
                    fila.get("creditoFavor"),
                    f"{prefijo}.creditoFavor",
                    opcional=True,
                ),
            }
        )

    return resultado


def _preparar_planes(
    filas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    resultado = []

    for indice, fila in enumerate(filas):
        prefijo = f"planes[{indice}]"
        resultado.append(
            {
                "id": _entero_positivo(fila.get("id"), f"{prefijo}.id"),
                "pacienteId": _entero_positivo(
                    fila.get("pacienteId"),
                    f"{prefijo}.pacienteId",
                ),
                "casoClinicoId": None,
                "pagoId": _entero_positivo(
                    fila.get("pagoId"),
                    f"{prefijo}.pagoId",
                    opcional=True,
                ),
                "nombre": _texto(fila.get("nombre"), f"{prefijo}.nombre"),
                "tipo": _texto(fila.get("tipo"), f"{prefijo}.tipo"),
                "duracion": _texto(
                    fila.get("duracion"),
                    f"{prefijo}.duracion",
                ),
                "costo": _monto(fila.get("costo"), f"{prefijo}.costo"),
                "nSesiones": _entero_positivo(
                    fila.get("nSesiones"),
                    f"{prefijo}.nSesiones",
                ),
                "descripcion": _texto(
                    fila.get("descripcion"),
                    f"{prefijo}.descripcion",
                ),
                "estado": _texto(fila.get("estado"), f"{prefijo}.estado"),
                "creadoEn": _texto(
                    fila.get("creadoEn"),
                    f"{prefijo}.creadoEn",
                ),
            }
        )

    return resultado


def _preparar_planes_pago(
    filas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    resultado = []

    for indice, fila in enumerate(filas):
        prefijo = f"planPagos[{indice}]"
        resultado.append(
            {
                "id": _entero_positivo(fila.get("id"), f"{prefijo}.id"),
                "pacienteId": _entero_positivo(
                    fila.get("pacienteId"),
                    f"{prefijo}.pacienteId",
                ),
                "casoClinicoId": None,
                "planId": None,
                "pagoId": _entero_positivo(
                    fila.get("pagoId"),
                    f"{prefijo}.pagoId",
                    opcional=True,
                ),
                "citaId": _entero_positivo(
                    fila.get("citaId"),
                    f"{prefijo}.citaId",
                    opcional=True,
                ),
                "origen": "procedimiento",
                "concepto": _texto(
                    fila.get("concepto"),
                    f"{prefijo}.concepto",
                ),
                "totalAcordado": _monto(
                    fila.get("totalAcordado"),
                    f"{prefijo}.totalAcordado",
                ),
                "anticipo": _monto(
                    fila.get("anticipo"),
                    f"{prefijo}.anticipo",
                ),
                "metodoPreferido": _texto(
                    fila.get("metodoPreferido"),
                    f"{prefijo}.metodoPreferido",
                ),
                "estado": _texto(fila.get("estado"), f"{prefijo}.estado"),
                "cuotas": _lista_json(
                    fila.get("cuotas"),
                    f"{prefijo}.cuotas",
                ),
                "totalCuotas": _monto(
                    fila.get("totalCuotas"),
                    f"{prefijo}.totalCuotas",
                ),
                "cobrado": _monto(
                    fila.get("cobrado"),
                    f"{prefijo}.cobrado",
                ),
                "saldo": _monto(fila.get("saldo"), f"{prefijo}.saldo"),
                "fechaCreacion": _texto(
                    fila.get("fechaCreacion"),
                    f"{prefijo}.fechaCreacion",
                ),
                "creadoEn": _texto(
                    fila.get("creadoEn"),
                    f"{prefijo}.creadoEn",
                ),
            }
        )

    return resultado


def _exigir_referencia(
    filas: list[dict[str, Any]],
    campo: str,
    destinos: set[int],
    coleccion: str,
) -> None:
    invalidos = sorted(
        int(fila["id"])
        for fila in filas
        if fila.get(campo) is not None and fila.get(campo) not in destinos
    )

    if invalidos:
        raise ErrorImportacionOficial(
            f"{coleccion}.{campo} contiene referencias inválidas "
            f"en los registros {invalidos}."
        )


def _advertencias_datos(
    pacientes: list[dict[str, Any]],
    citas: list[dict[str, Any]],
    pagos: list[dict[str, Any]],
    planes_pago: list[dict[str, Any]],
) -> list[str]:
    advertencias: list[str] = []
    hoy = datetime.now().astimezone().date()
    pacientes_fecha = [
        {"id": fila["id"], "fechaNacimiento": fila["fechaNacimiento"]}
        for fila in pacientes
    ]
    nacimientos = _validar_fecha_implausible(
        pacientes_fecha,
        "fechaNacimiento",
        date(1900, 1, 1),
        hoy,
    )
    citas_fecha = _validar_fecha_implausible(
        citas,
        "fecha",
        date(2020, 1, 1),
        date(2100, 12, 31),
    )
    pagos_fecha = _validar_fecha_implausible(
        pagos,
        "fecha",
        date(2020, 1, 1),
        date(2100, 12, 31),
    )

    if nacimientos:
        advertencias.append(
            f"Fechas de nacimiento implausibles en pacientes: {nacimientos}."
        )
    if citas_fecha:
        advertencias.append(f"Fechas implausibles en citas: {citas_fecha}.")
    if pagos_fecha:
        advertencias.append(f"Fechas implausibles en pagos: {pagos_fecha}.")

    pagos_por_id = {int(fila["id"]): fila for fila in pagos}

    for plan in planes_pago:
        total = Decimal(plan["totalAcordado"])
        anticipo = Decimal(plan["anticipo"])
        cuotas = sum(
            (
                _monto(
                    cuota.get("monto"),
                    f"planPagos[{plan['id']}].cuotas.monto",
                )
                or Decimal("0.00")
                for cuota in plan["cuotas"]
            ),
            start=Decimal("0.00"),
        )

        if abs(total - anticipo - cuotas) > Decimal("0.01"):
            advertencias.append(
                f"Plan de pago {plan['id']}: el anticipo y las cuotas "
                "no completan el total acordado."
            )

        pago = pagos_por_id.get(int(plan["pagoId"] or 0))
        if pago and any(
            abs(Decimal(plan[campo_plan]) - Decimal(pago[campo_pago])) > Decimal("0.01")
            for campo_plan, campo_pago in (
                ("totalAcordado", "total"),
                ("cobrado", "cobrado"),
                ("saldo", "saldo"),
            )
        ):
            advertencias.append(
                f"Plan de pago {plan['id']}: sus totales contradicen "
                f"al pago relacionado {pago['id']}."
            )

    return advertencias


def preparar_json_oficial(
    ruta_json: Path,
    *,
    resolver_duplicados_ficha: bool = False,
) -> DatosImportacionOficial:
    ruta_json = ruta_json.resolve()

    if not ruta_json.is_file():
        raise ErrorImportacionOficial(f"No existe el archivo: {ruta_json}")

    contenido = ruta_json.read_bytes()

    if not contenido or len(contenido) > LIMITE_JSON_BYTES:
        raise ErrorImportacionOficial("El JSON está vacío o supera el límite de 50 MB.")

    try:
        bruto = json.loads(contenido.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ErrorImportacionOficial(
            "El archivo debe ser un JSON válido codificado en UTF-8."
        ) from error

    if not isinstance(bruto, dict):
        raise ErrorImportacionOficial("La raíz del JSON debe ser un objeto.")

    version = bruto.get("v")
    if version != VERSION_JSON_SOPORTADA:
        raise ErrorImportacionOficial(
            f"Versión JSON no soportada: {version!r}. Se espera v=1."
        )

    fecha_fuente = _texto(
        bruto.get("ts"),
        "ts",
        obligatorio=True,
    )

    for coleccion in COLECCIONES:
        if not isinstance(bruto.get(coleccion), list):
            raise ErrorImportacionOficial(
                f"La colección {coleccion} debe ser una lista."
            )
        if not all(isinstance(fila, dict) for fila in bruto[coleccion]):
            raise ErrorImportacionOficial(
                f"La colección {coleccion} solo puede contener objetos."
            )
        _validar_ids(coleccion, bruto[coleccion])

    if not bruto["pacientes"]:
        raise ErrorImportacionOficial(
            "El JSON oficial no contiene pacientes; se cancela el reemplazo vacío."
        )

    pacientes = _preparar_pacientes(bruto["pacientes"])
    citas, planes_cero = _preparar_citas(bruto["citas"])
    pagos = _preparar_pagos(bruto["pagos"])
    planes = _preparar_planes(bruto["planes"])
    planes_pago = _preparar_planes_pago(bruto["planPagos"])

    ajustes = _resolver_identificadores_pacientes(
        pacientes,
        resolver_duplicados_ficha,
    )
    if planes_cero:
        ajustes.append(f"{planes_cero} citas: planId=0 normalizado como vínculo vacío.")

    pacientes_ids = {int(fila["id"]) for fila in pacientes}
    citas_ids = {int(fila["id"]) for fila in citas}
    pagos_ids = {int(fila["id"]) for fila in pagos}
    planes_ids = {int(fila["id"]) for fila in planes}

    _exigir_referencia(citas, "pacienteId", pacientes_ids, "citas")
    _exigir_referencia(citas, "citaBaseId", citas_ids, "citas")
    _exigir_referencia(citas, "planId", planes_ids, "citas")
    _exigir_referencia(pagos, "pacienteId", pacientes_ids, "pagos")
    _exigir_referencia(pagos, "citaId", citas_ids, "pagos")
    _exigir_referencia(planes, "pacienteId", pacientes_ids, "planes")
    _exigir_referencia(planes, "pagoId", pagos_ids, "planes")
    _exigir_referencia(
        planes_pago,
        "pacienteId",
        pacientes_ids,
        "planPagos",
    )
    _exigir_referencia(planes_pago, "pagoId", pagos_ids, "planPagos")
    _exigir_referencia(planes_pago, "citaId", citas_ids, "planPagos")

    citas_por_id = {int(fila["id"]): fila for fila in citas}
    pagos_por_id = {int(fila["id"]): fila for fila in pagos}

    for cita in citas:
        if int(cita["sesionNum"]) > int(cita["totalSesiones"]):
            raise ErrorImportacionOficial(
                f"Cita {cita['id']}: la sesión supera el total de sesiones."
            )

        cita_base = citas_por_id.get(int(cita["citaBaseId"] or 0))
        if cita_base and int(cita_base["pacienteId"]) != int(cita["pacienteId"]):
            raise ErrorImportacionOficial(
                f"Cita {cita['id']}: la cita base pertenece a otro paciente."
            )

    for pago in pagos:
        cita = citas_por_id.get(int(pago["citaId"] or 0))
        if cita and int(cita["pacienteId"]) != int(pago["pacienteId"]):
            raise ErrorImportacionOficial(
                f"Pago {pago['id']}: la cita relacionada pertenece a otro paciente."
            )

    for plan in planes_pago:
        pago = pagos_por_id.get(int(plan["pagoId"] or 0))
        cita = citas_por_id.get(int(plan["citaId"] or 0))
        if pago and int(pago["pacienteId"]) != int(plan["pacienteId"]):
            raise ErrorImportacionOficial(
                f"Plan de pago {plan['id']}: el pago pertenece a otro paciente."
            )
        if cita and int(cita["pacienteId"]) != int(plan["pacienteId"]):
            raise ErrorImportacionOficial(
                f"Plan de pago {plan['id']}: la cita pertenece a otro paciente."
            )

        numeros = [cuota.get("num") for cuota in plan["cuotas"]]
        if len(numeros) != len(set(numeros)):
            raise ErrorImportacionOficial(
                f"Plan de pago {plan['id']}: contiene cuotas duplicadas."
            )

    for pago in pagos:
        if abs(
            Decimal(pago["total"]) - Decimal(pago["cobrado"]) - Decimal(pago["saldo"])
        ) > Decimal("0.01"):
            raise ErrorImportacionOficial(
                f"Pago {pago['id']}: total, cobrado y saldo no coinciden."
            )

    for plan in planes_pago:
        if abs(
            Decimal(plan["totalAcordado"])
            - Decimal(plan["cobrado"])
            - Decimal(plan["saldo"])
        ) > Decimal("0.01"):
            raise ErrorImportacionOficial(
                f"Plan de pago {plan['id']}: total, cobrado y saldo no coinciden."
            )

    advertencias = _advertencias_datos(
        pacientes,
        citas,
        pagos,
        planes_pago,
    )

    return DatosImportacionOficial(
        version=int(version),
        fecha_fuente=fecha_fuente,
        nombre_archivo=ruta_json.name,
        sha256=hashlib.sha256(contenido).hexdigest(),
        pacientes=tuple(pacientes),
        citas=tuple(citas),
        pagos=tuple(pagos),
        planes=tuple(planes),
        planes_pago=tuple(planes_pago),
        advertencias=tuple(advertencias),
        ajustes=tuple(ajustes),
    )


def _crear_motor_sqlite(ruta_bd: Path):
    motor = create_engine(
        f"sqlite:///{ruta_bd.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 15},
    )

    @event.listens_for(motor, "connect")
    def configurar_sqlite(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.close()

    return motor


def _leer_usuarios_actuales(ruta_bd: Path) -> list[dict[str, Any]]:
    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return []

    columnas = [columna.name for columna in UsuarioDB.__table__.columns]

    # El context manager nativo de sqlite3 confirma/revierte la transacción,
    # pero no cierra la conexión. En Windows eso mantiene el archivo bloqueado
    # e impide reemplazarlo durante la importación oficial.
    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        existe = conexion.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'usuarios'
            """
        ).fetchone()
        if not existe:
            return []

        disponibles = {
            fila[1]
            for fila in conexion.execute("PRAGMA table_info(usuarios)").fetchall()
        }
        faltantes = sorted(set(columnas) - disponibles)
        if faltantes:
            raise ErrorImportacionOficial(
                f"La tabla de usuarios actual está incompleta: {faltantes}."
            )

        consulta = (
            "SELECT "
            + ", ".join(f'"{columna}"' for columna in columnas)
            + " FROM usuarios"
        )
        filas = conexion.execute(consulta).fetchall()

    usuarios = [dict(zip(columnas, fila, strict=True)) for fila in filas]

    if not any(
        usuario["rol"] == "administrador" and bool(usuario["activo"])
        for usuario in usuarios
    ):
        raise ErrorImportacionOficial(
            "La base actual no tiene un administrador activo que pueda conservarse."
        )

    return usuarios


def _leer_catalogo_actual(ruta_bd: Path) -> list[dict[str, Any]]:
    if not ruta_bd.is_file() or ruta_bd.stat().st_size == 0:
        return []

    columnas = [columna.name for columna in ServicioCatalogoDB.__table__.columns]
    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        existe = conexion.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'serviciosCatalogo'
            """
        ).fetchone()
        if not existe:
            return []

        disponibles = {
            fila[1]
            for fila in conexion.execute(
                "PRAGMA table_info(serviciosCatalogo)"
            ).fetchall()
        }
        faltantes = sorted(set(columnas) - disponibles)
        if faltantes:
            raise ErrorImportacionOficial(
                f"La tabla del catálogo actual está incompleta: {faltantes}."
            )

        consulta = (
            "SELECT "
            + ", ".join(f'"{columna}"' for columna in columnas)
            + " FROM serviciosCatalogo"
        )
        filas = conexion.execute(consulta).fetchall()

    return [dict(zip(columnas, fila, strict=True)) for fila in filas]


def _crear_base_preparada(
    ruta_temporal: Path,
    datos: DatosImportacionOficial,
    usuarios: list[dict[str, Any]],
    catalogo: list[dict[str, Any]],
) -> None:
    ruta_temporal.unlink(missing_ok=True)
    motor = _crear_motor_sqlite(ruta_temporal)
    _ = models

    try:
        Base.metadata.create_all(bind=motor)
        with motor.begin() as conexion:
            aplicar_migraciones(conexion)

        SesionTemporal = sessionmaker(
            bind=motor,
            autocommit=False,
            autoflush=False,
        )
        with SesionTemporal() as db:
            if catalogo:
                db.query(ServicioCatalogoDB).delete()
                db.add_all(ServicioCatalogoDB(**servicio) for servicio in catalogo)
            db.add_all(UsuarioDB(**usuario) for usuario in usuarios)
            db.add_all(PacienteDB(**fila) for fila in datos.pacientes)
            db.add_all(PlanDB(**fila) for fila in datos.planes)
            db.add_all(CitaDB(**fila) for fila in datos.citas)
            db.add_all(PagoDB(**fila) for fila in datos.pagos)
            db.add_all(PlanPagoDB(**fila) for fila in datos.planes_pago)
            db.flush()

            citas_por_id = {cita.id: cita for cita in db.query(CitaDB).all()}
            for cita in citas_por_id.values():
                if cita.servicios:
                    continue
                servicio = buscar_servicio_catalogo_por_nombre(
                    db,
                    cita.procedimiento or "",
                )
                if not servicio:
                    continue
                cita.procedimiento = servicio.nombre
                cita.servicios = [
                    {
                        "servicioId": servicio.id,
                        "nombre": servicio.nombre,
                        "costo": float(cita.costo or 0),
                    }
                ]

            for pago in db.query(PagoDB).all():
                cita = citas_por_id.get(pago.citaId)
                if cita and cita.servicios:
                    pago.servicios = cita.servicios
                    pago.concepto = cita.procedimiento
                    continue
                servicio = buscar_servicio_catalogo_por_nombre(
                    db,
                    pago.concepto or "",
                )
                if servicio:
                    pago.concepto = servicio.nombre
                    pago.servicios = [
                        {
                            "servicioId": servicio.id,
                            "nombre": servicio.nombre,
                            "costo": float(pago.total or 0),
                        }
                    ]
            db.add(
                ImportacionOficialDB(
                    versionFuente=datos.version,
                    fechaFuente=datos.fecha_fuente,
                    nombreArchivo=datos.nombre_archivo,
                    sha256=datos.sha256,
                    conteos=datos.conteos,
                    advertencias=list(datos.advertencias),
                    ajustes=list(datos.ajustes),
                    importadaEn=datetime.now()
                    .astimezone()
                    .isoformat(timespec="seconds"),
                )
            )
            db.commit()
    finally:
        motor.dispose()

    auditoria = auditar_datos_sqlite(ruta_temporal)
    if not auditoria.saludable:
        detalle = "; ".join(
            f"{hallazgo.codigo}={hallazgo.cantidad}" for hallazgo in auditoria.hallazgos
        )
        raise ErrorImportacionOficial(
            f"La base preparada no superó la auditoría: {detalle}."
        )


def importar_json_oficial(
    ruta_json: Path,
    *,
    ruta_bd: Path,
    directorio_respaldos: Path,
    resolver_duplicados_ficha: bool = False,
    aceptar_advertencias: bool = False,
) -> ResultadoImportacionOficial:
    datos = preparar_json_oficial(
        ruta_json,
        resolver_duplicados_ficha=resolver_duplicados_ficha,
    )

    if datos.advertencias and not aceptar_advertencias:
        raise ErrorImportacionOficial(
            "El JSON contiene advertencias que requieren revisión explícita. "
            "Usa --aceptar-advertencias únicamente después de verificarlas."
        )

    ruta_bd = ruta_bd.resolve()
    usuarios = _leer_usuarios_actuales(ruta_bd)
    if not usuarios:
        raise ErrorImportacionOficial(
            "La base actual no contiene usuarios que puedan conservarse."
        )
    catalogo = _leer_catalogo_actual(ruta_bd)
    ruta_temporal = ruta_bd.with_name(f".{ruta_bd.name}.importacion-oficial")

    try:
        _crear_base_preparada(
            ruta_temporal,
            datos,
            usuarios,
            catalogo,
        )
        respaldo = restaurar_base_sqlite(
            ruta_respaldo=ruta_temporal,
            ruta_bd=ruta_bd,
            directorio_respaldos=directorio_respaldos,
        )
    finally:
        ruta_temporal.unlink(missing_ok=True)

    return ResultadoImportacionOficial(
        datos=datos,
        respaldo_previo=respaldo,
        usuarios_conservados=len(usuarios),
        servicios_catalogo_conservados=len(catalogo),
    )
