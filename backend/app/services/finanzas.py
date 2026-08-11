from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    MovimientoCuentaDB,
    PagoDB,
    PlanPagoDB,
)
from ..schemas import OperacionPagoPayload
from .citas import obtener_paciente
from .comun import ahora_iso, redondear_monto, serializar_modelo

CERO = Decimal("0.00")


def _obtener_pago(
    db: Session,
    pago_id: int,
) -> PagoDB:
    pago = db.query(PagoDB).filter(PagoDB.id == pago_id).first()

    if not pago:
        raise HTTPException(
            status_code=404,
            detail="El registro de pago no existe.",
        )

    return pago


def _asegurar_sin_plan_de_cuotas(
    db: Session,
    pago: PagoDB,
) -> None:
    plan = db.query(PlanPagoDB).filter(PlanPagoDB.pagoId == pago.id).first()

    if plan:
        raise HTTPException(
            status_code=409,
            detail=(
                "Este pago pertenece a un plan de cuotas. "
                "Gestiona el movimiento desde Planes de pago "
                "para conservar el cronograma."
            ),
        )


def _crear_movimiento(
    db: Session,
    pago: PagoDB,
    tipo: str,
    descripcion: str,
    cargo: Decimal | float = 0,
    abono: Decimal | float = 0,
    metodo: str = "",
    referencia: str = "",
    motivo: str = "",
    usuario: str = "Administrador",
) -> MovimientoCuentaDB:
    movimiento = MovimientoCuentaDB(
        pacienteId=pago.pacienteId,
        citaId=pago.citaId,
        pagoId=pago.id,
        tipo=tipo,
        descripcion=descripcion,
        cargo=redondear_monto(cargo),
        abono=redondear_monto(abono),
        fecha=(datetime.now().astimezone().date().isoformat()),
        metodo=metodo,
        referencia=referencia,
        motivo=motivo,
        usuario=usuario,
        creadoEn=ahora_iso(),
    )

    db.add(movimiento)
    return movimiento


def registrar_pago(
    db: Session,
    pago_id: int,
    payload: OperacionPagoPayload,
):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)

    saldo = redondear_monto(pago.saldo)
    monto = redondear_monto(payload.monto)

    if monto > saldo:
        raise HTTPException(
            status_code=400,
            detail=("El monto no puede superar el saldo pendiente."),
        )

    pago.cobrado = redondear_monto(redondear_monto(pago.cobrado) + monto)
    pago.saldo = redondear_monto(
        max(
            CERO,
            redondear_monto(pago.total) - pago.cobrado,
        )
    )
    pago.metodo = payload.metodo.strip() or "Efectivo"
    pago.fechaUltPago = datetime.now().astimezone().date().isoformat()

    pago.tipoPago = (
        "completo"
        if pago.saldo <= 0
        else ("cuotas" if pago.tipoPago == "cuotas" else "anticipo")
    )

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="pago",
        descripcion=(f"Pago: {pago.concepto or 'Atención dental'}"),
        abono=monto,
        metodo=pago.metodo,
        referencia=payload.referencia,
        motivo=payload.motivo,
        usuario=payload.usuario,
    )

    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)

    return {
        "message": "Pago registrado.",
        "pago": serializar_modelo(pago),
        "movimiento": serializar_modelo(movimiento),
    }


def anular_pago(
    db: Session,
    pago_id: int,
    payload: OperacionPagoPayload,
):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)

    monto = redondear_monto(payload.monto)
    cobrado = redondear_monto(pago.cobrado)

    if monto > cobrado:
        raise HTTPException(
            status_code=400,
            detail=("No puedes anular más de lo que está cobrado."),
        )

    if not payload.motivo.strip():
        raise HTTPException(
            status_code=400,
            detail=("El motivo de la anulación es obligatorio."),
        )

    pago.cobrado = redondear_monto(cobrado - monto)
    pago.saldo = redondear_monto(
        max(
            CERO,
            redondear_monto(pago.total) - pago.cobrado,
        )
    )
    pago.tipoPago = "contado" if pago.cobrado <= 0 else "anticipo"

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="anulacion",
        descripcion=(f"Anulación de pago: {pago.concepto or 'Atención dental'}"),
        cargo=monto,
        metodo=(payload.metodo.strip() or pago.metodo or "Pago"),
        referencia=payload.referencia,
        motivo=payload.motivo,
        usuario=payload.usuario,
    )

    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)

    return {
        "message": ("Pago anulado sin borrar el historial."),
        "pago": serializar_modelo(pago),
        "movimiento": serializar_modelo(movimiento),
    }


def devolver_pago(
    db: Session,
    pago_id: int,
    payload: OperacionPagoPayload,
):
    pago = _obtener_pago(db, pago_id)
    _asegurar_sin_plan_de_cuotas(db, pago)

    monto = redondear_monto(payload.monto)
    cobrado = redondear_monto(pago.cobrado)

    if monto > cobrado:
        raise HTTPException(
            status_code=400,
            detail=("No puedes devolver más de lo que está cobrado."),
        )

    if not payload.motivo.strip():
        raise HTTPException(
            status_code=400,
            detail=("El motivo de la devolución es obligatorio."),
        )

    pago.cobrado = redondear_monto(cobrado - monto)
    pago.saldo = redondear_monto(
        max(
            CERO,
            redondear_monto(pago.total) - pago.cobrado,
        )
    )
    pago.devuelto = redondear_monto(redondear_monto(pago.devuelto) + monto)
    pago.tipoPago = "contado" if pago.cobrado <= 0 else "anticipo"

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="devolucion",
        descripcion=(f"Devolución: {pago.concepto or 'Atención dental'}"),
        cargo=monto,
        metodo=(payload.metodo.strip() or pago.metodo or "Pago"),
        referencia=payload.referencia,
        motivo=payload.motivo,
        usuario=payload.usuario,
    )

    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)

    return {
        "message": ("Devolución registrada sin borrar el pago original."),
        "pago": serializar_modelo(pago),
        "movimiento": serializar_modelo(movimiento),
    }


def construir_cuenta_paciente(
    db: Session,
    paciente_id: int,
):
    obtener_paciente(db, paciente_id)

    pagos = db.query(PagoDB).filter(PagoDB.pacienteId == paciente_id).all()
    movimientos_db = (
        db.query(MovimientoCuentaDB)
        .filter(MovimientoCuentaDB.pacienteId == paciente_id)
        .all()
    )
    movimientos = []

    for pago in pagos:
        movimientos.append(
            {
                "id": f"cargo-{pago.id}",
                "tipo": "cargo",
                "pagoId": pago.id,
                "fecha": (pago.fecha or (pago.creadoEn or "")[:10]),
                "descripcion": (pago.concepto or "Atención dental"),
                "cargo": redondear_monto(pago.total),
                "abono": CERO,
                "metodo": "Cargo clínico",
                "orden": 0,
            }
        )

        vinculados = [
            movimiento
            for movimiento in movimientos_db
            if int(movimiento.pagoId or 0) == int(pago.id)
        ]

        neto_registrado = sum(
            (
                redondear_monto(movimiento.abono) - redondear_monto(movimiento.cargo)
                for movimiento in vinculados
            ),
            start=CERO,
        )

        legado = redondear_monto(
            max(
                CERO,
                redondear_monto(pago.cobrado) - neto_registrado,
            )
        )

        if legado > 0:
            movimientos.append(
                {
                    "id": f"legado-{pago.id}",
                    "tipo": "pago_anterior",
                    "pagoId": pago.id,
                    "fecha": (
                        pago.fechaUltPago or pago.fecha or (pago.creadoEn or "")[:10]
                    ),
                    "descripcion": (
                        "Pago registrado anteriormente: "
                        f"{pago.concepto or 'Atención dental'}"
                    ),
                    "cargo": 0,
                    "abono": legado,
                    "metodo": pago.metodo or "Pago",
                    "orden": 1,
                }
            )

    for movimiento in movimientos_db:
        item = serializar_modelo(movimiento)
        item["orden"] = 1
        movimientos.append(item)

    movimientos.sort(
        key=lambda item: (
            str(item.get("fecha") or ""),
            int(item.get("orden") or 0),
            str(item.get("creadoEn") or ""),
            str(item.get("id") or ""),
        )
    )

    saldo = CERO
    cargos = CERO
    abonos = CERO
    creditos = redondear_monto(
        sum((redondear_monto(pago.creditoFavor) for pago in pagos), start=CERO)
    )

    for item in movimientos:
        cargo = redondear_monto(item.get("cargo"))
        abono = redondear_monto(item.get("abono"))

        cargos += cargo
        abonos += abono
        saldo = redondear_monto(saldo + cargo - abono)

        item["saldoAcumulado"] = max(CERO, saldo)
        item.pop("orden", None)

    return {
        "movimientos": movimientos,
        "resumen": {
            "cargos": redondear_monto(cargos),
            "abonos": redondear_monto(abonos),
            "saldo": redondear_monto(max(CERO, saldo)),
            "creditoFavor": creditos,
        },
    }
