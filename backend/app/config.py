import os
import sys
from pathlib import Path


def _leer_entero_positivo(
    nombre: str,
    predeterminado: int,
) -> int:
    try:
        valor = int(os.getenv(nombre, str(predeterminado)))
    except ValueError:
        return predeterminado

    return valor if valor > 0 else predeterminado


ROOT_DIR = Path(__file__).resolve().parents[2]
IS_FROZEN = bool(getattr(sys, "frozen", False))

if IS_FROZEN:
    APP_DIR = Path(sys.executable).resolve().parent
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", ROOT_DIR))
else:
    APP_DIR = ROOT_DIR
    BUNDLE_DIR = ROOT_DIR


DATA_DIR = Path(
    os.getenv(
        "DENTALPRO_DATA_DIR",
        str(APP_DIR / "data"),
    )
).resolve()

DB_PATH = Path(
    os.getenv(
        "DENTALPRO_DB_PATH",
        str(DATA_DIR / "dentalpro.db"),
    )
).resolve()

DOCUMENTOS_DIR = DATA_DIR / "documentos"
RESPALDOS_DIR = DATA_DIR / "respaldos"

MAX_RESPALDOS = _leer_entero_positivo(
    "DENTALPRO_MAX_RESPALDOS",
    10,
)

RESPALDAR_AL_INICIAR = os.getenv(
    "DENTALPRO_RESPALDAR_AL_INICIAR",
    "1",
).strip().lower() not in {"0", "false", "no", "off"}

FRONTEND_DIR = BUNDLE_DIR / "frontend" if IS_FROZEN else ROOT_DIR / "frontend" / "dist"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)
RESPALDOS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

APP_NAME = "DentalPro"
APP_VERSION = "2.0.0"

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
