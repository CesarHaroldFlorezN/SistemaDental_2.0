from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_catalogo_inicial_es_canonico() -> None:
    respuesta = client.get("/api/servicios?incluirInactivos=true")

    assert respuesta.status_code == 200
    catalogo = respuesta.json()
    assert len(catalogo) >= 14

    ortodoncia = next(
        servicio
        for servicio in catalogo
        if servicio["codigo"] == "ortodoncia-colocacion"
    )
    assert ortodoncia["nombre"] == "Ortodoncia — colocación"
    assert ortodoncia["categoria"] == "Ortodoncia"


def test_administrador_crea_edita_y_desactiva_servicio() -> None:
    creado = client.post(
        "/api/servicios",
        json={
            "nombre": "Sellante dental de prueba",
            "categoria": "Prevención",
            "precio": 85.5,
            "activo": True,
        },
    )
    assert creado.status_code == 201
    servicio_id = creado.json()["id"]
    assert creado.json()["precio"] == "85.50"

    editado = client.put(
        f"/api/servicios/{servicio_id}",
        json={
            "nombre": "Sellante dental pediátrico de prueba",
            "categoria": "Odontopediatría",
            "precio": 95,
            "activo": False,
        },
    )
    assert editado.status_code == 200
    assert editado.json()["activo"] is False
    assert editado.json()["precio"] == "95.00"

    activos = client.get("/api/servicios").json()
    assert all(servicio["id"] != servicio_id for servicio in activos)


def test_catalogo_rechaza_alias_duplicado() -> None:
    respuesta = client.post(
        "/api/servicios",
        json={
            "nombre": "Ortodoncia - colocacion",
            "categoria": "Ortodoncia",
            "precio": 300,
            "activo": True,
        },
    )

    assert respuesta.status_code == 409
    assert "equivalente" in respuesta.json()["detail"]


def test_cita_guarda_id_y_nombre_canonico_desde_alias() -> None:
    paciente = client.post(
        "/api/pacientes",
        json={
            "nombre": "Paciente Catálogo",
            "cedula": "CATALOGO-001",
            "codigo_ficha": "F-CATALOGO-001",
        },
    )
    assert paciente.status_code == 200
    paciente_id = paciente.json()["id"]

    respuesta = client.post(
        "/api/operaciones/citas",
        json={
            "pacienteId": paciente_id,
            "fecha": "2037-03-21",
            "hora": "08:00",
            "horaFin": "09:00",
            "duracionMinutos": 60,
            "procedimiento": "Ortodoncia - colocacion",
            "servicios": [
                {
                    "nombre": "Ortodoncia - colocacion",
                    "costo": 300,
                }
            ],
            "estado": "pendiente",
            "costo": 300,
            "tipoPago": "contado",
            "montoPagado": 0,
            "metodoPago": "Pendiente",
        },
    )

    assert respuesta.status_code == 200
    cita = respuesta.json()["cita"]
    assert cita["procedimiento"] == "Ortodoncia — colocación"
    assert cita["servicios"][0]["servicioId"] is not None
    assert cita["servicios"][0]["nombre"] == "Ortodoncia — colocación"

    assert client.delete(f"/api/operaciones/citas/{cita['id']}").status_code == 200
    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200
