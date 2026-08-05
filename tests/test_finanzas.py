from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def crear_cita_financiera(
    sufijo: str,
    hora: str,
) -> tuple[int, int, int]:
    respuesta_paciente = client.post(
        "/api/pacientes",
        json={
            "nombre": f"Paciente Finanzas {sufijo}",
            "cedula": f"FIN-{sufijo}",
            "codigo_ficha": f"F-FIN-{sufijo}",
            "telefono": "999999999",
        },
    )

    assert respuesta_paciente.status_code == 200
    paciente_id = respuesta_paciente.json()["id"]

    respuesta_cita = client.post(
        "/api/operaciones/citas",
        json={
            "pacienteId": paciente_id,
            "fecha": "2036-07-20",
            "hora": hora,
            "horaFin": (
                "10:00"
                if hora == "09:00"
                else "14:00"
            ),
            "duracionMinutos": 60,
            "procedimiento": "Tratamiento dental",
            "servicios": [
                {
                    "nombre": "Tratamiento dental",
                    "costo": 200,
                }
            ],
            "notas": "Prueba financiera",
            "estado": "pendiente",
            "costo": 200,
            "tipoPago": "contado",
            "montoPagado": 0,
            "metodoPago": "Efectivo",
            "sesionNum": 1,
            "totalSesiones": 1,
        },
    )

    assert respuesta_cita.status_code == 200

    resultado = respuesta_cita.json()

    return (
        paciente_id,
        resultado["cita"]["id"],
        resultado["pago"]["id"],
    )


def test_registrar_anular_y_devolver_pago() -> None:
    paciente_id, _, pago_id = crear_cita_financiera(
        sufijo="001",
        hora="09:00",
    )

    respuesta_pago = client.post(
        f"/api/operaciones/pagos/{pago_id}/registrar",
        json={
            "monto": 80,
            "metodo": "Efectivo",
            "referencia": "PAGO-001",
            "usuario": "Pruebas",
        },
    )

    assert respuesta_pago.status_code == 200
    assert respuesta_pago.json()["pago"]["cobrado"] == 80
    assert respuesta_pago.json()["pago"]["saldo"] == 120
    assert respuesta_pago.json()["movimiento"]["tipo"] == "pago"
    assert respuesta_pago.json()["movimiento"]["abono"] == 80

    respuesta_anulacion = client.post(
        f"/api/operaciones/pagos/{pago_id}/anular",
        json={
            "monto": 30,
            "metodo": "Efectivo",
            "motivo": "Cobro registrado por error",
            "referencia": "ANULACION-001",
            "usuario": "Pruebas",
        },
    )

    assert respuesta_anulacion.status_code == 200
    assert respuesta_anulacion.json()["pago"]["cobrado"] == 50
    assert respuesta_anulacion.json()["pago"]["saldo"] == 150
    assert (
        respuesta_anulacion.json()["movimiento"]["tipo"]
        == "anulacion"
    )
    assert respuesta_anulacion.json()["movimiento"]["cargo"] == 30

    respuesta_devolucion = client.post(
        f"/api/operaciones/pagos/{pago_id}/devolver",
        json={
            "monto": 20,
            "metodo": "Efectivo",
            "motivo": "Devolución solicitada por el paciente",
            "referencia": "DEVOLUCION-001",
            "usuario": "Pruebas",
        },
    )

    assert respuesta_devolucion.status_code == 200
    assert respuesta_devolucion.json()["pago"]["cobrado"] == 30
    assert respuesta_devolucion.json()["pago"]["saldo"] == 170
    assert respuesta_devolucion.json()["pago"]["devuelto"] == 20
    assert (
        respuesta_devolucion.json()["movimiento"]["tipo"]
        == "devolucion"
    )

    respuesta_cuenta = client.get(
        f"/api/pacientes/{paciente_id}/cuenta"
    )

    assert respuesta_cuenta.status_code == 200

    cuenta = respuesta_cuenta.json()
    tipos = {
        movimiento["tipo"]
        for movimiento in cuenta["movimientos"]
    }

    assert "cargo" in tipos
    assert "pago" in tipos
    assert "anulacion" in tipos
    assert "devolucion" in tipos

    assert cuenta["resumen"]["cargos"] == 250
    assert cuenta["resumen"]["abonos"] == 80
    assert cuenta["resumen"]["saldo"] == 170


def test_no_modificar_ni_eliminar_movimiento_financiero() -> None:
    paciente_id, _, pago_id = crear_cita_financiera(
        sufijo="002",
        hora="13:00",
    )

    respuesta_pago = client.post(
        f"/api/operaciones/pagos/{pago_id}/registrar",
        json={
            "monto": 50,
            "metodo": "Tarjeta",
            "referencia": "PAGO-PROTEGIDO",
            "usuario": "Pruebas",
        },
    )

    assert respuesta_pago.status_code == 200
    movimiento_id = respuesta_pago.json()["movimiento"]["id"]

    respuesta_modificar = client.put(
        f"/api/movimientosCuenta/{movimiento_id}",
        json={
            "descripcion": "Movimiento alterado",
            "abono": 9999,
        },
    )

    assert respuesta_modificar.status_code == 405
    assert "inmutable" in respuesta_modificar.json()["detail"]

    respuesta_eliminar = client.delete(
        f"/api/movimientosCuenta/{movimiento_id}"
    )

    assert respuesta_eliminar.status_code == 405
    assert "inmutable" in respuesta_eliminar.json()["detail"]

    respuesta_cuenta = client.get(
        f"/api/pacientes/{paciente_id}/cuenta"
    )

    assert respuesta_cuenta.status_code == 200
    assert any(
        movimiento.get("id") == movimiento_id
        for movimiento in respuesta_cuenta.json()["movimientos"]
    )