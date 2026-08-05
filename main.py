from __future__ import annotations

import sys
from pathlib import Path


import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.migrations import inicializar_base_datos


from backend.app.routers import (
    citas_router,
    crud_router,
    documentos_router,
    finanzas_router,
    pacientes_router,
    salud_router,
)

# =====================================================
# RUTAS DEL PROYECTO
# =====================================================

if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent

# =====================================================
# BASE DE DATOS
# =====================================================

inicializar_base_datos()


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
app.include_router(pacientes_router)
app.include_router(salud_router)
app.include_router(crud_router)




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
