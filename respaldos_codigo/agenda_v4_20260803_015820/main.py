from __future__ import annotations

import csv
import io
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import JSON, Column, Float, Integer, String, Text, create_engine, event, or_
from sqlalchemy.orm import Session, declarative_base, sessionmaker


# =====================================================
# RUTAS DEL PROYECTO Y BASE DE DATOS
# =====================================================

if getattr(sys, "frozen", False):
    # En el ejecutable, la base debe persistir junto a SistemaDental.exe.
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent

DATA_DIR = APP_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "dentalpro.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 15,
    },
)


@event.listens_for(engine, "connect")
def configurar_sqlite(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
Base = declarative_base()


# =====================================================
# MODELOS SQLALCHEMY
# =====================================================

class PacienteDB(Base):
    __tablename__ = "pacientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cedula = Column(String(50), index=True)
    fechaNacimiento = Column(String(50))
    genero = Column(String(50))
    telefono = Column(String(50))
    correo = Column(String(100))
    codigo_ficha = Column(String(50), index=True)
    direccion = Column(String(200))
    alergias = Column(Text)
    medicamentos = Column(Text)
    fechaReg = Column(String(50))


class CitaDB(Base):
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    planId = Column(Integer, nullable=True)
    citaBaseId = Column(Integer, nullable=True)
    fecha = Column(String(50), index=True)
    hora = Column(String(50), index=True)
    procedimiento = Column(String(200))
    servicios = Column(JSON)
    notas = Column(Text)
    notasFin = Column(Text)
    costo = Column(Float)
    tipoPago = Column(String(50))
    estado = Column(String(50), index=True)
    sesionNum = Column(Integer)
    totalSesiones = Column(Integer)
    creadaEn = Column(String(50))
    inicio = Column(String(50))
    fin = Column(String(50))
    motivoCancelacion = Column(Text)
    canceladaEn = Column(String(50))


class PagoDB(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    citaId = Column(Integer, index=True)
    concepto = Column(String(200))
    fecha = Column(String(50))
    total = Column(Float)
    cobrado = Column(Float)
    saldo = Column(Float)
    metodo = Column(String(50))
    tipoPago = Column(String(50))
    cuotas = Column(JSON)
    creadoEn = Column(String(50))
    fechaUltPago = Column(String(50))
    nota = Column(Text)
    devuelto = Column(Float)
    creditoFavor = Column(Float)


class PlanDB(Base):
    __tablename__ = "planes"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    nombre = Column(String(150))
    tipo = Column(String(100))
    duracion = Column(String(50))
    costo = Column(Float)
    nSesiones = Column(Integer)
    descripcion = Column(Text)
    estado = Column(String(50))
    creadoEn = Column(String(50))


class PlanPagoDB(Base):
    __tablename__ = "planPagos"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    pagoId = Column(Integer, index=True)
    citaId = Column(Integer, index=True)
    concepto = Column(String(200))
    totalAcordado = Column(Float)
    anticipo = Column(Float)
    metodoPreferido = Column(String(50))
    estado = Column(String(50))
    cuotas = Column(JSON)
    totalCuotas = Column(Float)
    cobrado = Column(Float)
    saldo = Column(Float)
    fechaCreacion = Column(String(50))
    creadoEn = Column(String(50))


Base.metadata.create_all(bind=engine)


def asegurar_compatibilidad_esquema() -> None:
    """Agrega columnas nuevas sin borrar ni reemplazar la base existente."""
    with engine.begin() as connection:
        columnas_citas = {
            fila[1]
            for fila in connection.exec_driver_sql("PRAGMA table_info(citas)").fetchall()
        }
        if "servicios" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN servicios JSON")


asegurar_compatibilidad_esquema()


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title="API DentalPro",
    version="1.2.0",
    description="Backend local para gestión clínica, agenda y finanzas.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================
# ESQUEMAS DE VALIDACIÓN
# =====================================================

EstadoCita = Literal[
    "pendiente",
    "confirmada",
    "en_espera",
    "en_atencion",
    "completada",
    "no_asistio",
    "cancelada",
]

TipoPago = Literal[
    "contado",
    "completo",
    "anticipo",
    "cuotas",
    "cortesia",
    "sesion",
]


class ServicioCitaPayload(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    costo: float = Field(default=0, ge=0)


class CitaPagoPayload(BaseModel):
    pacienteId: int = Field(gt=0)
    planId: Optional[int] = Field(default=None, gt=0)
    citaBaseId: Optional[int] = Field(default=None, gt=0)

    fecha: str = Field(min_length=10, max_length=10)
    hora: str = Field(min_length=5, max_length=5)
    procedimiento: str = Field(min_length=2, max_length=200)
    servicios: List[ServicioCitaPayload] = Field(default_factory=list, max_length=20)
    notas: str = Field(default="", max_length=5000)
    estado: EstadoCita = "pendiente"

    costo: float = Field(default=0, ge=0)
    tipoPago: TipoPago = "contado"
    montoPagado: float = Field(default=0, ge=0)
    metodoPago: str = Field(default="Efectivo", max_length=50)

    sesionNum: int = Field(default=1, ge=1)
    totalSesiones: int = Field(default=1, ge=1)


class CambioEstadoPayload(BaseModel):
    estado: EstadoCita


class ReprogramarCitaPayload(BaseModel):
    fecha: str = Field(min_length=10, max_length=10)
    hora: str = Field(min_length=5, max_length=5)


# =====================================================
# FUNCIONES AUXILIARES
# =====================================================

MODELOS = {
    "pacientes": PacienteDB,
    "citas": CitaDB,
    "pagos": PagoDB,
    "planes": PlanDB,
    "planPagos": PlanPagoDB,
}

ESTADOS_QUE_BLOQUEAN_HORARIO = {
    "pendiente",
    "confirmada",
    "en_espera",
    "en_atencion",
}

TRANSICIONES_ESTADO = {
    "pendiente": {
        "confirmada",
        "en_espera",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "confirmada": {
        "pendiente",
        "en_espera",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "en_espera": {
        "confirmada",
        "en_atencion",
        "no_asistio",
        "cancelada",
    },
    "en_atencion": {"completada", "cancelada"},
    "no_asistio": {"pendiente"},
    "cancelada": {"pendiente"},
    "completada": set(),
}


def ahora_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def serializar_modelo(registro):
    return {
        columna.name: getattr(registro, columna.name)
        for columna in registro.__table__.columns
    }


def validar_fecha_hora(fecha: str, hora: str) -> None:
    try:
        datetime.strptime(f"{fecha} {hora}", "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="La fecha o la hora no tienen un formato válido.",
        ) from exc


def obtener_paciente(db: Session, paciente_id: int) -> PacienteDB:
    paciente = db.query(PacienteDB).filter(PacienteDB.id == paciente_id).first()
    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="El paciente seleccionado no existe.",
        )
    return paciente


def validar_plan(db: Session, plan_id: Optional[int], paciente_id: int) -> None:
    if not plan_id:
        return

    plan = db.query(PlanDB).filter(PlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="El plan de tratamiento no existe.")
    if int(plan.pacienteId or 0) != int(paciente_id):
        raise HTTPException(
            status_code=400,
            detail="El plan de tratamiento no pertenece al paciente seleccionado.",
        )


def validar_disponibilidad(
    db: Session,
    fecha: str,
    hora: str,
    estado: str,
    cita_excluida_id: Optional[int] = None,
) -> None:
    """Evita dos citas activas exactamente en el mismo horario."""
    if estado not in ESTADOS_QUE_BLOQUEAN_HORARIO:
        return

    consulta = db.query(CitaDB).filter(
        CitaDB.fecha == fecha,
        CitaDB.hora == hora,
        CitaDB.estado.in_(ESTADOS_QUE_BLOQUEAN_HORARIO),
    )

    if cita_excluida_id:
        consulta = consulta.filter(CitaDB.id != cita_excluida_id)

    conflicto = consulta.first()
    if not conflicto:
        return

    paciente = db.query(PacienteDB).filter(
        PacienteDB.id == conflicto.pacienteId
    ).first()
    nombre = paciente.nombre if paciente else "otro paciente"

    raise HTTPException(
        status_code=409,
        detail=(
            f"El horario {fecha} a las {hora} ya está ocupado por "
            f"{nombre} ({conflicto.procedimiento or 'consulta'})."
        ),
    )


def validar_secuencia_sesion(db: Session, cita: CitaDB) -> None:
    sesion_num = int(cita.sesionNum or 1)
    total_sesiones = int(cita.totalSesiones or 1)

    if sesion_num <= 1 or total_sesiones <= 1:
        return

    base_id = int(cita.citaBaseId or cita.id)
    grupo = (
        db.query(CitaDB)
        .filter(or_(CitaDB.id == base_id, CitaDB.citaBaseId == base_id))
        .all()
    )

    anterior = next(
        (
            item
            for item in grupo
            if int(item.sesionNum or 1) == sesion_num - 1
        ),
        None,
    )

    if anterior and anterior.estado != "completada":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Debes completar primero la sesión {sesion_num - 1} "
                f"antes de iniciar la sesión {sesion_num}."
            ),
        )


def normalizar_servicios(payload: CitaPagoPayload) -> Dict[str, Any]:
    servicios = []

    for servicio in payload.servicios:
        nombre = servicio.nombre.strip()
        if not nombre:
            continue
        servicios.append({
            "nombre": nombre,
            "costo": round(float(servicio.costo or 0), 2),
        })

    if not servicios:
        servicios = [{
            "nombre": payload.procedimiento.strip(),
            "costo": round(float(payload.costo or 0), 2),
        }]

    if payload.tipoPago in {"cortesia", "sesion"}:
        servicios = [
            {**servicio, "costo": 0.0}
            for servicio in servicios
        ]

    procedimiento = " + ".join(servicio["nombre"] for servicio in servicios)
    procedimiento = procedimiento[:200]
    costo_total = round(sum(servicio["costo"] for servicio in servicios), 2)

    return {
        "servicios": servicios,
        "procedimiento": procedimiento,
        "costo_total": costo_total,
    }


def calcular_datos_pago(payload: CitaPagoPayload, costo_total: Optional[float] = None) -> Dict[str, Any]:
    tipo_pago = payload.tipoPago

    if tipo_pago in {"cortesia", "sesion"}:
        total = 0.0
        cobrado = 0.0
    else:
        total = round(float(payload.costo if costo_total is None else costo_total), 2)

        if tipo_pago == "completo":
            cobrado = total
        elif tipo_pago == "contado":
            cobrado = 0.0
        else:
            cobrado = round(float(payload.montoPagado), 2)

    if cobrado > total:
        raise HTTPException(
            status_code=400,
            detail="El monto pagado no puede superar el costo total.",
        )

    if tipo_pago == "anticipo":
        if total <= 0:
            raise HTTPException(
                status_code=400,
                detail="Una cita con anticipo debe tener un costo mayor que cero.",
            )
        if cobrado <= 0:
            raise HTTPException(
                status_code=400,
                detail="Debes ingresar el monto del anticipo.",
            )
        if cobrado >= total:
            raise HTTPException(
                status_code=400,
                detail=(
                    "El anticipo debe ser menor al costo total. "
                    "Si pagó todo, selecciona 'Pagado completo'."
                ),
            )

    if tipo_pago == "cuotas" and total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Una cita en cuotas debe tener un costo mayor que cero.",
        )

    saldo = round(total - cobrado, 2)
    metodo = (
        payload.metodoPago.strip()
        if cobrado > 0 and payload.metodoPago.strip()
        else "Pendiente"
    )

    return {
        "total": total,
        "cobrado": cobrado,
        "saldo": saldo,
        "metodo": metodo,
    }


def limpiar_valor_csv(valor: Any) -> str:
    return str(valor or "").strip()


# =====================================================
# SALUD DEL SERVIDOR
# =====================================================

@app.get("/api/salud", tags=["Sistema"])
def salud():
    return {
        "estado": "ok",
        "base_datos": str(DB_PATH),
        "version": app.version,
    }


# =====================================================
# OPERACIONES TRANSACCIONALES DE CITAS
# =====================================================

@app.post("/api/operaciones/citas", tags=["Citas"])
def crear_cita_con_pago(
    payload: CitaPagoPayload,
    db: Session = Depends(get_db),
):
    validar_fecha_hora(payload.fecha, payload.hora)
    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.estado,
    )

    detalle_servicios = normalizar_servicios(payload)
    datos_pago = calcular_datos_pago(payload, detalle_servicios["costo_total"])
    ahora = ahora_iso()

    nueva_cita = CitaDB(
        pacienteId=payload.pacienteId,
        planId=payload.planId,
        citaBaseId=payload.citaBaseId,
        fecha=payload.fecha,
        hora=payload.hora,
        procedimiento=detalle_servicios["procedimiento"],
        servicios=detalle_servicios["servicios"],
        notas=payload.notas.strip(),
        costo=datos_pago["total"],
        tipoPago=payload.tipoPago,
        estado=payload.estado,
        sesionNum=payload.sesionNum,
        totalSesiones=payload.totalSesiones,
        creadaEn=ahora,
        inicio=ahora if payload.estado == "en_atencion" else None,
        fin=ahora if payload.estado in {"completada", "no_asistio"} else None,
    )

    try:
        db.add(nueva_cita)
        db.flush()

        nuevo_pago = PagoDB(
            pacienteId=payload.pacienteId,
            citaId=nueva_cita.id,
            concepto=detalle_servicios["procedimiento"],
            fecha=payload.fecha,
            total=datos_pago["total"],
            cobrado=datos_pago["cobrado"],
            saldo=datos_pago["saldo"],
            metodo=datos_pago["metodo"],
            tipoPago=payload.tipoPago,
            cuotas=[],
            creadoEn=ahora,
            fechaUltPago=(payload.fecha if datos_pago["cobrado"] > 0 else None),
            nota="Pago generado automáticamente desde la cita",
            devuelto=0,
            creditoFavor=0,
        )

        db.add(nuevo_pago)
        db.commit()
        db.refresh(nueva_cita)
        db.refresh(nuevo_pago)

        return {
            "message": "Cita y registro financiero creados correctamente.",
            "cita": serializar_modelo(nueva_cita),
            "pago": serializar_modelo(nuevo_pago),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo registrar la cita y su pago.",
        ) from error


@app.put("/api/operaciones/citas/{cita_id}", tags=["Citas"])
def actualizar_cita_con_pago(
    cita_id: int,
    payload: CitaPagoPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    validar_fecha_hora(payload.fecha, payload.hora)
    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.estado,
        cita_excluida_id=cita_id,
    )

    pago = db.query(PagoDB).filter(PagoDB.citaId == cita_id).first()
    detalle_servicios = normalizar_servicios(payload)
    datos_pago = calcular_datos_pago(payload, detalle_servicios["costo_total"])
    ahora = ahora_iso()

    if pago and datos_pago["cobrado"] < float(pago.cobrado or 0):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes reducir un monto ya cobrado desde la cita. "
                "Primero debes revertir el cobro desde Finanzas."
            ),
        )

    cita.pacienteId = payload.pacienteId
    cita.planId = payload.planId
    cita.citaBaseId = payload.citaBaseId
    cita.fecha = payload.fecha
    cita.hora = payload.hora
    cita.procedimiento = detalle_servicios["procedimiento"]
    cita.servicios = detalle_servicios["servicios"]
    cita.notas = payload.notas.strip()
    cita.costo = datos_pago["total"]
    cita.tipoPago = payload.tipoPago
    cita.estado = payload.estado
    cita.sesionNum = payload.sesionNum
    cita.totalSesiones = payload.totalSesiones

    if payload.estado == "en_atencion" and not cita.inicio:
        cita.inicio = ahora
    if payload.estado in {"completada", "no_asistio"} and not cita.fin:
        cita.fin = ahora

    try:
        if not pago:
            pago = PagoDB(
                pacienteId=payload.pacienteId,
                citaId=cita.id,
                cuotas=[],
                creadoEn=ahora,
                devuelto=0,
                creditoFavor=0,
            )
            db.add(pago)

        pago.pacienteId = payload.pacienteId
        pago.concepto = detalle_servicios["procedimiento"]
        pago.fecha = payload.fecha
        pago.total = datos_pago["total"]
        pago.cobrado = datos_pago["cobrado"]
        pago.saldo = datos_pago["saldo"]
        pago.metodo = datos_pago["metodo"]
        pago.tipoPago = payload.tipoPago
        pago.fechaUltPago = payload.fecha if datos_pago["cobrado"] > 0 else None

        db.commit()
        db.refresh(cita)
        db.refresh(pago)

        return {
            "message": "Cita y registro financiero actualizados correctamente.",
            "cita": serializar_modelo(cita),
            "pago": serializar_modelo(pago),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar la cita y su pago.",
        ) from error


@app.patch("/api/operaciones/citas/{cita_id}/reprogramar", tags=["Citas"])
def reprogramar_cita(
    cita_id: int,
    payload: ReprogramarCitaPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    if cita.estado not in ESTADOS_QUE_BLOQUEAN_HORARIO:
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden reprogramar citas activas.",
        )

    validar_fecha_hora(payload.fecha, payload.hora)
    validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        cita.estado,
        cita_excluida_id=cita.id,
    )

    fecha_anterior = cita.fecha
    hora_anterior = cita.hora
    cita.fecha = payload.fecha
    cita.hora = payload.hora

    try:
        db.commit()
        db.refresh(cita)
        return {
            "message": (
                f"Cita reprogramada de {fecha_anterior} {hora_anterior} "
                f"a {payload.fecha} {payload.hora}."
            ),
            "cita": serializar_modelo(cita),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo reprogramar la cita.",
        ) from error


@app.patch("/api/operaciones/citas/{cita_id}/estado", tags=["Citas"])
def cambiar_estado_cita(
    cita_id: int,
    payload: CambioEstadoPayload,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    estado_actual = cita.estado or "pendiente"
    estado_nuevo = payload.estado

    if estado_actual == estado_nuevo:
        return {
            "message": "La cita ya se encontraba en ese estado.",
            "cita": serializar_modelo(cita),
        }

    permitidos = TRANSICIONES_ESTADO.get(estado_actual, set())
    if estado_nuevo not in permitidos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede cambiar una cita de '{estado_actual}' "
                f"a '{estado_nuevo}' desde esta acción."
            ),
        )

    if estado_nuevo == "en_atencion":
        validar_secuencia_sesion(db, cita)
        validar_disponibilidad(
            db,
            cita.fecha,
            cita.hora,
            estado_nuevo,
            cita_excluida_id=cita.id,
        )

    ahora = ahora_iso()
    cita.estado = estado_nuevo

    if estado_nuevo == "en_atencion":
        cita.inicio = ahora
        cita.fin = None
    elif estado_nuevo in {"completada", "no_asistio"}:
        cita.fin = ahora
    elif estado_nuevo == "cancelada":
        cita.canceladaEn = ahora
    elif estado_nuevo == "pendiente":
        cita.inicio = None
        cita.fin = None
        cita.canceladaEn = None
        cita.motivoCancelacion = None

    try:
        db.commit()
        db.refresh(cita)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el estado de la cita.",
        ) from error

    etiquetas = {
        "pendiente": "programada",
        "confirmada": "confirmada",
        "en_espera": "en espera",
        "en_atencion": "en atención",
        "completada": "atendida",
        "no_asistio": "registrada como inasistencia",
        "cancelada": "cancelada",
    }

    return {
        "message": f"La cita quedó {etiquetas.get(estado_nuevo, estado_nuevo)}.",
        "cita": serializar_modelo(cita),
    }


@app.delete("/api/operaciones/citas/{cita_id}", tags=["Citas"])
def eliminar_cita_con_pago(
    cita_id: int,
    db: Session = Depends(get_db),
):
    cita = db.query(CitaDB).filter(CitaDB.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    pago = db.query(PagoDB).filter(PagoDB.citaId == cita_id).first()

    if pago and float(pago.cobrado or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Esta cita tiene dinero cobrado. Debes cancelarla o revertir "
                "el cobro; no puedes eliminarla."
            ),
        )

    if pago:
        plan_cuotas = db.query(PlanPagoDB).filter(
            PlanPagoDB.pagoId == pago.id
        ).first()
        if plan_cuotas:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Esta cita está relacionada con un plan de cuotas. "
                    "Primero debes cancelar ese plan."
                ),
            )

    try:
        if pago:
            db.delete(pago)
        db.delete(cita)
        db.commit()
        return {"message": "Cita y registro financiero eliminados correctamente."}
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar la cita.",
        ) from error


# =====================================================
# CRUD GENERAL
# =====================================================

@app.get("/api/{store}", tags=["CRUD"])
def get_all(store: str, db: Session = Depends(get_db)):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(status_code=404, detail="Tabla no encontrada.")

    registros = db.query(modelo).all()
    return [serializar_modelo(registro) for registro in registros]


@app.post("/api/{store}", tags=["CRUD"])
def create_record(
    store: str,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(status_code=404, detail="Tabla no encontrada.")

    if store == "pacientes":
        cedula_nueva = str(data.get("cedula", "") or "").strip()
        ficha_nueva = str(data.get("codigo_ficha", "") or "").strip()
        nombre = str(data.get("nombre", "") or "").strip()

        if not nombre:
            raise HTTPException(
                status_code=400,
                detail="El nombre del paciente es obligatorio.",
            )

        if cedula_nueva and db.query(PacienteDB).filter(
            PacienteDB.cedula == cedula_nueva
        ).first():
            raise HTTPException(
                status_code=400,
                detail=f"El DNI/Cédula '{cedula_nueva}' ya está registrado.",
            )

        if ficha_nueva and db.query(PacienteDB).filter(
            PacienteDB.codigo_ficha == ficha_nueva
        ).first():
            raise HTTPException(
                status_code=400,
                detail=f"El código de ficha '{ficha_nueva}' ya existe.",
            )

    columnas_validas = {columna.name for columna in modelo.__table__.columns}
    datos_filtrados = {
        clave: valor
        for clave, valor in data.items()
        if clave in columnas_validas and clave != "id"
    }

    nuevo_registro = modelo(**datos_filtrados)

    try:
        db.add(nuevo_registro)
        db.commit()
        db.refresh(nuevo_registro)
        return serializar_modelo(nuevo_registro)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el registro.",
        ) from error


@app.put("/api/{store}/{item_id}", tags=["CRUD"])
def update_record(
    store: str,
    item_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(status_code=404, detail="Tabla no encontrada.")

    registro = db.query(modelo).filter(modelo.id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    if store == "pacientes":
        cedula_nueva = str(data.get("cedula", registro.cedula) or "").strip()
        ficha_nueva = str(
            data.get("codigo_ficha", registro.codigo_ficha) or ""
        ).strip()

        if cedula_nueva and db.query(PacienteDB).filter(
            PacienteDB.cedula == cedula_nueva,
            PacienteDB.id != item_id,
        ).first():
            raise HTTPException(
                status_code=400,
                detail=f"El DNI '{cedula_nueva}' ya pertenece a otro paciente.",
            )

        if ficha_nueva and db.query(PacienteDB).filter(
            PacienteDB.codigo_ficha == ficha_nueva,
            PacienteDB.id != item_id,
        ).first():
            raise HTTPException(
                status_code=400,
                detail=f"La ficha '{ficha_nueva}' ya pertenece a otro paciente.",
            )

    if store == "citas":
        fecha = str(data.get("fecha", registro.fecha) or "")
        hora = str(data.get("hora", registro.hora) or "")
        estado = str(data.get("estado", registro.estado) or "pendiente")
        validar_fecha_hora(fecha, hora)
        validar_disponibilidad(
            db,
            fecha,
            hora,
            estado,
            cita_excluida_id=item_id,
        )

    columnas_validas = {columna.name for columna in modelo.__table__.columns}
    for clave, valor in data.items():
        if clave in columnas_validas and clave != "id":
            setattr(registro, clave, valor)

    try:
        db.commit()
        db.refresh(registro)
        return {
            "message": "Actualizado correctamente.",
            "registro": serializar_modelo(registro),
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el registro.",
        ) from error


@app.delete("/api/{store}/{item_id}", tags=["CRUD"])
def delete_record(
    store: str,
    item_id: int,
    db: Session = Depends(get_db),
):
    modelo = MODELOS.get(store)
    if not modelo:
        raise HTTPException(status_code=404, detail="Tabla no encontrada.")

    registro = db.query(modelo).filter(modelo.id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    if store == "pacientes":
        tiene_historial = any(
            [
                db.query(CitaDB).filter(CitaDB.pacienteId == item_id).first(),
                db.query(PagoDB).filter(PagoDB.pacienteId == item_id).first(),
                db.query(PlanDB).filter(PlanDB.pacienteId == item_id).first(),
                db.query(PlanPagoDB).filter(
                    PlanPagoDB.pacienteId == item_id
                ).first(),
            ]
        )
        if tiene_historial:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No puedes eliminar un paciente con historial clínico o "
                    "financiero. Conserva su ficha para mantener la trazabilidad."
                ),
            )

    if store == "pagos" and db.query(PlanPagoDB).filter(
        PlanPagoDB.pagoId == item_id
    ).first():
        raise HTTPException(
            status_code=409,
            detail="No puedes eliminar un pago vinculado a un plan de cuotas.",
        )

    try:
        db.delete(registro)
        db.commit()
        return {"message": "Eliminado correctamente."}
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el registro.",
        ) from error


# =====================================================
# IMPORTACIÓN Y EXPORTACIÓN CSV
# =====================================================

@app.get("/api/exportar/pacientes", tags=["Pacientes"])
def exportar_pacientes(db: Session = Depends(get_db)):
    pacientes = db.query(PacienteDB).order_by(PacienteDB.nombre).all()
    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    headers = [
        "codigo_ficha",
        "cedula",
        "nombre",
        "telefono",
        "correo",
        "fechaNacimiento",
        "genero",
        "direccion",
        "alergias",
        "medicamentos",
    ]
    writer.writerow(headers)

    for paciente in pacientes:
        writer.writerow(
            [
                paciente.codigo_ficha or "",
                paciente.cedula or "",
                paciente.nombre or "",
                paciente.telefono or "",
                paciente.correo or "",
                paciente.fechaNacimiento or "",
                paciente.genero or "",
                paciente.direccion or "",
                paciente.alergias or "",
                paciente.medicamentos or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=pacientes_respaldo.csv"
        },
    )


@app.post("/api/importar/pacientes", tags=["Pacientes"])
async def importar_pacientes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nombre_archivo = (file.filename or "").lower()
    if not nombre_archivo.endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV.")

    contenido = await file.read()
    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="El archivo supera el límite de 5 MB.",
        )

    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe estar codificado en UTF-8.",
        ) from exc

    lector = csv.DictReader(io.StringIO(texto), delimiter=",")
    if not lector.fieldnames or "nombre" not in lector.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe contener al menos la columna 'nombre'.",
        )

    nuevos = 0
    actualizados = 0
    omitidos = 0

    try:
        for fila in lector:
            datos = {
                clave: limpiar_valor_csv(valor)
                for clave, valor in fila.items()
                if clave
            }

            nombre = datos.get("nombre", "")
            cedula = datos.get("cedula", "")
            ficha = datos.get("codigo_ficha", "")

            if not nombre:
                omitidos += 1
                continue

            paciente = None
            if cedula:
                paciente = db.query(PacienteDB).filter(
                    PacienteDB.cedula == cedula
                ).first()
            if not paciente and ficha:
                paciente = db.query(PacienteDB).filter(
                    PacienteDB.codigo_ficha == ficha
                ).first()

            if paciente:
                for clave, valor in datos.items():
                    if hasattr(paciente, clave) and clave != "id" and valor:
                        setattr(paciente, clave, valor)
                actualizados += 1
            else:
                columnas_validas = {
                    columna.name for columna in PacienteDB.__table__.columns
                }
                datos_validos = {
                    clave: valor
                    for clave, valor in datos.items()
                    if clave in columnas_validas and clave != "id"
                }
                db.add(PacienteDB(**datos_validos))
                nuevos += 1

        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo importar el archivo. Revisa duplicados y columnas.",
        ) from error

    return {
        "message": (
            f"Importación completa: {nuevos} nuevos, "
            f"{actualizados} actualizados y {omitidos} omitidos."
        )
    }


# =====================================================
# FRONTEND REACT
# =====================================================

def obtener_directorio_frontend() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "frontend"
    return APP_DIR / "frontend-moderno" / "dist"


FRONTEND_DIR = obtener_directorio_frontend()
FRONTEND_ASSETS = FRONTEND_DIR / "assets"

if FRONTEND_DIR.is_dir():
    if FRONTEND_ASSETS.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(FRONTEND_ASSETS)),
            name="react-assets",
        )

    @app.get("/", include_in_schema=False)
    def mostrar_frontend():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{ruta:path}", include_in_schema=False)
    def mostrar_ruta_react(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(status_code=404, detail="Ruta API no encontrada.")

        archivo_solicitado = (FRONTEND_DIR / ruta).resolve()
        frontend_resuelto = FRONTEND_DIR.resolve()

        try:
            archivo_solicitado.relative_to(frontend_resuelto)
        except ValueError as exc:
            raise HTTPException(
                status_code=404,
                detail="Archivo no encontrado.",
            ) from exc

        if archivo_solicitado.is_file():
            return FileResponse(archivo_solicitado)

        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def estado_backend():
        return {
            "message": "API DentalPro activa",
            "frontend": "No compilado",
            "instruccion": "Ejecuta npm run dev o npm run build.",
        }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
