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

    respuesta_eliminar = client.delete(f"/api/operaciones/citas/{cita['id']}")

    assert respuesta_eliminar.status_code == 200

    respuesta_eliminar_paciente = client.delete(f"/api/pacientes/{paciente_id}")

    assert respuesta_eliminar_paciente.status_code == 200


def test_rechazar_fecha_y_hora_no_iso_antes_de_guardar() -> None:
    paciente_id = crear_paciente("TIPOS-FECHA")
    payload = datos_cita(
        paciente_id=paciente_id,
        hora="09:00",
        hora_fin="10:00",
    )

    fecha_invalida = client.post(
        "/api/operaciones/citas",
        json={**payload, "fecha": "15/06/2035"},
    )
    hora_invalida = client.post(
        "/api/operaciones/citas",
        json={**payload, "hora": "25:00"},
    )

    assert fecha_invalida.status_code == 422
    assert hora_invalida.status_code == 422
    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


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

    assert (
        client.delete(f"/api/operaciones/citas/{cita_contigua_id}").status_code == 200
    )

    assert client.delete(f"/api/operaciones/citas/{primera_cita_id}").status_code == 200

    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


def test_una_cita_cancelada_deja_el_horario_disponible() -> None:
    paciente_id = crear_paciente("002-CANCELADA")

    primera_cita = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="13:00",
            hora_fin="14:00",
        ),
    )
    assert primera_cita.status_code == 200
    primera_cita_id = primera_cita.json()["cita"]["id"]

    cancelacion = client.patch(
        f"/api/operaciones/citas/{primera_cita_id}/estado",
        json={"estado": "cancelada"},
    )
    assert cancelacion.status_code == 200

    nueva_cita = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="13:00",
            hora_fin="14:00",
        ),
    )
    assert nueva_cita.status_code == 200

    assert (
        client.delete(
            f"/api/operaciones/citas/{nueva_cita.json()['cita']['id']}"
        ).status_code
        == 200
    )
    assert client.delete(f"/api/operaciones/citas/{primera_cita_id}").status_code == 200
    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


def test_reprogramar_cita_activa() -> None:
    paciente_id = crear_paciente("003")

    respuesta_crear = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="15:00",
            hora_fin="16:00",
        ),
    )

    assert respuesta_crear.status_code == 200
    cita_id = respuesta_crear.json()["cita"]["id"]

    respuesta_reprogramar = client.patch(
        f"/api/operaciones/citas/{cita_id}/reprogramar",
        json={
            "fecha": "2035-06-16",
            "hora": "16:00",
            "horaFin": "17:00",
            "duracionMinutos": 60,
        },
    )

    assert respuesta_reprogramar.status_code == 200

    cita = respuesta_reprogramar.json()["cita"]

    assert cita["fecha"] == "2035-06-16"
    assert cita["hora"] == "16:00"
    assert cita["horaFin"] == "17:00"
    assert cita["duracionMinutos"] == 60

    assert client.delete(f"/api/operaciones/citas/{cita_id}").status_code == 200

    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


def test_actualizar_cita_y_pago() -> None:
    paciente_id = crear_paciente("004")

    respuesta_crear = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="08:00",
            hora_fin="09:00",
        ),
    )

    assert respuesta_crear.status_code == 200
    cita_id = respuesta_crear.json()["cita"]["id"]

    datos_actualizados = datos_cita(
        paciente_id=paciente_id,
        hora="09:00",
        hora_fin="10:00",
    )
    datos_actualizados.update(
        {
            "fecha": "2035-06-17",
            "procedimiento": "Resina dental",
            "servicios": [
                {
                    "nombre": "Resina dental",
                    "costo": 150,
                }
            ],
            "costo": 150,
            "notas": "Cita actualizada durante las pruebas",
        }
    )

    respuesta_actualizar = client.put(
        f"/api/operaciones/citas/{cita_id}",
        json=datos_actualizados,
    )

    assert respuesta_actualizar.status_code == 200

    resultado = respuesta_actualizar.json()
    cita = resultado["cita"]
    pago = resultado["pago"]

    assert cita["fecha"] == "2035-06-17"
    assert cita["hora"] == "09:00"
    assert cita["horaFin"] == "10:00"
    assert cita["procedimiento"] == "Resina dental"
    assert cita["costo"] == 150

    assert pago["total"] == 150
    assert pago["cobrado"] == 0
    assert pago["saldo"] == 150

    assert client.delete(f"/api/operaciones/citas/{cita_id}").status_code == 200

    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


def test_editar_servicios_sincroniza_plan_y_amortizacion() -> None:
    paciente_id = crear_paciente("PLAN-SYNC")
    payload = datos_cita(
        paciente_id=paciente_id,
        hora="12:00",
        hora_fin="13:00",
    )
    payload.update(
        {
            "fecha": "2035-06-25",
            "procedimiento": "Tratamiento inicial",
            "servicios": [{"nombre": "Tratamiento inicial", "costo": 400}],
            "costo": 400,
            "tipoPago": "cuotas",
        }
    )
    creada = client.post("/api/operaciones/citas", json=payload)
    assert creada.status_code == 200
    cita_id = creada.json()["cita"]["id"]
    pago_id = creada.json()["pago"]["id"]

    plan = client.post(
        "/api/planPagos",
        json={
            "pacienteId": paciente_id,
            "pagoId": pago_id,
            "citaId": cita_id,
            "concepto": "Tratamiento inicial",
            "cuotas": [
                {
                    "num": 1,
                    "tipo": "cuota",
                    "fecha": "2035-07-25",
                    "monto": 200,
                    "pagado": False,
                },
                {
                    "num": 2,
                    "tipo": "cuota",
                    "fecha": "2035-08-25",
                    "monto": 200,
                    "pagado": False,
                },
            ],
        },
    )
    assert plan.status_code == 200
    plan_id = plan.json()["id"]

    payload.update(
        {
            "procedimiento": "Tratamiento inicial + Corona",
            "servicios": [
                {"nombre": "Tratamiento inicial", "costo": 400},
                {"nombre": "Corona", "costo": 350},
            ],
            "costo": 750,
        }
    )
    actualizada = client.put(f"/api/operaciones/citas/{cita_id}", json=payload)
    assert actualizada.status_code == 200
    assert actualizada.json()["cita"]["costo"] == 750
    assert actualizada.json()["pago"]["total"] == 750
    assert actualizada.json()["pago"]["saldo"] == 750
    assert actualizada.json()["planPago"]["totalAcordado"] == 750
    assert [cuota["monto"] for cuota in actualizada.json()["planPago"]["cuotas"]] == [
        375,
        375,
    ]

    amortizacion = client.post(
        f"/api/planPagos/{plan_id}/adelantos",
        json={
            "monto": 100,
            "metodo": "Efectivo",
            "motivo": "Amortización directa",
            "usuario": "Pruebas",
        },
    )
    assert amortizacion.status_code == 200
    registro = amortizacion.json()["registro"]
    assert registro["cobrado"] == 100
    assert registro["saldo"] == 650
    assert [cuota["monto"] for cuota in registro["cuotas"]] == [325, 325]

    editado = client.put(
        f"/api/planPagos/{plan_id}",
        json={
            **registro,
            "concepto": "Tratamiento reprogramado",
            "metodoPreferido": "Yape",
            "cuotas": [
                {
                    "num": 1,
                    "tipo": "cuota",
                    "fecha": "2035-09-25",
                    "monto": 216.67,
                    "pagado": False,
                },
                {
                    "num": 2,
                    "tipo": "cuota",
                    "fecha": "2035-10-25",
                    "monto": 216.67,
                    "pagado": False,
                },
                {
                    "num": 3,
                    "tipo": "cuota",
                    "fecha": "2035-11-25",
                    "monto": 216.66,
                    "pagado": False,
                },
            ],
        },
    )
    assert editado.status_code == 200
    assert editado.json()["registro"]["concepto"] == "Tratamiento reprogramado"
    assert editado.json()["registro"]["metodoPreferido"] == "Yape"
    assert editado.json()["registro"]["saldo"] == 650

    eliminado = client.delete(f"/api/planPagos/{plan_id}")
    assert eliminado.status_code == 200
    pago = next(
        item for item in client.get("/api/pagos").json() if item["id"] == pago_id
    )
    assert pago["total"] == 750
    assert pago["cobrado"] == 100
    assert pago["saldo"] == 650
    assert pago["cuotas"] == []


def test_cambiar_estados_de_cita() -> None:
    paciente_id = crear_paciente("005")

    respuesta_crear = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="17:00",
            hora_fin="18:00",
        ),
    )

    assert respuesta_crear.status_code == 200
    cita_id = respuesta_crear.json()["cita"]["id"]

    respuesta_confirmar = client.patch(
        f"/api/operaciones/citas/{cita_id}/estado",
        json={"estado": "confirmada"},
    )

    assert respuesta_confirmar.status_code == 200
    assert respuesta_confirmar.json()["cita"]["estado"] == "confirmada"

    respuesta_atender = client.patch(
        f"/api/operaciones/citas/{cita_id}/estado",
        json={"estado": "en_atencion"},
    )

    assert respuesta_atender.status_code == 200
    assert respuesta_atender.json()["cita"]["estado"] == "en_atencion"
    assert respuesta_atender.json()["cita"]["inicio"]

    respuesta_completar = client.patch(
        f"/api/operaciones/citas/{cita_id}/estado",
        json={"estado": "completada"},
    )

    assert respuesta_completar.status_code == 200
    assert respuesta_completar.json()["cita"]["estado"] == "completada"
    assert respuesta_completar.json()["cita"]["fin"]

    assert client.delete(f"/api/operaciones/citas/{cita_id}").status_code == 200

    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200


def test_listar_y_actualizar_cita_desde_ruta_directa() -> None:
    paciente_id = crear_paciente("006")

    respuesta_crear = client.post(
        "/api/operaciones/citas",
        json=datos_cita(
            paciente_id=paciente_id,
            hora="19:00",
            hora_fin="20:00",
        ),
    )

    assert respuesta_crear.status_code == 200
    cita_id = respuesta_crear.json()["cita"]["id"]

    respuesta_listar = client.get("/api/citas")

    assert respuesta_listar.status_code == 200
    assert any(cita["id"] == cita_id for cita in respuesta_listar.json())
    respuesta_actualizar = client.put(
        f"/api/citas/{cita_id}",
        json={
            "fecha": "2035-06-18",
            "hora": "18:00",
            "horaFin": "19:00",
            "duracionMinutos": 60,
            "estado": "pendiente",
        },
    )

    assert respuesta_actualizar.status_code == 200

    cita = respuesta_actualizar.json()["registro"]

    assert cita["fecha"] == "2035-06-18"
    assert cita["hora"] == "18:00"
    assert cita["horaFin"] == "19:00"
    assert cita["duracionMinutos"] == 60

    assert client.delete(f"/api/operaciones/citas/{cita_id}").status_code == 200

    assert client.delete(f"/api/pacientes/{paciente_id}").status_code == 200
