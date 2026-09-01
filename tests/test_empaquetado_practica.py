from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def test_especificacion_practica_genera_ejecutable_sin_consola() -> None:
    contenido = (RAIZ / "DentalProPractica.spec").read_text(encoding="utf-8")

    assert "['desktop_practica.py']" in contenido
    assert "name='DentalProPractica'" in contenido
    assert "console=False" in contenido


def test_constructor_compila_e_incluye_ambas_ediciones() -> None:
    contenido = (RAIZ / "scripts" / "construir_windows.ps1").read_text(encoding="utf-8")

    assert "SistemaDental.spec" in contenido
    assert "DentalProPractica.spec" in contenido
    assert '$programaPractica = Join-Path $dist "DentalProPractica"' in contenido
    assert 'Join-Path $portable "Practica"' in contenido


def test_instalador_crea_acceso_y_carpeta_aislada_de_practica() -> None:
    contenido = (RAIZ / "installer" / "DentalPro.iss").read_text(encoding="utf-8")

    assert "DentalPro-Practica\\data" in contenido
    assert "DentalProPractica.exe" in contenido
    assert 'Name: "{autodesktop}\\DentalPro Práctica"' in contenido
