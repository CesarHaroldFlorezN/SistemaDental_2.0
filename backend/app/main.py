from __future__ import annotations

from uuid import uuid4

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    ALLOWED_ORIGINS,
    FRONTEND_DIR,
    TEST_DB_PATH,
    TEST_RESPALDOS_DIR,
    validar_aislamiento_bases,
)
from .database import test_engine
from .dependencias import (
    exigir_personal_clinico,
    obtener_usuario_actual,
)
from .logging_config import configurar_logging
from .migrations import inicializar_base_datos
from .routers import (
    autenticacion_router,
    catalogo_router,
    citas_router,
    clinica_router,
    documentos_router,
    finanzas_router,
    odontograma_router,
    pacientes_router,
    salud_router,
    usuarios_router,
)

# =====================================================
# BASE DE DATOS
# =====================================================

logger = configurar_logging()

try:
    validar_aislamiento_bases()
    inicializar_base_datos()
    inicializar_base_datos(
        test_engine,
        ruta_bd=TEST_DB_PATH,
        directorio_respaldos=TEST_RESPALDOS_DIR,
    )
except Exception:
    logger.exception("DentalPro no pudo inicializar sus bases de datos.")
    raise


# =====================================================
# APLICACIÓN FASTAPI
# =====================================================

app = FastAPI(
    title="API DentalPro",
    version="1.3.0",
    description=("Backend local para gestión clínica, agenda y finanzas."),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Limit", "X-Offset"],
)


@app.exception_handler(HTTPException)
async def registrar_error_controlado(
    request: Request,
    error: HTTPException,
) -> JSONResponse:
    causa = error.__cause__
    if causa is not None and (error.status_code == 400 or error.status_code >= 500):
        codigo = uuid4().hex[:10].upper()
        logger.error(
            "Error controlado %s | %s %s | %s",
            codigo,
            request.method,
            request.url.path,
            error.detail,
            exc_info=(type(causa), causa, causa.__traceback__),
        )
        detalle = f"{error.detail} Código de diagnóstico: {codigo}."
    else:
        detalle = error.detail

    return JSONResponse(
        status_code=error.status_code,
        content={"detail": jsonable_encoder(detalle)},
        headers=error.headers,
    )


@app.exception_handler(Exception)
async def registrar_error_no_controlado(
    request: Request,
    error: Exception,
) -> JSONResponse:
    codigo = uuid4().hex[:10].upper()
    logger.error(
        "Error no controlado %s | %s %s",
        codigo,
        request.method,
        request.url.path,
        exc_info=(type(error), error, error.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": (f"Ocurrió un error interno. Código de diagnóstico: {codigo}.")
        },
    )


# =====================================================
# ROUTERS
# =====================================================
app.include_router(autenticacion_router)
app.include_router(usuarios_router)

app.include_router(
    catalogo_router,
    dependencies=[Depends(obtener_usuario_actual)],
)

app.include_router(
    citas_router,
    dependencies=[Depends(obtener_usuario_actual)],
)
app.include_router(
    clinica_router,
    dependencies=[Depends(obtener_usuario_actual)],
)
app.include_router(
    documentos_router,
    dependencies=[Depends(exigir_personal_clinico)],
)
app.include_router(
    finanzas_router,
    dependencies=[Depends(obtener_usuario_actual)],
)
app.include_router(
    pacientes_router,
    dependencies=[Depends(obtener_usuario_actual)],
)
app.include_router(
    odontograma_router,
    dependencies=[Depends(exigir_personal_clinico)],
)

app.include_router(salud_router)

# =====================================================
# FRONTEND REACT
# =====================================================

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

        archivo_solicitado = (FRONTEND_DIR / ruta).resolve()

        frontend_resuelto = FRONTEND_DIR.resolve()

        try:
            archivo_solicitado.relative_to(frontend_resuelto)
        except ValueError as error:
            raise HTTPException(
                status_code=404,
                detail="Archivo no encontrado.",
            ) from error

        if archivo_solicitado.is_file():
            return FileResponse(archivo_solicitado)

        return FileResponse(FRONTEND_DIR / "index.html")
else:

    @app.get("/", include_in_schema=False)
    def estado_backend():
        return {
            "message": "API DentalPro activa",
            "frontend": "No compilado",
            "instruccion": ("Ejecuta npm run dev o npm run build."),
        }


def ejecutar() -> None:
    """Inicia DentalPro sin recarga automática."""

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_config=None,
    )


if __name__ == "__main__":
    ejecutar()
