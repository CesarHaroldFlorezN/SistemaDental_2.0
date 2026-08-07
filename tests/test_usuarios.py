from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.app.models import SesionDB, UsuarioDB
from backend.app.seguridad import verificar_contrasena
from backend.app.services.usuarios import (
    ErrorUsuario,
    UsuarioDuplicadoError,
    UsuarioNoEncontradoError,
    cambiar_contrasena_usuario,
    crear_usuario,
)


def crear_fabrica_sesiones(tmp_path: Path):
    motor = create_engine(f"sqlite:///{(tmp_path / 'usuarios.db').as_posix()}")
    UsuarioDB.__table__.create(motor)
    SesionDB.__table__.create(motor)

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


def test_cambiar_contrasena_reinicia_bloqueo_y_revoca_sesiones(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    contrasena_anterior = "Primera clave segura 2026"
    contrasena_nueva = "Segunda clave segura 2026"

    with fabrica.begin() as db:
        usuario = crear_usuario(
            db,
            nombre="Recepción",
            nombre_usuario="recepcion.prueba",
            contrasena=contrasena_anterior,
            rol="recepcion",
        )
        usuario.intentos_fallidos = 4
        usuario.bloqueado_hasta = "2099-01-01T00:00:00+00:00"
        db.flush()

        usuario_id = usuario.id
        db.add(
            SesionDB(
                usuario_id=usuario_id,
                token_hash="a" * 64,
                creada_en="2026-08-07T10:00:00+00:00",
                expira_en="2026-08-07T18:00:00+00:00",
            )
        )

    with fabrica.begin() as db:
        cambiar_contrasena_usuario(
            db,
            nombre_usuario=" RECEPCION.PRUEBA ",
            nueva_contrasena=contrasena_nueva,
        )

    with fabrica() as db:
        usuario = db.get(UsuarioDB, usuario_id)
        sesion = db.scalar(select(SesionDB))

        assert usuario is not None
        assert not verificar_contrasena(
            contrasena_anterior,
            usuario.contrasena_hash,
        )
        assert verificar_contrasena(
            contrasena_nueva,
            usuario.contrasena_hash,
        )
        assert usuario.intentos_fallidos == 0
        assert usuario.bloqueado_hasta is None
        assert sesion is not None
        assert sesion.revocada_en is not None

    motor.dispose()


def test_no_cambiar_contrasena_de_usuario_inexistente(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)

    with pytest.raises(UsuarioNoEncontradoError), fabrica.begin() as db:
        cambiar_contrasena_usuario(
            db,
            nombre_usuario="no.existe",
            nueva_contrasena="Nueva clave suficientemente segura",
        )

    motor.dispose()
