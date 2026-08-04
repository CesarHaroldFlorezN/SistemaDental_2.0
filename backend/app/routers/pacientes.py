"""Rutas de pacientes, importación y exportación."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api/pacientes",
    tags=["Pacientes"],
)

# Aquí se migrarán:
# GET    /api/pacientes
# POST   /api/pacientes
# PUT    /api/pacientes/{id}
# DELETE /api/pacientes/{id}
# Importación y exportación CSV