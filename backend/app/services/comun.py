from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

DOS_DECIMALES = Decimal("0.01")


def ahora_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def redondear_monto(valor: Any) -> Decimal:
    """Convierte cualquier valor numérico a Decimal con 2 decimales exactos.

    Se usa para TODOS los montos de dinero (pagos, saldos, costos) en vez
    de `round(float(x), 2)`. `float` no puede representar exactamente la
    mayoría de las cantidades decimales (0.10, 0.20, etc.), y sumar o
    restar montos repetidamente (como pasa en cada registro de pago)
    acumula errores de redondeo con el tiempo.

    Importante: si `valor` es un float, se convierte pasando primero por
    `str()`. `Decimal(0.1)` arrastra el valor binario impreciso de 0.1
    (0.1000000000000000055511151231257827021181583404541015625),
    mientras que `Decimal(str(0.1))` da exactamente `Decimal('0.1')`.
    """

    if valor is None:
        valor = 0

    if not isinstance(valor, Decimal):
        valor = Decimal(str(valor))

    return valor.quantize(DOS_DECIMALES, rounding=ROUND_HALF_UP)


def serializar_modelo(registro):
    return {
        columna.name: getattr(registro, columna.name)
        for columna in registro.__table__.columns
    }


def limpiar_valor_csv(valor: Any) -> str:
    return str(valor or "").strip()
