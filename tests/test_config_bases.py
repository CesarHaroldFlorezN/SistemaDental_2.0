from pathlib import Path

import pytest

from backend.app import config


def test_rechazar_variable_heredada_apuntando_a_pruebas(
    monkeypatch,
) -> None:
    monkeypatch.setenv(
        "DENTALPRO_DATA_DIR",
        str(Path("C:/DentalPro/pruebas")),
    )
    monkeypatch.setattr(
        config,
        "DATA_DIR",
        Path("C:/DentalPro/pruebas"),
    )

    with pytest.raises(RuntimeError, match="Configuración insegura"):
        config.validar_aislamiento_bases()
