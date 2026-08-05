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
            "horaFin": {
                "09:00": "10:00",
                "13:00": "14:00",
                "15:00": "16:00",
            }[hora],
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
    assert respuesta_anulacion.json()["movimiento"]["tipo"] == "anulacion"
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
    assert respuesta_devolucion.json()["movimiento"]["tipo"] == "devolucion"

    respuesta_cuenta = client.get(f"/api/pacientes/{paciente_id}/cuenta")

    assert respuesta_cuenta.status_code == 200

    cuenta = respuesta_cuenta.json()
    tipos = {movimiento["tipo"] for movimiento in cuenta["movimientos"]}

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

    respuesta_eliminar = client.delete(f"/api/movimientosCuenta/{movimiento_id}")

    assert respuesta_eliminar.status_code == 405
    assert "inmutable" in respuesta_eliminar.json()["detail"]

    respuesta_cuenta = client.get(f"/api/pacientes/{paciente_id}/cuenta")

    assert respuesta_cuenta.status_code == 200
    assert any(
        movimiento.get("id") == movimiento_id
        for movimiento in respuesta_cuenta.json()["movimientos"]
    )


def test_crud_de_recursos_financieros() -> None:
    paciente_id, cita_id, pago_id = crear_cita_financiera(
        sufijo="003",
        hora="15:00",
    )

    respuesta_listar_pagos = client.get("/api/pagos")

    assert respuesta_listar_pagos.status_code == 200
    assert any(pago["id"] == pago_id for pago in respuesta_listar_pagos.json())

    respuesta_actualizar_pago = client.put(
        f"/api/pagos/{pago_id}",
        json={
            "nota": "Pago revisado durante las pruebas",
        },
    )

    assert respuesta_actualizar_pago.status_code == 200
    assert (
        respuesta_actualizar_pago.json()["registro"]["nota"]
        == "Pago revisado durante las pruebas"
    )

    respuesta_pago_manual = client.post(
        "/api/pagos",
        json={
            "pacienteId": paciente_id,
            "concepto": "Pago manual de prueba",
            "fecha": "2036-07-20",
            "total": 50,
            "cobrado": 0,
            "saldo": 50,
            "metodo": "Efectivo",
            "tipoPago": "contado",
            "cuotas": [],
            "devuelto": 0,
            "creditoFavor": 0,
        },
    )

    assert respuesta_pago_manual.status_code == 200
    pago_manual_id = respuesta_pago_manual.json()["id"]

    respuesta_movimiento_manual = client.post(
        "/api/movimientosCuenta",
        json={
            "pacienteId": paciente_id,
            "pagoId": pago_manual_id,
            "tipo": "pago",
            "descripcion": "Movimiento financiero directo",
            "cargo": 0,
            "abono": 50,
            "fecha": "2036-07-20",
            "metodo": "Efectivo",
            "referencia": "MOVIMIENTO-003",
            "usuario": "Pruebas",
        },
    )

    assert respuesta_movimiento_manual.status_code == 200
    movimiento_manual_id = respuesta_movimiento_manual.json()["id"]

    respuesta_listar_movimientos = client.get("/api/movimientosCuenta")

    assert respuesta_listar_movimientos.status_code == 200
    assert any(
        movimiento["id"] == movimiento_manual_id
        for movimiento in respuesta_listar_movimientos.json()
    )

    respuesta_plan = client.post(
        "/api/planes",
        json={
            "pacienteId": paciente_id,
            "nombre": "Plan dental de prueba",
            "tipo": "Tratamiento",
            "duracion": "3 meses",
            "costo": 600,
            "nSesiones": 3,
            "descripcion": "Plan creado durante las pruebas",
            "estado": "activo",
        },
    )

    assert respuesta_plan.status_code == 200
    plan_id = respuesta_plan.json()["id"]

    respuesta_listar_planes = client.get("/api/planes")

    assert respuesta_listar_planes.status_code == 200
    assert any(plan["id"] == plan_id for plan in respuesta_listar_planes.json())

    respuesta_actualizar_plan = client.put(
        f"/api/planes/{plan_id}",
        json={
            "estado": "completado",
        },
    )

    assert respuesta_actualizar_plan.status_code == 200
    assert respuesta_actualizar_plan.json()["registro"]["estado"] == "completado"

    respuesta_plan_pago = client.post(
        "/api/planPagos",
        json={
            "pacienteId": paciente_id,
            "pagoId": pago_id,
            "citaId": cita_id,
            "concepto": "Plan de cuotas de prueba",
            "totalAcordado": 200,
            "anticipo": 0,
            "metodoPreferido": "Efectivo",
            "estado": "activo",
            "cuotas": [],
            "totalCuotas": 2,
            "cobrado": 0,
            "saldo": 200,
            "fechaCreacion": "2036-07-20",
        },
    )

    assert respuesta_plan_pago.status_code == 200
    plan_pago_id = respuesta_plan_pago.json()["id"]

    respuesta_listar_plan_pagos = client.get("/api/planPagos")

    assert respuesta_listar_plan_pagos.status_code == 200
    assert any(
        plan["id"] == plan_pago_id for plan in respuesta_listar_plan_pagos.json()
    )

    respuesta_actualizar_plan_pago = client.put(
        f"/api/planPagos/{plan_pago_id}",
        json={
            "estado": "finalizado",
        },
    )

    assert respuesta_actualizar_plan_pago.status_code == 200
    assert respuesta_actualizar_plan_pago.json()["registro"]["estado"] == "finalizado"

    assert client.delete(f"/api/planPagos/{plan_pago_id}").status_code == 200

    assert client.delete(f"/api/planes/{plan_id}").status_code == 200

    assert client.delete(f"/api/pagos/{pago_manual_id}").status_code == 200

    assert client.delete(f"/api/operaciones/citas/{cita_id}").status_code == 200

    respuesta_eliminar_paciente = client.delete(f"/api/pacientes/{paciente_id}")

    assert respuesta_eliminar_paciente.status_code == 409
