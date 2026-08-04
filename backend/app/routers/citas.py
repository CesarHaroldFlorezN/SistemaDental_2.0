"""Rutas de agenda y operaciones clínicas."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["Citas"],
)

# Aquí se migrarán:
# GET    /api/citas
# POST   /api/operaciones/citas
# PUT    /api/operaciones/citas/{id}
# PATCH  /api/operaciones/citas/{id}/estado
# PATCH  /api/operaciones/citas/{id}/reprogramar
# DELETE /api/operaciones/citas/{id}