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


def test_ejecutable_instalado_usa_programdata(
    monkeypatch,
    tmp_path: Path,
) -> None:
    programdata = tmp_path / "ProgramData"
    (programdata / "DentalPro").mkdir(parents=True)
    monkeypatch.setattr(config, "IS_FROZEN", True)
    monkeypatch.setenv("PROGRAMDATA", str(programdata))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "LocalAppData"))

    assert config._directorio_datos_predeterminado() == (
        programdata / "DentalPro" / "data"
    )


def test_ejecutable_portatil_usa_localappdata_sin_instalador(
    monkeypatch,
    tmp_path: Path,
) -> None:
    localappdata = tmp_path / "LocalAppData"
    monkeypatch.setattr(config, "IS_FROZEN", True)
    monkeypatch.setenv("PROGRAMDATA", str(tmp_path / "ProgramData"))
    monkeypatch.setenv("LOCALAPPDATA", str(localappdata))

    assert config._directorio_datos_predeterminado() == (
        localappdata / "DentalPro" / "data"
    )
