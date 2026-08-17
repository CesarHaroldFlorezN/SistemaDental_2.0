from datetime import date, time

from sqlalchemy import Date, Time
from sqlalchemy.types import TypeDecorator


class FechaISO(TypeDecorator):
    """Columna SQL DATE que mantiene la salida JSON histórica AAAA-MM-DD."""

    impl = Date
    cache_ok = True

    def process_bind_param(self, value, dialect):
        del dialect
        if value in {None, ""}:
            return None
        if isinstance(value, date):
            return value
        return date.fromisoformat(str(value))

    def process_result_value(self, value, dialect):
        del dialect
        if value is None:
            return None
        if isinstance(value, date):
            return value.isoformat()
        return str(value)[:10]


class HoraISO(TypeDecorator):
    """Columna SQL TIME que mantiene la salida JSON histórica HH:MM."""

    impl = Time
    cache_ok = True

    def process_bind_param(self, value, dialect):
        del dialect
        if value in {None, ""}:
            return None
        if isinstance(value, time):
            return value
        return time.fromisoformat(str(value))

    def process_result_value(self, value, dialect):
        del dialect
        if value is None:
            return None
        if isinstance(value, time):
            return value.strftime("%H:%M")
        return str(value)[:5]
