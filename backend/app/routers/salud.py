from fastapi import APIRouter, Request

from ..config import APP_NAME, DB_PATH, EDICION

router = APIRouter()


@router.get(
    "/api/salud",
    tags=["Sistema"],
)
def salud(request: Request):
    return {
        "estado": "ok",
        "aplicacion": APP_NAME,
        "edicion": EDICION,
        "base_datos": str(DB_PATH),
        "version": request.app.version,
    }
