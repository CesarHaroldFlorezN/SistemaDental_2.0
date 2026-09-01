from pathlib import Path

import pytest

from backend.app import config, main


def test_rechazar_variable_heredada_apuntando_a_pruebas(
    monkeypatch,
) -> None:
    ruta_solicitada = Path("C:/DentalPro/otra-base.db")
    monkeypatch.setenv("DENTALPRO_DB_PATH", str(ruta_solicitada))

    assert config.DB_PATH.name == "dentalpro.db"
    assert config.DB_PATH != ruta_solicitada

    with pytest.raises(RuntimeError, match="DENTALPRO_DB_PATH"):
        config.validar_base_unica()


def test_pruebas_usan_unico_nombre_en_carpeta_temporal() -> None:
    assert config.MODO_PRUEBAS is True
    assert config.DB_PATH == config.DATA_DIR / "dentalpro.db"


def test_windows_usa_programdata_como_ubicacion_oficial(monkeypatch) -> None:
    monkeypatch.setattr(config.sys, "platform", "win32")
    monkeypatch.setenv("PROGRAMDATA", "C:/ProgramData")

    assert config._directorio_datos_predeterminado() == Path(
        "C:/ProgramData/DentalPro/data"
    )


def test_windows_usa_otra_carpeta_fija_para_practica(monkeypatch) -> None:
    monkeypatch.setattr(config.sys, "platform", "win32")
    monkeypatch.setenv("PROGRAMDATA", "C:/ProgramData")

    assert config._directorio_datos_predeterminado("practica") == Path(
        "C:/ProgramData/DentalPro-Practica/data"
    )


def test_edicion_no_se_puede_elegir_con_variable(monkeypatch) -> None:
    monkeypatch.setenv("DENTALPRO_EDICION", "practica")

    with pytest.raises(RuntimeError, match="DENTALPRO_EDICION"):
        config.validar_base_unica()


def test_edicion_practica_se_detecta_por_nombre_del_lanzador(monkeypatch) -> None:
    monkeypatch.setattr(config, "IS_FROZEN", False)
    monkeypatch.setattr(config.sys, "argv", ["desktop_practica.py"])

    assert config._detectar_edicion_runtime() == "practica"


def test_data_dir_tambien_se_rechaza_fuera_de_pytest(monkeypatch) -> None:
    monkeypatch.setattr(config, "MODO_PRUEBAS", False)
    monkeypatch.setenv("DENTALPRO_DATA_DIR", "C:/otra-carpeta")

    with pytest.raises(RuntimeError, match="DENTALPRO_DATA_DIR"):
        config.validar_base_unica()


def test_inicio_de_pytest_no_migra_la_base_real(monkeypatch) -> None:
    llamadas: list[str] = []

    monkeypatch.setattr(main, "MODO_PRUEBAS", True)
    monkeypatch.setattr(
        main,
        "validar_base_unica",
        lambda: llamadas.append("validar"),
    )
    monkeypatch.setattr(
        main,
        "migrar_datos_heredados",
        lambda *_args: llamadas.append("migrar"),
    )
    monkeypatch.setattr(
        main,
        "inicializar_base_datos",
        lambda: llamadas.append("inicializar"),
    )

    main._preparar_almacen_clinico()

    assert llamadas == ["validar", "inicializar"]
