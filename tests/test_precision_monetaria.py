"""Pruebas de precisión decimal en montos de dinero.

Los montos (total, cobrado, saldo, etc.) se manejan como `Decimal` en
Python y se guardan en columnas `Numeric(10, 2)` en la base de datos, en
vez de `float` / `Float`. Ver `backend/app/services/comun.py::redondear_monto`
para el porqué: `float` no puede representar exactamente la mayoría de
los montos decimales, y sumar o restar dinero de forma repetida (como
pasa en cada pago, anulación o devolución) puede acumular errores de
redondeo con el tiempo. `Decimal` evita ese problema de raíz.
"""

from decimal import Decimal

from backend.app.database import SessionLocal
from backend.app.models import PacienteDB, PagoDB
from backend.app.schemas import OperacionPagoPayload
from backend.app.services import redondear_monto, registrar_pago
from backend.app.services.comun import ahora_iso


def test_redondear_monto_evita_el_error_clasico_de_binario() -> None:
    """Caso clásico: en float, 0.1 + 0.2 no da exactamente 0.3, y sumar
    0.10 mil veces no da exactamente 100.00. Con Decimal, sí.
    """

    acumulado_float = 0.0
    for _ in range(1000):
        acumulado_float += 0.10

    assert acumulado_float != 100.0  # el error de binario es real

    acumulado_decimal = Decimal("0.00")
    for _ in range(1000):
        acumulado_decimal = redondear_monto(acumulado_decimal + Decimal("0.10"))

    assert acumulado_decimal == Decimal("100.00")


def test_registrar_muchos_pagos_pequenos_da_saldo_exacto() -> None:
    """Prueba de regresión sobre la función real `registrar_pago` (la
    misma que usa la API): llamarla cientos de veces seguidas con montos
    pequeños debe dejar el saldo EXACTO, sin desviarse ni un centavo.
    """

    db = SessionLocal()

    try:
        paciente = PacienteDB(
            nombre="Paciente Precisión Decimal",
            cedula="PRECISION-001",
            codigo_ficha="F-PRECISION-001",
            telefono="999999999",
        )
        db.add(paciente)
        db.flush()

        total = Decimal("100.00")
        pago = PagoDB(
            pacienteId=paciente.id,
            concepto="Prueba de precisión decimal",
            fecha="2036-01-01",
            total=total,
            cobrado=Decimal("0.00"),
            saldo=total,
            metodo="Efectivo",
            tipoPago="cuotas",
            cuotas=[],
            creadoEn=ahora_iso(),
            devuelto=Decimal("0.00"),
            creditoFavor=Decimal("0.00"),
        )
        db.add(pago)
        db.commit()
        db.refresh(pago)

        # 500 pagos de 0.10 suman, matemáticamente, exactamente 50.00.
        for _ in range(500):
            registrar_pago(
                db,
                pago.id,
                OperacionPagoPayload(monto=Decimal("0.10")),
            )

        db.refresh(pago)

        assert pago.cobrado == Decimal("50.00")
        assert pago.saldo == Decimal("50.00")
        assert isinstance(pago.cobrado, Decimal)
    finally:
        db.rollback()
        db.close()
