from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models import UsuarioDB
from backend.app.seguridad import verificar_contrasena
from backend.app.services.usuarios import (
    ErrorUsuario,
    UsuarioDuplicadoError,
    crear_usuario,
)


def crear_fabrica_sesiones(tmp_path: Path):
    motor = create_engine(f"sqlite:///{(tmp_path / 'usuarios.db').as_posix()}")
    UsuarioDB.__table__.create(motor)

    return motor, sessionmaker(bind=motor)


def test_crear_usuario_con_contrasena_protegida(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    with fabrica.begin() as db:
        usuario = crear_usuario(
            db,
            nombre="  César Flórez  ",
            nombre_usuario="  ADMIN.CESAR  ",
            contrasena="Clave dental segura 2026",
            rol="  ADMINISTRADOR  ",
        )

        assert usuario.id is not None
        assert usuario.nombre == "César Flórez"
        assert usuario.nombre_usuario == "admin.cesar"
        assert usuario.rol == "administrador"
        assert usuario.activo is True
        assert usuario.contrasena_hash != "Clave dental segura 2026"
        assert verificar_contrasena(
            "Clave dental segura 2026",
            usuario.contrasena_hash,
        )

    motor.dispose()


def test_impedir_nombre_usuario_duplicado(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    with fabrica.begin() as db:
        crear_usuario(
            db,
            nombre="Administrador",
            nombre_usuario="admin",
            contrasena="Primera clave segura 2026",
            rol="administrador",
        )

    with pytest.raises(UsuarioDuplicadoError), fabrica.begin() as db:
        crear_usuario(
            db,
            nombre="Usuario duplicado",
            nombre_usuario=" ADMIN ",
            contrasena="Segunda clave segura 2026",
            rol="recepcion",
        )

    motor.dispose()


def test_rechazar_rol_invalido(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    with pytest.raises(ErrorUsuario, match="Rol"), fabrica.begin() as db:
        crear_usuario(
            db,
            nombre="Usuario inválido",
            nombre_usuario="usuario",
            contrasena="Clave suficientemente segura",
            rol="superusuario",
        )

    motor.dispose()


def test_rechazar_nombre_usuario_invalido(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    with pytest.raises(ErrorUsuario, match="3 y 40"), fabrica.begin() as db:
        crear_usuario(
            db,
            nombre="Usuario inválido",
            nombre_usuario="usuario con espacios",
            contrasena="Clave suficientemente segura",
            rol="odontologo",
        )

    motor.dispose()
