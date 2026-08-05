from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_estado_del_servidor() -> None:
    respuesta = client.get("/api/salud")

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ok"
