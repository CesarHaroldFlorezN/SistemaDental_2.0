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


def _detectar_edicion_runtime() -> str:
    """Identifica la edición por su ejecutable, sin variables configurables."""

    lanzador = Path(sys.executable if IS_FROZEN else sys.argv[0]).stem.casefold()
    if lanzador in {"dentalpropractica", "desktop_practica"}:
        return "practica"
    return "oficial"


EDICION = _detectar_edicion_runtime()
ES_PRACTICA = EDICION == "practica"

if IS_FROZEN:
    APP_DIR = Path(sys.executable).resolve().parent
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", ROOT_DIR))
else:
    APP_DIR = ROOT_DIR
    BUNDLE_DIR = ROOT_DIR


def _directorio_datos_predeterminado(edicion: str = EDICION) -> Path:
    """Devuelve el almacén fijo de la edición solicitada."""

    nombre_aplicacion = "DentalPro-Practica" if edicion == "practica" else "DentalPro"

    if sys.platform == "win32" and os.getenv("PROGRAMDATA"):
        return Path(os.environ["PROGRAMDATA"]) / nombre_aplicacion / "data"

    nombre_local = "data-practica" if edicion == "practica" else "data"
    return APP_DIR / nombre_local


MODO_PRUEBAS = os.getenv("DENTALPRO_TEST_MODE", "0").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

# Solo pytest puede dirigir la base a una carpeta temporal. En uso normal ni
# DENTALPRO_DATA_DIR ni DENTALPRO_DB_PATH cambian la base clínica oficial.
DATA_DIR = Path(
    os.getenv("DENTALPRO_DATA_DIR", str(_directorio_datos_predeterminado()))
    if MODO_PRUEBAS
    else _directorio_datos_predeterminado()
).resolve()

# El nombre del archivo activo es invariable.
DB_PATH = (DATA_DIR / "dentalpro.db").resolve()

# Compatibilidad interna: representa la base activa fijada por el ejecutable.
# La interfaz y las variables de entorno no pueden cambiarla.
OFICIAL_DB_PATH = DB_PATH

OFFICIAL_OWNER_USERNAME = (
    "practica.admin"
    if ES_PRACTICA
    else os.getenv(
        "DENTALPRO_OFFICIAL_OWNER_USERNAME",
        "cesar.admin",
    )
    .strip()
    .lower()
)

DOCUMENTOS_DIR = DATA_DIR / "documentos"
RESPALDOS_DIR = DATA_DIR / "respaldos"
LOGS_DIR = DATA_DIR / "logs"

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
LOGS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"


def validar_base_unica() -> None:
    """Rechaza variables capaces de recrear el antiguo diseño multibase."""

    variables_obsoletas = (
        "DENTALPRO_EDITION",
        "DENTALPRO_EDICION",
        "DENTALPRO_DB_PATH",
        "DENTALPRO_TEST_DATA_DIR",
        "DENTALPRO_TEST_DB_PATH",
        "DENTALPRO_TEST_ADMIN_USERNAME",
    )
    configuradas = [nombre for nombre in variables_obsoletas if os.getenv(nombre)]

    if os.getenv("DENTALPRO_DATA_DIR") and not MODO_PRUEBAS:
        configuradas.append("DENTALPRO_DATA_DIR")

    if configuradas:
        raise RuntimeError(
            "Configuración obsoleta de múltiples bases. Elimina estas "
            "variables: " + ", ".join(configuradas)
        )


APP_NAME = "DentalPro Práctica" if ES_PRACTICA else "DentalPro"
APP_VERSION = "2.0.0"

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
