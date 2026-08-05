from datetime import datetime
from typing import Any


def ahora_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def serializar_modelo(registro):
    return {
        columna.name: getattr(registro, columna.name)
        for columna in registro.__table__.columns
    }


def limpiar_valor_csv(valor: Any) -> str:
    return str(valor or "").strip()
