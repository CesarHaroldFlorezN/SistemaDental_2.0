"""
Punto de entrada de DentalPro.

Temporalmente reutiliza la aplicación definida en el main.py principal.
Los módulos se migrarán progresivamente a backend/app.
"""

from main import app

__all__ = ["app"]