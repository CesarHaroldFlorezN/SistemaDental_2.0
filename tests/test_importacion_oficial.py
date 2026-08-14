import json
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.gestion_bd import ejecutar_importacion_json_oficial
from backend.app.importacion_oficial import (
    ErrorImportacionOficial,
    importar_json_oficial,
    preparar_json_oficial,
)
from backend.app.migrations import aplicar_migraciones
from backend.app.models import PacienteDB, SesionDB, UsuarioDB


def datos_json_oficial() -> dict:
    return {
        "v": 1,
        "ts": "2026-08-13T23:14:33.790Z",
        "pacientes": [
            {
                "id": 10,
                "nombre": "Paciente oficial",
                "cedula": "DNI-OFICIAL-10",
                "nacimiento": "1990-05-12",
                "genero": "Femenino",
                "telefono": "999999999",
                "codigo_ficha": "FICHA-OFICIAL-10",
                "direccion": "Dirección oficial",
                "alergias": "",
                "medicamentos": "",
                "fechaReg": "2026-08-13",
            }
        ],
        "citas": [
            {
                "id": 20,
                "pacienteId": 10,
                "planId": None,
                "citaBaseId": None,
                "fecha": "2026-08-20",
                "hora": "10:00",
                "procedimiento": "Evaluación",
                "notas": "",
                "notasFin": None,
                "costo": 100,
                "tipoPago": "contado",
                "estado": "pendiente",
                "sesionNum": 1,
                "totalSesiones": 1,
                "creadaEn": "2026-08-13T23:14:33.790Z",
                "inicio": None,
                "fin": None,
                "motivoCancelacion": None,
                "canceladaEn": None,
            }
        ],
        "pagos": [
            {
                "id": 30,
                "pacienteId": 10,
                "citaId": 20,
                "concepto": "Evaluación",
                "fecha": "2026-08-20",
                "total": 100,
                "cobrado": 0,
                "saldo": 100,
                "metodo": "Pendiente",
                "tipoPago": "contado",
                "cuotas": [],
                "creadoEn": "2026-08-13T23:14:33.790Z",
                "fechaUltPago": None,
                "nota": None,
                "devuelto": None,
                "creditoFavor": None,
            }
        ],
        "planes": [],
        "planPagos": [],
    }


def escribir_json(ruta: Path, datos: dict) -> None:
    ruta.write_text(
        json.dumps(datos, ensure_ascii=False),
        encoding="utf-8",
    )


def crear_base_actual(ruta: Path) -> None:
    motor = create_engine(f"sqlite:///{ruta.as_posix()}")
    Base.metadata.create_all(bind=motor)

    with motor.begin() as conexion:
        aplicar_migraciones(conexion)

    Sesion = sessionmaker(bind=motor)
    with Sesion() as db:
        db.add(
            UsuarioDB(
                id=1,
                nombre="Administrador actual",
                nombre_usuario="admin",
                contrasena_hash="hash-conservado",
                rol="administrador",
                activo=True,
                intentos_fallidos=0,
                creado_en="2026-08-01T10:00:00-05:00",
                actualizado_en="2026-08-01T10:00:00-05:00",
            )
        )
        db.add(
            SesionDB(
                id=1,
                usuario_id=1,
                token_hash="a" * 64,
                creada_en="2026-08-01T10:00:00-05:00",
                expira_en="2026-08-15T10:00:00-05:00",
            )
        )
        db.add(
            PacienteDB(
                id=1,
                nombre="Paciente anterior",
                cedula="DNI-ANTERIOR",
                codigo_ficha="FICHA-ANTERIOR",
            )
        )
        db.commit()

    motor.dispose()


def contar(ruta: Path, tabla: str) -> int:
    with closing(sqlite3.connect(str(ruta))) as conexion:
        return int(conexion.execute(f'SELECT COUNT(*) FROM "{tabla}"').fetchone()[0])


def test_reemplazar_datos_y_conservar_usuarios(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    ruta_json = tmp_path / "DentalPro_oficial.json"
    respaldos = tmp_path / "respaldos"
    crear_base_actual(ruta_bd)
    escribir_json(ruta_json, datos_json_oficial())

    resultado = importar_json_oficial(
        ruta_json,
        ruta_bd=ruta_bd,
        directorio_respaldos=respaldos,
    )

    assert resultado.usuarios_conservados == 1
    assert resultado.respaldo_previo is not None
    assert resultado.respaldo_previo.is_file()
    assert contar(ruta_bd, "pacientes") == 1
    assert contar(ruta_bd, "citas") == 1
    assert contar(ruta_bd, "pagos") == 1
    assert contar(ruta_bd, "usuarios") == 1
    assert contar(ruta_bd, "sesiones") == 0
    assert contar(ruta_bd, "importacionesOficiales") == 1
    assert contar(resultado.respaldo_previo, "pacientes") == 1

    with closing(sqlite3.connect(str(ruta_bd))) as conexion:
        paciente = conexion.execute(
            "SELECT id, nombre, fechaNacimiento FROM pacientes"
        ).fetchone()
        usuario = conexion.execute(
            "SELECT nombre_usuario, contrasena_hash FROM usuarios"
        ).fetchone()

    assert paciente == (10, "Paciente oficial", "1990-05-12")
    assert usuario == ("admin", "hash-conservado")


def test_rechazar_ficha_duplicada_sin_modificar_la_base(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    ruta_json = tmp_path / "duplicados.json"
    respaldos = tmp_path / "respaldos"
    crear_base_actual(ruta_bd)
    datos = datos_json_oficial()
    duplicado = dict(datos["pacientes"][0])
    duplicado.update(
        id=11,
        nombre="Segundo paciente",
        cedula="DNI-OFICIAL-11",
    )
    datos["pacientes"].append(duplicado)
    escribir_json(ruta_json, datos)

    with pytest.raises(ErrorImportacionOficial, match="duplicado"):
        importar_json_oficial(
            ruta_json,
            ruta_bd=ruta_bd,
            directorio_respaldos=respaldos,
        )

    assert contar(ruta_bd, "pacientes") == 1
    assert not respaldos.exists()

    preparado = preparar_json_oficial(
        ruta_json,
        resolver_duplicados_ficha=True,
    )
    fichas = {paciente["codigo_ficha"] for paciente in preparado.pacientes}
    assert len(fichas) == 2
    assert any("sufijo" in ajuste for ajuste in preparado.ajustes)


def test_exigir_aceptacion_de_advertencias(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    ruta_json = tmp_path / "fecha-implausible.json"
    respaldos = tmp_path / "respaldos"
    crear_base_actual(ruta_bd)
    datos = datos_json_oficial()
    datos["pacientes"][0]["nacimiento"] = "0205-11-21"
    escribir_json(ruta_json, datos)

    with pytest.raises(ErrorImportacionOficial, match="advertencias"):
        importar_json_oficial(
            ruta_json,
            ruta_bd=ruta_bd,
            directorio_respaldos=respaldos,
        )

    assert contar(ruta_bd, "pacientes") == 1

    resultado = importar_json_oficial(
        ruta_json,
        ruta_bd=ruta_bd,
        directorio_respaldos=respaldos,
        aceptar_advertencias=True,
    )
    assert resultado.datos.advertencias
    assert contar(ruta_bd, "pacientes") == 1


def test_comando_requiere_confirmacion_y_servidor_detenido(
    tmp_path: Path,
) -> None:
    ruta_bd = tmp_path / "dentalpro.db"
    ruta_json = tmp_path / "oficial.json"
    crear_base_actual(ruta_bd)
    escribir_json(ruta_json, datos_json_oficial())

    assert (
        ejecutar_importacion_json_oficial(
            archivo=str(ruta_json),
            confirmacion=None,
            servidor_detenido=True,
            resolver_duplicados_ficha=False,
            aceptar_advertencias=False,
            ruta_bd=ruta_bd,
            directorio=tmp_path / "respaldos",
        )
        == 2
    )
    assert (
        ejecutar_importacion_json_oficial(
            archivo=str(ruta_json),
            confirmacion="REEMPLAZAR",
            servidor_detenido=False,
            resolver_duplicados_ficha=False,
            aceptar_advertencias=False,
            ruta_bd=ruta_bd,
            directorio=tmp_path / "respaldos",
        )
        == 2
    )
    assert contar(ruta_bd, "pacientes") == 1
