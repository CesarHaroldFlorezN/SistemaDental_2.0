"""Rutas de pagos, cuentas y planes de pago."""

from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["Finanzas"],
)

# Aquí se migrarán:
# GET  /api/pagos
# GET  /api/planPagos
# GET  /api/planes
# POST /api/operaciones/pagos/{id}/registrar
# POST /api/operaciones/pagos/{id}/anular
# POST /api/operaciones/pagos/{id}/devolver
# GET  /api/pacientes/{id}/cuenta