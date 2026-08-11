from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    CasoClinicoDB,
    CitaDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
    SesionPlanDB,
)
from ..schemas import CitaPagoPayload
from .comun import ahora_iso, serializar_modelo

TIPO_CASO_POR_CITA = {
    "diagnostico_inicial": "diagnostico",
    "urgencia": "urgencia",
    "procedimiento": "procedimiento",
    "sesion_tratamiento": "tratamiento",
    "control": "control",
}


def obtener_caso_clinico(
    db: Session,
    caso_id: int | None,
    paciente_id: int,
) -> CasoClinicoDB | None:
    if not caso_id:
        return None

    caso = db.query(CasoClinicoDB).filter(CasoClinicoDB.id == caso_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="El caso clínico no existe.")
    if int(caso.pacienteId or 0) != int(paciente_id):
        raise HTTPException(
            status_code=400,
            detail="El caso clínico no pertenece al paciente seleccionado.",
        )
    return caso


def crear_caso_automatico_para_cita(
    db: Session,
    payload: CitaPagoPayload,
    plan: PlanDB | None = None,
) -> CasoClinicoDB:
    if plan and plan.casoClinicoId:
        caso = obtener_caso_clinico(db, plan.casoClinicoId, payload.pacienteId)
        if caso:
            return caso

    caso_existente = obtener_caso_clinico(
        db,
        payload.casoClinicoId,
        payload.pacienteId,
    )
    if caso_existente:
        return caso_existente

    motivo = payload.motivoConsulta.strip()
    pieza = payload.piezaDental.strip()
    if motivo:
        titulo = motivo[:180]
    elif payload.tipoCita == "urgencia":
        titulo = f"Urgencia dental{f' · Pieza {pieza}' if pieza else ''}"
    elif payload.tipoCita == "diagnostico_inicial":
        titulo = "Evaluación y diagnóstico inicial"
    elif payload.tipoCita == "control":
        titulo = "Control odontológico"
    else:
        titulo = payload.procedimiento.strip()[:180] or "Atención odontológica"

    caso = CasoClinicoDB(
        pacienteId=payload.pacienteId,
        titulo=titulo,
        tipo=TIPO_CASO_POR_CITA.get(payload.tipoCita, "procedimiento"),
        motivoConsulta=motivo,
        piezaDental=pieza,
        diagnostico="",
        estado="en_tratamiento" if plan else "abierto",
        creadoEn=ahora_iso(),
        actualizadoEn=ahora_iso(),
    )
    db.add(caso)
    db.flush()
    return caso


def obtener_plan_clinico(
    db: Session,
    plan_id: int | None,
    paciente_id: int,
) -> PlanDB | None:
    if not plan_id:
        return None

    plan = db.query(PlanDB).filter(PlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="El plan de tratamiento no existe.")
    if int(plan.pacienteId or 0) != int(paciente_id):
        raise HTTPException(
            status_code=400,
            detail="El plan de tratamiento no pertenece al paciente seleccionado.",
        )
    if plan.estado in {"cancelado", "completado"}:
        raise HTTPException(
            status_code=409,
            detail="El plan seleccionado ya no admite nuevas sesiones.",
        )
    return plan


def obtener_sesion_para_cita(
    db: Session,
    plan: PlanDB | None,
    sesion_id: int | None = None,
    cita_id: int | None = None,
) -> SesionPlanDB | None:
    if not plan:
        if sesion_id:
            raise HTTPException(
                status_code=400,
                detail="No puedes seleccionar una sesión sin un plan de tratamiento.",
            )
        return None

    consulta = db.query(SesionPlanDB).filter(SesionPlanDB.planId == plan.id)
    if sesion_id:
        sesion = consulta.filter(SesionPlanDB.id == sesion_id).first()
        if not sesion:
            raise HTTPException(
                status_code=404,
                detail="La sesión seleccionada no pertenece al plan.",
            )
    else:
        sesion = (
            consulta.filter(SesionPlanDB.estado == "pendiente")
            .order_by(SesionPlanDB.numero)
            .first()
        )

    if not sesion:
        raise HTTPException(
            status_code=409,
            detail="El plan no tiene sesiones pendientes disponibles.",
        )

    if sesion.citaId and int(sesion.citaId) != int(cita_id or 0):
        raise HTTPException(
            status_code=409,
            detail="La sesión seleccionada ya está vinculada a otra cita.",
        )
    return sesion


def vincular_sesion_a_cita(
    sesion: SesionPlanDB | None,
    cita: CitaDB,
) -> None:
    if not sesion:
        return
    sesion.citaId = cita.id
    sesion.fechaProgramada = cita.fecha
    sesion.estado = "completada" if cita.estado == "completada" else "agendada"
    sesion.actualizadoEn = ahora_iso()


def liberar_sesion_de_cita(
    db: Session,
    cita: CitaDB,
) -> None:
    if not cita.sesionPlanId:
        return
    sesion = db.query(SesionPlanDB).filter(SesionPlanDB.id == cita.sesionPlanId).first()
    if not sesion:
        return
    sesion.citaId = None
    sesion.fechaProgramada = None
    sesion.estado = "pendiente"
    sesion.actualizadoEn = ahora_iso()


def actualizar_sesion_desde_cita(
    db: Session,
    cita: CitaDB,
) -> None:
    if not cita.sesionPlanId:
        return
    sesion = db.query(SesionPlanDB).filter(SesionPlanDB.id == cita.sesionPlanId).first()
    if not sesion:
        return

    if cita.estado == "completada":
        sesion.estado = "completada"
    elif cita.estado == "cancelada":
        sesion.estado = "pendiente"
        sesion.citaId = None
        sesion.fechaProgramada = None
    else:
        sesion.estado = "agendada"
        sesion.citaId = cita.id
        sesion.fechaProgramada = cita.fecha
    sesion.actualizadoEn = ahora_iso()


def crear_sesiones_plan(
    db: Session,
    plan: PlanDB,
    cantidad: int,
) -> list[SesionPlanDB]:
    ahora = ahora_iso()
    sesiones = []
    for numero in range(1, cantidad + 1):
        sesion = SesionPlanDB(
            planId=plan.id,
            numero=numero,
            titulo=f"Sesión {numero} · {plan.nombre}",
            estado="pendiente",
            cuotaNum=numero,
            creadoEn=ahora,
            actualizadoEn=ahora,
        )
        db.add(sesion)
        sesiones.append(sesion)
    db.flush()
    return sesiones


def sincronizar_sesiones_plan(
    db: Session,
    plan: PlanDB,
    nueva_cantidad: int,
) -> list[SesionPlanDB]:
    sesiones = (
        db.query(SesionPlanDB)
        .filter(SesionPlanDB.planId == plan.id)
        .order_by(SesionPlanDB.numero)
        .all()
    )
    usadas = [
        sesion for sesion in sesiones if sesion.citaId or sesion.estado == "completada"
    ]
    mayor_usada = max((int(sesion.numero) for sesion in usadas), default=0)
    if nueva_cantidad < mayor_usada:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No puedes reducir el plan a {nueva_cantidad} sesiones porque "
                f"la sesión {mayor_usada} ya fue utilizada."
            ),
        )

    if nueva_cantidad > len(sesiones):
        ahora = ahora_iso()
        for numero in range(len(sesiones) + 1, nueva_cantidad + 1):
            sesion = SesionPlanDB(
                planId=plan.id,
                numero=numero,
                titulo=f"Sesión {numero} · {plan.nombre}",
                estado="pendiente",
                cuotaNum=numero,
                creadoEn=ahora,
                actualizadoEn=ahora,
            )
            db.add(sesion)
            sesiones.append(sesion)
    elif nueva_cantidad < len(sesiones):
        for sesion in sesiones[nueva_cantidad:]:
            if sesion.citaId or sesion.estado == "completada":
                raise HTTPException(
                    status_code=409,
                    detail="No puedes eliminar una sesión ya agendada o completada.",
                )
            db.delete(sesion)
        sesiones = sesiones[:nueva_cantidad]

    for sesion in sesiones:
        sesion.titulo = f"Sesión {sesion.numero} · {plan.nombre}"
        sesion.actualizadoEn = ahora_iso()
    db.flush()
    return sesiones


def serializar_plan_detallado(
    db: Session,
    plan: PlanDB,
) -> dict[str, Any]:
    resultado = serializar_modelo(plan)
    sesiones = (
        db.query(SesionPlanDB)
        .filter(SesionPlanDB.planId == plan.id)
        .order_by(SesionPlanDB.numero)
        .all()
    )
    resultado["sesiones"] = [serializar_modelo(sesion) for sesion in sesiones]

    pago = None
    if plan.pagoId:
        pago = db.query(PagoDB).filter(PagoDB.id == plan.pagoId).first()
    if not pago:
        pago = db.query(PagoDB).filter(PagoDB.planId == plan.id).first()
    resultado["pago"] = serializar_modelo(pago) if pago else None

    plan_pago = db.query(PlanPagoDB).filter(PlanPagoDB.planId == plan.id).first()
    resultado["planPago"] = serializar_modelo(plan_pago) if plan_pago else None
    return resultado
