import csv
import io

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PacienteDB
from ..services import limpiar_valor_csv


router = APIRouter()


@router.get(
    "/api/exportar/pacientes",
    tags=["Pacientes"],
)
def exportar_pacientes(
    db: Session = Depends(get_db),
):
    pacientes = (
        db.query(PacienteDB)
        .order_by(PacienteDB.nombre)
        .all()
    )

    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.writer(
        output,
        delimiter=",",
        quoting=csv.QUOTE_MINIMAL,
    )

    headers = [
        "codigo_ficha",
        "cedula",
        "nombre",
        "telefono",
        "correo",
        "fechaNacimiento",
        "genero",
        "direccion",
        "alergias",
        "medicamentos",
    ]

    writer.writerow(headers)

    for paciente in pacientes:
        writer.writerow(
            [
                paciente.codigo_ficha or "",
                paciente.cedula or "",
                paciente.nombre or "",
                paciente.telefono or "",
                paciente.correo or "",
                paciente.fechaNacimiento or "",
                paciente.genero or "",
                paciente.direccion or "",
                paciente.alergias or "",
                paciente.medicamentos or "",
            ]
        )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                "attachment; "
                "filename=pacientes_respaldo.csv"
            )
        },
    )


@router.post(
    "/api/importar/pacientes",
    tags=["Pacientes"],
)
async def importar_pacientes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nombre_archivo = (
        file.filename or ""
    ).lower()

    if not nombre_archivo.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser CSV.",
        )

    contenido = await file.read()

    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="El archivo supera el límite de 5 MB.",
        )

    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe estar codificado en UTF-8.",
        ) from error

    lector = csv.DictReader(
        io.StringIO(texto),
        delimiter=",",
    )

    if (
        not lector.fieldnames
        or "nombre" not in lector.fieldnames
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "El CSV debe contener al menos "
                "la columna 'nombre'."
            ),
        )

    nuevos = 0
    actualizados = 0
    omitidos = 0

    try:
        for fila in lector:
            datos = {
                clave: limpiar_valor_csv(valor)
                for clave, valor in fila.items()
                if clave
            }

            nombre = datos.get("nombre", "")
            cedula = datos.get("cedula", "")
            ficha = datos.get("codigo_ficha", "")

            if not nombre:
                omitidos += 1
                continue

            paciente = None

            if cedula:
                paciente = (
                    db.query(PacienteDB)
                    .filter(
                        PacienteDB.cedula == cedula
                    )
                    .first()
                )

            if not paciente and ficha:
                paciente = (
                    db.query(PacienteDB)
                    .filter(
                        PacienteDB.codigo_ficha == ficha
                    )
                    .first()
                )

            if paciente:
                for clave, valor in datos.items():
                    if (
                        hasattr(paciente, clave)
                        and clave != "id"
                        and valor
                    ):
                        setattr(
                            paciente,
                            clave,
                            valor,
                        )

                actualizados += 1
            else:
                columnas_validas = {
                    columna.name
                    for columna
                    in PacienteDB.__table__.columns
                }

                datos_validos = {
                    clave: valor
                    for clave, valor in datos.items()
                    if (
                        clave in columnas_validas
                        and clave != "id"
                    )
                }

                db.add(
                    PacienteDB(**datos_validos)
                )
                nuevos += 1

        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=(
                "No se pudo importar el archivo. "
                "Revisa duplicados y columnas."
            ),
        ) from error

    return {
        "message": (
            f"Importación completa: {nuevos} nuevos, "
            f"{actualizados} actualizados y "
            f"{omitidos} omitidos."
        )
    }