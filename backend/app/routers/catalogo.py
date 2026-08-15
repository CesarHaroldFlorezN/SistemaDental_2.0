from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import exigir_administrador
from ..schemas import ServicioCatalogoPayload, ServicioCatalogoResponse
from ..services import (
    ErrorCatalogo,
    actualizar_servicio_catalogo,
    crear_servicio_catalogo,
    listar_servicios_catalogo,
    obtener_servicio_catalogo,
)

router = APIRouter(
    prefix="/api/servicios",
    tags=["Catálogo de servicios"],
)


@router.get("", response_model=list[ServicioCatalogoResponse])
def consultar_catalogo(
    incluir_inactivos: bool = Query(default=False, alias="incluirInactivos"),
    db: Session = Depends(get_db),
):
    return listar_servicios_catalogo(
        db,
        incluir_inactivos=incluir_inactivos,
    )


@router.post(
    "",
    response_model=ServicioCatalogoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(exigir_administrador)],
)
def registrar_servicio(
    payload: ServicioCatalogoPayload,
    db: Session = Depends(get_db),
):
    try:
        servicio = crear_servicio_catalogo(
            db,
            nombre=payload.nombre,
            categoria=payload.categoria,
            precio=payload.precio,
            activo=payload.activo,
        )
        db.commit()
        db.refresh(servicio)
        return servicio
    except (ErrorCatalogo, IntegrityError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.put(
    "/{servicio_id}",
    response_model=ServicioCatalogoResponse,
    dependencies=[Depends(exigir_administrador)],
)
def modificar_servicio(
    servicio_id: int,
    payload: ServicioCatalogoPayload,
    db: Session = Depends(get_db),
):
    servicio = obtener_servicio_catalogo(db, servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado.",
        )

    try:
        actualizar_servicio_catalogo(
            db,
            servicio,
            nombre=payload.nombre,
            categoria=payload.categoria,
            precio=payload.precio,
            activo=payload.activo,
        )
        db.commit()
        db.refresh(servicio)
        return servicio
    except (ErrorCatalogo, IntegrityError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
