from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import exigir_administrador
from ..models import UsuarioDB
from ..practica import (
    CONFIRMACION_RESTABLECIMIENTO,
    limpiar_documentos_practica,
    restablecer_datos_practica,
)
from ..schemas.practica import RestablecerPracticaPayload

router = APIRouter(
    prefix="/api/practica",
    tags=["Práctica"],
)


@router.post("/restablecer")
def restablecer_practica(
    payload: RestablecerPracticaPayload,
    _administrador: UsuarioDB = Depends(exigir_administrador),
    db: Session = Depends(get_db),
):
    if payload.confirmacion.strip() != CONFIRMACION_RESTABLECIMIENTO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=("Escribe exactamente RESTABLECER PRACTICA para confirmar."),
        )

    try:
        conteos = restablecer_datos_practica(db)
        db.commit()
        limpiar_documentos_practica()
    except (OSError, RuntimeError, SQLAlchemyError) as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo restablecer la base de práctica.",
        ) from error

    return {
        "message": (
            "DentalPro Práctica volvió a sus datos ficticios y credenciales iniciales."
        ),
        "conteos": conteos,
    }
