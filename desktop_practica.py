"""Punto de entrada exclusivo de DentalPro Práctica."""

from desktop import ejecutar

if __name__ == "__main__":
    raise SystemExit(
        ejecutar(
            edicion_objetivo="practica",
            nombre_aplicacion="DentalPro Práctica",
        )
    )
