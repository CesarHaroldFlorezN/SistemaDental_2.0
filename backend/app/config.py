from pathlib import Path

# Raíz del proyecto SOFTWARE DENTAL 2.0
ROOT_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = ROOT_DIR / "data"
DOCUMENTOS_DIR = DATA_DIR / "documentos"
FRONTEND_DIR = ROOT_DIR / "frontend" / "dist"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "dentalpro.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

APP_NAME = "DentalPro"
APP_VERSION = "2.0.0"

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]