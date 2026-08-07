"""Rutas de pagos, cuentas y planes de pago."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import (
    exigir_administrador,
    exigir_personal_financiero,
)
from ..models import (
    MovimientoCuentaDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
)
from ..schemas import OperacionPagoPayload
from ..services import (
    anular_pago,
    construir_cuenta_paciente,
    devolver_pago,
    registrar_pago,
    serializar_modelo,
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


@router.get("/api/planes")
def listar_planes(
    db: Session = Depends(get_db),
):
    return _listar_registros(PlanDB, db)


@router.post("/api/planes")
def crear_plan(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _crear_registro(PlanDB, data, db)


@router.put("/api/planes/{item_id}")
def actualizar_plan(
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _actualizar_registro(
        PlanDB,
        item_id,
        data,
        db,
    )


@router.delete("/api/planes/{item_id}")
def eliminar_plan(
    item_id: int,
    db: Session = Depends(get_db),
):
    return _eliminar_registro(
        PlanDB,
        item_id,
        db,
    )


# =====================================================
# PLANES DE PAGO
# =====================================================


@router.get("/api/planPagos")
def listar_planes_pago(
    db: Session = Depends(get_db),
):
    return _listar_registros(PlanPagoDB, db)


@router.post("/api/planPagos")
def crear_plan_pago(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _crear_registro(PlanPagoDB, data, db)


@router.put("/api/planPagos/{item_id}")
def actualizar_plan_pago(
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _actualizar_registro(
        PlanPagoDB,
        item_id,
        data,
        db,
    )


@router.delete("/api/planPagos/{item_id}")
def eliminar_plan_pago(
    item_id: int,
    db: Session = Depends(get_db),
):
    return _eliminar_registro(
        PlanPagoDB,
        item_id,
        db,
    )


# =====================================================
# MOVIMIENTOS DE CUENTA
# =====================================================


@router.get("/api/movimientosCuenta")
def listar_movimientos_cuenta(
    db: Session = Depends(get_db),
):
    return _listar_registros(
        MovimientoCuentaDB,
        db,
    )


@router.post("/api/movimientosCuenta")
def crear_movimiento_cuenta(
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    return _crear_registro(
        MovimientoCuentaDB,
        data,
        db,
    )


@router.put("/api/movimientosCuenta/{item_id}")
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


@router.delete("/api/movimientosCuenta/{item_id}")
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
