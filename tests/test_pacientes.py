import csv
import io

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
    assert respuesta_actualizar.json()["registro"]["telefono"] == "988888888"

    respuesta_listar = client.get("/api/pacientes")

    assert respuesta_listar.status_code == 200
    assert any(item["id"] == paciente_id for item in respuesta_listar.json())

    respuesta_eliminar = client.delete(f"/api/pacientes/{paciente_id}")

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


def test_exportar_pacientes_csv() -> None:
    respuesta_crear = client.post(
        "/api/pacientes",
        json=datos_paciente("CSV-EXPORT"),
    )

    assert respuesta_crear.status_code == 200
    paciente_id = respuesta_crear.json()["id"]

    respuesta_exportar = client.get("/api/exportar/pacientes")

    assert respuesta_exportar.status_code == 200
    assert respuesta_exportar.headers["content-type"].startswith("text/csv")

    texto_csv = respuesta_exportar.content.decode("utf-8-sig")

    lector = csv.DictReader(io.StringIO(texto_csv))

    pacientes = list(lector)

    paciente_exportado = next(
        (paciente for paciente in pacientes if paciente["cedula"] == "DNI-CSV-EXPORT"),
        None,
    )

    assert paciente_exportado is not None
    assert paciente_exportado["nombre"] == "Paciente de Prueba CSV-EXPORT"
    assert paciente_exportado["codigo_ficha"] == "TEST-CSV-EXPORT"
    assert paciente_exportado["telefono"] == "999999999"

    respuesta_eliminar = client.delete(f"/api/pacientes/{paciente_id}")

    assert respuesta_eliminar.status_code == 200


def test_importar_y_actualizar_paciente_desde_csv() -> None:
    contenido_inicial = (
        "codigo_ficha,cedula,nombre,telefono,correo\n"
        "CSV-IMPORT,DNI-CSV-IMPORT,"
        "Paciente Importado,955555555,"
        "importado@dentalpro.test\n"
    )

    respuesta_importar = client.post(
        "/api/importar/pacientes",
        files={
            "file": (
                "pacientes.csv",
                contenido_inicial.encode("utf-8"),
                "text/csv",
            ),
        },
    )

    assert respuesta_importar.status_code == 200
    assert "1 nuevos" in respuesta_importar.json()["message"]

    respuesta_listar = client.get("/api/pacientes")

    assert respuesta_listar.status_code == 200

    paciente = next(
        (
            item
            for item in respuesta_listar.json()
            if item["cedula"] == "DNI-CSV-IMPORT"
        ),
        None,
    )

    assert paciente is not None
    assert paciente["nombre"] == "Paciente Importado"
    assert paciente["telefono"] == "955555555"

    paciente_id = paciente["id"]

    contenido_actualizado = (
        "codigo_ficha,cedula,nombre,telefono,correo\n"
        "CSV-IMPORT,DNI-CSV-IMPORT,"
        "Paciente Importado Actualizado,966666666,"
        "actualizado@dentalpro.test\n"
    )

    respuesta_actualizar = client.post(
        "/api/importar/pacientes",
        files={
            "file": (
                "pacientes.csv",
                contenido_actualizado.encode("utf-8"),
                "text/csv",
            ),
        },
    )

    assert respuesta_actualizar.status_code == 200
    assert "1 actualizados" in respuesta_actualizar.json()["message"]

    respuesta_listar_actualizado = client.get("/api/pacientes")

    paciente_actualizado = next(
        item
        for item in respuesta_listar_actualizado.json()
        if item["id"] == paciente_id
    )

    assert paciente_actualizado["nombre"] == "Paciente Importado Actualizado"
    assert paciente_actualizado["telefono"] == "966666666"
    assert paciente_actualizado["correo"] == "actualizado@dentalpro.test"

    respuesta_eliminar = client.delete(f"/api/pacientes/{paciente_id}")

    assert respuesta_eliminar.status_code == 200
