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


def _directorio_datos_predeterminado() -> Path:
    """Separa los datos clínicos de los binarios y de carpetas sincronizadas."""

    if not IS_FROZEN:
        return APP_DIR / "data"

    if os.getenv("PROGRAMDATA"):
        datos_comunes = Path(os.environ["PROGRAMDATA"]) / "DentalPro"
        # El instalador crea esta carpeta y concede escritura a los usuarios.
        # Una copia portátil sin instalar usa LocalAppData para no exigir UAC.
        if datos_comunes.is_dir() and os.access(datos_comunes, os.W_OK):
            return datos_comunes / "data"

    if os.getenv("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "DentalPro" / "data"

    return APP_DIR / "data"


DATA_DIR = Path(
    os.getenv(
        "DENTALPRO_DATA_DIR",
        str(_directorio_datos_predeterminado()),
    )
).resolve()

DB_PATH = Path(
    os.getenv(
        "DENTALPRO_DB_PATH",
        str(DATA_DIR / "dentalpro.db"),
    )
).resolve()

# La base oficial conserva los datos reales de la clínica. La base de pruebas
# vive en una carpeta independiente y nunca se selecciona mediante la interfaz.
OFICIAL_DB_PATH = DB_PATH

if os.getenv("DENTALPRO_TEST_DATA_DIR"):
    TEST_DATA_DIR = Path(os.environ["DENTALPRO_TEST_DATA_DIR"]).resolve()
elif os.getenv("DENTALPRO_DATA_DIR"):
    TEST_DATA_DIR = (DATA_DIR / "pruebas").resolve()
elif os.getenv("LOCALAPPDATA"):
    TEST_DATA_DIR = (
        Path(os.environ["LOCALAPPDATA"]) / "DentalPro" / "pruebas"
    ).resolve()
else:
    TEST_DATA_DIR = (DATA_DIR / "pruebas").resolve()

TEST_DB_PATH = Path(
    os.getenv(
        "DENTALPRO_TEST_DB_PATH",
        str(TEST_DATA_DIR / "dentalpro-pruebas.db"),
    )
).resolve()

TEST_ADMIN_USERNAME = (
    os.getenv(
        "DENTALPRO_TEST_ADMIN_USERNAME",
        "adminpruebas",
    )
    .strip()
    .lower()
)

OFFICIAL_OWNER_USERNAME = (
    os.getenv(
        "DENTALPRO_OFFICIAL_OWNER_USERNAME",
        "cesar.admin",
    )
    .strip()
    .lower()
)

DOCUMENTOS_DIR = DATA_DIR / "documentos"
RESPALDOS_DIR = DATA_DIR / "respaldos"
LOGS_DIR = DATA_DIR / "logs"
TEST_DOCUMENTOS_DIR = TEST_DATA_DIR / "documentos"
TEST_RESPALDOS_DIR = TEST_DATA_DIR / "respaldos"

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
TEST_DATA_DIR.mkdir(parents=True, exist_ok=True)
TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
TEST_DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)
TEST_RESPALDOS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH.as_posix()}"


def validar_aislamiento_bases() -> None:
    datos_heredados_apuntan_pruebas = bool(
        os.getenv("DENTALPRO_DATA_DIR") and DATA_DIR.name.lower() == "pruebas"
    )
    base_heredada_apunta_pruebas = bool(
        os.getenv("DENTALPRO_DB_PATH")
        and DB_PATH.name.lower() == "dentalpro-pruebas.db"
    )

    if (
        DB_PATH == TEST_DB_PATH
        or datos_heredados_apuntan_pruebas
        or base_heredada_apunta_pruebas
    ):
        raise RuntimeError(
            "Configuración insegura de bases: las variables antiguas "
            "DENTALPRO_DATA_DIR o DENTALPRO_DB_PATH apuntan al entorno de "
            "pruebas. Elimínalas antes de iniciar DentalPro."
        )


APP_NAME = "DentalPro"
APP_VERSION = "2.0.0"

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
