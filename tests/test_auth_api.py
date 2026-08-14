from fastapi.testclient import TestClient

from backend.app.database import (
    COOKIE_ENTORNO_DATOS,
    ENTORNO_OFICIAL,
    ENTORNO_PRUEBAS,
    SessionLocal,
    TestSessionLocal,
)
from backend.app.dependencias import (
    COOKIE_SESION,
    obtener_usuario_actual,
)
from backend.app.main import app
from backend.app.services import crear_usuario

CONTRASENA_PRUEBA = "Contraseña segura de prueba 2026"


def crear_usuario_prueba(
    nombre_usuario: str,
    *,
    rol: str = "recepcion",
) -> None:
    with SessionLocal() as db:
        crear_usuario(
            db,
            nombre="Usuario de pruebas API",
            nombre_usuario=nombre_usuario,
            contrasena=CONTRASENA_PRUEBA,
            rol=rol,
        )
        db.commit()


def test_login_y_consulta_de_sesion() -> None:
    crear_usuario_prueba(
        "api.login",
        rol="administrador",
    )

    with TestClient(app) as client:
        respuesta_login = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": "api.login",
                "contrasena": CONTRASENA_PRUEBA,
            },
        )

        assert respuesta_login.status_code == 200
        assert respuesta_login.json()["usuario"]["nombreUsuario"] == "api.login"
        assert respuesta_login.json()["usuario"]["rol"] == "administrador"
        assert respuesta_login.json()["usuario"]["esPropietario"] is False
        assert respuesta_login.json()["usuario"]["entornoDatos"] == ENTORNO_OFICIAL

        encabezado_cookie = respuesta_login.headers["set-cookie"].lower()

        assert "httponly" in encabezado_cookie
        assert "samesite=strict" in encabezado_cookie
        assert client.cookies.get(COOKIE_SESION)
        assert client.cookies.get(COOKIE_ENTORNO_DATOS) == ENTORNO_OFICIAL

        respuesta_sesion = client.get("/api/auth/me")

        assert respuesta_sesion.status_code == 200
        assert respuesta_sesion.json()["usuario"]["nombreUsuario"] == "api.login"


def test_login_rechaza_credenciales_incorrectas() -> None:
    crear_usuario_prueba("api.invalido")

    with TestClient(app) as client:
        respuesta = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": "api.invalido",
                "contrasena": "Contraseña incorrecta 2026",
            },
        )

        assert respuesta.status_code == 401
        assert client.cookies.get(COOKIE_SESION) is None


def test_consulta_sesion_requiere_cookie() -> None:
    with TestClient(app) as client:
        respuesta = client.get("/api/auth/me")

        assert respuesta.status_code == 401


def test_logout_revoca_la_sesion() -> None:
    crear_usuario_prueba("api.logout")

    with TestClient(app) as client:
        respuesta_login = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": "api.logout",
                "contrasena": CONTRASENA_PRUEBA,
            },
        )

        assert respuesta_login.status_code == 200

        token = client.cookies.get(COOKIE_SESION)

        assert token

        respuesta_logout = client.post("/api/auth/logout")

        assert respuesta_logout.status_code == 200
        assert client.cookies.get(COOKIE_SESION) is None
        assert client.get("/api/auth/me").status_code == 401

    with TestClient(app) as otro_client:
        otro_client.cookies.set(
            COOKIE_SESION,
            token,
        )

        assert otro_client.get("/api/auth/me").status_code == 401


def test_adminpruebas_se_conecta_solo_a_base_pruebas() -> None:
    with TestSessionLocal() as db:
        crear_usuario(
            db,
            nombre="Administrador de Pruebas",
            nombre_usuario="adminpruebas",
            contrasena=CONTRASENA_PRUEBA,
            rol="administrador",
        )
        db.commit()

    with TestClient(app) as client:
        respuesta = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": "adminpruebas",
                "contrasena": CONTRASENA_PRUEBA,
            },
        )

        assert respuesta.status_code == 200
        assert respuesta.json()["usuario"]["entornoDatos"] == ENTORNO_PRUEBAS
        assert respuesta.json()["usuario"]["esPropietario"] is True
        assert client.cookies.get(COOKIE_ENTORNO_DATOS) == ENTORNO_PRUEBAS
        respuesta_sesion = client.get("/api/auth/me")
        assert respuesta_sesion.json()["usuario"]["entornoDatos"] == ENTORNO_PRUEBAS


def test_usuario_bloqueado_recibe_respuesta_423() -> None:
    crear_usuario_prueba("api.bloqueado")

    with TestClient(app) as client:
        for _ in range(5):
            respuesta = client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": "api.bloqueado",
                    "contrasena": "Contraseña incorrecta 2026",
                },
            )

            assert respuesta.status_code == 401

        respuesta_bloqueada = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": "api.bloqueado",
                "contrasena": CONTRASENA_PRUEBA,
            },
        )

        assert respuesta_bloqueada.status_code == 423


def test_rutas_clinicas_requieren_sesion() -> None:
    reemplazo_pruebas = app.dependency_overrides.pop(
        obtener_usuario_actual,
        None,
    )

    try:
        with TestClient(app) as client:
            respuesta_pacientes = client.get("/api/pacientes")
            respuesta_citas = client.get("/api/citas")
            respuesta_pagos = client.get("/api/pagos")
            respuesta_salud = client.get("/api/salud")

        assert respuesta_pacientes.status_code == 401
        assert respuesta_citas.status_code == 401
        assert respuesta_pagos.status_code == 401

        assert (
            respuesta_pacientes.json()["detail"]
            == "Debes iniciar sesión para continuar."
        )

        assert respuesta_salud.status_code == 200
    finally:
        if reemplazo_pruebas is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo_pruebas
