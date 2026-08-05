from datetime import datetime
from typing import Any


def ahora_iso() -> str:
    """Devuelve la fecha y hora local en formato ISO."""

    return datetime.now().astimezone().isoformat(timespec="seconds")


def serializar_modelo(registro: Any) -> dict[str, Any]:
    """Convierte un modelo SQLAlchemy en un diccionario."""

    return {
        columna.name: getattr(registro, columna.name)
        for columna in registro.__table__.columns
    }


def limpiar_texto(valor: Any) -> str:
    return str(valor or "").strip()


def redondear_moneda(valor: Any) -> float:
    return round(float(valor or 0), 2)
