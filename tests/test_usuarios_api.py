from fastapi.testclient import TestClient

from backend.app.database import SessionLocal
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
    activa: bool = True,
) -> int:
    with SessionLocal() as db:
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
            cambiar_estado_usuario(db, usuario_id=usuario_id, activo=False)
        db.commit()
        return usuario_id


def iniciar_admin(client: TestClient, nombre_usuario: str) -> None:
    respuesta = client.post(
        "/api/auth/login",
        json={
            "nombreUsuario": nombre_usuario,
            "contrasena": CLAVE_ADMIN,
        },
    )
    assert respuesta.status_code == 200


def payload_usuario(
    nombre_usuario: str,
    *,
    rol: str = "odontologo",
) -> dict[str, str]:
    return {
        "nombre": f"Cuenta {nombre_usuario}",
        "nombreUsuario": nombre_usuario,
        "rol": rol,
        "contrasenaTemporal": CLAVE_TEMPORAL,
        "contrasenaAdministrador": CLAVE_ADMIN,
    }


def test_crear_usuario_trabaja_solo_con_base_clinica() -> None:
    nombre_admin = "admin.gestion"
    nombre_nuevo = "odontologo.nuevo"
    crear_cuenta(nombre_admin, rol="administrador")
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            respuesta = client.post(
                "/api/usuarios",
                json=payload_usuario(nombre_nuevo),
            )
            listado = client.get("/api/usuarios")

        assert respuesta.status_code == 201
        assert respuesta.json()["rol"] == "odontologo"
        assert respuesta.json()["debeCambiarContrasena"] is True
        assert "entornoDatos" not in respuesta.json()
        assert listado.status_code == 200
        assert all("entornoDatos" not in usuario for usuario in listado.json())
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_usuario_cambia_clave_temporal_en_primer_ingreso() -> None:
    nombre_admin = "admin.cambio"
    nombre_nuevo = "odontologo.cambio"
    crear_cuenta(nombre_admin, rol="administrador")
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as admin_client:
            iniciar_admin(admin_client, nombre_admin)
            creado = admin_client.post(
                "/api/usuarios",
                json=payload_usuario(nombre_nuevo),
            )
        assert creado.status_code == 201

        with TestClient(app) as usuario_client:
            login = usuario_client.post(
                "/api/auth/login",
                json={
                    "nombreUsuario": nombre_nuevo,
                    "contrasena": CLAVE_TEMPORAL,
                },
            )
            assert login.status_code == 200
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
            assert usuario_client.get("/api/pacientes").status_code == 200
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_administrador_delegado_no_crea_otro_administrador() -> None:
    nombre_admin = "admin.protegido"
    crear_cuenta(nombre_admin, rol="administrador")
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            respuesta = client.post(
                "/api/usuarios",
                json=payload_usuario("otro.admin", rol="administrador"),
            )

        assert respuesta.status_code == 403
        assert "Administrador propietario" in respuesta.json()["detail"]
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_propietario_crea_delegado_y_su_cuenta_queda_protegida() -> None:
    nombre_propietario = "cesar.admin"
    crear_cuenta(nombre_propietario, rol="administrador")
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_propietario)
            creado = client.post(
                "/api/usuarios",
                json=payload_usuario("admin.delegado", rol="administrador"),
            )
            listado = client.get("/api/usuarios")
            propietario = next(
                usuario
                for usuario in listado.json()
                if usuario["nombreUsuario"] == nombre_propietario
            )
            desactivar = client.patch(
                f"/api/usuarios/{propietario['id']}/estado",
                json={
                    "activo": False,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )

        assert creado.status_code == 201
        assert propietario["esPropietario"] is True
        assert desactivar.status_code == 403
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo


def test_estado_y_restablecimiento_usan_rutas_sin_entorno() -> None:
    nombre_admin = "admin.operaciones"
    usuario_id = crear_cuenta("recepcion.operaciones", rol="recepcion")
    crear_cuenta(nombre_admin, rol="administrador")
    reemplazo = app.dependency_overrides.pop(obtener_usuario_actual, None)

    try:
        with TestClient(app) as client:
            iniciar_admin(client, nombre_admin)
            estado = client.patch(
                f"/api/usuarios/{usuario_id}/estado",
                json={
                    "activo": False,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )
            clave = client.post(
                f"/api/usuarios/{usuario_id}/restablecer-contrasena",
                json={
                    "contrasenaTemporal": CLAVE_PRIVADA,
                    "contrasenaAdministrador": CLAVE_ADMIN,
                },
            )

        assert estado.status_code == 200
        assert estado.json()["activo"] is False
        assert clave.status_code == 200
        assert clave.json()["debeCambiarContrasena"] is True
    finally:
        if reemplazo is not None:
            app.dependency_overrides[obtener_usuario_actual] = reemplazo
