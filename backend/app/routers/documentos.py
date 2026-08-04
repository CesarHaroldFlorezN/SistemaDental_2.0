"""Rutas de documentos clínicos de pacientes."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api/pacientes",
    tags=["Documentos"],
)

# Aquí se migrarán:
# GET    /api/pacientes/{id}/documentos
# POST   /api/pacientes/{id}/documentos
# GET    /api/pacientes/{id}/documentos/{documento_id}/descargar
# DELETE /api/pacientes/{id}/documentos/{documento_id}