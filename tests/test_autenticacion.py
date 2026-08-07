from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.app.models import SesionDB, UsuarioDB
from backend.app.services.autenticacion import (
    MAX_INTENTOS_FALLIDOS,
    CredencialesInvalidasError,
    SesionInvalidaError,
    UsuarioBloqueadoError,
    iniciar_sesion,
    obtener_usuario_por_token,
    revocar_sesion,
)
from backend.app.services.usuarios import crear_usuario

CONTRASENA = "Contraseña administrativa segura 2026"


def crear_fabrica_sesiones(tmp_path: Path):
    motor = create_engine(f"sqlite:///{(tmp_path / 'autenticacion.db').as_posix()}")
    UsuarioDB.__table__.create(motor)
    SesionDB.__table__.create(motor)

    return motor, sessionmaker(bind=motor)


def crear_administrador(fabrica) -> int:
    with fabrica.begin() as db:
        usuario = crear_usuario(
            db,
            nombre="Administrador",
            nombre_usuario="admin",
            contrasena=CONTRASENA,
            rol="administrador",
        )

        return usuario.id


def test_iniciar_y_consultar_sesion(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    usuario_id = crear_administrador(fabrica)
    momento = datetime(2036, 1, 1, 12, tzinfo=UTC)

    with fabrica() as db:
        usuario, token = iniciar_sesion(
            db,
            nombre_usuario=" ADMIN ",
            contrasena=CONTRASENA,
            momento=momento,
        )

        sesion = db.scalar(select(SesionDB))

        assert usuario.id == usuario_id
        assert sesion is not None
        assert token != sesion.token_hash
        assert (
            obtener_usuario_por_token(
                db,
                token,
                momento=momento,
            ).id
            == usuario_id
        )

    motor.dispose()


def test_bloquear_despues_de_intentos_fallidos(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    crear_administrador(fabrica)
    momento = datetime(2036, 1, 1, 12, tzinfo=UTC)

    for _ in range(MAX_INTENTOS_FALLIDOS):
        with fabrica() as db, pytest.raises(CredencialesInvalidasError):
            iniciar_sesion(
                db,
                nombre_usuario="admin",
                contrasena="Contraseña equivocada",
                momento=momento,
            )

    with fabrica() as db:
        usuario = db.scalar(select(UsuarioDB))

        assert usuario is not None
        assert usuario.intentos_fallidos == MAX_INTENTOS_FALLIDOS
        assert usuario.bloqueado_hasta is not None

    with fabrica() as db, pytest.raises(UsuarioBloqueadoError):
        iniciar_sesion(
            db,
            nombre_usuario="admin",
            contrasena=CONTRASENA,
            momento=momento + timedelta(minutes=1),
        )

    with fabrica() as db:
        usuario, _token = iniciar_sesion(
            db,
            nombre_usuario="admin",
            contrasena=CONTRASENA,
            momento=momento + timedelta(minutes=16),
        )

        assert usuario.intentos_fallidos == 0
        assert usuario.bloqueado_hasta is None

    motor.dispose()


def test_revocar_sesion(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    crear_administrador(fabrica)
    momento = datetime(2036, 1, 1, 12, tzinfo=UTC)

    with fabrica() as db:
        _usuario, token = iniciar_sesion(
            db,
            nombre_usuario="admin",
            contrasena=CONTRASENA,
            momento=momento,
        )

        assert revocar_sesion(
            db,
            token,
            momento=momento,
        )

        with pytest.raises(SesionInvalidaError):
            obtener_usuario_por_token(
                db,
                token,
                momento=momento,
            )

    motor.dispose()


def test_rechazar_sesion_vencida(
    tmp_path: Path,
) -> None:
    motor, fabrica = crear_fabrica_sesiones(tmp_path)
    crear_administrador(fabrica)
    momento = datetime(2036, 1, 1, 12, tzinfo=UTC)

    with fabrica() as db:
        _usuario, token = iniciar_sesion(
            db,
            nombre_usuario="admin",
            contrasena=CONTRASENA,
            momento=momento,
        )

        with pytest.raises(SesionInvalidaError):
            obtener_usuario_por_token(
                db,
                token,
                momento=momento + timedelta(hours=9),
            )

    motor.dispose()
