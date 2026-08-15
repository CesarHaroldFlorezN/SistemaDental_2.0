from __future__ import annotations

import re
import unicodedata


def normalizar_clave_servicio(valor: str) -> str:
    """Genera una clave comparable, independiente de tildes y signos."""

    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = "".join(
        caracter for caracter in texto if not unicodedata.combining(caracter)
    )
    texto = re.sub(r"[^a-zA-Z0-9]+", " ", texto).strip().lower()
    return re.sub(r"\s+", " ", texto)


SERVICIOS_INICIALES = (
    ("consulta-evaluacion", "Consulta de evaluación", "Diagnóstico"),
    ("profilaxis-limpieza", "Profilaxis / Limpieza dental", "Prevención"),
    ("empaste-resina", "Empaste / Resina", "Restauración"),
    ("endodoncia", "Endodoncia", "Endodoncia"),
    ("extraccion-simple", "Extracción simple", "Cirugía"),
    (
        "extraccion-muela-juicio",
        "Extracción de muela del juicio",
        "Cirugía",
    ),
    ("corona-dental", "Corona dental", "Rehabilitación"),
    ("implante-dental", "Implante dental", "Implantología"),
    ("blanqueamiento-dental", "Blanqueamiento dental", "Estética"),
    ("ortodoncia-colocacion", "Ortodoncia — colocación", "Ortodoncia"),
    ("ortodoncia-control", "Ortodoncia — control", "Ortodoncia"),
    ("protesis-dental", "Prótesis dental", "Rehabilitación"),
    ("radiografia-dental", "Radiografía dental", "Radiología"),
    ("cirugia-oral", "Cirugía oral", "Cirugía"),
)


_CODIGO_POR_CLAVE = {
    normalizar_clave_servicio(nombre): codigo
    for codigo, nombre, _categoria in SERVICIOS_INICIALES
}

_ALIAS = {
    "evaluacion": "consulta-evaluacion",
    "consulta de evaluacion": "consulta-evaluacion",
    "limpieza dental": "profilaxis-limpieza",
    "profilaxis": "profilaxis-limpieza",
    "endodoncia canal": "endodoncia",
    "extraccion muela juicio": "extraccion-muela-juicio",
    "blanqueamiento": "blanqueamiento-dental",
    "ortodoncia colocacion": "ortodoncia-colocacion",
    "ortodoncia control": "ortodoncia-control",
    "rayos x": "radiografia-dental",
}

CODIGO_POR_ALIAS = {
    **_CODIGO_POR_CLAVE,
    **{normalizar_clave_servicio(alias): codigo for alias, codigo in _ALIAS.items()},
}
