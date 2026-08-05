from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    MovimientoCuentaDB,
    PagoDB,
    PlanPagoDB,
)
from ..schemas import OperacionPagoPayload
from .citas import obtener_paciente
from .comun import ahora_iso, serializar_modelo


def _obtener_pago(
    db: Session,
    pago_id: int,
) -> PagoDB:
    pago = (
        db.query(PagoDB)
        .filter(PagoDB.id == pago_id)
        .first()
    )

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
    plan = (
        db.query(PlanPagoDB)
        .filter(PlanPagoDB.pagoId == pago.id)
        .first()
    )

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
    cargo: float = 0,
    abono: float = 0,
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
        cargo=round(float(cargo or 0), 2),
        abono=round(float(abono or 0), 2),
        fecha=(
            datetime.now()
            .astimezone()
            .date()
            .isoformat()
        ),
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

    saldo = round(float(pago.saldo or 0), 2)
    monto = round(float(payload.monto), 2)

    if monto > saldo:
        raise HTTPException(
            status_code=400,
            detail=(
                "El monto no puede superar "
                "el saldo pendiente."
            ),
        )

    pago.cobrado = round(
        float(pago.cobrado or 0) + monto,
        2,
    )
    pago.saldo = round(
        max(
            0,
            float(pago.total or 0) - pago.cobrado,
        ),
        2,
    )
    pago.metodo = payload.metodo.strip() or "Efectivo"
    pago.fechaUltPago = (
        datetime.now()
        .astimezone()
        .date()
        .isoformat()
    )

    pago.tipoPago = (
        "completo"
        if pago.saldo <= 0
        else (
            "cuotas"
            if pago.tipoPago == "cuotas"
            else "anticipo"
        )
    )

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="pago",
        descripcion=(
            f"Pago: "
            f"{pago.concepto or 'Atención dental'}"
        ),
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

    monto = round(float(payload.monto), 2)
    cobrado = round(float(pago.cobrado or 0), 2)

    if monto > cobrado:
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes anular más "
                "de lo que está cobrado."
            ),
        )

    if not payload.motivo.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "El motivo de la anulación "
                "es obligatorio."
            ),
        )

    pago.cobrado = round(cobrado - monto, 2)
    pago.saldo = round(
        max(
            0,
            float(pago.total or 0) - pago.cobrado,
        ),
        2,
    )
    pago.tipoPago = (
        "contado"
        if pago.cobrado <= 0
        else "anticipo"
    )

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="anulacion",
        descripcion=(
            "Anulación de pago: "
            f"{pago.concepto or 'Atención dental'}"
        ),
        cargo=monto,
        metodo=(
            payload.metodo.strip()
            or pago.metodo
            or "Pago"
        ),
        referencia=payload.referencia,
        motivo=payload.motivo,
        usuario=payload.usuario,
    )

    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)

    return {
        "message": (
            "Pago anulado sin borrar el historial."
        ),
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

    monto = round(float(payload.monto), 2)
    cobrado = round(float(pago.cobrado or 0), 2)

    if monto > cobrado:
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes devolver más "
                "de lo que está cobrado."
            ),
        )

    if not payload.motivo.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "El motivo de la devolución "
                "es obligatorio."
            ),
        )

    pago.cobrado = round(cobrado - monto, 2)
    pago.saldo = round(
        max(
            0,
            float(pago.total or 0) - pago.cobrado,
        ),
        2,
    )
    pago.devuelto = round(
        float(pago.devuelto or 0) + monto,
        2,
    )
    pago.tipoPago = (
        "contado"
        if pago.cobrado <= 0
        else "anticipo"
    )

    movimiento = _crear_movimiento(
        db=db,
        pago=pago,
        tipo="devolucion",
        descripcion=(
            f"Devolución: "
            f"{pago.concepto or 'Atención dental'}"
        ),
        cargo=monto,
        metodo=(
            payload.metodo.strip()
            or pago.metodo
            or "Pago"
        ),
        referencia=payload.referencia,
        motivo=payload.motivo,
        usuario=payload.usuario,
    )

    db.commit()
    db.refresh(pago)
    db.refresh(movimiento)

    return {
        "message": (
            "Devolución registrada "
            "sin borrar el pago original."
        ),
        "pago": serializar_modelo(pago),
        "movimiento": serializar_modelo(movimiento),
    }


def construir_cuenta_paciente(
    db: Session,
    paciente_id: int,
):
    obtener_paciente(db, paciente_id)

    pagos = (
        db.query(PagoDB)
        .filter(PagoDB.pacienteId == paciente_id)
        .all()
    )
    movimientos_db = (
        db.query(MovimientoCuentaDB)
        .filter(
            MovimientoCuentaDB.pacienteId == paciente_id
        )
        .all()
    )
    movimientos = []

    for pago in pagos:
        movimientos.append(
            {
                "id": f"cargo-{pago.id}",
                "tipo": "cargo",
                "pagoId": pago.id,
                "fecha": (
                    pago.fecha
                    or (pago.creadoEn or "")[:10]
                ),
                "descripcion": (
                    pago.concepto or "Atención dental"
                ),
                "cargo": round(
                    float(pago.total or 0),
                    2,
                ),
                "abono": 0,
                "metodo": "Cargo clínico",
                "orden": 0,
            }
        )

        vinculados = [
            movimiento
            for movimiento in movimientos_db
            if int(movimiento.pagoId or 0)
            == int(pago.id)
        ]

        neto_registrado = sum(
            float(movimiento.abono or 0)
            - float(movimiento.cargo or 0)
            for movimiento in vinculados
        )

        legado = round(
            max(
                0,
                float(pago.cobrado or 0)
                - neto_registrado,
            ),
            2,
        )

        if legado > 0:
            movimientos.append(
                {
                    "id": f"legado-{pago.id}",
                    "tipo": "pago_anterior",
                    "pagoId": pago.id,
                    "fecha": (
                        pago.fechaUltPago
                        or pago.fecha
                        or (pago.creadoEn or "")[:10]
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

    saldo = 0.0
    cargos = 0.0
    abonos = 0.0
    creditos = round(
        sum(
            float(pago.creditoFavor or 0)
            for pago in pagos
        ),
        2,
    )

    for item in movimientos:
        cargo = round(
            float(item.get("cargo") or 0),
            2,
        )
        abono = round(
            float(item.get("abono") or 0),
            2,
        )

        cargos += cargo
        abonos += abono
        saldo = round(saldo + cargo - abono, 2)

        item["saldoAcumulado"] = max(0, saldo)
        item.pop("orden", None)

    return {
        "movimientos": movimientos,
        "resumen": {
            "cargos": round(cargos, 2),
            "abonos": round(abonos, 2),
            "saldo": round(max(0, saldo), 2),
            "creditoFavor": creditos,
        },
    }