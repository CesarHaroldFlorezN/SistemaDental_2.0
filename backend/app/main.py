from __future__ import annotations

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import ALLOWED_ORIGINS, FRONTEND_DIR
from .migrations import inicializar_base_datos
from .routers import (
    citas_router,
    crud_router,
    documentos_router,
    finanzas_router,
    pacientes_router,
    salud_router,
)


# =====================================================
# BASE DE DATOS
# =====================================================

inicializar_base_datos()


# =====================================================
# APLICACIÓN FASTAPI
# =====================================================

app = FastAPI(
    title="API DentalPro",
    version="1.3.0",
    description=(
        "Backend local para gestión clínica, "
        "agenda y finanzas."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# ROUTERS
# =====================================================

app.include_router(citas_router)
app.include_router(documentos_router)
app.include_router(finanzas_router)
app.include_router(pacientes_router)
app.include_router(salud_router)

# El CRUD genérico debe registrarse después
# de las rutas específicas.
app.include_router(crud_router)


# =====================================================
# FRONTEND REACT
# =====================================================

FRONTEND_ASSETS = FRONTEND_DIR / "assets"

if FRONTEND_DIR.is_dir():
    if FRONTEND_ASSETS.is_dir():
        app.mount(
            "/assets",
            StaticFiles(
                directory=str(FRONTEND_ASSETS)
            ),
            name="react-assets",
        )

    @app.get("/", include_in_schema=False)
    def mostrar_frontend():
        return FileResponse(
            FRONTEND_DIR / "index.html"
        )

    @app.get(
        "/{ruta:path}",
        include_in_schema=False,
    )
    def mostrar_ruta_react(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(
                status_code=404,
                detail="Ruta API no encontrada.",
            )

        archivo_solicitado = (
            FRONTEND_DIR / ruta
        ).resolve()

        frontend_resuelto = (
            FRONTEND_DIR.resolve()
        )

        try:
            archivo_solicitado.relative_to(
                frontend_resuelto
            )
        except ValueError as error:
            raise HTTPException(
                status_code=404,
                detail="Archivo no encontrado.",
            ) from error

        if archivo_solicitado.is_file():
            return FileResponse(
                archivo_solicitado
            )

        return FileResponse(
            FRONTEND_DIR / "index.html"
        )
else:

    @app.get("/", include_in_schema=False)
    def estado_backend():
        return {
            "message": "API DentalPro activa",
            "frontend": "No compilado",
            "instruccion": (
                "Ejecuta npm run dev o npm run build."
            ),
        }


def ejecutar() -> None:
    """Inicia DentalPro sin recarga automática."""

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
    )


if __name__ == "__main__":
    ejecutar()