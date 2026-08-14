from fastapi.testclient import TestClient

from backend.app.database import (
    ENTORNO_OFICIAL,
    ENTORNO_PRUEBAS,
    SessionLocal,
    TestSessionLocal,
)
from backend.app.dependencias import obtener_usuario_actual
from backend.app.main import app
from backend.app.services import cambiar_estado_usuario, crear_usuario

CLAVE_ADMIN = "Clave administradora segura 2026"
CLAVE_TEMPORAL = "Temporal odontologia 2026!"
CLAVE_PRIVADA = "Privada odontologia 2026!"


def crear_cuenta(
    nombre_usuario: str,
    *,
    rol: str,
    entorno: str = ENTORNO_OFICIAL,
    activa: bool = True,
) -> int:
    fabrica_sesiones = TestSessionLocal if entorno == ENTORNO_PRUEBAS else SessionLocal
    with fabrica_sesiones() as db:
        usuario = crear_usuario(
            db,
            nombre=f"Cuenta {nombre_usuario}",
            nombre_usuario=nombre_usuario,
            contrasena=CLAVE_ADMIN if rol == "administrador" else CLAVE_TEMPORAL,
            rol=rol,
        )
        db.flush()
        usuario_id = usuario.id
        if not activa:
            cambiar_estado_usuario(
                db,
                usuario_id=usuario_id,
                activo=False,
            )
        db.commit()
        return usuario_id


def crear_administrador(
    nombre_usuario: str,
    *,
    entorno: str = ENTORNO_OFICIAL,
) -> None:
    crear_cuenta(
        nombre_usuario,
        rol="administrador",
        entorno=entorno,
    )


def iniciar_admin(client: TestClient, nombre_usuario: str) -> None:
    respuesta = client.post(
        "/api/auth/login",
        json={
            "nombreUsuario": nombre_usuario,
            "contrasena": CLAVE_ADMIN,
        },
    )
    assert respuesta.status_code == 200


def test_crear_usuario_exige_clave_temporal_y_cambio_inicial() -> None:
    nombre_admin = "admin.gestion"
    nombre_nuevo = "odontologo.nuevo"
    crear_administrador(nombre_admin)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)

            respuesta = client.post(
                "/api/usuarios",
                json={
                    "nombre": "Odontólogo Nuevo",
                    "nombreUsuario": nombre_nuevo,
                    "rol": "odontologo",
                    "entornoDatos": ENTORNO_OFICIAL,
                    "contrasenaTemporal": CLAVE_TEMPORAL,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )

            assert respuesta.status_code == 201
            assert respuesta.json()["rol"] == "odontologo"
            assert respuesta.json()["entornoDatos"] == ENTORNO_OFICIAL
            assert respuesta.json()["debeCambiarContrasena"] is True

        with TestClient(app) as usuario_client:
            login = usuario_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_nuevo,
                    "contrasena": CLAVE_TEMPORAL,
                },
            )
            assert login.status_code == 200
            assert login.json()["usuario"]["debeCambiarContrasena"] is True
            assert usuario_client.get("/api/pacientes").status_code == 403

            cambio = usuario_client.post(
                "/api/auth/cambiar-contrasena",
                json={
                    "contrasenaActual": CLAVE_TEMPORAL,
                    "nuevaContrasena": CLAVE_PRIVADA,
                },
            )
            assert cambio.status_code == 200

            nuevo_login = usuario_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_nuevo,
                    "contrasena": CLAVE_PRIVADA,
                },
            )
            assert nuevo_login.status_code == 200
            assert nuevo_login.json()["usuario"]["debeCambiarContrasena"] is False
            assert usuario_client.get("/api/pacientes").status_code == 200
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_administrador_oficial_crea_y_lista_usuario_de_pruebas() -> None:
    nombre_admin = "admin.ambas.bases"
    nombre_nuevo = "recepcion.base.test"
    crear_administrador(nombre_admin)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            creado = client.post(
                "/api/usuarios",
                json={
                    "nombre": "Recepción de pruebas",
                    "nombreUsuario": nombre_nuevo,
                    "rol": "recepcion",
                    "entornoDatos": ENTORNO_PRUEBAS,
                    "contrasenaTemporal": CLAVE_TEMPORAL,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )
            listado = client.get("/api/usuarios")

        assert creado.status_code == 201
        assert creado.json()["entornoDatos"] == ENTORNO_PRUEBAS
        assert listado.status_code == 200
        assert any(
            usuario["nombreUsuario"] == nombre_nuevo
            and usuario["entornoDatos"] == ENTORNO_PRUEBAS
            for usuario in listado.json()
        )

        with TestClient(app) as usuario_client:
            login = usuario_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_nuevo,
                    "contrasena": CLAVE_TEMPORAL,
                },
            )

        assert login.status_code == 200
        assert login.json()["usuario"]["entornoDatos"] == ENTORNO_PRUEBAS
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_administrador_pruebas_no_modifica_base_oficial() -> None:
    nombre_admin = "admin.solo.pruebas"
    crear_administrador(nombre_admin, entorno=ENTORNO_PRUEBAS)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            respuesta = client.post(
                "/api/usuarios",
                json={
                    "nombre": "Cuenta oficial no permitida",
                    "nombreUsuario": "oficial.no.permitido",
                    "rol": "recepcion",
                    "entornoDatos": ENTORNO_OFICIAL,
                    "contrasenaTemporal": CLAVE_TEMPORAL,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )
            listado = client.get("/api/usuarios")

        assert respuesta.status_code == 403
        assert listado.status_code == 200
        assert all(
            usuario["entornoDatos"] == ENTORNO_PRUEBAS for usuario in listado.json()
        )
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_trasladar_usuario_exige_desactivar_origen() -> None:
    nombre_admin = "admin.traslado"
    nombre_usuario = "odontologo.trasladable"
    usuario_oficial_id = crear_cuenta(
        nombre_usuario,
        rol="odontologo",
    )
    crear_administrador(nombre_admin)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        payload_creacion = {
            "nombre": "Odontólogo trasladado",
            "nombreUsuario": nombre_usuario,
            "rol": "odontologo",
            "entornoDatos": ENTORNO_PRUEBAS,
            "contrasenaTemporal": CLAVE_TEMPORAL,
            "contrasenaAdministrador": CLAVE_ADMIN,
        }

        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)

            conflicto = client.post(
                "/api/usuarios",
                json=payload_creacion,
            )
            desactivado = client.patch(
                f"/api/usuarios/{ENTORNO_OFICIAL}/{usuario_oficial_id}/estado",
                json={
                    "activo": False,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )
            creado = client.post(
                "/api/usuarios",
                json=payload_creacion,
            )

        assert conflicto.status_code == 409
        assert desactivado.status_code == 200
        assert creado.status_code == 201
        assert creado.json()["entornoDatos"] == ENTORNO_PRUEBAS

        with TestClient(app) as usuario_client:
            login = usuario_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_usuario,
                    "contrasena": CLAVE_TEMPORAL,
                },
            )

        assert login.status_code == 200
        assert login.json()["usuario"]["entornoDatos"] == ENTORNO_PRUEBAS
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_administrador_delegado_no_crea_otro_administrador() -> None:
    nombre_admin = "admin.protegido"
    crear_administrador(nombre_admin)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            respuesta = client.post(
                "/api/usuarios",
                json={
                    "nombre": "Administrador no permitido",
                    "nombreUsuario": "otro.admin",
                    "rol": "administrador",
                    "entornoDatos": ENTORNO_OFICIAL,
                    "contrasenaTemporal": CLAVE_TEMPORAL,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )

        assert respuesta.status_code == 403
        assert "Administrador propietario" in respuesta.json()["detail"]
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_propietario_crea_administrador_delegado_y_queda_protegido() -> None:
    nombre_propietario = "cesar.admin"
    nombre_delegado = "admin.delegado"
    crear_administrador(nombre_propietario)
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_propietario)
            creado = client.post(
                "/api/usuarios",
                json={
                    "nombre": "Administrador delegado",
                    "nombreUsuario": nombre_delegado,
                    "rol": "administrador",
                    "entornoDatos": ENTORNO_OFICIAL,
                    "contrasenaTemporal": CLAVE_TEMPORAL,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )
            listado = client.get("/api/usuarios")

            propietario = next(
                usuario
                for usuario in listado.json()
                if usuario["nombreUsuario"] == nombre_propietario
            )
            intento_desactivar_propietario = client.patch(
                f"/api/usuarios/{ENTORNO_OFICIAL}/{propietario['id']}/estado",
                json={
                    "activo": False,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )

        assert creado.status_code == 201
        assert creado.json()["rol"] == "administrador"
        assert creado.json()["esPropietario"] is False
        assert propietario["esPropietario"] is True
        assert intento_desactivar_propietario.status_code == 403

        with TestClient(app) as delegado_client:
            login = delegado_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_delegado,
                    "contrasena": CLAVE_TEMPORAL,
                },
            )

        assert login.status_code == 200
        assert login.json()["usuario"]["esPropietario"] is False
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_login_rechaza_usuario_activo_en_ambas_bases() -> None:
    nombre_usuario = "cuenta.ambigua"
    crear_cuenta(nombre_usuario, rol="recepcion")
    crear_cuenta(
        nombre_usuario,
        rol="recepcion",
        entorno=ENTORNO_PRUEBAS,
    )

    with TestClient(app) as client:
        respuesta = client.post(
            "/api/auth/login",
            json={
                "nombreUsuario": nombre_usuario,
                "contrasena": CLAVE_TEMPORAL,
            },
        )

    assert respuesta.status_code == 409
    assert "más de una base" in respuesta.json()["detail"]
