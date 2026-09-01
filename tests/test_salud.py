from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_estado_del_servidor() -> None:
    respuesta = client.get("/api/salud")

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ok"
    assert respuesta.json()["edicion"] == "oficial"
    assert respuesta.json()["aplicacion"] == "DentalPro"


def test_endpoint_de_reinicio_no_existe_en_edicion_oficial() -> None:
    respuesta = client.post(
        "/api/practica/restablecer",
        json={"confirmacion": "RESTABLECER PRACTICA"},
    )

    assert respuesta.status_code in {404, 405}
