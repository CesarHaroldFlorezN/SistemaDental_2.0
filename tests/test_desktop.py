import sqlite3
from pathlib import Path

import pytest

from desktop import migrar_datos_heredados, validar_base_sqlite


def _crear_base(ruta: Path, paciente: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(ruta) as conexion:
        conexion.execute("CREATE TABLE pacientes (nombre TEXT NOT NULL)")
        conexion.execute("INSERT INTO pacientes (nombre) VALUES (?)", (paciente,))


def _leer_paciente(ruta: Path) -> str:
    with sqlite3.connect(ruta) as conexion:
        return conexion.execute("SELECT nombre FROM pacientes").fetchone()[0]


def test_migrar_solo_base_activa_y_documentos(tmp_path: Path) -> None:
    origen = tmp_path / "portable" / "data"
    destino = tmp_path / "produccion" / "data"
    _crear_base(origen / "dentalpro.db", "Paciente oficial")
    _crear_base(origen / "dentalpro_pruebas.db", "Paciente de pruebas")
    _crear_base(origen / "dentalpro_vacia.db", "Paciente equivocado")
    (origen / "documentos" / "6").mkdir(parents=True)
    (origen / "documentos" / "6" / "radiografia.txt").write_text(
        "documento clínico",
        encoding="utf-8",
    )

    assert migrar_datos_heredados(origen, destino) is True

    assert validar_base_sqlite(destino / "dentalpro.db")
    assert _leer_paciente(destino / "dentalpro.db") == "Paciente oficial"
    assert (destino / "documentos" / "6" / "radiografia.txt").is_file()
    assert not (destino / "dentalpro_pruebas.db").exists()
    assert not (destino / "dentalpro_vacia.db").exists()
    assert len(list((destino / "respaldos").glob("dentalpro-instalacion-*.db"))) == 1


def test_no_reemplazar_base_productiva_existente(tmp_path: Path) -> None:
    origen = tmp_path / "portable" / "data"
    destino = tmp_path / "produccion" / "data"
    _crear_base(origen / "dentalpro.db", "Paciente del paquete")
    _crear_base(destino / "dentalpro.db", "Paciente en producción")

    assert migrar_datos_heredados(origen, destino) is False
    assert _leer_paciente(destino / "dentalpro.db") == "Paciente en producción"


def test_rechazar_base_de_paquete_invalida(tmp_path: Path) -> None:
    origen = tmp_path / "portable" / "data"
    destino = tmp_path / "produccion" / "data"
    origen.mkdir(parents=True)
    (origen / "dentalpro.db").write_bytes(b"esto no es sqlite")

    with pytest.raises(RuntimeError, match="no es válida"):
        migrar_datos_heredados(origen, destino)

    assert not (destino / "dentalpro.db").exists()
