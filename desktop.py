"""Lanzador de escritorio de DentalPro para Windows.

El ejecutable generado con PyInstaller usa este módulo para iniciar el servidor
local sin consola, abrir la interfaz automáticamente y reutilizar una instancia
que ya esté funcionando.
"""

from __future__ import annotations

import json
import logging
import multiprocessing
import os
import shutil
import socket
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from contextlib import closing
from datetime import datetime
from pathlib import Path

# --- FIX PARA PYINSTALLER: Forzar carga de módulos ocultos de Uvicorn ---
import uvicorn.logging
import uvicorn.loops
import uvicorn.loops.auto
import uvicorn.protocols.http.auto
import uvicorn.protocols.websockets.auto
import uvicorn.lifespan.on
# ------------------------------------------------------------------------

HOST = "127.0.0.1"
PUERTO_INICIAL = 8000
PUERTO_FINAL = 8010
TIEMPO_ESPERA_SEGUNDOS = 30


def validar_base_sqlite(ruta: Path) -> bool:
    """Comprueba una base existente sin crearla ni modificarla."""

    if not ruta.is_file() or ruta.stat().st_size == 0:
        return False

    uri = f"{ruta.resolve().as_uri()}?mode=ro"
    try:
        with closing(sqlite3.connect(uri, uri=True)) as conexion:
            resultado = conexion.execute("PRAGMA quick_check").fetchone()
    except sqlite3.DatabaseError:
        return False

    return bool(resultado and resultado[0] == "ok")


def _copiar_base_consistente(origen: Path, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    uri = f"{origen.resolve().as_uri()}?mode=ro"

    with (
        closing(sqlite3.connect(uri, uri=True)) as conexion_origen,
        closing(sqlite3.connect(str(destino))) as conexion_destino,
    ):
        conexion_origen.backup(conexion_destino)

    if not validar_base_sqlite(destino):
        destino.unlink(missing_ok=True)
        raise RuntimeError("La copia de dentalpro.db no superó la validación.")


def migrar_datos_heredados(
    origen: Path,
    destino: Path,
) -> bool:
    """Importa una instalación portátil sin reemplazar datos existentes.

    Solo se migra ``dentalpro.db`` y ``documentos``. Las bases original, vacía
    y de pruebas permanecen fuera del entorno productivo.
    """

    origen = origen.resolve()
    destino = destino.resolve()
    base_origen = origen / "dentalpro.db"
    base_destino = destino / "dentalpro.db"

    if origen == destino or base_destino.exists():
        return False
    if not base_origen.exists():
        return False
    if not validar_base_sqlite(base_origen):
        raise RuntimeError(
            "La base data\\dentalpro.db incluida en el paquete no es válida."
        )

    destino.mkdir(parents=True, exist_ok=True)
    temporal = destino / ".instalacion-temporal"
    shutil.rmtree(temporal, ignore_errors=True)
    temporal.mkdir(parents=True)

    try:
        base_temporal = temporal / "dentalpro.db"
        _copiar_base_consistente(base_origen, base_temporal)

        documentos_origen = origen / "documentos"
        documentos_temporales = temporal / "documentos"
        if documentos_origen.is_dir():
            shutil.copytree(documentos_origen, documentos_temporales)

        marca = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
        respaldo_temporal = temporal / f"dentalpro-instalacion-{marca}.db"
        _copiar_base_consistente(base_temporal, respaldo_temporal)

        if documentos_temporales.is_dir():
            shutil.copytree(
                documentos_temporales,
                destino / "documentos",
                dirs_exist_ok=True,
            )

        respaldos = destino / "respaldos"
        respaldos.mkdir(parents=True, exist_ok=True)
        os.replace(
            respaldo_temporal,
            respaldos / respaldo_temporal.name,
        )
        os.replace(base_temporal, base_destino)
    finally:
        shutil.rmtree(temporal, ignore_errors=True)

    return True


def _respuesta_dentalpro(puerto: int, timeout: float = 0.5) -> bool:
    url = f"http://{HOST}:{puerto}/api/salud"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as respuesta:
            if respuesta.status != 200:
                return False
            contenido = json.loads(respuesta.read().decode("utf-8"))
    except (
        OSError,
        ValueError,
        urllib.error.URLError,
        json.JSONDecodeError,
    ):
        return False

    return contenido.get("estado") == "ok" and bool(contenido.get("version"))


def buscar_instancia_activa() -> int | None:
    for puerto in range(PUERTO_INICIAL, PUERTO_FINAL + 1):
        if _respuesta_dentalpro(puerto):
            return puerto
    return None


def buscar_puerto_disponible() -> int:
    for puerto in range(PUERTO_INICIAL, PUERTO_FINAL + 1):
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as socket_local:
            try:
                socket_local.bind((HOST, puerto))
            except OSError:
                continue
            return puerto

    raise RuntimeError(
        f"No existe un puerto disponible entre {PUERTO_INICIAL} y {PUERTO_FINAL}."
    )


def abrir_cuando_este_listo(
    puerto: int,
    *,
    timeout: float = TIEMPO_ESPERA_SEGUNDOS,
) -> bool:
    limite = time.monotonic() + timeout
    while time.monotonic() < limite:
        if _respuesta_dentalpro(puerto):
            webbrowser.open(f"http://{HOST}:{puerto}", new=1, autoraise=True)
            return True
        time.sleep(0.25)
    return False


def _mostrar_error(mensaje: str) -> None:
    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, mensaje, "DentalPro", 0x10)
            return
        except (AttributeError, OSError):
            # En entornos sin interfaz gráfica se conserva la salida estándar.
            pass

    print(mensaje, file=sys.stderr)


def _configurar_log_lanzador(logs_dir: Path) -> logging.Logger:
    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("dentalpro.lanzador")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if not logger.handlers:
        handler = logging.FileHandler(
            logs_dir / "lanzador.log",
            encoding="utf-8",
        )
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
        )
        logger.addHandler(handler)

    return logger


def ejecutar() -> int:
    multiprocessing.freeze_support()

    try:
        # Configurar las rutas no abre ni inicializa la base de datos.
        from backend.app.config import APP_DIR, DATA_DIR, LOGS_DIR

        logger = _configurar_log_lanzador(LOGS_DIR)

        instancia = buscar_instancia_activa()
        if instancia is not None:
            logger.info("Se reutiliza la instancia activa en el puerto %s.", instancia)
            webbrowser.open(
                f"http://{HOST}:{instancia}",
                new=1,
                autoraise=True,
            )
            return 0

        migrada = migrar_datos_heredados(APP_DIR / "data", DATA_DIR)
        if migrada:
            logger.info(
                "La base dentalpro.db y los documentos fueron migrados a %s.",
                DATA_DIR,
            )

        puerto = buscar_puerto_disponible()

        # Se importa después de migrar la base: main aplica validaciones y
        # migraciones sobre la copia productiva, nunca sobre el paquete.
        import uvicorn

        from backend.app.main import app

        hilo_apertura = threading.Thread(
            target=abrir_cuando_este_listo,
            args=(puerto,),
            daemon=True,
            name="dentalpro-apertura",
        )
        hilo_apertura.start()

        logger.info("DentalPro inicia en http://%s:%s.", HOST, puerto)
        uvicorn.run(
            app,
            host=HOST,
            port=puerto,
            access_log=False,
            log_level="warning",
            log_config=None,
        )
        return 0
    # El límite del ejecutable convierte cualquier fallo de arranque en un
    # mensaje comprensible y un registro persistente para soporte.
    except Exception as error:  # noqa: BLE001
        try:
            logger.exception("DentalPro no pudo iniciarse.")
        except UnboundLocalError:
            pass

        _mostrar_error(
            "DentalPro no pudo iniciarse. No se modificó la base original.\n\n"
            f"Detalle: {error}\n\n"
            "Revisa el archivo data\\logs\\lanzador.log."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(ejecutar())
