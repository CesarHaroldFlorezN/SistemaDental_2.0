import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .config import LOGS_DIR

FORMATO_LOG = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def configurar_logging(
    directorio: Path = LOGS_DIR,
    *,
    nombre_logger: str = "dentalpro",
) -> logging.Logger:
    """Crea un registro persistente y rotativo apto para la versión .exe."""

    directorio.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(nombre_logger)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if any(
        getattr(handler, "_dentalpro_handler", False) for handler in logger.handlers
    ):
        return logger

    formato = logging.Formatter(FORMATO_LOG)
    archivo = RotatingFileHandler(
        directorio / "dentalpro.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    archivo.setLevel(logging.INFO)
    archivo.setFormatter(formato)
    archivo._dentalpro_handler = True
    logger.addHandler(archivo)

    consola = logging.StreamHandler()
    consola.setLevel(logging.INFO)
    consola.setFormatter(formato)
    consola._dentalpro_handler = True
    logger.addHandler(consola)

    logger.info("Registro de diagnóstico iniciado en %s", directorio)
    return logger
