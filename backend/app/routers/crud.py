from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    CitaDB,
    DocumentoPacienteDB,
    MovimientoCuentaDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
)
from ..services import serializar_modelo, validar_disponibilidad

router = APIRouter()


MODELOS = {
    "citas": CitaDB,
    "pagos": PagoDB,
    "planes": PlanDB,
    "planPagos": PlanPagoDB,
    "movimientosCuenta": MovimientoCuentaDB,
    "documentosPaciente": DocumentoPacienteDB,
}

ALMACENES_INMUTABLES = {
    "movimientosCuenta",
}


@router.get("/api/{store}", tags=["CRUD"])
def get_all(store: str, db: Session = Depends(get_db)):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(
            status_code=404,
            detail="Tabla no encontrada.",
        )

    registros = db.query(modelo).all()
    return [serializar_modelo(registro) for registro in registros]


@router.post("/api/{store}", tags=["CRUD"])
def create_record(
    store: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(
            status_code=404,
            detail="Tabla no encontrada.",
        )

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


@router.put("/api/{store}/{item_id}", tags=["CRUD"])
def update_record(
    store: str,
    item_id: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(
            status_code=404,
            detail="Tabla no encontrada.",
        )

    if store in ALMACENES_INMUTABLES:
        raise HTTPException(
            status_code=405,
            detail=(
                "El historial financiero es inmutable. Usa una anulación o devolución."
            ),
        )

    registro = db.query(modelo).filter(modelo.id == item_id).first()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro no encontrado.",
        )

    if store == "citas":
        fecha = str(data.get("fecha", registro.fecha) or "")

        hora = str(data.get("hora", registro.hora) or "")

        hora_fin = data.get(
            "horaFin",
            registro.horaFin,
        )

        duracion = int(
            data.get(
                "duracionMinutos",
                registro.duracionMinutos or 60,
            )
            or 60
        )

        estado = str(
            data.get(
                "estado",
                registro.estado,
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
            cita_excluida_id=item_id,
        )

        data["horaFin"] = hora_fin_resuelta
        data["duracionMinutos"] = duracion_resuelta

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


@router.delete("/api/{store}/{item_id}", tags=["CRUD"])
def delete_record(
    store: str,
    item_id: int,
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(
            status_code=404,
            detail="Tabla no encontrada.",
        )

    if store in ALMACENES_INMUTABLES:
        raise HTTPException(
            status_code=405,
            detail=(
                "El historial financiero es inmutable. Usa una anulación o devolución."
            ),
        )

    registro = db.query(modelo).filter(modelo.id == item_id).first()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro no encontrado.",
        )

    if (
        store == "pagos"
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
