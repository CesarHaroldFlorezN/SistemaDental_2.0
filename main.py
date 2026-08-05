from __future__ import annotations

import csv
import io
import sys
from pathlib import Path


import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles


from sqlalchemy.orm import Session

from backend.app.config import DB_PATH
from backend.app.database import Base, engine, get_db

from backend.app.models import PacienteDB

from backend.app.services import limpiar_valor_csv

from backend.app.routers import (
    citas_router,
    crud_router,
    documentos_router,
    finanzas_router,
)

# =====================================================
# RUTAS DEL PROYECTO
# =====================================================

if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent



# =====================================================
# MODELOS SQLALCHEMY
# =====================================================


Base.metadata.create_all(bind=engine)


def asegurar_compatibilidad_esquema() -> None:
    """Agrega columnas nuevas sin borrar ni reemplazar la base existente."""
    with engine.begin() as connection:
        columnas_citas = {
            fila[1]
            for fila in connection.exec_driver_sql("PRAGMA table_info(citas)").fetchall()
        }
        if "servicios" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN servicios JSON")
        if "horaFin" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN horaFin VARCHAR(50)")
        if "duracionMinutos" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN duracionMinutos INTEGER")


asegurar_compatibilidad_esquema()


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title="API DentalPro",
    version="1.3.0",
    description="Backend local para gestión clínica, agenda y finanzas.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(citas_router)
app.include_router(documentos_router)
app.include_router(finanzas_router)

# =====================================================
# SALUD DEL SERVIDOR
# =====================================================

@app.get("/api/salud", tags=["Sistema"])
def salud():
    return {
        "estado": "ok",
        "base_datos": str(DB_PATH),
        "version": app.version,
    }

app.include_router(crud_router)


# =====================================================
# IMPORTACIÓN Y EXPORTACIÓN CSV
# =====================================================

@app.get("/api/exportar/pacientes", tags=["Pacientes"])
def exportar_pacientes(db: Session = Depends(get_db)):
    pacientes = db.query(PacienteDB).order_by(PacienteDB.nombre).all()
    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
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
            "Content-Disposition": "attachment; filename=pacientes_respaldo.csv"
        },
    )


@app.post("/api/importar/pacientes", tags=["Pacientes"])
async def importar_pacientes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nombre_archivo = (file.filename or "").lower()
    if not nombre_archivo.endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV.")

    contenido = await file.read()
    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="El archivo supera el límite de 5 MB.",
        )

    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe estar codificado en UTF-8.",
        ) from exc

    lector = csv.DictReader(io.StringIO(texto), delimiter=",")
    if not lector.fieldnames or "nombre" not in lector.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe contener al menos la columna 'nombre'.",
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
                paciente = db.query(PacienteDB).filter(
                    PacienteDB.cedula == cedula
                ).first()
            if not paciente and ficha:
                paciente = db.query(PacienteDB).filter(
                    PacienteDB.codigo_ficha == ficha
                ).first()

            if paciente:
                for clave, valor in datos.items():
                    if hasattr(paciente, clave) and clave != "id" and valor:
                        setattr(paciente, clave, valor)
                actualizados += 1
            else:
                columnas_validas = {
                    columna.name for columna in PacienteDB.__table__.columns
                }
                datos_validos = {
                    clave: valor
                    for clave, valor in datos.items()
                    if clave in columnas_validas and clave != "id"
                }
                db.add(PacienteDB(**datos_validos))
                nuevos += 1

        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo importar el archivo. Revisa duplicados y columnas.",
        ) from error

    return {
        "message": (
            f"Importación completa: {nuevos} nuevos, "
            f"{actualizados} actualizados y {omitidos} omitidos."
        )
    }


# =====================================================
# FRONTEND REACT
# =====================================================

def obtener_directorio_frontend() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "frontend"
    return APP_DIR / "frontend" / "dist"


FRONTEND_DIR = obtener_directorio_frontend()
FRONTEND_ASSETS = FRONTEND_DIR / "assets"

if FRONTEND_DIR.is_dir():
    if FRONTEND_ASSETS.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(FRONTEND_ASSETS)),
            name="react-assets",
        )

    @app.get("/", include_in_schema=False)
    def mostrar_frontend():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{ruta:path}", include_in_schema=False)
    def mostrar_ruta_react(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(status_code=404, detail="Ruta API no encontrada.")

        archivo_solicitado = (FRONTEND_DIR / ruta).resolve()
        frontend_resuelto = FRONTEND_DIR.resolve()

        try:
            archivo_solicitado.relative_to(frontend_resuelto)
        except ValueError as exc:
            raise HTTPException(
                status_code=404,
                detail="Archivo no encontrado.",
            ) from exc

        if archivo_solicitado.is_file():
            return FileResponse(archivo_solicitado)

        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def estado_backend():
        return {
            "message": "API DentalPro activa",
            "frontend": "No compilado",
            "instruccion": "Ejecuta npm run dev o npm run build.",
        }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
