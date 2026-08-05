from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def crear_paciente(sufijo: str) -> int:
    respuesta = client.post(
        "/api/pacientes",
        json={
            "nombre": f"Paciente Citas {sufijo}",
            "cedula": f"CITAS-{sufijo}",
            "codigo_ficha": f"F-CITAS-{sufijo}",
            "telefono": "999999999",
        },
    )

    assert respuesta.status_code == 200
    return respuesta.json()["id"]


def datos_cita(
    paciente_id: int,
    hora: str,
    hora_fin: str,
) -> dict:
    return {
        "pacienteId": paciente_id,
        "fecha": "2035-06-15",
        "hora": hora,
        "horaFin": hora_fin,
        "duracionMinutos": 60,
        "procedimiento": "Limpieza dental",
        "servicios": [
            {
                "nombre": "Limpieza dental",
                "costo": 100,
            }
        ],
        "notas": "Cita creada durante las pruebas",
        "estado": "pendiente",
        "costo": 100,
        "tipoPago": "contado",
        "montoPagado": 0,
        "metodoPago": "Efectivo",
        "sesionNum": 1,
        "totalSesiones": 1,
    }


def test_crear_cita_con_registro_financiero() -> None:
    paciente_id = crear_paciente("001")

    respuesta = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="09:00",
            hora_fin="10:00",
        ),
    )

    assert respuesta.status_code == 200

    resultado = respuesta.json()
    cita = resultado["cita"]
    pago = resultado["pago"]

    assert cita["pacienteId"] == paciente_id
    assert cita["hora"] == "09:00"
    assert cita["horaFin"] == "10:00"
    assert cita["estado"] == "pendiente"

    assert pago["citaId"] == cita["id"]
    assert pago["total"] == 100
    assert pago["cobrado"] == 0
    assert pago["saldo"] == 100

    respuesta_eliminar = client.delete(
        f"/api/operaciones/citas/{cita['id']}"
    )

    assert respuesta_eliminar.status_code == 200

    respuesta_eliminar_paciente = client.delete(
        f"/api/pacientes/{paciente_id}"
    )

    assert respuesta_eliminar_paciente.status_code == 200


def test_impedir_cruce_de_horarios() -> None:
    paciente_id = crear_paciente("002")

    primera_cita = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="10:00",
            hora_fin="11:00",
        ),
    )

    assert primera_cita.status_code == 200
    primera_cita_id = primera_cita.json()["cita"]["id"]

    cita_cruzada = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="10:30",
            hora_fin="11:30",
        ),
    )

    assert cita_cruzada.status_code == 409
    assert "se cruza" in cita_cruzada.json()["detail"]

    cita_contigua = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="11:00",
            hora_fin="12:00",
        ),
    )

    assert cita_contigua.status_code == 200
    cita_contigua_id = cita_contigua.json()["cita"]["id"]

    assert client.delete(
        f"/api/operaciones/citas/{cita_contigua_id}"
    ).status_code == 200

    assert client.delete(
        f"/api/operaciones/citas/{primera_cita_id}"
    ).status_code == 200

    assert client.delete(
        f"/api/pacientes/{paciente_id}"
    ).status_code == 200