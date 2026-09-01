"""Lanzador de escritorio de DentalPro para Windows.

El ejecutable generado con PyInstaller usa este módulo para iniciar el servidor
local sin consola, abrir la interfaz automáticamente y reutilizar una instancia
que ya esté funcionando.
"""

# ruff: noqa: F401, I001

from __future__ import annotations

import json
import logging
import multiprocessing
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from contextlib import closing
from pathlib import Path

from backend.app.almacen import migrar_datos_heredados, validar_base_sqlite

# --- FIX PARA PYINSTALLER: Forzar carga de módulos ocultos de Uvicorn ---
import uvicorn.lifespan.on
import uvicorn.logging
import uvicorn.loops
import uvicorn.loops.auto
import uvicorn.protocols.http.auto
import uvicorn.protocols.websockets.auto
# ------------------------------------------------------------------------

HOST = "127.0.0.1"
PUERTO_INICIAL = 8000
PUERTO_FINAL = 8010
TIEMPO_ESPERA_SEGUNDOS = 30
EDICION_OBJETIVO = "oficial"
NOMBRE_APLICACION = "DentalPro"


def _respuesta_dentalpro(
    puerto: int,
    timeout: float = 0.5,
    *,
    edicion: str = EDICION_OBJETIVO,
) -> bool:
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

    return (
        contenido.get("estado") == "ok"
        and contenido.get("edicion") == edicion
        and bool(contenido.get("version"))
    )


def buscar_instancia_activa(edicion: str = EDICION_OBJETIVO) -> int | None:
    for puerto in range(PUERTO_INICIAL, PUERTO_FINAL + 1):
        if _respuesta_dentalpro(puerto, edicion=edicion):
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
    edicion: str = EDICION_OBJETIVO,
) -> bool:
    limite = time.monotonic() + timeout
    while time.monotonic() < limite:
        if _respuesta_dentalpro(puerto, edicion=edicion):
            webbrowser.open(f"http://{HOST}:{puerto}", new=1, autoraise=True)
            return True
        time.sleep(0.25)
    return False


def _mostrar_error(mensaje: str, titulo: str = NOMBRE_APLICACION) -> None:
    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, mensaje, titulo, 0x10)
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


def ejecutar(
    *,
    edicion_objetivo: str = EDICION_OBJETIVO,
    nombre_aplicacion: str = NOMBRE_APLICACION,
) -> int:
    multiprocessing.freeze_support()

    try:
        # Configurar las rutas no abre ni inicializa la base de datos.
        from backend.app.config import APP_DIR, DATA_DIR, EDICION, LOGS_DIR

        if EDICION != edicion_objetivo:
            raise RuntimeError("El ejecutable no coincide con la edición configurada.")

        logger = _configurar_log_lanzador(LOGS_DIR)

        instancia = buscar_instancia_activa(edicion_objetivo)
        if instancia is not None:
            logger.info("Se reutiliza la instancia activa en el puerto %s.", instancia)
            webbrowser.open(
                f"http://{HOST}:{instancia}",
                new=1,
                autoraise=True,
            )
            return 0

        if edicion_objetivo == "oficial":
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
            kwargs={"puerto": puerto, "edicion": edicion_objetivo},
            daemon=True,
            name="dentalpro-apertura",
        )
        hilo_apertura.start()

        logger.info("%s inicia en http://%s:%s.", nombre_aplicacion, HOST, puerto)
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
            f"{nombre_aplicacion} no pudo iniciarse. "
            "No se modificó la otra edición.\n\n"
            f"Detalle: {error}\n\n"
            "Revisa el archivo data\\logs\\lanzador.log.",
            nombre_aplicacion,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(ejecutar())
