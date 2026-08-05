from fastapi import APIRouter, Request

from ..config import DB_PATH

router = APIRouter()


@router.get(
    "/api/salud",
    tags=["Sistema"],
)
def salud(request: Request):
    return {
        "estado": "ok",
        "base_datos": str(DB_PATH),
        "version": request.app.version,
    }
