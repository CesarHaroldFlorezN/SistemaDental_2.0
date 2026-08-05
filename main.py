from __future__ import annotations

import csv
import io
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict

import uvicorn
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles


from sqlalchemy.orm import Session

from backend.app.config import DATA_DIR, DB_PATH
from backend.app.database import Base, engine, get_db

from backend.app.models import (
    CitaDB,
    DocumentoPacienteDB,
    MovimientoCuentaDB,
    PacienteDB,
    PagoDB,
    PlanDB,
    PlanPagoDB,
)

from backend.app.schemas import (
    CambioEstadoPayload,
    CitaPagoPayload,
    OperacionPagoPayload,
    ReprogramarCitaPayload,
)


from backend.app.services import (
    TRANSICIONES_ESTADO,
    ahora_iso,
    calcular_datos_pago,
    limpiar_valor_csv,
    normalizar_servicios,
    obtener_paciente,
    serializar_modelo,
    validar_disponibilidad,
    validar_plan,
    validar_secuencia_sesion,
    anular_pago,
    construir_cuenta_paciente,
    devolver_pago,
    registrar_pago,
)

# =====================================================
# RUTAS DEL PROYECTO
# =====================================================

if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent



# =====================================================
# MODELOS SQLALCHEMY
# =====================================================


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
        if "horaFin" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN horaFin VARCHAR(50)")
        if "duracionMinutos" not in columnas_citas:
            connection.exec_driver_sql("ALTER TABLE citas ADD COLUMN duracionMinutos INTEGER")


asegurar_compatibilidad_esquema()


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title="API DentalPro",
    version="1.3.0",
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



# =====================================================
# FUNCIONES AUXILIARES
# =====================================================

MODELOS = {
    "pacientes": PacienteDB,
    "citas": CitaDB,
    "pagos": PagoDB,
    "planes": PlanDB,
    "planPagos": PlanPagoDB,
    "movimientosCuenta": MovimientoCuentaDB,
    "documentosPaciente": DocumentoPacienteDB,

}

ALMACENES_INMUTABLES = {
    "movimientosCuenta",
}


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
    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
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
        horaFin=hora_fin_resuelta,
        duracionMinutos=duracion_resuelta,
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

    obtener_paciente(db, payload.pacienteId)
    validar_plan(db, payload.planId, payload.pacienteId)

    if payload.sesionNum > payload.totalSesiones:
        raise HTTPException(
            status_code=400,
            detail="La sesión actual no puede superar el total de sesiones.",
        )

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
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
    cita.horaFin = hora_fin_resuelta
    cita.duracionMinutos = duracion_resuelta
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

    hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
        db,
        payload.fecha,
        payload.hora,
        payload.horaFin,
        payload.duracionMinutos,
        cita.estado,
        cita_excluida_id=cita.id,
    )

    fecha_anterior = cita.fecha
    hora_anterior = cita.hora
    hora_fin_anterior = cita.horaFin or minutos_a_hora(convertir_hora_a_minutos(cita.hora or "00:00") + int(cita.duracionMinutos or 60))
    cita.fecha = payload.fecha
    cita.hora = payload.hora
    cita.horaFin = hora_fin_resuelta
    cita.duracionMinutos = duracion_resuelta

    try:
        db.commit()
        db.refresh(cita)
        return {
            "message": (
                f"Cita reprogramada de {fecha_anterior} {hora_anterior} → {hora_fin_anterior} "
                f"a {payload.fecha} {payload.hora} → {hora_fin_resuelta}."
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
            cita.horaFin,
            int(cita.duracionMinutos or 60),
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

    if store in ALMACENES_INMUTABLES:
        raise HTTPException(
            status_code=405,
            detail=(
                "El historial financiero es inmutable. "
                "Usa una anulación o devolución."
            ),
        )



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
        hora_fin = data.get("horaFin", registro.horaFin)
        duracion = int(data.get("duracionMinutos", registro.duracionMinutos or 60) or 60)
        estado = str(data.get("estado", registro.estado) or "pendiente")
        hora_fin_resuelta, duracion_resuelta = validar_disponibilidad(
            db,
            fecha,
            hora,
            hora_fin,
            duracion,
            estado,
            cita_excluida_id=item_id,
        )
        data["horaFin"] = hora_fin_resuelta
        data["duracionMinutos"] = duracion_resuelta

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

    if store in ALMACENES_INMUTABLES:
            raise HTTPException(
                status_code=405,
                detail=(
                    "El historial financiero es inmutable. "
                    "Usa una anulación o devolución."
                ),
            )

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
                db.query(MovimientoCuentaDB).filter(
                    MovimientoCuentaDB.pacienteId == item_id
                ).first(),
                db.query(DocumentoPacienteDB).filter(
                    DocumentoPacienteDB.pacienteId == item_id
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
# DENTALPRO V8: CUENTA, ANULACIONES, DEVOLUCIONES Y DOCUMENTOS
# =====================================================




@app.post(
    "/api/operaciones/pagos/{pago_id}/registrar",
    tags=["Finanzas"],
)
def registrar_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return registrar_pago(db, pago_id, payload)


@app.post(
    "/api/operaciones/pagos/{pago_id}/anular",
    tags=["Finanzas"],
)
def anular_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return anular_pago(db, pago_id, payload)


@app.post(
    "/api/operaciones/pagos/{pago_id}/devolver",
    tags=["Finanzas"],
)
def devolver_pago_auditable(
    pago_id: int,
    payload: OperacionPagoPayload,
    db: Session = Depends(get_db),
):
    return devolver_pago(db, pago_id, payload)


@app.get(
    "/api/pacientes/{paciente_id}/cuenta",
    tags=["Finanzas"],
)
def obtener_cuenta_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
):
    return construir_cuenta_paciente(
        db,
        paciente_id,
    )

DOCUMENTOS_DIR = DATA_DIR / "documentos"
DOCUMENTOS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/pacientes/{paciente_id}/documentos", tags=["Documentos"])
def listar_documentos_paciente(paciente_id: int, db: Session = Depends(get_db)):
    obtener_paciente(db, paciente_id)
    registros = db.query(DocumentoPacienteDB).filter(DocumentoPacienteDB.pacienteId == paciente_id).order_by(DocumentoPacienteDB.id.desc()).all()
    return [serializar_modelo(item) for item in registros]


@app.post("/api/pacientes/{paciente_id}/documentos", tags=["Documentos"])
async def subir_documento_paciente(
    paciente_id: int,
    file: UploadFile = File(...),
    descripcion: str = Form(""),
    db: Session = Depends(get_db),
):
    obtener_paciente(db, paciente_id)
    nombre_original = Path(file.filename or "documento").name
    nombre_seguro = re.sub(r"[^A-Za-z0-9._-]+", "_", nombre_original).strip("._") or "documento"
    carpeta = DOCUMENTOS_DIR / str(paciente_id)
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{nombre_seguro}"
    contenido = await file.read()
    if len(contenido) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede superar 25 MB.")
    destino.write_bytes(contenido)
    registro = DocumentoPacienteDB(
        pacienteId=paciente_id, nombre=nombre_original,
        tipo=file.content_type or "application/octet-stream",
        ruta=str(destino), descripcion=descripcion,
        fecha=datetime.now().astimezone().date().isoformat(), creadoEn=ahora_iso(),
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return serializar_modelo(registro)


@app.get("/api/pacientes/{paciente_id}/documentos/{documento_id}/descargar", tags=["Documentos"])
def descargar_documento_paciente(paciente_id: int, documento_id: int, db: Session = Depends(get_db)):
    registro = db.query(DocumentoPacienteDB).filter(DocumentoPacienteDB.id == documento_id, DocumentoPacienteDB.pacienteId == paciente_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="El documento no existe.")
    ruta = Path(registro.ruta)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo ya no está disponible.")
    return FileResponse(path=ruta, filename=registro.nombre, media_type=registro.tipo or "application/octet-stream")


@app.delete("/api/pacientes/{paciente_id}/documentos/{documento_id}", tags=["Documentos"])
def eliminar_documento_paciente(paciente_id: int, documento_id: int, db: Session = Depends(get_db)):
    registro = db.query(DocumentoPacienteDB).filter(DocumentoPacienteDB.id == documento_id, DocumentoPacienteDB.pacienteId == paciente_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="El documento no existe.")
    ruta = Path(registro.ruta)
    if ruta.exists():
        ruta.unlink()
    db.delete(registro)
    db.commit()
    return {"message": "Documento eliminado."}


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
    return APP_DIR / "frontend" / "dist"


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
