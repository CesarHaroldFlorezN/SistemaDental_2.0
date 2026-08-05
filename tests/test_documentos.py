from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def crear_paciente_documentos(sufijo: str) -> int:
    respuesta = client.post(
        "/api/pacientes",
        json={
            "nombre": f"Paciente Documentos {sufijo}",
            "cedula": f"DOC-{sufijo}",
            "codigo_ficha": f"F-DOC-{sufijo}",
            "telefono": "999999999",
        },
    )

    assert respuesta.status_code == 200
    return respuesta.json()["id"]


def test_subir_listar_descargar_y_eliminar_documento() -> None:
    paciente_id = crear_paciente_documentos("001")
    contenido = b"Contenido del documento clinico de prueba."

    respuesta_subir = client.post(
        f"/api/pacientes/{paciente_id}/documentos",
        files={
            "file": (
                "historia-clinica.txt",
                contenido,
                "text/plain",
            ),
        },
        data={
            "descripcion": "Historia clínica de prueba",
        },
    )

    assert respuesta_subir.status_code == 200

    documento = respuesta_subir.json()
    documento_id = documento["id"]

    assert documento["pacienteId"] == paciente_id
    assert documento["nombre"] == "historia-clinica.txt"
    assert documento["tipo"] == "text/plain"
    assert documento["descripcion"] == "Historia clínica de prueba"

    respuesta_listar = client.get(
        f"/api/pacientes/{paciente_id}/documentos"
    )

    assert respuesta_listar.status_code == 200
    assert any(
        item["id"] == documento_id
        for item in respuesta_listar.json()
    )

    respuesta_descargar = client.get(
        (
            f"/api/pacientes/{paciente_id}/documentos/"
            f"{documento_id}/descargar"
        )
    )

    assert respuesta_descargar.status_code == 200
    assert respuesta_descargar.content == contenido
    assert respuesta_descargar.headers["content-type"].startswith(
        "text/plain"
    )

    respuesta_eliminar = client.delete(
        f"/api/pacientes/{paciente_id}/documentos/{documento_id}"
    )

    assert respuesta_eliminar.status_code == 200
    assert (
        respuesta_eliminar.json()["message"]
        == "Documento eliminado."
    )

    respuesta_listar_final = client.get(
        f"/api/pacientes/{paciente_id}/documentos"
    )

    assert respuesta_listar_final.status_code == 200
    assert not any(
        item["id"] == documento_id
        for item in respuesta_listar_final.json()
    )

    respuesta_eliminar_paciente = client.delete(
        f"/api/pacientes/{paciente_id}"
    )

    assert respuesta_eliminar_paciente.status_code == 200