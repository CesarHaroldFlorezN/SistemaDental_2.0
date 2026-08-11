from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def crear_paciente(sufijo: str = "001") -> int:
    respuesta = client.post(
        "/api/pacientes",
        json={
            "nombre": f"Paciente Flujo Clínico {sufijo}",
            "cedula": f"FLUJO-CLINICO-{sufijo}",
            "codigo_ficha": f"F-FLUJO-{sufijo}",
            "telefono": "999111222",
        },
    )
    assert respuesta.status_code == 200
    return respuesta.json()["id"]


def datos_cita(
    paciente_id: int,
    hora: str,
    **extras: object,
) -> dict:
    datos = {
        "pacienteId": paciente_id,
        "tipoCita": "procedimiento",
        "motivoConsulta": "Atención de prueba",
        "piezaDental": "26",
        "fecha": "2040-08-12",
        "hora": hora,
        "horaFin": f"{int(hora[:2]) + 1:02d}:00",
        "duracionMinutos": 60,
        "procedimiento": "Atención odontológica",
        "servicios": [{"nombre": "Atención odontológica", "costo": 300}],
        "notas": "Flujo clínico-financiero",
        "estado": "pendiente",
        "costo": 300,
        "tipoPago": "contado",
        "montoPagado": 0,
        "metodoPago": "Pendiente",
        "sesionNum": 1,
        "totalSesiones": 1,
    }
    datos.update(extras)
    return datos


def test_diagnostico_plan_sesiones_y_cuotas_quedan_vinculados() -> None:
    paciente_id = crear_paciente("002")

    diagnostico = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id,
            "08:00",
            tipoCita="diagnostico_inicial",
            motivoConsulta="Dolor de muela después de un mes",
            procedimiento="Evaluación y diagnóstico",
            servicios=[{"nombre": "Evaluación y diagnóstico", "costo": 80}],
            costo=80,
        ),
    )
    assert diagnostico.status_code == 200
    caso = diagnostico.json()["casoClinico"]
    assert caso["tipo"] == "diagnostico"
    assert diagnostico.json()["pago"]["casoClinicoId"] == caso["id"]

    respuesta_plan = client.post(
        "/api/planes",
        json={
            "pacienteId": paciente_id,
            "casoClinicoId": caso["id"],
            "nombre": "Endodoncia pieza 26",
            "tipo": "Endodoncia",
            "duracion": "3 meses",
            "costo": 900,
            "nSesiones": 3,
            "descripcion": "Tratamiento indicado después del diagnóstico",
            "estado": "activo",
        },
    )
    assert respuesta_plan.status_code == 200
    plan = respuesta_plan.json()
    assert [sesion["numero"] for sesion in plan["sesiones"]] == [1, 2, 3]
    assert all(sesion["estado"] == "pendiente" for sesion in plan["sesiones"])
    assert plan["pago"]["total"] == 900
    assert plan["pago"]["planId"] == plan["id"]

    sesiones = plan["sesiones"]
    primera = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id,
            "10:00",
            casoClinicoId=caso["id"],
            planId=plan["id"],
            sesionPlanId=sesiones[0]["id"],
            tipoCita="sesion_tratamiento",
            procedimiento="Sesión 1 de endodoncia",
        ),
    )
    assert primera.status_code == 200
    assert primera.json()["pago"]["id"] == plan["pago"]["id"]
    assert primera.json()["cita"]["costo"] == 0
    assert primera.json()["sesionPlan"]["estado"] == "agendada"

    segunda = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id,
            "12:00",
            casoClinicoId=caso["id"],
            planId=plan["id"],
            sesionPlanId=sesiones[1]["id"],
            tipoCita="sesion_tratamiento",
            procedimiento="Sesión 2 de endodoncia",
        ),
    )
    assert segunda.status_code == 200

    segunda_id = segunda.json()["cita"]["id"]
    inicio_anticipado = client.patch(
        f"/api/operaciones/citas/{segunda_id}/estado",
        json={"estado": "en_atencion"},
    )
    assert inicio_anticipado.status_code == 409
    assert "sesión 1" in inicio_anticipado.json()["detail"]

    primera_id = primera.json()["cita"]["id"]
    assert (
        client.patch(
            f"/api/operaciones/citas/{primera_id}/estado",
            json={"estado": "en_atencion"},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/operaciones/citas/{primera_id}/estado",
            json={"estado": "completada"},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/operaciones/citas/{segunda_id}/estado",
            json={"estado": "en_atencion"},
        ).status_code
        == 200
    )

    cuotas = [
        {
            "num": numero,
            "tipo": "cuota",
            "fecha": f"2040-{8 + numero:02d}-12",
            "monto": 300,
            "pagado": False,
            "sesionPlanId": sesiones[numero - 1]["id"],
            "sesionNum": numero,
        }
        for numero in range(1, 4)
    ]
    respuesta_cuotas = client.post(
        "/api/planPagos",
        json={
            "pacienteId": paciente_id,
            "casoClinicoId": caso["id"],
            "planId": plan["id"],
            "pagoId": plan["pago"]["id"],
            "concepto": plan["nombre"],
            "totalAcordado": 900,
            "anticipo": 0,
            "metodoPreferido": "Por definir",
            "estado": "activo",
            "cuotas": cuotas,
            "totalCuotas": 900,
            "cobrado": 0,
            "saldo": 900,
            "fechaCreacion": "2040-08-12",
        },
    )
    assert respuesta_cuotas.status_code == 200
    assert respuesta_cuotas.json()["origen"] == "plan_tratamiento"
    assert respuesta_cuotas.json()["planId"] == plan["id"]
    assert respuesta_cuotas.json()["pagoId"] == plan["pago"]["id"]

    plan_pago = respuesta_cuotas.json()
    cuotas[0] = {
        **cuotas[0],
        "pagado": True,
        "fechaPago": "2040-09-12",
        "metodoPago": "Efectivo",
    }
    pago_primera_cuota = client.put(
        f"/api/planPagos/{plan_pago['id']}",
        json={**plan_pago, "cuotas": cuotas, "estado": "activo"},
    )
    assert pago_primera_cuota.status_code == 200
    assert pago_primera_cuota.json()["registro"]["cobrado"] == 300
    assert pago_primera_cuota.json()["registro"]["saldo"] == 600

    cuotas_segunda = [
        dict(cuota) for cuota in pago_primera_cuota.json()["registro"]["cuotas"]
    ]
    cuotas_segunda[1] = {
        **cuotas_segunda[1],
        "pagado": True,
        "fechaPago": "2040-10-12",
        "metodoPago": "Yape",
        "referencia": "CUOTA-002",
    }
    pago_segunda_cuota = client.put(
        f"/api/planPagos/{plan_pago['id']}",
        json={**plan_pago, "cuotas": cuotas_segunda, "estado": "activo"},
    )
    assert pago_segunda_cuota.status_code == 200
    assert pago_segunda_cuota.json()["registro"]["cobrado"] == 600
    assert pago_segunda_cuota.json()["registro"]["saldo"] == 300

    cuotas_adulteradas = [
        dict(cuota) for cuota in pago_segunda_cuota.json()["registro"]["cuotas"]
    ]
    cuotas_adulteradas[0]["monto"] = 599
    cuotas_adulteradas[2] = {
        **cuotas_adulteradas[2],
        "monto": 1,
        "pagado": True,
        "fechaPago": "2040-11-12",
        "metodoPago": "Efectivo",
    }
    pago_con_montos_adulterados = client.put(
        f"/api/planPagos/{plan_pago['id']}",
        json={**plan_pago, "cuotas": cuotas_adulteradas},
    )
    assert pago_con_montos_adulterados.status_code == 400
    assert "cronograma" in pago_con_montos_adulterados.json()["detail"]

    cuenta = client.get(f"/api/pacientes/{paciente_id}/cuenta")
    assert cuenta.status_code == 200
    movimientos_cuota = [
        movimiento
        for movimiento in cuenta.json()["movimientos"]
        if movimiento["tipo"] == "pago_cuota"
    ]
    assert any(
        "cuota 2 · sesión 2" in movimiento["descripcion"]
        and movimiento["referencia"] == "CUOTA-002"
        for movimiento in movimientos_cuota
    )

    cuotas_incompletas = cuotas_segunda[:2]
    romper_vinculo = client.put(
        f"/api/planPagos/{plan_pago['id']}",
        json={**plan_pago, "cuotas": cuotas_incompletas},
    )
    assert romper_vinculo.status_code == 400
    assert "cuota por sesión" in romper_vinculo.json()["detail"]


def test_adelanto_del_plan_recalcula_cuotas_y_deja_movimiento() -> None:
    paciente_id = crear_paciente()
    respuesta_plan = client.post(
        "/api/planes",
        json={
            "pacienteId": paciente_id,
            "nombre": "Endodoncia con adelanto",
            "tipo": "Endodoncia",
            "duracion": "3 meses",
            "costo": 900,
            "nSesiones": 3,
            "descripcion": "Plan para probar el adelanto auditable",
            "estado": "activo",
        },
    )
    assert respuesta_plan.status_code == 200
    plan = respuesta_plan.json()
    cuotas = [
        {
            "num": sesion["numero"],
            "tipo": "cuota",
            "fecha": f"2041-0{sesion['numero']}-10",
            "monto": 300,
            "pagado": False,
            "sesionPlanId": sesion["id"],
            "sesionNum": sesion["numero"],
        }
        for sesion in plan["sesiones"]
    ]
    creado = client.post(
        "/api/planPagos",
        json={
            "pacienteId": paciente_id,
            "planId": plan["id"],
            "pagoId": plan["pago"]["id"],
            "concepto": plan["nombre"],
            "cuotas": cuotas,
            "fechaCreacion": "2040-12-10",
        },
    )
    assert creado.status_code == 200

    adelanto = client.post(
        f"/api/planPagos/{creado.json()['id']}/adelantos",
        json={
            "monto": 60,
            "metodo": "Yape",
            "referencia": "ADELANTO-001",
            "motivo": "Adelanto voluntario",
            "usuario": "Pruebas",
        },
    )
    assert adelanto.status_code == 200
    registro = adelanto.json()["registro"]
    assert registro["anticipo"] == 60
    assert registro["cobrado"] == 60
    assert registro["saldo"] == 840
    assert [cuota["monto"] for cuota in registro["cuotas"]] == [280, 280, 280]

    cuenta = client.get(f"/api/pacientes/{paciente_id}/cuenta")
    assert cuenta.status_code == 200
    movimiento = next(
        item for item in cuenta.json()["movimientos"] if item["tipo"] == "adelanto_plan"
    )
    assert movimiento["abono"] == 60
    assert movimiento["referencia"] == "ADELANTO-001"
