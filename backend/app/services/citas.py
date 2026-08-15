from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import CitaDB, PacienteDB, PlanDB, SesionPlanDB
from ..schemas import CitaPagoPayload
from .catalogo import resolver_servicio_guardado
from .comun import redondear_monto

CERO = Decimal("0.00")

ESTADOS_QUE_BLOQUEAN_HORARIO = {
    "pendiente",
    "confirmada",
    "en_espera",
    "en_atencion",
}

TRANSICIONES_ESTADO = {
    "pendiente": {
        "confirmada",
        "en_espera",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "confirmada": {
        "pendiente",
        "en_espera",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "en_espera": {
        "confirmada",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "en_atencion": {"completada", "cancelada"},
    "no_asistio": {"pendiente"},
    "cancelada": {"pendiente"},
    "completada": set(),
}


def convertir_hora_a_minutos(hora: str) -> int:
    try:
        horas, minutos = [int(parte) for parte in hora.split(":", 1)]
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="La hora no tiene un formato válido.",
        ) from exc

    if not (0 <= horas <= 23 and 0 <= minutos <= 59):
        raise HTTPException(
            status_code=422,
            detail="La hora no tiene un formato válido.",
        )

    return horas * 60 + minutos


def minutos_a_hora(total_minutos: int) -> str:
    total_minutos = int(total_minutos) % (24 * 60)
    return f"{total_minutos // 60:02d}:{total_minutos % 60:02d}"


def resolver_rango_horario(
    fecha: str,
    hora_inicio: str,
    hora_fin: str | None,
    duracion_minutos: int,
) -> tuple[int, int, str, int]:
    try:
        datetime.strptime(fecha, "%Y-%m-%d").replace(tzinfo=UTC)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="La fecha no tiene un formato válido.",
        ) from exc

    inicio_min = convertir_hora_a_minutos(hora_inicio)
    duracion = int(duracion_minutos or 60)

    if hora_fin:
        fin_min = convertir_hora_a_minutos(hora_fin)
        duracion = fin_min - inicio_min
    else:
        fin_min = inicio_min + duracion
        hora_fin = minutos_a_hora(fin_min)

    if duracion < 5:
        raise HTTPException(
            status_code=422,
            detail=("La hora final debe ser posterior a la hora de inicio."),
        )

    if duracion > 720 or fin_min > 24 * 60:
        raise HTTPException(
            status_code=422,
            detail=(
                "La duración de la cita no puede superar "
                "12 horas ni terminar después de medianoche."
            ),
        )

    return inicio_min, fin_min, hora_fin, duracion


def obtener_paciente(
    db: Session,
    paciente_id: int,
) -> PacienteDB:
    paciente = db.query(PacienteDB).filter(PacienteDB.id == paciente_id).first()

    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="El paciente seleccionado no existe.",
        )

    return paciente


def validar_plan(
    db: Session,
    plan_id: int | None,
    paciente_id: int,
) -> None:
    if not plan_id:
        return

    plan = db.query(PlanDB).filter(PlanDB.id == plan_id).first()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="El plan de tratamiento no existe.",
        )

    if int(plan.pacienteId or 0) != int(paciente_id):
        raise HTTPException(
            status_code=400,
            detail=("El plan de tratamiento no pertenece al paciente seleccionado."),
        )


def validar_disponibilidad(
    db: Session,
    fecha: str,
    hora: str,
    hora_fin: str | None,
    duracion_minutos: int,
    estado: str,
    cita_excluida_id: int | None = None,
) -> tuple[str, int]:
    """Impide cruces parciales o totales entre citas activas."""
    inicio, fin, hora_fin_resuelta, duracion_resuelta = resolver_rango_horario(
        fecha,
        hora,
        hora_fin,
        duracion_minutos,
    )

    if estado not in ESTADOS_QUE_BLOQUEAN_HORARIO:
        return hora_fin_resuelta, duracion_resuelta

    consulta = db.query(CitaDB).filter(
        CitaDB.fecha == fecha,
        CitaDB.estado.in_(ESTADOS_QUE_BLOQUEAN_HORARIO),
    )

    if cita_excluida_id:
        consulta = consulta.filter(CitaDB.id != cita_excluida_id)

    for conflicto in consulta.all():
        inicio_existente = convertir_hora_a_minutos(conflicto.hora or "00:00")
        duracion_existente = int(conflicto.duracionMinutos or 60)

        try:
            if conflicto.horaFin:
                fin_existente = convertir_hora_a_minutos(conflicto.horaFin)
            else:
                fin_existente = inicio_existente + duracion_existente
        except HTTPException:
            fin_existente = inicio_existente + duracion_existente

        hay_cruce = inicio < fin_existente and fin > inicio_existente

        if not hay_cruce:
            continue

        paciente = (
            db.query(PacienteDB).filter(PacienteDB.id == conflicto.pacienteId).first()
        )
        nombre = paciente.nombre if paciente else "otro paciente"
        hora_fin_existente = conflicto.horaFin or minutos_a_hora(fin_existente)

        raise HTTPException(
            status_code=409,
            detail=(
                f"El rango {hora} → {hora_fin_resuelta} "
                "se cruza con una cita existente. "
                f"Horario ocupado: {conflicto.hora or '—'} "
                f"→ {hora_fin_existente}. "
                f"Paciente: {nombre}."
            ),
        )

    return hora_fin_resuelta, duracion_resuelta


def validar_secuencia_sesion(
    db: Session,
    cita: CitaDB,
) -> None:
    if cita.sesionPlanId:
        sesion = (
            db.query(SesionPlanDB).filter(SesionPlanDB.id == cita.sesionPlanId).first()
        )
        if not sesion or int(sesion.numero or 1) <= 1:
            return

        anterior = (
            db.query(SesionPlanDB)
            .filter(
                SesionPlanDB.planId == sesion.planId,
                SesionPlanDB.numero == int(sesion.numero) - 1,
            )
            .first()
        )
        if not anterior or anterior.estado != "completada":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Debes completar primero la sesión {int(sesion.numero) - 1} "
                    f"antes de iniciar la sesión {sesion.numero}."
                ),
            )
        return

    sesion_num = int(cita.sesionNum or 1)
    total_sesiones = int(cita.totalSesiones or 1)

    if sesion_num <= 1 or total_sesiones <= 1:
        return

    base_id = int(cita.citaBaseId or cita.id)

    grupo = (
        db.query(CitaDB)
        .filter(
            or_(
                CitaDB.id == base_id,
                CitaDB.citaBaseId == base_id,
            )
        )
        .all()
    )

    anterior = next(
        (item for item in grupo if int(item.sesionNum or 1) == sesion_num - 1),
        None,
    )

    if anterior and anterior.estado != "completada":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Debes completar primero la sesión "
                f"{sesion_num - 1} antes de iniciar "
                f"la sesión {sesion_num}."
            ),
        )


def normalizar_servicios(
    db: Session,
    payload: CitaPagoPayload,
) -> dict[str, Any]:
    servicios = []

    for servicio in payload.servicios:
        servicio_id, nombre = resolver_servicio_guardado(
            db,
            servicio_id=servicio.servicioId,
            nombre=servicio.nombre,
        )

        if not nombre:
            continue

        # El costo por servicio se guarda dentro de la columna JSON
        # `servicios`, que no admite Decimal directamente (json.dumps no
        # sabe serializarlo) -> se guarda como float, ya redondeado con
        # la misma lógica de redondear_monto para que sea consistente
        # con costo_total.
        servicios.append(
            {
                "servicioId": servicio_id,
                "nombre": nombre,
                "costo": float(redondear_monto(servicio.costo)),
            }
        )

    if not servicios:
        servicios = [
            {
                "servicioId": None,
                "nombre": payload.procedimiento.strip(),
                "costo": float(redondear_monto(payload.costo)),
            }
        ]

    if payload.tipoPago == "sesion":
        servicios = [
            {
                **servicio,
                "costo": 0.0,
            }
            for servicio in servicios
        ]

    procedimiento = " + ".join(servicio["nombre"] for servicio in servicios)
    procedimiento = procedimiento[:200]

    costo_total = redondear_monto(
        sum((Decimal(str(servicio["costo"])) for servicio in servicios), start=CERO)
    )

    return {
        "servicios": servicios,
        "procedimiento": procedimiento,
        "costo_total": costo_total,
    }


def calcular_datos_pago(
    payload: CitaPagoPayload,
    costo_total: Decimal | None = None,
) -> dict[str, Any]:
    tipo_pago = payload.tipoPago

    if tipo_pago in {"cortesia", "sesion"}:
        total = CERO
        cobrado = CERO
    else:
        total = redondear_monto(payload.costo if costo_total is None else costo_total)

        if tipo_pago == "completo":
            cobrado = total
        elif tipo_pago == "contado":
            cobrado = CERO
        else:
            cobrado = redondear_monto(payload.montoPagado)

    if cobrado > total:
        raise HTTPException(
            status_code=400,
            detail=("El monto pagado no puede superar el costo total."),
        )

    if tipo_pago == "anticipo":
        if total <= 0:
            raise HTTPException(
                status_code=400,
                detail=("Una cita con anticipo debe tener un costo mayor que cero."),
            )

        if cobrado <= 0:
            raise HTTPException(
                status_code=400,
                detail="Debes ingresar el monto del anticipo.",
            )

        if cobrado >= total:
            raise HTTPException(
                status_code=400,
                detail=(
                    "El anticipo debe ser menor al costo total. "
                    "Si pagó todo, selecciona "
                    "'Pagado completo'."
                ),
            )

    if tipo_pago == "cuotas" and total <= 0:
        raise HTTPException(
            status_code=400,
            detail=("Una cita en cuotas debe tener un costo mayor que cero."),
        )

    saldo = redondear_monto(total - cobrado)

    metodo = (
        payload.metodoPago.strip()
        if cobrado > 0 and payload.metodoPago.strip()
        else "Pendiente"
    )

    return {
        "total": total,
        "cobrado": cobrado,
        "saldo": saldo,
        "metodo": metodo,
    }
