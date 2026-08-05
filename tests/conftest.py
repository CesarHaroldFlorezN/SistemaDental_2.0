import os
import shutil
import tempfile
from pathlib import Path

TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="dentalpro-tests-"))

os.environ["DENTALPRO_DATA_DIR"] = str(TEST_DATA_DIR)
os.environ["DENTALPRO_DB_PATH"] = str(TEST_DATA_DIR / "dentalpro-test.db")


def pytest_sessionfinish(session, exitstatus) -> None:
    """Cierra y elimina la base temporal al terminar las pruebas."""

    try:
        from backend.app.database import engine

        engine.dispose()
    finally:
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
