import logging

from backend.app.logging_config import configurar_logging


def test_logging_persistente_y_rotativo(tmp_path) -> None:
    nombre = "dentalpro.prueba.logging"
    logger = configurar_logging(tmp_path, nombre_logger=nombre)
    logger.error("Fallo clínico de prueba")
    for handler in logger.handlers:
        handler.flush()

    contenido = (tmp_path / "dentalpro.log").read_text(encoding="utf-8")
    assert "Fallo clínico de prueba" in contenido
    assert "ERROR" in contenido

    for handler in list(logger.handlers):
        handler.close()
        logger.removeHandler(handler)
    logging.getLogger(nombre).handlers.clear()
