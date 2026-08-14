from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import (
    DATABASE_URL,
    DOCUMENTOS_DIR,
    TEST_DATABASE_URL,
    TEST_DOCUMENTOS_DIR,
)

ENTORNO_OFICIAL = "oficial"
ENTORNO_PRUEBAS = "pruebas"
COOKIE_ENTORNO_DATOS = "dentalpro_entorno_datos"


class Base(DeclarativeBase):
    """Clase base para todos los modelos de la base de datos."""


def crear_motor_sqlite(url: str) -> Engine:
    motor = create_engine(
        url,
        connect_args={
            "check_same_thread": False,
            "timeout": 15,
        },
    )

    @event.listens_for(motor, "connect")
    def configurar_sqlite(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.close()

    return motor


engine = crear_motor_sqlite(DATABASE_URL)
test_engine = crear_motor_sqlite(TEST_DATABASE_URL)


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
TestSessionLocal = sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
)


def normalizar_entorno_datos(valor: str | None) -> str:
    return ENTORNO_PRUEBAS if valor == ENTORNO_PRUEBAS else ENTORNO_OFICIAL


def fabrica_sesiones_entorno(entorno: str):
    return (
        TestSessionLocal
        if normalizar_entorno_datos(entorno) == ENTORNO_PRUEBAS
        else SessionLocal
    )


def entorno_desde_request(request: Request) -> str:
    entorno = normalizar_entorno_datos(request.cookies.get(COOKIE_ENTORNO_DATOS))
    request.state.entorno_datos = entorno
    return entorno


def directorio_documentos_request(request: Request):
    return (
        TEST_DOCUMENTOS_DIR
        if entorno_desde_request(request) == ENTORNO_PRUEBAS
        else DOCUMENTOS_DIR
    )


def get_db(request: Request) -> Generator[Session, None, None]:
    db = fabrica_sesiones_entorno(entorno_desde_request(request))()

    try:
        yield db
    finally:
        db.close()
