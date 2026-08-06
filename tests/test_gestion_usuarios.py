from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.app.gestion_usuarios import (
    ejecutar_creacion_administrador,
    solicitar_contrasena,
)
from backend.app.models import UsuarioDB
from backend.app.seguridad import verificar_contrasena


def crear_fabrica_sesiones(tmp_path: Path):
    motor = create_engine(f"sqlite:///{(tmp_path / 'gestion-usuarios.db').as_posix()}")
    UsuarioDB.__table__.create(motor)

    return motor, sessionmaker(bind=motor)


def test_confirmar_contrasena() -> None:
    respuestas = iter(
        [
            "Contraseña administrativa segura 2026",
            "Contraseña administrativa segura 2026",
        ]
    )

    contrasena = solicitar_contrasena(lambda _mensaje: next(respuestas))

    assert contrasena == "Contraseña administrativa segura 2026"


def test_rechazar_confirmacion_diferente() -> None:
    respuestas = iter(
        [
            "Primera clave segura 2026",
            "Segunda clave segura 2026",
        ]
    )

    with pytest.raises(ValueError, match="no coinciden"):
        solicitar_contrasena(lambda _mensaje: next(respuestas))


def test_crear_administrador_sin_mostrar_contrasena(
    tmp_path: Path,
    capsys,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    contrasena = "Clave administrativa segura 2026"

    codigo = ejecutar_creacion_administrador(
        nombre="César Flórez",
        nombre_usuario="admin",
        contrasena=contrasena,
        fabrica_sesiones=fabrica,
    )

    salida = capsys.readouterr()

    assert codigo == 0
    assert "Administrador creado correctamente" in salida.out
    assert contrasena not in salida.out
    assert contrasena not in salida.err

    with fabrica() as db:
        usuario = db.scalar(select(UsuarioDB))

        assert usuario is not None
        assert usuario.nombre_usuario == "admin"
        assert usuario.rol == "administrador"
        assert verificar_contrasena(
            contrasena,
            usuario.contrasena_hash,
        )

    motor.dispose()


def test_impedir_administrador_duplicado(
    tmp_path: Path,
    capsys,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    datos = {
        "nombre": "Administrador",
        "nombre_usuario": "admin",
        "contrasena": "Clave administrativa segura 2026",
        "fabrica_sesiones": fabrica,
    }

    assert ejecutar_creacion_administrador(**datos) == 0
    assert ejecutar_creacion_administrador(**datos) == 1

    salida = capsys.readouterr()

    assert "ya existe" in salida.err

    motor.dispose()
