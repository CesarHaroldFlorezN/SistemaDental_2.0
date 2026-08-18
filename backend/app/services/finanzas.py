from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    MovimientoCuentaDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
    SesionPlanDB,
)
from ..schemas import OperacionPagoPayload
from .citas import obtener_paciente
from .comun import ahora_iso, redondear_monto, serializar_modelo

CERO = Decimal("0.00")


def _total_cuotas_pagadas(cuotas: list[dict]) -> Decimal:
    total = CERO
    for cuota in cuotas:
        if cuota.get("tipo") == "cuota":
            if cuota.get("pagado"):
                total += Decimal(str(cuota.get("monto") or 0))
            elif cuota.get("pagadoParcial"):
                total += Decimal(str(cuota.get("montoPagado") or 0))
    return redondear_monto(total)


def _redistribuir_saldo_pendiente(
    cuotas: list[dict],
    saldo: Decimal,
) -> list[dict]:
    pendientes_puras = [
        indice
        for indice, cuota in enumerate(cuotas)
        if cuota.get("tipo") == "cuota" and not cuota.get("pagado") and not cuota.get("pagadoParcial")
    ]
    
    # En esta lógica, el "monto" de una cuota parcial ES su remanente exacto
    saldo_parciales = sum(
        Decimal(str(c.get("monto") or 0))
        for c in cuotas
        if c.get("tipo") == "cuota" and c.get("pagadoParcial")
    )
    
    saldo_a_redistribuir = saldo - saldo_parciales

    if not pendientes_puras:
        return cuotas

    centavos = int(redondear_monto(saldo_a_redistribuir) * 100)
    base, sobrante = divmod(centavos, len(pendientes_puras))
    for posicion, indice in enumerate(pendientes_puras):
        monto = Decimal(base + (1 if posicion < sobrante else 0)) / Decimal(100)
        cuotas[indice]["monto"] = float(monto)
        cuotas[indice]["cubiertaPorAdelanto"] = monto <= CERO

    return cuotas


def _crear_cuota_pendiente(cuotas: list[dict], saldo: Decimal) -> None:
    numeros = [int(cuota.get("num") or 0) for cuota in cuotas if cuota.get("tipo") == "cuota"]
    fechas = [str(cuota.get("fecha")) for cuota in cuotas if cuota.get("tipo") == "cuota" and cuota.get("fecha")]
    fecha_base = datetime.now().astimezone().date()
    if fechas:
        try:
            fecha_base = datetime.fromisoformat(max(fechas)).date()
        except ValueError:
            pass

    cuotas.append({
        "num": max(numeros, default=0) + 1,
        "tipo": "cuota",
        "fecha": (fecha_base + timedelta(days=30)).isoformat(),
        "monto": float(redondear_monto(saldo)),
        "pagado": False,
        "pagadoParcial": False,
        "montoPagado": None,
        "fechaPago": None,
        "metodoPago": None,
        "cubiertaPorAdelanto": False,
    })


def sincronizar_cuotas_con_sesiones_plan(
    db: Session,
    plan: PlanDB,
    pago: PagoDB,
    sesiones: list[SesionPlanDB],
) -> PlanPagoDB | None:
    plan_pago = db.query(PlanPagoDB).filter(PlanPagoDB.planId == plan.id).first()
    if not plan_pago:
        return None

    cuotas_anteriores = [dict(cuota) for cuota in (plan_pago.cuotas or []) if cuota.get("tipo", "cuota") == "cuota"]
    por_sesion = {int(cuota.get("sesionPlanId") or 0): cuota for cuota in cuotas_anteriores if cuota.get("sesionPlanId")}
    por_numero = {int(cuota.get("sesionNum") or cuota.get("num") or 0): cuota for cuota in cuotas_anteriores}

    fechas = [str(cuota.get("fecha")) for cuota in cuotas_anteriores if cuota.get("fecha")]
    fecha_base = datetime.now().astimezone().date()
    if fechas:
        try:
            fecha_base = datetime.fromisoformat(max(fechas)).date()
        except ValueError:
            pass

    cuotas_nuevas: list[dict] = []
    sesiones_ordenadas = sorted(sesiones, key=lambda sesion: int(sesion.numero))
    for sesion in sesiones_ordenadas:
        numero = int(sesion.numero)
        cuota = por_sesion.get(int(sesion.id)) or por_numero.get(numero)
        if cuota:
            cuota = dict(cuota)
        else:
            fecha_base += timedelta(days=30)
            cuota = {
                "num": numero,
                "tipo": "cuota",
                "fecha": fecha_base.isoformat(),
                "monto": 0.0,
                "pagado": False,
                "pagadoParcial": False,
                "montoPagado": None,
                "fechaPago": None,
                "metodoPago": None,
                "cubiertaPorAdelanto": False,
            }

        cuota["num"] = numero
        cuota["tipo"] = "cuota"
        cuota["sesionPlanId"] = int(sesion.id)
        cuota["sesionNum"] = numero
        cuotas_nuevas.append(cuota)

    claves_validas = {int(sesion.id) for sesion in sesiones_ordenadas}
    numeros_validos = {int(sesion.numero) for sesion in sesiones_ordenadas}
    eliminadas_pagadas = [
        cuota for cuota in cuotas_anteriores
        if (cuota.get("pagado") or cuota.get("pagadoParcial"))
        and int(cuota.get("sesionPlanId") or 0) not in claves_validas
        and int(cuota.get("sesionNum") or cuota.get("num") or 0) not in numeros_validos
    ]
    if eliminadas_pagadas:
        raise HTTPException(
            status_code=409,
            detail="No se puede retirar una sesión cuya cuota ya tiene un pago registrado.",
        )

    plan_pago.cuotas = cuotas_nuevas
    pago.cuotas = cuotas_nuevas
    db.flush()
    return sincronizar_plan_pago_con_pago(db, pago)


def sincronizar_plan_pago_con_pago(db: Session, pago: PagoDB) -> PlanPagoDB | None:
    plan = db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == pago.id).first()
    if not plan:
        return None

    cuotas = [dict(cuota) for cuota in (plan.cuotas or [])]
    total = redondear_monto(pago.total)
    anticipo = redondear_monto(plan.anticipo)
    pagado_cuotas = _total_cuotas_pagadas(cuotas)

    cobrado_desglosado = redondear_monto(anticipo + pagado_cuotas)
    cobrado_registrado = max(cobrado_desglosado, redondear_monto(plan.cobrado), redondear_monto(pago.cobrado))
    if cobrado_registrado > cobrado_desglosado:
        anticipo = redondear_monto(anticipo + cobrado_registrado - cobrado_desglosado)
    cobrado = redondear_monto(anticipo + pagado_cuotas)

    if total < cobrado:
        raise HTTPException(
            status_code=409,
            detail="El nuevo total no puede ser menor que el monto ya cobrado. Primero revierte el cobro correspondiente."
        )

    saldo = redondear_monto(total - cobrado)
    pendientes = [c for c in cuotas if c.get("tipo") == "cuota" and not c.get("pagado") and not c.get("pagadoParcial")]
    if saldo > CERO and not pendientes:
        if plan.planId:
            raise HTTPException(status_code=409, detail="El plan clínico ya no tiene cuotas 100% pendientes.")
        _crear_cuota_pendiente(cuotas, saldo)

    cuotas = _redistribuir_saldo_pendiente(cuotas, saldo)
    
    # El costo programado suma el tamaño real (remanente + lo ya pagado)
    total_cuotas = redondear_monto(
        sum((Decimal(str(c.get("monto") or 0)) + Decimal(str(c.get("montoPagado") or 0))) for c in cuotas if c.get("tipo") == "cuota")
    )

    plan.concepto = pago.concepto or plan.concepto
    plan.totalAcordado = total
    plan.anticipo = anticipo
    plan.totalCuotas = total_cuotas
    plan.cobrado = cobrado
    plan.saldo = saldo
    plan.cuotas = cuotas
    plan.estado = "completado" if saldo <= CERO else "activo"

    pago.cobrado = cobrado
    pago.saldo = saldo
    pago.cuotas = cuotas
    pago.tipoPago = "completo" if saldo <= CERO else "cuotas"
    return plan


def _obtener_pago(db: Session, pago_id: int) -> PagoDB:
    pago = db.query(PagoDB).filter(PagoDB.id == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="El registro de pago no existe.")
    return pago

def _asegurar_sin_plan_de_cuotas(db: Session, pago: PagoDB) -> None:
    plan = db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == pago.id).first()
    if plan:
        raise HTTPException(status_code=409, detail="Este pago pertenece a un plan de cuotas.")

def _crear_movimiento(
    db: Session, pago: PagoDB, tipo: str, descripcion: str, cargo: Decimal | float = 0, abono: Decimal | float = 0,
    metodo: str = "", referencia: str = "", motivo: str = "", usuario: str = "Administrador"
) -> MovimientoCuentaDB:
    movimiento = MovimientoCuentaDB(
        pacienteId=pago.pacienteId, casoClinicoId=pago.casoClinicoId, planId=pago.planId, citaId=pago.citaId,
        pagoId=pago.id, tipo=tipo, descripcion=descripcion, cargo=redondear_monto(cargo), abono=redondear_monto(abono),
        fecha=(datetime.now().astimezone().date().isoformat()), metodo=metodo, referencia=referencia, motivo=motivo, usuario=usuario, creadoEn=ahora_iso()
    )
    db.add(movimiento)
    return movimiento

def registrar_pago(db: Session, pago_id: int, payload: OperacionPagoPayload):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)
    saldo = redondear_monto(pago.saldo)
    monto = redondear_monto(payload.monto)
    if monto > saldo:
        raise HTTPException(status_code=400, detail="El monto no puede superar el saldo pendiente.")
    pago.cobrado = redondear_monto(redondear_monto(pago.cobrado) + monto)
    pago.saldo = redondear_monto(max(CERO, redondear_monto(pago.total) - pago.cobrado))
    pago.metodo = payload.metodo.strip() or "Efectivo"
    pago.fechaUltPago = datetime.now().astimezone().date().isoformat()
    pago.tipoPago = "completo" if pago.saldo <= 0 else ("cuotas" if pago.tipoPago == "cuotas" else "anticipo")
    movimiento = _crear_movimiento(db=db, pago=pago, tipo="pago", descripcion=(f"Pago: {pago.concepto or 'Atención dental'}"), abono=monto, metodo=pago.metodo, referencia=payload.referencia, motivo=payload.motivo, usuario=payload.usuario)
    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)
    return {"message": "Pago registrado.", "pago": serializar_modelo(pago), "movimiento": serializar_modelo(movimiento)}

def anular_pago(db: Session, pago_id: int, payload: OperacionPagoPayload):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)
    monto = redondear_monto(payload.monto)
    cobrado = redondear_monto(pago.cobrado)
    if monto > cobrado:
        raise HTTPException(status_code=400, detail="No puedes anular más de lo que está cobrado.")
    if not payload.motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo de la anulación es obligatorio.")
    pago.cobrado = redondear_monto(cobrado - monto)
    pago.saldo = redondear_monto(max(CERO, redondear_monto(pago.total) - pago.cobrado))
    pago.tipoPago = "contado" if pago.cobrado <= 0 else "anticipo"
    movimiento = _crear_movimiento(db=db, pago=pago, tipo="anulacion", descripcion=(f"Anulación de pago: {pago.concepto or 'Atención dental'}"), cargo=monto, metodo=(payload.metodo.strip() or pago.metodo or "Pago"), referencia=payload.referencia, motivo=payload.motivo, usuario=payload.usuario)
    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)
    return {"message": "Pago anulado sin borrar el historial.", "pago": serializar_modelo(pago), "movimiento": serializar_modelo(movimiento)}

def devolver_pago(db: Session, pago_id: int, payload: OperacionPagoPayload):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)
    monto = redondear_monto(payload.monto)
    cobrado = redondear_monto(pago.cobrado)
    if monto > cobrado:
        raise HTTPException(status_code=400, detail="No puedes devolver más de lo que está cobrado.")
    if not payload.motivo.strip():
        raise HTTPException(status_code=400, detail="El motivo de la devolución es obligatorio.")
    pago.cobrado = redondear_monto(cobrado - monto)
    pago.saldo = redondear_monto(max(CERO, redondear_monto(pago.total) - pago.cobrado))
    pago.devuelto = redondear_monto(redondear_monto(pago.devuelto) + monto)
    pago.tipoPago = "contado" if pago.cobrado <= 0 else "anticipo"
    movimiento = _crear_movimiento(db=db, pago=pago, tipo="devolucion", descripcion=(f"Devolución: {pago.concepto or 'Atención dental'}"), cargo=monto, metodo=(payload.metodo.strip() or pago.metodo or "Pago"), referencia=payload.referencia, motivo=payload.motivo, usuario=payload.usuario)
    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)
    return {"message": "Devolución registrada.", "pago": serializar_modelo(pago), "movimiento": serializar_modelo(movimiento)}

def construir_cuenta_paciente(db: Session, paciente_id: int):
    obtener_paciente(db, paciente_id)
    pagos = db.query(PagoDB).filter(PagoDB.pacienteId == paciente_id).all()
    movimientos_db = db.query(MovimientoCuentaDB).filter(MovimientoCuentaDB.pacienteId == paciente_id).all()
    movimientos = []
    for pago in pagos:
        movimientos.append({"id": f"cargo-{pago.id}", "tipo": "cargo", "pagoId": pago.id, "fecha": (pago.fecha or (pago.creadoEn or "")[:10]), "creadoEn": pago.creadoEn or pago.fecha, "descripcion": (pago.concepto or "Atención dental"), "cargo": redondear_monto(pago.total), "abono": CERO, "metodo": "Cargo clínico", "orden": 0})
        vinculados = [movimiento for movimiento in movimientos_db if int(movimiento.pagoId or 0) == int(pago.id)]
        neto_registrado = sum((redondear_monto(movimiento.abono) - redondear_monto(movimiento.cargo) for movimiento in vinculados), start=CERO)
        legado = redondear_monto(max(CERO, redondear_monto(pago.cobrado) - neto_registrado))
        if legado > 0:
            movimientos.append({"id": f"legado-{pago.id}", "tipo": "pago_anterior", "pagoId": pago.id, "fecha": (pago.fechaUltPago or pago.fecha or (pago.creadoEn or "")[:10]), "creadoEn": pago.fechaUltPago or pago.creadoEn or pago.fecha, "descripcion": ("Pago registrado anteriormente: " + f"{pago.concepto or 'Atención dental'}"), "cargo": 0, "abono": legado, "metodo": pago.metodo or "Pago", "orden": 1})
    for movimiento in movimientos_db:
        item = serializar_modelo(movimiento)
        item["orden"] = 1
        movimientos.append(item)
    movimientos.sort(key=lambda item: (str(item.get("fecha") or ""), int(item.get("orden") or 0), str(item.get("creadoEn") or ""), str(item.get("id") or "")))
    saldo = CERO
    cargos = CERO
    abonos = CERO
    creditos = redondear_monto(sum((redondear_monto(pago.creditoFavor) for pago in pagos), start=CERO))
    for item in movimientos:
        cargo = redondear_monto(item.get("cargo"))
        abono = redondear_monto(item.get("abono"))
        cargos += cargo
        abonos += abono
        saldo = redondear_monto(saldo + cargo - abono)
        item["saldoAcumulado"] = max(CERO, saldo)
        item.pop("orden", None)
    return {"movimientos": movimientos, "resumen": {"cargos": redondear_monto(cargos), "abonos": redondear_monto(abonos), "saldo": redondear_monto(max(CERO, saldo)), "creditoFavor": creditos}}