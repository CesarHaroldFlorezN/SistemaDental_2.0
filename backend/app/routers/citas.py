"""Rutas de agenda y operaciones clínicas."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CitaDB, PagoDB, PlanPagoDB
from ..schemas import (
    CambioEstadoPayload,
    CitaPagoPayload,
    ReprogramarCitaPayload,
)
from ..services import (
    ESTADOS_QUE_BLOQUEAN_HORARIO,
    TRANSICIONES_ESTADO,
    ahora_iso,
    calcular_datos_pago,
    convertir_hora_a_minutos,
    minutos_a_hora,
    normalizar_servicios,
    obtener_paciente,
    redondear_monto,
    serializar_modelo,
    validar_disponibilidad,
    validar_plan,
    validar_secuencia_sesion,
)

router = APIRouter()

# =====================================================
# OPERACIONES TRANSACCIONALES DE CITAS
# =====================================================


@router.get("/api/citas", tags=["Citas"])
def listar_citas(
    db: Session = Depends(get_db),
):
    citas = db.query(CitaDB).all()
    return [serializar_modelo(cita) for cita in citas]


@router.put(
    "/api/citas/{cita_id}",
    tags=["Citas"],
)
def actualizar_cita_directa(
    cita_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()

    if not cita:
        raise HTTPException(
            status_code=404,
            detail="Cita no encontrada.",
        )

    fecha = str(data.get("fecha", cita.fecha) or "")
    hora = str(data.get("hora", cita.hora) or "")

    hora_fin = data.get(
        "horaFin",
        cita.horaFin,
    )

    duracion = int(
        data.get(
            "duracionMinutos",
            cita.duracionMinutos or 60,
        )
        or 60
    )

    estado = str(
        data.get(
            "estado",
            cita.estado,
        )
        or "pendiente"
    )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        fecha,
        hora,
        hora_fin,
        duracion,
        estado,
        cita_excluida_id=cita_id,
    )

    data["horaFin"] = hora_fin_resuelta
    data["duracionMinutos"] = duracion_resuelta

    columnas_validas = {columna.name for columna in CitaDB.__table__.columns}

    for clave, valor in data.items():
        if clave in columnas_validas and clave != "id":
            setattr(cita, clave, valor)

    try:
        db.commit()
        db.refresh(cita)
        return {
            "message": "Actualizado correctamente.",
            "registro": serializar_modelo(cita),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar la cita.",
        ) from error


@router.post("/api/operaciones/citas", tags=["Citas"])
def crear_cita_con_pago(
    payload: CitaPagoPayload,
    db: Session = Depends(get_db),
):
    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
        payload.estado,
    )

    detalle_servicios = normalizar_servicios(payload)
    datos_pago = calcular_datos_pago(
        payload,
        detalle_servicios["costo_total"],
    )
    ahora = ahora_iso()

    nueva_cita = CitaDB(
        pacienteId=payload.pacienteId,
        planId=payload.planId,
        citaBaseId=payload.citaBaseId,
        fecha=payload.fecha,
        hora=payload.hora,
        horaFin=hora_fin_resuelta,
        duracionMinutos=duracion_resuelta,
        procedimiento=detalle_servicios["procedimiento"],
        servicios=detalle_servicios["servicios"],
        notas=payload.notas.strip(),
        costo=datos_pago["total"],
        tipoPago=payload.tipoPago,
        estado=payload.estado,
        sesionNum=payload.sesionNum,
        totalSesiones=payload.totalSesiones,
        creadaEn=ahora,
        inicio=(ahora if payload.estado == "en_atencion" else None),
        fin=(ahora if payload.estado in {"completada", "no_asistio"} else None),
    )

    try:
        db.add(nueva_cita)
        db.flush()

        nuevo_pago = PagoDB(
            pacienteId=payload.pacienteId,
            citaId=nueva_cita.id,
            concepto=detalle_servicios["procedimiento"],
            fecha=payload.fecha,
            total=datos_pago["total"],
            cobrado=datos_pago["cobrado"],
            saldo=datos_pago["saldo"],
            metodo=datos_pago["metodo"],
            tipoPago=payload.tipoPago,
            cuotas=[],
            creadoEn=ahora,
            fechaUltPago=(payload.fecha if datos_pago["cobrado"] > 0 else None),
            nota=("Pago generado automáticamente desde la cita"),
            devuelto=0,
            creditoFavor=0,
        )

        db.add(nuevo_pago)
        db.commit()
        db.refresh(nueva_cita)
        db.refresh(nuevo_pago)

        return {
            "message": ("Cita y registro financiero creados correctamente."),
            "cita": serializar_modelo(nueva_cita),
            "pago": serializar_modelo(nuevo_pago),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=("No se pudo registrar la cita y su pago."),
        ) from error


@router.put("/api/operaciones/citas/{cita_id}", tags=["Citas"])
def actualizar_cita_con_pago(
    cita_id: int,
    payload: CitaPagoPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
        payload.estado,
        cita_excluida_id=cita_id,
    )

    pago = db.query(PagoDB).filter(PagoDB.citaId == cita_id).first()
    detalle_servicios = normalizar_servicios(payload)
    datos_pago = calcular_datos_pago(payload, detalle_servicios["costo_total"])
    ahora = ahora_iso()

    if pago and datos_pago["cobrado"] < redondear_monto(pago.cobrado):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes reducir un monto ya cobrado desde la cita. "
                "Primero debes revertir el cobro desde Finanzas."
            ),
        )

    cita.pacienteId = payload.pacienteId
    cita.planId = payload.planId
    cita.citaBaseId = payload.citaBaseId
    cita.fecha = payload.fecha
    cita.hora = payload.hora
    cita.horaFin = hora_fin_resuelta
    cita.duracionMinutos = duracion_resuelta
    cita.procedimiento = detalle_servicios["procedimiento"]
    cita.servicios = detalle_servicios["servicios"]
    cita.notas = payload.notas.strip()
    cita.costo = datos_pago["total"]
    cita.tipoPago = payload.tipoPago
    cita.estado = payload.estado
    cita.sesionNum = payload.sesionNum
    cita.totalSesiones = payload.totalSesiones

    if payload.estado == "en_atencion" and not cita.inicio:
        cita.inicio = ahora
    if payload.estado in {"completada", "no_asistio"} and not cita.fin:
        cita.fin = ahora

    try:
        if not pago:
            pago = PagoDB(
                pacienteId=payload.pacienteId,
                citaId=cita.id,
                cuotas=[],
                creadoEn=ahora,
                devuelto=0,
                creditoFavor=0,
            )
            db.add(pago)

        pago.pacienteId = payload.pacienteId
        pago.concepto = detalle_servicios["procedimiento"]
        pago.fecha = payload.fecha
        pago.total = datos_pago["total"]
        pago.cobrado = datos_pago["cobrado"]
        pago.saldo = datos_pago["saldo"]
        pago.metodo = datos_pago["metodo"]
        pago.tipoPago = payload.tipoPago
        pago.fechaUltPago = payload.fecha if datos_pago["cobrado"] > 0 else None

        db.commit()
        db.refresh(cita)
        db.refresh(pago)

        return {
            "message": "Cita y registro financiero actualizados correctamente.",
            "cita": serializar_modelo(cita),
            "pago": serializar_modelo(pago),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar la cita y su pago.",
        ) from error


@router.patch("/api/operaciones/citas/{cita_id}/reprogramar", tags=["Citas"])
def reprogramar_cita(
    cita_id: int,
    payload: ReprogramarCitaPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    if cita.estado not in ESTADOS_QUE_BLOQUEAN_HORARIO:
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden reprogramar citas activas.",
        )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
        cita.estado,
        cita_excluida_id=cita.id,
    )

    fecha_anterior = cita.fecha
    hora_anterior = cita.hora
    hora_fin_anterior = cita.horaFin or minutos_a_hora(
        convertir_hora_a_minutos(cita.hora or "00:00") + int(cita.duracionMinutos or 60)
    )
    cita.fecha = payload.fecha
    cita.hora = payload.hora
    cita.horaFin = hora_fin_resuelta
    cita.duracionMinutos = duracion_resuelta

    try:
        db.commit()
        db.refresh(cita)
        return {
            "message": (
                f"Cita reprogramada de {fecha_anterior} {hora_anterior} → {hora_fin_anterior} "
                f"a {payload.fecha} {payload.hora} → {hora_fin_resuelta}."
            ),
            "cita": serializar_modelo(cita),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo reprogramar la cita.",
        ) from error


@router.patch("/api/operaciones/citas/{cita_id}/estado", tags=["Citas"])
def cambiar_estado_cita(
    cita_id: int,
    payload: CambioEstadoPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    estado_actual = cita.estado or "pendiente"
    estado_nuevo = payload.estado

    if estado_actual == estado_nuevo:
        return {
            "message": "La cita ya se encontraba en ese estado.",
            "cita": serializar_modelo(cita),
        }

    permitidos = TRANSICIONES_ESTADO.get(estado_actual, set())
    if estado_nuevo not in permitidos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede cambiar una cita de '{estado_actual}' "
                f"a '{estado_nuevo}' desde esta acción."
            ),
        )

    if estado_nuevo == "en_atencion":
        validar_secuencia_sesion(db, cita)
        validar_disponibilidad(
            db,
            cita.fecha,
            cita.hora,
            cita.horaFin,
            int(cita.duracionMinutos or 60),
            estado_nuevo,
            cita_excluida_id=cita.id,
        )

    ahora = ahora_iso()
    cita.estado = estado_nuevo

    if estado_nuevo == "en_atencion":
        cita.inicio = ahora
        cita.fin = None
    elif estado_nuevo in {"completada", "no_asistio"}:
        cita.fin = ahora
    elif estado_nuevo == "cancelada":
        cita.canceladaEn = ahora
    elif estado_nuevo == "pendiente":
        cita.inicio = None
        cita.fin = None
        cita.canceladaEn = None
        cita.motivoCancelacion = None

    try:
        db.commit()
        db.refresh(cita)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el estado de la cita.",
        ) from error

    etiquetas = {
        "pendiente": "programada",
        "confirmada": "confirmada",
        "en_espera": "en espera",
        "en_atencion": "en atención",
        "completada": "atendida",
        "no_asistio": "registrada como inasistencia",
        "cancelada": "cancelada",
    }

    return {
        "message": f"La cita quedó {etiquetas.get(estado_nuevo, estado_nuevo)}.",
        "cita": serializar_modelo(cita),
    }


@router.delete("/api/operaciones/citas/{cita_id}", tags=["Citas"])
def eliminar_cita_con_pago(
    cita_id: int,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    pago = db.query(PagoDB).filter(PagoDB.citaId == cita_id).first()

    if pago and redondear_monto(pago.cobrado) > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Esta cita tiene dinero cobrado. Debes cancelarla o revertir "
                "el cobro; no puedes eliminarla."
            ),
        )

    if pago:
        plan_cuotas = db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == pago.id).first()
        if plan_cuotas:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Esta cita está relacionada con un plan de cuotas. "
                    "Primero debes cancelar ese plan."
                ),
            )

    try:
        if pago:
            db.delete(pago)
        db.delete(cita)
        db.commit()
        return {"message": "Cita y registro financiero eliminados correctamente."}
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar la cita.",
        ) from error
