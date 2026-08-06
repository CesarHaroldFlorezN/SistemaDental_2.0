import sqlite3
from contextlib import closing
from pathlib import Path

from backend.app.gestion_bd import (
    ejecutar_listado,
    ejecutar_restauracion,
)


def crear_base(ruta: Path, valor: str) -> None:
    with closing(sqlite3.connect(str(ruta))) as conexion:
        conexion.execute("CREATE TABLE datos (valor TEXT NOT NULL)")
        conexion.execute(
            "INSERT INTO datos (valor) VALUES (?)",
            (valor,),
        )
        conexion.commit()


def leer_valor(ruta: Path) -> str:
    with closing(sqlite3.connect(str(ruta))) as conexion:
        resultado = conexion.execute("SELECT valor FROM datos").fetchone()

    assert resultado is not None
    return resultado[0]


def test_listar_respaldo_valido(
    tmp_path: Path,
    capsys,
) -> None:
    respaldo = tmp_path / "dentalpro-20260806-000000-000000.db"
    crear_base(respaldo, "respaldo")

    resultado = ejecutar_listado(tmp_path)
    salida = capsys.readouterr().out

    assert resultado == 0
    assert respaldo.name in salida
    assert "válido" in salida


def test_cancelar_restauracion_sin_confirmacion(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    respaldo = tmp_path / "respaldo.db"

    crear_base(ruta_bd, "actual")
    crear_base(respaldo, "anterior")

    resultado = ejecutar_restauracion(
        archivo=str(respaldo),
        confirmacion=None,
        servidor_detenido=True,
        ruta_bd=ruta_bd,
        directorio=tmp_path / "respaldos",
    )

    assert resultado == 2
    assert leer_valor(ruta_bd) == "actual"


def test_restaurar_desde_herramienta_controlada(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    respaldo = tmp_path / "respaldo.db"
    directorio = tmp_path / "respaldos"

    crear_base(ruta_bd, "actual")
    crear_base(respaldo, "anterior")

    resultado = ejecutar_restauracion(
        archivo=str(respaldo),
        confirmacion="RESTAURAR",
        servidor_detenido=True,
        ruta_bd=ruta_bd,
        directorio=directorio,
    )

    assert resultado == 0
    assert leer_valor(ruta_bd) == "anterior"
