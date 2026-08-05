"""Lanzador compatible de DentalPro."""

from backend.app.main import app, ejecutar


__all__ = [
    "app",
]


if __name__ == "__main__":
    ejecutar()