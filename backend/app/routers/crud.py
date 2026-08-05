from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DocumentoPacienteDB
from ..services import serializar_modelo

router = APIRouter()


MODELOS = {
    "documentosPaciente": DocumentoPacienteDB,
}


@router.get("/api/{store}", tags=["CRUD"])
def get_all(
    store: str,
    db: Session = Depends(get_db),
):
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

    registro = db.query(modelo).filter(modelo.id == item_id).first()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro no encontrado.",
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
