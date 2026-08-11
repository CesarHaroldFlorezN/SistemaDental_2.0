from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def crear_paciente_odontograma(sufijo: str) -> int:
    respuesta = client.post(
        "/api/pacientes",
        json={
            "nombre": f"Paciente Odontograma {sufijo}",
            "cedula": f"ODONTO-{sufijo}",
            "codigo_ficha": f"F-ODONTO-{sufijo}",
            "telefono": "999222333",
        },
    )
    assert respuesta.status_code == 200
    return respuesta.json()["id"]


def test_odontograma_guarda_version_inalterable_con_nomenclatura_nts() -> None:
    paciente_id = crear_paciente_odontograma("001")
    respuesta = client.post(
        "/api/odontogramas",
        json={
            "pacienteId": paciente_id,
            "motivo": "evaluacion_inicial",
            "denticion": "permanente",
            "hallazgos": [
                {
                    "codigo": "caries",
                    "nombre": "Lesión de caries dental",
                    "piezas": ["26"],
                    "sigla": "CD",
                    "color": "rojo",
                    "superficies": ["oclusal"],
                    "detalle": "Lesión a nivel de dentina",
                },
                {
                    "codigo": "restauracion_definitiva",
                    "nombre": "Restauración definitiva",
                    "piezas": ["16"],
                    "sigla": "R",
                    "color": "azul",
                    "superficies": ["oclusal"],
                },
            ],
            "especificaciones": "Pieza 16 con resina en buen estado",
            "observaciones": "",
        },
    )
    assert respuesta.status_code == 200
    registro = respuesta.json()
    assert registro["norma"] == "NTS 188-MINSA/DGIESP-2022"
    assert registro["profesionalNombre"] == "Usuario de pruebas"

    listado = client.get(f"/api/odontogramas?pacienteId={paciente_id}")
    assert listado.status_code == 200
    assert listado.json()[0]["id"] == registro["id"]

    modificar = client.put(
        f"/api/odontogramas/{registro['id']}",
        json={"observaciones": "No debe cambiar"},
    )
    assert modificar.status_code in {404, 405}


def test_odontograma_rechaza_color_contrario_a_la_norma() -> None:
    paciente_id = crear_paciente_odontograma("002")
    respuesta = client.post(
        "/api/odontogramas",
        json={
            "pacienteId": paciente_id,
            "motivo": "nuevo_hallazgo",
            "hallazgos": [
                {
                    "codigo": "caries",
                    "nombre": "Lesión de caries dental",
                    "piezas": ["11"],
                    "sigla": "CE",
                    "color": "azul",
                }
            ],
        },
    )
    assert respuesta.status_code == 422
    assert "color rojo" in respuesta.json()["detail"]
