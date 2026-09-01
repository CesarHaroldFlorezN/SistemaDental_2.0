import os
import shutil
import tempfile
from pathlib import Path
from types import SimpleNamespace

TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="dentalpro-tests-"))

os.environ["DENTALPRO_TEST_MODE"] = "1"
os.environ["DENTALPRO_DATA_DIR"] = str(TEST_DATA_DIR)


def pytest_sessionfinish(session, exitstatus) -> None:
    """Cierra y elimina la base temporal al terminar las pruebas."""

    try:
        from backend.app.database import engine

        engine.dispose()
    finally:
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)


def usuario_prueba_autenticado() -> SimpleNamespace:
    return SimpleNamespace(
        id=0,
        nombre="Usuario de pruebas",
        nombre_usuario="pruebas",
        rol="administrador",
        activo=True,
    )


def pytest_configure(config) -> None:
    del config

    from backend.app.dependencias import obtener_usuario_actual
    from backend.app.main import app

    app.dependency_overrides[obtener_usuario_actual] = usuario_prueba_autenticado
