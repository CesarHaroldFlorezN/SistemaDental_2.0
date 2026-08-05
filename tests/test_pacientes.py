from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def datos_paciente(sufijo: str) -> dict:
    return {
        "nombre": f"Paciente de Prueba {sufijo}",
        "cedula": f"DNI-{sufijo}",
        "codigo_ficha": f"TEST-{sufijo}",
        "telefono": "999999999",
        "correo": f"prueba{sufijo}@dentalpro.test",
    }


def test_crear_actualizar_y_eliminar_paciente() -> None:
    respuesta_crear = client.post(
        "/api/pacientes",
        json=datos_paciente("001"),
    )

    assert respuesta_crear.status_code == 200

    paciente = respuesta_crear.json()
    paciente_id = paciente["id"]

    respuesta_actualizar = client.put(
        f"/api/pacientes/{paciente_id}",
        json={"telefono": "988888888"},
    )

    assert respuesta_actualizar.status_code == 200
    assert (
        respuesta_actualizar.json()["registro"]["telefono"]
        == "988888888"
    )

    respuesta_listar = client.get("/api/pacientes")

    assert respuesta_listar.status_code == 200
    assert any(
        item["id"] == paciente_id
        for item in respuesta_listar.json()
    )

    respuesta_eliminar = client.delete(
        f"/api/pacientes/{paciente_id}"
    )

    assert respuesta_eliminar.status_code == 200


def test_no_permitir_dni_duplicado() -> None:
    paciente = datos_paciente("DUPLICADO")

    primera_respuesta = client.post(
        "/api/pacientes",
        json=paciente,
    )

    assert primera_respuesta.status_code == 200

    segunda_respuesta = client.post(
        "/api/pacientes",
        json={
            **paciente,
            "nombre": "Otro paciente",
            "codigo_ficha": "TEST-OTRO",
        },
    )

    assert segunda_respuesta.status_code == 400
    assert "ya está registrado" in segunda_respuesta.json()["detail"]

    paciente_id = primera_respuesta.json()["id"]
    client.delete(f"/api/pacientes/{paciente_id}")