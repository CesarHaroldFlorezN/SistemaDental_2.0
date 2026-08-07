from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.dependencias import obtener_usuario_actual
from backend.app.main import app


def usuario_recepcion() -> SimpleNamespace:
    return SimpleNamespace(
        id=20,
        nombre="Usuario Recepción",
        nombre_usuario="recepcion.pruebas",
        rol="recepcion",
        activo=True,
    )


def usuario_odontologo() -> SimpleNamespace:
    return SimpleNamespace(
        id=22,
        nombre="Usuario Odontólogo",
        nombre_usuario="odontologo.pruebas",
        rol="odontologo",
        activo=True,
    )


def usuario_administrador() -> SimpleNamespace:
    return SimpleNamespace(
        id=21,
        nombre="Usuario Administrador",
        nombre_usuario="admin.pruebas",
        rol="administrador",
        activo=True,
    )


def test_solo_administrador_puede_eliminar_pacientes() -> None:
    reemplazo_original = app.dependency_overrides.get(
        obtener_usuario_actual,
    )

    try:
        app.dependency_overrides[obtener_usuario_actual] = usuario_recepcion

        with TestClient(app) as client:
            respuesta_recepcion = client.delete(
                "/api/pacientes/999999",
            )

        assert respuesta_recepcion.status_code == 403
        assert (
            respuesta_recepcion.json()["detail"]
            == "No tienes permisos para realizar esta acción."
        )

        app.dependency_overrides[obtener_usuario_actual] = usuario_administrador

        with TestClient(app) as client:
            respuesta_administrador = client.delete(
                "/api/pacientes/999999",
            )

        assert respuesta_administrador.status_code == 404
    finally:
        if reemplazo_original is None:
            app.dependency_overrides.pop(
                obtener_usuario_actual,
                None,
            )
        else:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo_original


def test_documentos_solo_para_personal_clinico() -> None:
    reemplazo_original = app.dependency_overrides.get(
        obtener_usuario_actual,
    )

    try:
        app.dependency_overrides[obtener_usuario_actual] = usuario_recepcion

        with TestClient(app) as client:
            respuesta_recepcion = client.get(
                "/api/pacientes/999999/documentos",
            )

        assert respuesta_recepcion.status_code == 403

        app.dependency_overrides[obtener_usuario_actual] = usuario_odontologo

        with TestClient(app) as client:
            respuesta_odontologo = client.get(
                "/api/pacientes/999999/documentos",
            )

        assert respuesta_odontologo.status_code == 404
    finally:
        if reemplazo_original is None:
            app.dependency_overrides.pop(
                obtener_usuario_actual,
                None,
            )
        else:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo_original


def test_finanzas_para_administracion_y_recepcion() -> None:
    reemplazo_original = app.dependency_overrides.get(
        obtener_usuario_actual,
    )

    try:
        app.dependency_overrides[obtener_usuario_actual] = usuario_recepcion

        with TestClient(app) as client:
            respuesta_recepcion = client.get("/api/pagos")

        assert respuesta_recepcion.status_code == 200

        app.dependency_overrides[obtener_usuario_actual] = usuario_odontologo

        with TestClient(app) as client:
            respuesta_odontologo = client.get("/api/pagos")

        assert respuesta_odontologo.status_code == 403
    finally:
        if reemplazo_original is None:
            app.dependency_overrides.pop(
                obtener_usuario_actual,
                None,
            )
        else:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo_original


def test_eliminar_pago_solo_para_administrador() -> None:
    reemplazo_original = app.dependency_overrides.get(
        obtener_usuario_actual,
    )

    try:
        app.dependency_overrides[obtener_usuario_actual] = usuario_recepcion

        with TestClient(app) as client:
            respuesta_recepcion = client.delete(
                "/api/pagos/999999",
            )

        assert respuesta_recepcion.status_code == 403

        app.dependency_overrides[obtener_usuario_actual] = usuario_administrador

        with TestClient(app) as client:
            respuesta_administrador = client.delete(
                "/api/pagos/999999",
            )

        assert respuesta_administrador.status_code == 404
    finally:
        if reemplazo_original is None:
            app.dependency_overrides.pop(
                obtener_usuario_actual,
                None,
            )
        else:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo_original
