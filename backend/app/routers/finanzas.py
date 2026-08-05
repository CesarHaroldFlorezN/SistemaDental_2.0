"""Rutas de pagos, cuentas y planes de pago."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["Finanzas"],
)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import OperacionPagoPayload
from ..services import (
    anular_pago,
    construir_cuenta_paciente,
    devolver_pago,
    registrar_pago,
)


router = APIRouter(tags=["Finanzas"])


@router.post(
    "/api/operaciones/pagos/{pago_id}/registrar",
)
def registrar_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return registrar_pago(db, pago_id, payload)


@router.post(
    "/api/operaciones/pagos/{pago_id}/anular",
)
def anular_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return anular_pago(db, pago_id, payload)


@router.post(
    "/api/operaciones/pagos/{pago_id}/devolver",
)
def devolver_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return devolver_pago(db, pago_id, payload)


@router.get(
    "/api/pacientes/{paciente_id}/cuenta",
)
def obtener_cuenta_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
):
    return construir_cuenta_paciente(
        db,
        paciente_id,
    )