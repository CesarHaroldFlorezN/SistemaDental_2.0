"""Rutas de pagos, cuentas y planes clínicos/financieros."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import (
    exigir_administrador,
    exigir_personal_clinico,
    exigir_personal_financiero,
)
from ..models import (
    CasoClinicoDB,
    MovimientoCuentaDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
    SesionPlanDB,
)
from ..schemas import OperacionPagoPayload, PlanTratamientoPayload
from ..services import (
    ahora_iso,
    anular_pago,
    construir_cuenta_paciente,
    crear_sesiones_plan,
    devolver_pago,
    obtener_caso_clinico,
    obtener_paciente,
    redondear_monto,
    registrar_pago,
    serializar_modelo,
    serializar_plan_detallado,
    sincronizar_plan_pago_con_pago,
    sincronizar_sesiones_plan,
)

router = APIRouter(tags=["Finanzas"])


def _listar_registros(
    modelo: type[Any],
    db: Session,
) -> list[dict[str, Any]]:
    registros = db.query(modelo).all()
    return [serializar_modelo(registro) for registro in registros]


def _crear_registro(
    modelo: type[Any],
    data: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    columnas_validas = {columna.name for columna in modelo.__table__.columns}

    datos_filtrados = {
        clave: valor
        for clave, valor in data.items()
        if clave in columnas_validas and clave != "id"
    }

    nuevo_registro = modelo(**datos_filtrados)

    try:
        db.add(nuevo_registro)
        db.commit()
        db.refresh(nuevo_registro)
        return serializar_modelo(nuevo_registro)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el registro.",
        ) from error


def _actualizar_registro(
    modelo: type[Any],
    item_id: int,
    data: dict[str, Any],
    db: Session,
) -> dict[str, Any]:
    registro = db.query(modelo).filter(modelo.id == item_id).first()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro no encontrado.",
        )

    columnas_validas = {columna.name for columna in modelo.__table__.columns}

    for clave, valor in data.items():
        if clave in columnas_validas and clave != "id":
            setattr(registro, clave, valor)

    try:
        db.commit()
        db.refresh(registro)
        return {
            "message": "Actualizado correctamente.",
            "registro": serializar_modelo(registro),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el registro.",
        ) from error


def _eliminar_registro(
    modelo: type[Any],
    item_id: int,
    db: Session,
) -> dict[str, str]:
    registro = db.query(modelo).filter(modelo.id == item_id).first()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro no encontrado.",
        )

    if (
        modelo is PagoDB
        and db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == item_id).first()
    ):
        raise HTTPException(
            status_code=409,
            detail=("No puedes eliminar un pago vinculado a un plan de cuotas."),
        )

    try:
        db.delete(registro)
        db.commit()
        return {
            "message": "Eliminado correctamente.",
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el registro.",
        ) from error


# =====================================================
# PAGOS
# =====================================================


@router.get(
    "/api/pagos",
    dependencies=[Depends(exigir_personal_financiero)],
)
def listar_pagos(
    db: Session = Depends(get_db),
):
    return _listar_registros(PagoDB, db)


@router.post(
    "/api/pagos",
    dependencies=[Depends(exigir_personal_financiero)],
)
def crear_pago(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _crear_registro(PagoDB, data, db)


@router.put(
    "/api/pagos/{item_id}",
    dependencies=[Depends(exigir_personal_financiero)],
)
def actualizar_pago(
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    pago = db.query(PagoDB).filter(PagoDB.id == item_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    plan_pago = db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == item_id).first()
    if plan_pago:
        columnas_validas = {columna.name for columna in PagoDB.__table__.columns}
        campos_calculados = {"cobrado", "saldo", "cuotas", "tipoPago", "fechaUltPago"}
        for clave, valor in data.items():
            if clave in columnas_validas and clave not in campos_calculados | {"id"}:
                setattr(pago, clave, valor)

        try:
            sincronizar_plan_pago_con_pago(db, pago)
            db.commit()
            db.refresh(pago)
            db.refresh(plan_pago)
            return {
                "message": "Pago y plan de cuotas actualizados correctamente.",
                "registro": serializar_modelo(pago),
                "planPago": serializar_modelo(plan_pago),
            }
        except HTTPException:
            db.rollback()
            raise
        except Exception as error:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No se pudo sincronizar el pago con su plan de cuotas.",
            ) from error

    return _actualizar_registro(
        PagoDB,
        item_id,
        data,
        db,
    )


@router.delete(
    "/api/pagos/{item_id}",
    dependencies=[Depends(exigir_administrador)],
)
def eliminar_pago(
    item_id: int,
    db: Session = Depends(get_db),
):
    return _eliminar_registro(
        PagoDB,
        item_id,
        db,
    )


# =====================================================
# PLANES DE TRATAMIENTO
# =====================================================


@router.get(
    "/api/planes",
    dependencies=[Depends(exigir_personal_clinico)],
)
def listar_planes(
    db: Session = Depends(get_db),
):
    planes = db.query(PlanDB).order_by(PlanDB.id.desc()).all()
    return [serializar_plan_detallado(db, plan) for plan in planes]


@router.post(
    "/api/planes",
    dependencies=[Depends(exigir_personal_clinico)],
)
def crear_plan(
    payload: PlanTratamientoPayload,
    db: Session = Depends(get_db),
):
    obtener_paciente(db, payload.pacienteId)
    caso = obtener_caso_clinico(db, payload.casoClinicoId, payload.pacienteId)
    ahora = ahora_iso()

    if not caso:
        caso = CasoClinicoDB(
            pacienteId=payload.pacienteId,
            titulo=payload.nombre.strip(),
            tipo="tratamiento",
            motivoConsulta=payload.descripcion.strip(),
            diagnostico="",
            estado="en_tratamiento",
            creadoEn=ahora,
            actualizadoEn=ahora,
        )
        db.add(caso)
        db.flush()

    plan = PlanDB(
        pacienteId=payload.pacienteId,
        casoClinicoId=caso.id,
        nombre=payload.nombre.strip(),
        tipo=payload.tipo.strip(),
        duracion=payload.duracion.strip(),
        costo=redondear_monto(payload.costo),
        nSesiones=payload.nSesiones,
        descripcion=payload.descripcion.strip(),
        estado=payload.estado,
        creadoEn=ahora,
    )

    try:
        db.add(plan)
        db.flush()
        caso.planId = plan.id
        caso.estado = "en_tratamiento"
        caso.actualizadoEn = ahora
        crear_sesiones_plan(db, plan, payload.nSesiones)

        if redondear_monto(payload.costo) > Decimal("0.00"):
            pago = PagoDB(
                pacienteId=payload.pacienteId,
                casoClinicoId=caso.id,
                planId=plan.id,
                citaId=None,
                concepto=plan.nombre,
                fecha=ahora[:10],
                total=redondear_monto(payload.costo),
                cobrado=0,
                saldo=redondear_monto(payload.costo),
                metodo="Pendiente",
                tipoPago="contado",
                servicios=[
                    {
                        "nombre": plan.nombre,
                        "costo": float(redondear_monto(payload.costo)),
                        "origen": "plan_tratamiento",
                    }
                ],
                cuotas=[],
                creadoEn=ahora,
                nota="Cargo generado desde el plan de tratamiento",
                devuelto=0,
                creditoFavor=0,
            )
            db.add(pago)
            db.flush()
            plan.pagoId = pago.id

        db.commit()
        db.refresh(plan)
        return serializar_plan_detallado(db, plan)
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo crear el plan clínico y sus sesiones.",
        ) from error


@router.put(
    "/api/planes/{item_id}",
    dependencies=[Depends(exigir_personal_clinico)],
)
def actualizar_plan(
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    plan = db.query(PlanDB).filter(PlanDB.id == item_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")
    datos_actuales = {
        "pacienteId": plan.pacienteId,
        "casoClinicoId": plan.casoClinicoId,
        "nombre": plan.nombre or "Plan de tratamiento",
        "tipo": plan.tipo or "Tratamiento",
        "duracion": plan.duracion or "",
        "costo": plan.costo or 0,
        "nSesiones": plan.nSesiones or 1,
        "descripcion": plan.descripcion or "",
        "estado": plan.estado or "activo",
    }
    datos_actuales.update(data)
    payload = PlanTratamientoPayload.model_validate(datos_actuales)

    if int(plan.pacienteId or 0) != int(payload.pacienteId):
        raise HTTPException(
            status_code=400,
            detail="No puedes cambiar el paciente de un plan existente.",
        )

    pago = None
    if plan.pagoId:
        pago = db.query(PagoDB).filter(PagoDB.id == plan.pagoId).first()
    plan_pago = db.query(PlanPagoDB).filter(PlanPagoDB.planId == plan.id).first()
    if plan_pago and int(payload.nSesiones) != int(plan.nSesiones or 1):
        raise HTTPException(
            status_code=409,
            detail=(
                "No puedes cambiar el número de sesiones mientras exista un "
                "cronograma de cuotas vinculado."
            ),
        )
    nuevo_costo = redondear_monto(payload.costo)
    if pago and redondear_monto(pago.cobrado) > nuevo_costo:
        raise HTTPException(
            status_code=409,
            detail="El costo no puede quedar por debajo de lo ya cobrado.",
        )

    plan.nombre = payload.nombre.strip()
    plan.tipo = payload.tipo.strip()
    plan.duracion = payload.duracion.strip()
    plan.costo = nuevo_costo
    plan.nSesiones = payload.nSesiones
    plan.descripcion = payload.descripcion.strip()
    plan.estado = payload.estado

    try:
        sincronizar_sesiones_plan(db, plan, payload.nSesiones)
        if pago and nuevo_costo == Decimal("0.00"):
            if plan_pago:
                raise HTTPException(
                    status_code=409,
                    detail="Primero debes eliminar el cronograma de cuotas vinculado.",
                )
            db.delete(pago)
            plan.pagoId = None
        elif pago:
            pago.concepto = plan.nombre
            pago.servicios = [
                {
                    "nombre": plan.nombre,
                    "costo": float(nuevo_costo),
                    "origen": "plan_tratamiento",
                }
            ]
            pago.total = nuevo_costo
            pago.saldo = redondear_monto(nuevo_costo - redondear_monto(pago.cobrado))
        elif nuevo_costo > Decimal("0.00"):
            pago = PagoDB(
                pacienteId=plan.pacienteId,
                casoClinicoId=plan.casoClinicoId,
                planId=plan.id,
                citaId=None,
                concepto=plan.nombre,
                fecha=ahora_iso()[:10],
                total=nuevo_costo,
                cobrado=0,
                saldo=nuevo_costo,
                metodo="Pendiente",
                tipoPago="contado",
                servicios=[
                    {
                        "nombre": plan.nombre,
                        "costo": float(nuevo_costo),
                        "origen": "plan_tratamiento",
                    }
                ],
                cuotas=[],
                creadoEn=ahora_iso(),
                nota="Cargo generado desde el plan de tratamiento",
                devuelto=0,
                creditoFavor=0,
            )
            db.add(pago)
            db.flush()
            plan.pagoId = pago.id
        caso = obtener_caso_clinico(db, plan.casoClinicoId, plan.pacienteId)
        if caso:
            caso.titulo = plan.nombre
            caso.estado = "cerrado" if plan.estado == "completado" else "en_tratamiento"
            caso.actualizadoEn = ahora_iso()
        db.commit()
        db.refresh(plan)
        return {
            "message": "Plan actualizado correctamente.",
            "registro": serializar_plan_detallado(db, plan),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="No se pudo actualizar el plan."
        ) from error


@router.delete(
    "/api/planes/{item_id}",
    dependencies=[Depends(exigir_personal_clinico)],
)
def eliminar_plan(
    item_id: int,
    db: Session = Depends(get_db),
):
    plan = db.query(PlanDB).filter(PlanDB.id == item_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")
    sesiones = db.query(SesionPlanDB).filter(SesionPlanDB.planId == item_id).all()
    if any(sesion.citaId or sesion.estado == "completada" for sesion in sesiones):
        raise HTTPException(
            status_code=409,
            detail="No puedes eliminar un plan con sesiones agendadas o completadas.",
        )
    plan_pago = db.query(PlanPagoDB).filter(PlanPagoDB.planId == item_id).first()
    if plan_pago:
        raise HTTPException(
            status_code=409,
            detail="Primero debes cerrar o eliminar el plan de pagos vinculado.",
        )
    pago = (
        db.query(PagoDB).filter(PagoDB.id == plan.pagoId).first()
        if plan.pagoId
        else None
    )
    if pago and redondear_monto(pago.cobrado) > 0:
        raise HTTPException(
            status_code=409,
            detail="El plan tiene pagos registrados y debe conservarse por trazabilidad.",
        )
    try:
        for sesion in sesiones:
            db.delete(sesion)
        if pago:
            db.delete(pago)
        caso = obtener_caso_clinico(db, plan.casoClinicoId, plan.pacienteId)
        if caso:
            caso.planId = None
            caso.estado = "abierto"
            caso.actualizadoEn = ahora_iso()
        db.delete(plan)
        db.commit()
        return {"message": "Plan eliminado correctamente."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="No se pudo eliminar el plan."
        ) from error


# =====================================================
# PLANES DE PAGO
# =====================================================


@router.get(
    "/api/planPagos",
    dependencies=[Depends(exigir_personal_financiero)],
)
def listar_planes_pago(
    db: Session = Depends(get_db),
):
    return _listar_registros(PlanPagoDB, db)


@router.post(
    "/api/planPagos",
    dependencies=[Depends(exigir_personal_financiero)],
)
def crear_plan_pago(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    paciente_id = int(data.get("pacienteId") or 0)
    pago_id = int(data.get("pagoId") or 0)
    plan_id = int(data.get("planId") or 0)
    obtener_paciente(db, paciente_id)

    pago = db.query(PagoDB).filter(PagoDB.id == pago_id).first() if pago_id else None
    plan = db.query(PlanDB).filter(PlanDB.id == plan_id).first() if plan_id else None
    if not pago:
        raise HTTPException(
            status_code=400,
            detail="Selecciona una deuda existente para crear el plan de pagos.",
        )
    if redondear_monto(pago.saldo) <= Decimal("0.00"):
        raise HTTPException(
            status_code=409,
            detail="La deuda seleccionada ya no tiene saldo por financiar.",
        )
    if pago and int(pago.pacienteId or 0) != paciente_id:
        raise HTTPException(
            status_code=400, detail="La deuda no pertenece al paciente."
        )
    if plan and int(plan.pacienteId or 0) != paciente_id:
        raise HTTPException(status_code=400, detail="El plan no pertenece al paciente.")
    if pago and db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == pago.id).first():
        raise HTTPException(
            status_code=409, detail="La deuda ya tiene un plan de pagos."
        )
    if plan and int(pago.planId or 0) != int(plan.id):
        raise HTTPException(
            status_code=400,
            detail="La deuda no corresponde al plan de tratamiento seleccionado.",
        )

    cuotas = data.get("cuotas") or []
    if plan:
        sesiones = (
            db.query(SesionPlanDB)
            .filter(SesionPlanDB.planId == plan.id)
            .order_by(SesionPlanDB.numero)
            .all()
        )
        cuotas_reales = [cuota for cuota in cuotas if cuota.get("tipo") == "cuota"]
        if len(cuotas_reales) != int(plan.nSesiones or 1):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El plan clínico tiene {plan.nSesiones} sesiones y debe "
                    f"tener exactamente {plan.nSesiones} cuotas."
                ),
            )
        ids_esperados = [int(sesion.id) for sesion in sesiones]
        ids_recibidos = [int(cuota.get("sesionPlanId") or 0) for cuota in cuotas_reales]
        if ids_recibidos != ids_esperados:
            raise HTTPException(
                status_code=400,
                detail="Cada cuota debe estar vinculada a su sesión correspondiente.",
            )

    if cuotas:
        suma_cuotas = redondear_monto(
            sum(
                (Decimal(str(cuota.get("monto") or 0)) for cuota in cuotas),
                start=Decimal("0.00"),
            )
        )
        if suma_cuotas != redondear_monto(pago.saldo):
            raise HTTPException(
                status_code=400,
                detail="La suma de las cuotas debe coincidir con el saldo pendiente.",
            )

    columnas_validas = {columna.name for columna in PlanPagoDB.__table__.columns}
    datos = {
        clave: valor
        for clave, valor in data.items()
        if clave in columnas_validas and clave != "id"
    }
    datos["casoClinicoId"] = data.get("casoClinicoId") or (
        plan.casoClinicoId if plan else (pago.casoClinicoId if pago else None)
    )
    datos["planId"] = plan.id if plan else None
    datos["pagoId"] = pago.id
    datos["citaId"] = pago.citaId
    datos["origen"] = "plan_tratamiento" if plan else "procedimiento"
    datos["totalAcordado"] = redondear_monto(pago.total)
    datos["anticipo"] = redondear_monto(pago.cobrado)
    datos["totalCuotas"] = redondear_monto(pago.saldo)
    datos["cobrado"] = redondear_monto(pago.cobrado)
    datos["saldo"] = redondear_monto(pago.saldo)
    datos["cuotas"] = cuotas
    datos["creadoEn"] = data.get("creadoEn") or ahora_iso()
    nuevo_plan = PlanPagoDB(**datos)

    try:
        db.add(nuevo_plan)
        if pago:
            pago.tipoPago = "cuotas"
            pago.cuotas = data.get("cuotas") or []
        db.commit()
        db.refresh(nuevo_plan)
        return serializar_modelo(nuevo_plan)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo crear el plan de pagos vinculado.",
        ) from error


@router.post(
    "/api/planPagos/{item_id}/adelantos",
    dependencies=[Depends(exigir_personal_financiero)],
)
def registrar_adelanto_plan_pago(
    item_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    """Registra un adelanto separado y redistribuye solo las cuotas pendientes."""

    registro = db.query(PlanPagoDB).filter(PlanPagoDB.id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado.")
    pago = db.query(PagoDB).filter(PagoDB.id == registro.pagoId).first()
    if not pago:
        raise HTTPException(
            status_code=409, detail="El plan no conserva su deuda de origen."
        )

    monto = redondear_monto(payload.monto)
    saldo_actual = redondear_monto(registro.saldo)
    if monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail="El adelanto no puede superar el saldo pendiente.",
        )

    cuotas = [dict(cuota) for cuota in (registro.cuotas or [])]
    pendientes = [
        indice
        for indice, cuota in enumerate(cuotas)
        if cuota.get("tipo") == "cuota" and not cuota.get("pagado")
    ]
    nuevo_anticipo = redondear_monto(redondear_monto(registro.anticipo) + monto)
    pagado_cuotas = redondear_monto(
        sum(
            (
                Decimal(str(cuota.get("monto") or 0))
                for cuota in cuotas
                if cuota.get("pagado")
            ),
            start=Decimal("0.00"),
        )
    )
    nuevo_saldo = redondear_monto(
        max(
            Decimal("0.00"),
            redondear_monto(registro.totalAcordado) - nuevo_anticipo - pagado_cuotas,
        )
    )
    if nuevo_saldo > Decimal("0.00") and not pendientes:
        raise HTTPException(
            status_code=409,
            detail="No hay cuotas pendientes donde redistribuir el saldo.",
        )

    if pendientes:
        centavos = int(nuevo_saldo * 100)
        base, sobrante = divmod(centavos, len(pendientes))
        for posicion, indice in enumerate(pendientes):
            monto_cuota = float(
                Decimal(base + (1 if posicion < sobrante else 0)) / Decimal(100)
            )
            cuotas[indice]["monto"] = monto_cuota
            cuotas[indice]["cubiertaPorAdelanto"] = monto_cuota <= 0

    nuevo_cobrado = redondear_monto(nuevo_anticipo + pagado_cuotas)
    registro.anticipo = nuevo_anticipo
    registro.cobrado = nuevo_cobrado
    registro.saldo = nuevo_saldo
    registro.cuotas = cuotas
    registro.totalCuotas = redondear_monto(
        sum(
            (Decimal(str(cuota.get("monto") or 0)) for cuota in cuotas),
            start=Decimal("0.00"),
        )
    )
    registro.estado = "completado" if nuevo_saldo <= Decimal("0.00") else "activo"

    pago.cobrado = nuevo_cobrado
    pago.saldo = nuevo_saldo
    pago.cuotas = cuotas
    pago.fechaUltPago = ahora_iso()[:10]
    pago.tipoPago = "completo" if nuevo_saldo <= Decimal("0.00") else "cuotas"
    db.add(
        MovimientoCuentaDB(
            pacienteId=pago.pacienteId,
            casoClinicoId=pago.casoClinicoId,
            planId=pago.planId,
            citaId=pago.citaId,
            pagoId=pago.id,
            tipo="adelanto_plan",
            descripcion=f"Adelanto del plan: {pago.concepto or 'Atención dental'}",
            cargo=0,
            abono=monto,
            fecha=ahora_iso()[:10],
            metodo=payload.metodo,
            referencia=payload.referencia,
            motivo=payload.motivo or "Adelanto registrado en el plan de pagos",
            usuario=payload.usuario,
            creadoEn=ahora_iso(),
        )
    )

    try:
        db.commit()
        db.refresh(registro)
        return {
            "message": "Adelanto registrado y cuotas pendientes recalculadas.",
            "registro": serializar_modelo(registro),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo registrar el adelanto.",
        ) from error


@router.put(
    "/api/planPagos/{item_id}",
    dependencies=[Depends(exigir_personal_financiero)],
)
def actualizar_plan_pago(
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    registro = db.query(PlanPagoDB).filter(PlanPagoDB.id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado.")

    for campo in ("pacienteId", "casoClinicoId", "planId", "pagoId", "citaId"):
        if campo in data and int(data.get(campo) or 0) != int(
            getattr(registro, campo) or 0
        ):
            raise HTTPException(
                status_code=400,
                detail="No se puede cambiar el origen clínico de un plan de pagos.",
            )

    cuotas_anteriores = [dict(cuota) for cuota in (registro.cuotas or [])]
    cuotas = [dict(cuota) for cuota in (data.get("cuotas", cuotas_anteriores) or [])]

    def clave_cuota(cuota: dict[str, Any], posicion: int) -> tuple[str, int, int]:
        return (
            str(cuota.get("tipo") or "cuota"),
            int(cuota.get("sesionPlanId") or 0),
            int(cuota.get("num") or posicion + 1),
        )

    anteriores_por_clave = {
        clave_cuota(cuota, posicion): cuota
        for posicion, cuota in enumerate(cuotas_anteriores)
    }
    nuevas_por_clave = {
        clave_cuota(cuota, posicion): cuota for posicion, cuota in enumerate(cuotas)
    }
    if len(anteriores_por_clave) != len(cuotas_anteriores) or len(
        nuevas_por_clave
    ) != len(cuotas):
        raise HTTPException(
            status_code=400,
            detail="El cronograma contiene cuotas duplicadas.",
        )

    for clave, cuota_anterior in anteriores_por_clave.items():
        if cuota_anterior.get("pagado") and clave not in nuevas_por_clave:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar una cuota que ya fue pagada.",
            )
    for clave, cuota_nueva in nuevas_por_clave.items():
        if cuota_nueva.get("pagado") and clave not in anteriores_por_clave:
            raise HTTPException(
                status_code=400,
                detail="Una cuota nueva debe registrarse primero como pendiente.",
            )

    cambios_estado = [
        (anteriores_por_clave[clave], nuevas_por_clave[clave])
        for clave in anteriores_por_clave.keys() & nuevas_por_clave.keys()
        if bool(anteriores_por_clave[clave].get("pagado"))
        != bool(nuevas_por_clave[clave].get("pagado"))
    ]
    if len(cambios_estado) > 1:
        raise HTTPException(
            status_code=400,
            detail="Registra o revierte una sola cuota por operación.",
        )

    montos_modificados = any(
        redondear_monto(anteriores_por_clave[clave].get("monto"))
        != redondear_monto(nuevas_por_clave[clave].get("monto"))
        for clave in anteriores_por_clave.keys() & nuevas_por_clave.keys()
    )
    if cambios_estado and (
        montos_modificados or anteriores_por_clave.keys() != nuevas_por_clave.keys()
    ):
        raise HTTPException(
            status_code=400,
            detail="No se puede modificar el cronograma mientras se registra un pago.",
        )

    if registro.planId:
        plan = db.query(PlanDB).filter(PlanDB.id == registro.planId).first()
        sesiones = (
            db.query(SesionPlanDB)
            .filter(SesionPlanDB.planId == registro.planId)
            .order_by(SesionPlanDB.numero)
            .all()
        )
        cuotas_reales = [cuota for cuota in cuotas if cuota.get("tipo") == "cuota"]
        if not plan or len(cuotas_reales) != int(plan.nSesiones or 1):
            raise HTTPException(
                status_code=400,
                detail="Un plan de tratamiento debe conservar una cuota por sesión.",
            )
        if [int(cuota.get("sesionPlanId") or 0) for cuota in cuotas_reales] != [
            int(sesion.id) for sesion in sesiones
        ] or [int(cuota.get("num") or 0) for cuota in cuotas_reales] != [
            int(sesion.numero) for sesion in sesiones
        ]:
            raise HTTPException(
                status_code=400,
                detail="No se puede romper el vínculo entre cuotas y sesiones.",
            )
        if montos_modificados:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Los montos de un plan de tratamiento solo cambian "
                    "mediante un adelanto."
                ),
            )

    total = redondear_monto(registro.totalAcordado)
    anticipo = redondear_monto(registro.anticipo)
    total_programado = redondear_monto(
        sum(
            (
                Decimal(str(cuota.get("monto") or 0))
                for cuota in cuotas
                if cuota.get("tipo") == "cuota"
            ),
            start=Decimal("0.00"),
        )
    )
    total_financiado = redondear_monto(max(Decimal("0.00"), total - anticipo))
    if cuotas and total_programado != total_financiado:
        raise HTTPException(
            status_code=400,
            detail=(
                "La suma de las cuotas debe coincidir con el monto "
                "financiado pendiente del anticipo."
            ),
        )

    pagado_cuotas = redondear_monto(
        sum(
            (
                Decimal(str(cuota.get("monto") or 0))
                for cuota in cuotas
                if cuota.get("tipo") == "cuota" and cuota.get("pagado")
            ),
            start=Decimal("0.00"),
        )
    )
    nuevo_cobrado = redondear_monto(min(total, anticipo + pagado_cuotas))
    saldo = redondear_monto(max(Decimal("0.00"), total - nuevo_cobrado))
    cobrado_anterior = redondear_monto(registro.cobrado)

    registro.cuotas = cuotas
    registro.totalCuotas = total_programado
    registro.cobrado = nuevo_cobrado
    registro.saldo = saldo
    if "concepto" in data:
        registro.concepto = str(data.get("concepto") or "").strip()
    if "metodoPreferido" in data:
        registro.metodoPreferido = str(data.get("metodoPreferido") or "").strip()
    if "fechaCreacion" in data:
        registro.fechaCreacion = str(data.get("fechaCreacion") or "").strip()
    registro.estado = (
        "completado"
        if saldo <= Decimal("0.00")
        else str(data.get("estado", "activo") or "activo")
    )

    pago = (
        db.query(PagoDB).filter(PagoDB.id == registro.pagoId).first()
        if registro.pagoId
        else None
    )
    diferencia = redondear_monto(nuevo_cobrado - cobrado_anterior)
    if pago:
        pago.cobrado = nuevo_cobrado
        pago.saldo = saldo
        pago.cuotas = cuotas
        pago.fechaUltPago = ahora_iso()[:10] if diferencia > 0 else pago.fechaUltPago
        pago.tipoPago = "completo" if saldo <= Decimal("0.00") else "cuotas"

    if pago and diferencia != Decimal("0.00"):
        if not cambios_estado:
            raise HTTPException(
                status_code=400,
                detail="No se pudo identificar la cuota modificada.",
            )
        cuota_anterior, cuota_nueva = cambios_estado[0]
        cuota_cambiada = cuota_nueva if diferencia > 0 else cuota_anterior
        db.add(
            MovimientoCuentaDB(
                pacienteId=pago.pacienteId,
                casoClinicoId=pago.casoClinicoId,
                planId=pago.planId,
                citaId=pago.citaId,
                pagoId=pago.id,
                tipo="pago_cuota" if diferencia > 0 else "anulacion_cuota",
                descripcion=(
                    f"{'Pago' if diferencia > 0 else 'Reversión'} de cuota "
                    f"{cuota_cambiada.get('num') or ''}"
                    f"{' · sesión ' + str(cuota_cambiada.get('sesionNum')) if cuota_cambiada.get('sesionNum') else ''}: "
                    f"{pago.concepto or 'Atención dental'}"
                ).strip(),
                cargo=abs(diferencia) if diferencia < 0 else 0,
                abono=max(Decimal("0.00"), diferencia),
                fecha=ahora_iso()[:10],
                metodo=cuota_cambiada.get("metodoPago") or "Pago de cuota",
                referencia=cuota_cambiada.get("referencia") or "",
                motivo="Movimiento generado desde el cronograma de cuotas",
                usuario="Administrador",
                creadoEn=ahora_iso(),
            )
        )

    try:
        db.commit()
        db.refresh(registro)
        return {
            "message": "Plan de pagos actualizado correctamente.",
            "registro": serializar_modelo(registro),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el plan de pagos.",
        ) from error


@router.delete(
    "/api/planPagos/{item_id}",
    dependencies=[Depends(exigir_administrador)],
)
def eliminar_plan_pago(
    item_id: int,
    db: Session = Depends(get_db),
):
    registro = db.query(PlanPagoDB).filter(PlanPagoDB.id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Plan de pagos no encontrado.")

    pago = (
        db.query(PagoDB).filter(PagoDB.id == registro.pagoId).first()
        if registro.pagoId
        else None
    )
    try:
        db.delete(registro)
        if pago:
            pago.cuotas = []
            saldo = redondear_monto(pago.saldo)
            cobrado = redondear_monto(pago.cobrado)
            pago.tipoPago = (
                "completo"
                if saldo <= Decimal("0.00")
                else ("anticipo" if cobrado > Decimal("0.00") else "contado")
            )
        db.commit()
        return {
            "message": (
                "Plan eliminado. La deuda y los cobros registrados se conservaron."
            )
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el plan de pagos.",
        ) from error


# =====================================================
# MOVIMIENTOS DE CUENTA
# =====================================================


@router.get(
    "/api/movimientosCuenta",
    dependencies=[Depends(exigir_personal_financiero)],
)
def listar_movimientos_cuenta(
    db: Session = Depends(get_db),
):
    return _listar_registros(
        MovimientoCuentaDB,
        db,
    )


@router.post(
    "/api/movimientosCuenta",
    dependencies=[Depends(exigir_personal_financiero)],
)
def crear_movimiento_cuenta(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _crear_registro(
        MovimientoCuentaDB,
        data,
        db,
    )


@router.put(
    "/api/movimientosCuenta/{item_id}",
    dependencies=[Depends(exigir_personal_financiero)],
)
def impedir_actualizacion_movimiento(
    item_id: int,
):
    _ = item_id

    raise HTTPException(
        status_code=405,
        detail=(
            "El historial financiero es inmutable. Usa una anulación o devolución."
        ),
    )


@router.delete(
    "/api/movimientosCuenta/{item_id}",
    dependencies=[Depends(exigir_personal_financiero)],
)
def impedir_eliminacion_movimiento(
    item_id: int,
):
    _ = item_id

    raise HTTPException(
        status_code=405,
        detail=(
            "El historial financiero es inmutable. Usa una anulación o devolución."
        ),
    )


# =====================================================
# OPERACIONES FINANCIERAS AUDITABLES
# =====================================================


@router.post(
    "/api/operaciones/pagos/{pago_id}/registrar",
    dependencies=[Depends(exigir_personal_financiero)],
)
def registrar_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return registrar_pago(db, pago_id, payload)


@router.post(
    "/api/operaciones/pagos/{pago_id}/anular",
    dependencies=[Depends(exigir_administrador)],
)
def anular_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return anular_pago(db, pago_id, payload)


@router.post(
    "/api/operaciones/pagos/{pago_id}/devolver",
    dependencies=[Depends(exigir_administrador)],
)
def devolver_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return devolver_pago(db, pago_id, payload)


@router.get(
    "/api/pacientes/{paciente_id}/cuenta",
    dependencies=[Depends(exigir_personal_financiero)],
)
def obtener_cuenta_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
):
    return construir_cuenta_paciente(
        db,
        paciente_id,
    )
