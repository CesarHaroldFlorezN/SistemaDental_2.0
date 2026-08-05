"""Rutas de documentos clínicos de pacientes."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api/pacientes",
    tags=["Documentos"],
)

import re
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import DATA_DIR
from ..database import get_db
from ..models import DocumentoPacienteDB
from ..services import (
    ahora_iso,
    obtener_paciente,
    serializar_modelo,
)


router = APIRouter()

DOCUMENTOS_DIR = DATA_DIR / "documentos"
DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)


@router.get(
    "/api/pacientes/{paciente_id}/documentos",
    tags=["Documentos"],
)
def listar_documentos_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
):
    obtener_paciente(db, paciente_id)

    registros = (
        db.query(DocumentoPacienteDB)
        .filter(
            DocumentoPacienteDB.pacienteId == paciente_id
        )
        .order_by(DocumentoPacienteDB.id.desc())
        .all()
    )

    return [
        serializar_modelo(item)
        for item in registros
    ]


@router.post(
    "/api/pacientes/{paciente_id}/documentos",
    tags=["Documentos"],
)
async def subir_documento_paciente(
    paciente_id: int,
    file: UploadFile = File(...),
    descripcion: str = Form(""),
    db: Session = Depends(get_db),
):
    obtener_paciente(db, paciente_id)

    nombre_original = Path(
        file.filename or "documento"
    ).name

    nombre_seguro = (
        re.sub(
            r"[^A-Za-z0-9._-]+",
            "_",
            nombre_original,
        ).strip("._")
        or "documento"
    )

    carpeta = DOCUMENTOS_DIR / str(paciente_id)
    carpeta.mkdir(parents=True, exist_ok=True)

    marca_tiempo = datetime.now().strftime(
        "%Y%m%d_%H%M%S_%f"
    )

    destino = carpeta / (
        f"{marca_tiempo}_{nombre_seguro}"
    )

    contenido = await file.read()

    if len(contenido) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="El archivo no puede superar 25 MB.",
        )

    destino.write_bytes(contenido)

    registro = DocumentoPacienteDB(
        pacienteId=paciente_id,
        nombre=nombre_original,
        tipo=(
            file.content_type
            or "application/octet-stream"
        ),
        ruta=str(destino),
        descripcion=descripcion,
        fecha=(
            datetime.now()
            .astimezone()
            .date()
            .isoformat()
        ),
        creadoEn=ahora_iso(),
    )

    try:
        db.add(registro)
        db.commit()
        db.refresh(registro)
        return serializar_modelo(registro)
    except Exception as error:
        db.rollback()

        if destino.exists():
            destino.unlink()

        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el documento.",
        ) from error


@router.get(
    (
        "/api/pacientes/{paciente_id}/documentos/"
        "{documento_id}/descargar"
    ),
    tags=["Documentos"],
)
def descargar_documento_paciente(
    paciente_id: int,
    documento_id: int,
    db: Session = Depends(get_db),
):
    registro = (
        db.query(DocumentoPacienteDB)
        .filter(
            DocumentoPacienteDB.id == documento_id,
            DocumentoPacienteDB.pacienteId == paciente_id,
        )
        .first()
    )

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="El documento no existe.",
        )

    ruta = Path(registro.ruta)

    if not ruta.exists():
        raise HTTPException(
            status_code=404,
            detail="El archivo ya no está disponible.",
        )

    return FileResponse(
        path=ruta,
        filename=registro.nombre,
        media_type=(
            registro.tipo
            or "application/octet-stream"
        ),
    )


@router.delete(
    (
        "/api/pacientes/{paciente_id}/documentos/"
        "{documento_id}"
    ),
    tags=["Documentos"],
)
def eliminar_documento_paciente(
    paciente_id: int,
    documento_id: int,
    db: Session = Depends(get_db),
):
    registro = (
        db.query(DocumentoPacienteDB)
        .filter(
            DocumentoPacienteDB.id == documento_id,
            DocumentoPacienteDB.pacienteId == paciente_id,
        )
        .first()
    )

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="El documento no existe.",
        )

    ruta = Path(registro.ruta)

    try:
        if ruta.exists():
            ruta.unlink()

        db.delete(registro)
        db.commit()

        return {
            "message": "Documento eliminado.",
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el documento.",
        ) from error