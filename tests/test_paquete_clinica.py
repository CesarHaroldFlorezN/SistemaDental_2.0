import json
import sqlite3
from pathlib import Path

from scripts.preparar_paquete_clinica import preparar, validar_base


def _crear_base(ruta: Path, valor: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(ruta) as conexion:
        conexion.execute("CREATE TABLE control (valor TEXT NOT NULL)")
        conexion.execute("INSERT INTO control (valor) VALUES (?)", (valor,))


def test_paquete_privado_excluye_bases_auxiliares_y_registros(
    tmp_path: Path,
) -> None:
    origen = tmp_path / "data"
    destino = tmp_path / "salida" / "payload-clinica"
    _crear_base(origen / "dentalpro.db", "oficial")
    _crear_base(origen / "dentalpro_original.db", "original")
    _crear_base(origen / "dentalpro_pruebas.db", "pruebas")
    _crear_base(origen / "dentalpro_vacia.db", "vacia")
    (origen / "logs").mkdir()
    (origen / "logs" / "dentalpro.log").write_text("privado", encoding="utf-8")
    (origen / "documentos").mkdir()
    (origen / "documentos" / "archivo.txt").write_text(
        "documento",
        encoding="utf-8",
    )

    manifiesto = preparar(origen, destino)

    assert validar_base(destino / "dentalpro.db")
    assert (destino / "documentos" / "archivo.txt").is_file()
    assert not (destino / "dentalpro_original.db").exists()
    assert not (destino / "dentalpro_pruebas.db").exists()
    assert not (destino / "dentalpro_vacia.db").exists()
    assert not (destino / "logs").exists()
    datos = json.loads(manifiesto.read_text(encoding="utf-8"))
    assert datos["archivo"] == "dentalpro.db"
    assert datos["incluye_documentos"] is True
