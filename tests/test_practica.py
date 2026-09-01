from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from backend.app import practica
from backend.app.database import Base, crear_motor_sqlite
from backend.app.models import PacienteDB, UsuarioDB
from backend.app.seguridad import verificar_contrasena


@pytest.fixture
def sesiones_practica(tmp_path: Path, monkeypatch):
    ruta = tmp_path / "practica" / "dentalpro.db"
    ruta.parent.mkdir(parents=True)
    motor = crear_motor_sqlite(f"sqlite:///{ruta.as_posix()}")
    Base.metadata.create_all(bind=motor)
    fabrica = sessionmaker(bind=motor, autoflush=False)
    monkeypatch.setattr(practica, "ES_PRACTICA", True)
    monkeypatch.setattr(practica, "SessionLocal", fabrica)
    yield fabrica
    motor.dispose()


def test_edicion_oficial_rechaza_restablecimiento() -> None:
    with pytest.raises(RuntimeError, match="solo existe"):
        practica.restablecer_datos_practica(None)


def test_practica_se_inicializa_una_sola_vez(sesiones_practica) -> None:
    assert practica.inicializar_base_practica() is True
    assert practica.inicializar_base_practica() is False

    with sesiones_practica() as db:
        assert db.scalar(select(func.count()).select_from(PacienteDB)) == 3
        administrador = db.scalar(
            select(UsuarioDB).where(
                UsuarioDB.nombre_usuario == practica.USUARIO_PRACTICA
            )
        )
        assert administrador is not None
        assert administrador.rol == "administrador"


def test_restablecer_reemplaza_solo_datos_ficticios(sesiones_practica) -> None:
    practica.inicializar_base_practica()

    with sesiones_practica.begin() as db:
        db.add(PacienteDB(nombre="Paciente temporal"))
        db.add(
            UsuarioDB(
                nombre="Usuario temporal",
                nombre_usuario="temporal.practica",
                contrasena_hash="hash temporal",
                rol="recepcion",
                activo=True,
                intentos_fallidos=0,
                creado_en="2026-01-01T00:00:00+00:00",
                actualizado_en="2026-01-01T00:00:00+00:00",
                debe_cambiar_contrasena=False,
            )
        )

    with sesiones_practica.begin() as db:
        conteos = practica.restablecer_datos_practica(db)

    assert conteos["pacientes"] == 3
    with sesiones_practica() as db:
        assert db.scalar(select(func.count()).select_from(PacienteDB)) == 3
        administrador = db.scalar(
            select(UsuarioDB).where(
                UsuarioDB.nombre_usuario == practica.USUARIO_PRACTICA
            )
        )
        assert db.scalar(select(func.count()).select_from(UsuarioDB)) == 1
        assert verificar_contrasena(
            practica.CONTRASENA_PRACTICA_INICIAL,
            administrador.contrasena_hash,
        )
