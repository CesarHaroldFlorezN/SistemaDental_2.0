"""Inicialización y restablecimiento de la edición aislada de práctica."""

from __future__ import annotations

import shutil
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from .config import DOCUMENTOS_DIR, ES_PRACTICA
from .database import SessionLocal
from .models import (
    CasoClinicoDB,
    CitaDB,
    DocumentoPacienteDB,
    ImportacionOficialDB,
    MovimientoCuentaDB,
    OdontogramaDB,
    PacienteDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
    SesionDB,
    SesionPlanDB,
    UsuarioDB,
)
from .services.usuarios import buscar_usuario_por_nombre, crear_usuario

USUARIO_PRACTICA = "practica.admin"
CONTRASENA_PRACTICA_INICIAL = "Practica2026!"
CONFIRMACION_RESTABLECIMIENTO = "RESTABLECER PRACTICA"

_TABLAS_DATOS_PRACTICA = (
    OdontogramaDB,
    DocumentoPacienteDB,
    MovimientoCuentaDB,
    PlanPagoDB,
    PagoDB,
    CitaDB,
    SesionPlanDB,
    PlanDB,
    CasoClinicoDB,
    PacienteDB,
    ImportacionOficialDB,
    SesionDB,
    UsuarioDB,
)


def _exigir_edicion_practica() -> None:
    if not ES_PRACTICA:
        raise RuntimeError("Esta operación solo existe en DentalPro Práctica.")


def _asegurar_tabla_control(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS configuracionPractica (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            )
            """
        )
    )


def _crear_administrador_si_falta(db: Session) -> None:
    if buscar_usuario_por_nombre(db, USUARIO_PRACTICA) is not None:
        return

    crear_usuario(
        db,
        nombre="Administrador de práctica",
        nombre_usuario=USUARIO_PRACTICA,
        contrasena=CONTRASENA_PRACTICA_INICIAL,
        rol="administrador",
    )


def _crear_datos_ficticios(db: Session) -> dict[str, int]:
    momento = datetime.now().astimezone()
    hoy = momento.date()
    ahora = momento.isoformat(timespec="seconds")
    pacientes = [
        PacienteDB(
            nombre="ANA DEMOSTRACIÓN",
            cedula="PRACTICA-001",
            fechaNacimiento="1992-04-18",
            genero="Femenino",
            telefono="900000001",
            correo="ana.demostracion@example.invalid",
            codigo_ficha="P-001",
            direccion="Dirección ficticia 1",
            alergias="Ninguna (dato ficticio)",
            medicamentos="Ninguno (dato ficticio)",
            fechaReg=hoy.isoformat(),
        ),
        PacienteDB(
            nombre="LUIS PRÁCTICA",
            cedula="PRACTICA-002",
            fechaNacimiento="1985-09-07",
            genero="Masculino",
            telefono="900000002",
            correo="luis.practica@example.invalid",
            codigo_ficha="P-002",
            direccion="Dirección ficticia 2",
            alergias="Penicilina (ejemplo)",
            medicamentos="Ninguno (dato ficticio)",
            fechaReg=hoy.isoformat(),
        ),
        PacienteDB(
            nombre="MARÍA ENTRENAMIENTO",
            cedula="PRACTICA-003",
            fechaNacimiento="2001-01-22",
            genero="Femenino",
            telefono="900000003",
            correo="maria.entrenamiento@example.invalid",
            codigo_ficha="P-003",
            direccion="Dirección ficticia 3",
            alergias="Ninguna (dato ficticio)",
            medicamentos="Ninguno (dato ficticio)",
            fechaReg=hoy.isoformat(),
        ),
    ]
    db.add_all(pacientes)
    db.flush()

    caso = CasoClinicoDB(
        pacienteId=pacientes[0].id,
        titulo="Tratamiento de demostración",
        tipo="procedimiento",
        motivoConsulta="Ejemplo para aprender el flujo clínico",
        diagnostico="Diagnóstico ficticio",
        estado="abierto",
        creadoEn=ahora,
        actualizadoEn=ahora,
    )
    db.add(caso)
    db.flush()

    plan = PlanDB(
        pacienteId=pacientes[0].id,
        casoClinicoId=caso.id,
        nombre="Plan de práctica en 3 sesiones",
        tipo="Restauración",
        duracion="3 semanas",
        costo=Decimal("300.00"),
        nSesiones=3,
        descripcion="Plan completamente ficticio para entrenamiento.",
        estado="activo",
        creadoEn=ahora,
    )
    db.add(plan)
    db.flush()
    caso.planId = plan.id

    sesiones = []
    for numero in range(1, 4):
        sesion = SesionPlanDB(
            planId=plan.id,
            numero=numero,
            titulo=f"Sesión de práctica {numero}",
            estado="pendiente",
            fechaProgramada=(hoy + timedelta(days=7 * numero)).isoformat(),
            cuotaNum=numero,
            notas="Dato ficticio",
            creadoEn=ahora,
            actualizadoEn=ahora,
        )
        sesiones.append(sesion)
    db.add_all(sesiones)

    citas = [
        CitaDB(
            pacienteId=pacientes[0].id,
            casoClinicoId=caso.id,
            planId=plan.id,
            tipoCita="sesion_tratamiento",
            fecha=(hoy + timedelta(days=1)).isoformat(),
            hora="09:00",
            horaFin="10:00",
            duracionMinutos=60,
            procedimiento="Primera sesión de práctica",
            servicios=[{"nombre": "Consulta de demostración", "costo": 0}],
            notas="Esta cita es ficticia.",
            costo=Decimal("0.00"),
            tipoPago="sesion",
            estado="programada",
            sesionNum=1,
            totalSesiones=3,
            creadaEn=ahora,
        ),
        CitaDB(
            pacienteId=pacientes[1].id,
            tipoCita="procedimiento",
            fecha=(hoy + timedelta(days=2)).isoformat(),
            hora="11:00",
            horaFin="11:45",
            duracionMinutos=45,
            procedimiento="Consulta de evaluación ficticia",
            servicios=[{"nombre": "Consulta de evaluación", "costo": 50}],
            notas="Esta cita es ficticia.",
            costo=Decimal("50.00"),
            tipoPago="contado",
            estado="programada",
            sesionNum=1,
            totalSesiones=1,
            creadaEn=ahora,
        ),
    ]
    db.add_all(citas)

    pago = PagoDB(
        pacienteId=pacientes[2].id,
        concepto="Limpieza de demostración",
        fecha=hoy.isoformat(),
        total=Decimal("80.00"),
        cobrado=Decimal("40.00"),
        saldo=Decimal("40.00"),
        metodo="Efectivo",
        tipoPago="parcial",
        servicios=[{"nombre": "Limpieza ficticia", "costo": 80}],
        cuotas=[],
        creadoEn=ahora,
        fechaUltPago=hoy.isoformat(),
        nota="Pago ficticio para entrenamiento.",
        devuelto=Decimal("0.00"),
        creditoFavor=Decimal("0.00"),
    )
    db.add(pago)
    db.flush()

    db.add(
        MovimientoCuentaDB(
            pacienteId=pacientes[2].id,
            pagoId=pago.id,
            tipo="abono",
            descripcion="Abono ficticio de entrenamiento",
            cargo=Decimal("0.00"),
            abono=Decimal("40.00"),
            fecha=hoy.isoformat(),
            metodo="Efectivo",
            usuario=USUARIO_PRACTICA,
            creadoEn=ahora,
        )
    )

    return {
        "pacientes": len(pacientes),
        "citas": len(citas),
        "planes": 1,
        "pagos": 1,
    }


def restablecer_datos_practica(db: Session) -> dict[str, int]:
    """Borra solo datos ficticios y vuelve al escenario inicial."""

    _exigir_edicion_practica()
    _asegurar_tabla_control(db)
    for modelo in _TABLAS_DATOS_PRACTICA:
        db.execute(delete(modelo))

    _crear_administrador_si_falta(db)
    conteos = _crear_datos_ficticios(db)
    db.execute(
        text(
            """
            INSERT INTO configuracionPractica (clave, valor)
            VALUES ('datos_iniciales', :valor)
            ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
            """
        ),
        {"valor": datetime.now().astimezone().isoformat(timespec="seconds")},
    )
    return conteos


def inicializar_base_practica() -> bool:
    """Crea una sola vez el escenario ficticio de la base de práctica."""

    _exigir_edicion_practica()
    with SessionLocal.begin() as db:
        _asegurar_tabla_control(db)
        existe = db.execute(
            text("SELECT 1 FROM configuracionPractica WHERE clave = 'datos_iniciales'")
        ).first()
        if existe:
            _crear_administrador_si_falta(db)
            return False

        restablecer_datos_practica(db)
        return True


def limpiar_documentos_practica() -> None:
    """Elimina adjuntos ficticios, nunca documentos de la edición oficial."""

    _exigir_edicion_practica()
    shutil.rmtree(DOCUMENTOS_DIR, ignore_errors=True)
    DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)
