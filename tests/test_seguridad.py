import pytest

from backend.app.seguridad import (
    crear_hash_contrasena,
    crear_hash_token_sesion,
    crear_token_sesion,
    verificar_contrasena,
)


def test_proteger_y_verificar_contrasena() -> None:
    contrasena = "Clave dental segura 2026"
    hash_contrasena = crear_hash_contrasena(contrasena)

    assert hash_contrasena != contrasena
    assert verificar_contrasena(contrasena, hash_contrasena)
    assert not verificar_contrasena("Contraseña incorrecta", hash_contrasena)


def test_generar_sales_diferentes() -> None:
    contrasena = "Otra clave dental 2026"

    assert crear_hash_contrasena(contrasena) != crear_hash_contrasena(contrasena)


def test_rechazar_contrasena_demasiado_corta() -> None:
    with pytest.raises(ValueError, match="12 caracteres"):
        crear_hash_contrasena("corta")


def test_generar_y_proteger_token_de_sesion() -> None:
    token_uno = crear_token_sesion()
    token_dos = crear_token_sesion()

    assert token_uno != token_dos
    assert crear_hash_token_sesion(token_uno) != token_uno
    assert crear_hash_token_sesion(token_uno) == crear_hash_token_sesion(token_uno)
