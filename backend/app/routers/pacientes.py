import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import exigir_administrador
from ..models import (
    CasoClinicoDB,
    CitaDB,
    DocumentoPacienteDB,
    MovimientoCuentaDB,
    PacienteDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
)
from ..schemas import PacienteActualizarPayload, PacienteCrearPayload
from ..services import ahora_iso, limpiar_valor_csv, serializar_modelo

router = APIRouter()


@router.get("/api/pacientes", tags=["Pacientes"])
def listar_pacientes(
    response: Response,
    limite: int = Query(default=100, ge=1, le=250, alias="limit"),
    offset: int = Query(default=0, ge=0),
    busqueda: str = Query(default="", max_length=100, alias="q"),
    db: Session = Depends(get_db),
):
    consulta = db.query(PacienteDB)
    termino = busqueda.strip()
    if termino:
        patron = f"%{termino}%"
        consulta = consulta.filter(
            or_(
                PacienteDB.nombre.ilike(patron),
                PacienteDB.cedula.ilike(patron),
                PacienteDB.codigo_ficha.ilike(patron),
                PacienteDB.telefono.ilike(patron),
                PacienteDB.correo.ilike(patron),
            )
        )

    total = consulta.count()
    pacientes = consulta.order_by(PacienteDB.id).offset(offset).limit(limite).all()
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Limit"] = str(limite)
    response.headers["X-Offset"] = str(offset)
    return [serializar_modelo(paciente) for paciente in pacientes]


@router.post("/api/pacientes", tags=["Pacientes"])
def crear_paciente(
    payload: PacienteCrearPayload,
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    cedula_nueva = data["cedula"]
    ficha_nueva = data["codigo_ficha"]

    if (
        cedula_nueva
        and db.query(PacienteDB).filter(PacienteDB.cedula == cedula_nueva).first()
    ):
        raise HTTPException(
            status_code=400,
            detail=f"El DNI/Cédula '{cedula_nueva}' ya está registrado.",
        )

    if (
        ficha_nueva
        and db.query(PacienteDB).filter(PacienteDB.codigo_ficha == ficha_nueva).first()
    ):
        raise HTTPException(
            status_code=400,
            detail=f"El código de ficha '{ficha_nueva}' ya existe.",
        )

    nuevo_paciente = PacienteDB(**data, fechaReg=ahora_iso())

    try:
        db.add(nuevo_paciente)
        db.commit()
        db.refresh(nuevo_paciente)
        return serializar_modelo(nuevo_paciente)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el paciente.",
        ) from error


@router.put(
    "/api/pacientes/{paciente_id}",
    tags=["Pacientes"],
)
def actualizar_paciente(
    paciente_id: int,
    payload: PacienteActualizarPayload,
    db: Session = Depends(get_db),
):
    paciente = db.query(PacienteDB).filter(PacienteDB.id == paciente_id).first()

    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="Paciente no encontrado.",
        )

    data = payload.model_dump(exclude_unset=True)
    cedula_nueva = str(data.get("cedula", paciente.cedula) or "").strip()

    ficha_nueva = str(
        data.get(
            "codigo_ficha",
            paciente.codigo_ficha,
        )
        or ""
    ).strip()

    if (
        cedula_nueva
        and db.query(PacienteDB)
        .filter(
            PacienteDB.cedula == cedula_nueva,
            PacienteDB.id != paciente_id,
        )
        .first()
    ):
        raise HTTPException(
            status_code=400,
            detail=(f"El DNI '{cedula_nueva}' ya pertenece a otro paciente."),
        )

    if (
        ficha_nueva
        and db.query(PacienteDB)
        .filter(
            PacienteDB.codigo_ficha == ficha_nueva,
            PacienteDB.id != paciente_id,
        )
        .first()
    ):
        raise HTTPException(
            status_code=400,
            detail=(f"La ficha '{ficha_nueva}' ya pertenece a otro paciente."),
        )

    for clave, valor in data.items():
        setattr(paciente, clave, valor)

    try:
        db.commit()
        db.refresh(paciente)
        return {
            "message": "Actualizado correctamente.",
            "registro": serializar_modelo(paciente),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el paciente.",
        ) from error


@router.delete(
    "/api/pacientes/{paciente_id}",
    tags=["Pacientes"],
    dependencies=[Depends(exigir_administrador)],
)
def eliminar_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
):
    paciente = db.query(PacienteDB).filter(PacienteDB.id == paciente_id).first()

    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="Paciente no encontrado.",
        )

    tiene_historial = any(
        (
            db.query(CasoClinicoDB)
            .filter(CasoClinicoDB.pacienteId == paciente_id)
            .first(),
            db.query(CitaDB).filter(CitaDB.pacienteId == paciente_id).first(),
            db.query(PagoDB).filter(PagoDB.pacienteId == paciente_id).first(),
            db.query(PlanDB).filter(PlanDB.pacienteId == paciente_id).first(),
            db.query(PlanPagoDB).filter(PlanPagoDB.pacienteId == paciente_id).first(),
            db.query(MovimientoCuentaDB)
            .filter(MovimientoCuentaDB.pacienteId == paciente_id)
            .first(),
            db.query(DocumentoPacienteDB)
            .filter(DocumentoPacienteDB.pacienteId == paciente_id)
            .first(),
        )
    )

    if tiene_historial:
        raise HTTPException(
            status_code=409,
            detail=(
                "No puedes eliminar un paciente con historial "
                "clínico o financiero. Conserva su ficha para "
                "mantener la trazabilidad."
            ),
        )

    try:
        db.delete(paciente)
        db.commit()
        return {
            "message": "Eliminado correctamente.",
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el paciente.",
        ) from error


@router.get(
    "/api/exportar/pacientes",
    tags=["Pacientes"],
    dependencies=[Depends(exigir_administrador)],
)
def exportar_pacientes(
    db: Session = Depends(get_db),
):
    pacientes = db.query(PacienteDB).order_by(PacienteDB.nombre).all()

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
            "Content-Disposition": ("attachment; filename=pacientes_respaldo.csv")
        },
    )


@router.post(
    "/api/importar/pacientes",
    tags=["Pacientes"],
    dependencies=[Depends(exigir_administrador)],
)
async def importar_pacientes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nombre_archivo = (file.filename or "").lower()

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

    if not lector.fieldnames or "nombre" not in lector.fieldnames:
        raise HTTPException(
            status_code=400,
            detail=("El CSV debe contener al menos la columna 'nombre'."),
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
                    db.query(PacienteDB).filter(PacienteDB.cedula == cedula).first()
                )

            if not paciente and ficha:
                paciente = (
                    db.query(PacienteDB)
                    .filter(PacienteDB.codigo_ficha == ficha)
                    .first()
                )

            if paciente:
                for clave, valor in datos.items():
                    if hasattr(paciente, clave) and clave != "id" and valor:
                        setattr(
                            paciente,
                            clave,
                            valor,
                        )

                actualizados += 1
            else:
                columnas_validas = {
                    columna.name for columna in PacienteDB.__table__.columns
                }

                datos_validos = {
                    clave: valor
                    for clave, valor in datos.items()
                    if (clave in columnas_validas and clave != "id")
                }

                db.add(PacienteDB(**datos_validos))
                nuevos += 1

        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=("No se pudo importar el archivo. Revisa duplicados y columnas."),
        ) from error

    return {
        "message": (
            f"Importación completa: {nuevos} nuevos, "
            f"{actualizados} actualizados y "
            f"{omitidos} omitidos."
        )
    }
