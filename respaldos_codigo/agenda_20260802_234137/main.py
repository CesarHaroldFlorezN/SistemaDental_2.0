from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
import uvicorn
import os
import csv
import io
from pathlib import Path
import sys



BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "dentalpro.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"




# 1. CONFIGURACIÓN DE BASE DE DATOS
os.makedirs("./data", exist_ok=True) # Asegura que exista la carpeta data/
DATABASE_URL = "sqlite:///./data/dentalpro.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. MODELOS SQL (Creación de Tablas)
class PacienteDB(Base):
    __tablename__ = "pacientes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cedula = Column(String(50), index=True)
    fechaNacimiento = Column(String(50))  # Corregido para coincidir con React
    genero = Column(String(50))
    telefono = Column(String(50))
    correo = Column(String(100))          # Agregado
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
    fecha = Column(String(50))
    hora = Column(String(50))
    procedimiento = Column(String(200))
    notas = Column(Text)
    notasFin = Column(Text)
    costo = Column(Float)
    tipoPago = Column(String(50))
    estado = Column(String(50))
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
    citaId = Column(Integer)
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
    pagoId = Column(Integer)
    citaId = Column(Integer)
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

# 3. INICIALIZACIÓN FASTAPI Y CORS
app = FastAPI(title="API DentalPro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
class CitaPagoPayload(BaseModel):
    pacienteId: int

    planId: Optional[int] = None
    citaBaseId: Optional[int] = None

    fecha: str
    hora: str
    procedimiento: str

    notas: str = ""
    estado: str = "pendiente"

    costo: float = Field(default=0, ge=0)

    tipoPago: Literal[
        "contado",
        "completo",
        "anticipo",
        "cuotas",
        "cortesia"
    ] = "contado"

    montoPagado: float = Field(default=0, ge=0)
    metodoPago: str = "Efectivo"

    sesionNum: int = Field(default=1, ge=1)
    totalSesiones: int = Field(default=1, ge=1)

def serializar_modelo(registro):
    return {
        columna.name: getattr(registro, columna.name)
        for columna in registro.__table__.columns
    }


def calcular_datos_pago(payload: CitaPagoPayload):
    tipo_pago = payload.tipoPago

    if tipo_pago == "cortesia":
        total = 0.0
        cobrado = 0.0

    else:
        total = round(float(payload.costo), 2)

        if tipo_pago == "completo":
            cobrado = total

        elif tipo_pago == "contado":
            cobrado = 0.0

        else:
            cobrado = round(float(payload.montoPagado), 2)

    if cobrado > total:
        raise HTTPException(
            status_code=400,
            detail="El monto pagado no puede superar el costo total."
        )

    if tipo_pago == "anticipo":
        if cobrado <= 0:
            raise HTTPException(
                status_code=400,
                detail="Debes ingresar el monto del anticipo."
            )

        if cobrado >= total:
            raise HTTPException(
                status_code=400,
                detail=(
                    "El anticipo debe ser menor al costo total. "
                    "Si pagó todo, selecciona 'Pagado completo'."
                )
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
        "metodo": metodo
    }
    
# 4. RUTAS DINÁMICAS (CRUD Universal)
MODELOS = {
    "pacientes": PacienteDB,
    "citas": CitaDB,
    "pagos": PagoDB,
    "planes": PlanDB,
    "planPagos": PlanPagoDB
}

@app.get("/api/{store}")
def get_all(store: str, db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
    registros = db.query(MODELOS[store]).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in registros]

@app.post("/api/operaciones/citas")
def crear_cita_con_pago(
    payload: CitaPagoPayload,
    db: Session = Depends(get_db)
):
    paciente = db.query(PacienteDB).filter(
        PacienteDB.id == payload.pacienteId
    ).first()

    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="El paciente seleccionado no existe."
        )

    datos_pago = calcular_datos_pago(payload)
    ahora = datetime.now().isoformat(timespec="seconds")

    nueva_cita = CitaDB(
        pacienteId=payload.pacienteId,
        planId=payload.planId,
        citaBaseId=payload.citaBaseId,
        fecha=payload.fecha,
        hora=payload.hora,
        procedimiento=payload.procedimiento.strip(),
        notas=payload.notas.strip(),
        costo=datos_pago["total"],
        tipoPago=payload.tipoPago,
        estado=payload.estado,
        sesionNum=payload.sesionNum,
        totalSesiones=payload.totalSesiones,
        creadaEn=ahora
    )

    try:
        db.add(nueva_cita)

        # Obtiene el ID sin confirmar todavía la transacción.
        db.flush()

        nuevo_pago = PagoDB(
            pacienteId=payload.pacienteId,
            citaId=nueva_cita.id,
            concepto=payload.procedimiento.strip(),
            fecha=payload.fecha,
            total=datos_pago["total"],
            cobrado=datos_pago["cobrado"],
            saldo=datos_pago["saldo"],
            metodo=datos_pago["metodo"],
            tipoPago=payload.tipoPago,
            cuotas=[],
            creadoEn=ahora,
            fechaUltPago=(
                payload.fecha
                if datos_pago["cobrado"] > 0
                else None
            ),
            nota="Pago generado automáticamente desde la cita",
            devuelto=0,
            creditoFavor=0
        )

        db.add(nuevo_pago)

        # Cita y pago se confirman juntos.
        db.commit()

        db.refresh(nueva_cita)
        db.refresh(nuevo_pago)

        return {
            "message": "Cita y pago registrados correctamente.",
            "cita": serializar_modelo(nueva_cita),
            "pago": serializar_modelo(nuevo_pago)
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=f"No se pudo registrar la cita y el pago: {error}"
        )

@app.put("/api/operaciones/citas/{cita_id}")
def actualizar_cita_con_pago(
    cita_id: int,
    payload: CitaPagoPayload,
    db: Session = Depends(get_db)
):
    cita = db.query(CitaDB).filter(
        CitaDB.id == cita_id
    ).first()

    if not cita:
        raise HTTPException(
            status_code=404,
            detail="La cita no existe."
        )

    paciente = db.query(PacienteDB).filter(
        PacienteDB.id == payload.pacienteId
    ).first()

    if not paciente:
        raise HTTPException(
            status_code=404,
            detail="El paciente seleccionado no existe."
        )

    pago = db.query(PagoDB).filter(
        PagoDB.citaId == cita_id
    ).first()

    datos_pago = calcular_datos_pago(payload)
    ahora = datetime.now().isoformat(timespec="seconds")

    # Evita eliminar accidentalmente dinero ya cobrado.
    if pago and datos_pago["cobrado"] < float(pago.cobrado or 0):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes reducir un monto ya cobrado desde la cita. "
                "Primero debes revertir el cobro desde Finanzas."
            )
        )

    cita.pacienteId = payload.pacienteId
    cita.planId = payload.planId
    cita.citaBaseId = payload.citaBaseId
    cita.fecha = payload.fecha
    cita.hora = payload.hora
    cita.procedimiento = payload.procedimiento.strip()
    cita.notas = payload.notas.strip()
    cita.costo = datos_pago["total"]
    cita.tipoPago = payload.tipoPago
    cita.estado = payload.estado
    cita.sesionNum = payload.sesionNum
    cita.totalSesiones = payload.totalSesiones

    try:
        if not pago:
            pago = PagoDB(
                pacienteId=payload.pacienteId,
                citaId=cita.id,
                cuotas=[],
                creadoEn=ahora,
                devuelto=0,
                creditoFavor=0
            )

            db.add(pago)

        pago.pacienteId = payload.pacienteId
        pago.concepto = payload.procedimiento.strip()
        pago.fecha = payload.fecha
        pago.total = datos_pago["total"]
        pago.cobrado = datos_pago["cobrado"]
        pago.saldo = datos_pago["saldo"]
        pago.metodo = datos_pago["metodo"]
        pago.tipoPago = payload.tipoPago
        pago.fechaUltPago = (
            payload.fecha
            if datos_pago["cobrado"] > 0
            else None
        )

        db.commit()

        db.refresh(cita)
        db.refresh(pago)

        return {
            "message": "Cita y pago actualizados correctamente.",
            "cita": serializar_modelo(cita),
            "pago": serializar_modelo(pago)
        }

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=f"No se pudo actualizar la cita: {error}"
        )
@app.delete("/api/operaciones/citas/{cita_id}")
def eliminar_cita_con_pago(
    cita_id: int,
    db: Session = Depends(get_db)
):
    cita = db.query(CitaDB).filter(
        CitaDB.id == cita_id
    ).first()

    if not cita:
        raise HTTPException(
            status_code=404,
            detail="La cita no existe."
        )

    pago = db.query(PagoDB).filter(
        PagoDB.citaId == cita_id
    ).first()

    if pago and float(pago.cobrado or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Esta cita tiene dinero cobrado. "
                "Debes cancelarla o revertir el cobro; no puedes eliminarla."
            )
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
                )
            )

    try:
        if pago:
            db.delete(pago)

        db.delete(cita)
        db.commit()

        return {
            "message": "Cita y pago eliminados correctamente."
        }

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=f"No se pudo eliminar la cita: {error}"
        )

@app.post("/api/{store}")
def create_record(store: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
        
    if store == "pacientes":
        cedula_nueva = str(data.get("cedula", "")).strip()
        ficha_nueva = str(data.get("codigo_ficha", "")).strip()
                
        if cedula_nueva:
            if db.query(PacienteDB).filter(PacienteDB.cedula == cedula_nueva).first():
                raise HTTPException(status_code=400, detail=f"El DNI/Cédula '{cedula_nueva}' ya está registrado.")
                        
        if ficha_nueva:
            if db.query(PacienteDB).filter(PacienteDB.codigo_ficha == ficha_nueva).first():
                raise HTTPException(status_code=400, detail=f"El código de ficha '{ficha_nueva}' ya existe.")
                
    # Filtramos solo las columnas válidas de la tabla de BD
    valid_columns = {c.name for c in MODELOS[store].__table__.columns}
    filtered_data = {k: v for k, v in data.items() if k in valid_columns and k != "id"}
    
    nuevo_registro = MODELOS[store](**filtered_data)
    try:
        db.add(nuevo_registro)
        db.commit()
        db.refresh(nuevo_registro)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error en base de datos: {str(e)}")
        
    return {c.name: getattr(nuevo_registro, c.name) for c in nuevo_registro.__table__.columns}

@app.put("/api/{store}/{item_id}")
def update_record(store: str, item_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
        
    registro = db.query(MODELOS[store]).filter(MODELOS[store].id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    if store == "pacientes":
        cedula_nueva = str(data.get("cedula", "")).strip()
        ficha_nueva = str(data.get("codigo_ficha", "")).strip()
                
        if cedula_nueva:
            existe_dni = db.query(PacienteDB).filter(
                PacienteDB.cedula == cedula_nueva, 
                PacienteDB.id != item_id
            ).first()
            if existe_dni:
                raise HTTPException(status_code=400, detail=f"El DNI '{cedula_nueva}' ya está registrado en otro paciente.")
                        
        if ficha_nueva:
            existe_ficha = db.query(PacienteDB).filter(
                PacienteDB.codigo_ficha == ficha_nueva, 
                PacienteDB.id != item_id
            ).first()
            if existe_ficha:
                raise HTTPException(status_code=400, detail=f"El código de ficha '{ficha_nueva}' ya existe en otro paciente.")
                
    # Actualizar solo campos que existan en el modelo
    valid_columns = {c.name for c in MODELOS[store].__table__.columns}
    for key, value in data.items():
        if key in valid_columns and key != "id":
            setattr(registro, key, value)
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar: {str(e)}")
        
    return {"message": "Actualizado exitosamente", "id": item_id}

@app.delete("/api/{store}/{item_id}")
def delete_record(store: str, item_id: int, db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
        
    registro = db.query(MODELOS[store]).filter(MODELOS[store].id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
            
    db.delete(registro)
    db.commit()
    return {"message": "Eliminado exitosamente"}


# ==========================================
# RUTAS DE EXPORTACIÓN E IMPORTACIÓN CSV
# ==========================================

@app.get("/api/exportar/pacientes")
def exportar_pacientes(db: Session = Depends(get_db)):
    pacientes = db.query(PacienteDB).all()
    
    # Crear un archivo CSV en memoria
    output = io.StringIO()
    
    # ¡ESTA ES LA LÍNEA MÁGICA PARA EXCEL! (UTF-8 BOM)
    output.write('\ufeff') 
    
    writer = csv.writer(output, delimiter=',', quoting=csv.QUOTE_MINIMAL)
    
    # Escribir la primera fila (los encabezados obligatorios)
    headers = ["codigo_ficha", "cedula", "nombre", "telefono", "correo", "fechaNacimiento", "genero", "direccion", "alergias", "medicamentos"]
    writer.writerow(headers)
    
    # Escribir los datos de cada paciente
    for p in pacientes:
        writer.writerow([
            p.codigo_ficha or "", p.cedula or "", p.nombre or "", 
            p.telefono or "", p.correo or "", p.fechaNacimiento or "", 
            p.genero or "", p.direccion or "", p.alergias or "", p.medicamentos or ""
        ])
    
    output.seek(0)
    
    # Enviar el archivo como descarga automática
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pacientes_respaldo.csv"}
    )

@app.post("/api/importar/pacientes")
async def importar_pacientes(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser formato CSV.")
    
    content = await file.read()
    decoded_content = content.decode('utf-8-sig') # utf-8-sig evita problemas con acentos y caracteres especiales
    csv_reader = csv.DictReader(io.StringIO(decoded_content), delimiter=',')
    
    nuevos, actualizados, omitidos = 0, 0, 0

    for row in csv_reader:
        nombre = row.get("nombre", "").strip()
        cedula = row.get("cedula", "").strip()
        
        if not nombre:
            omitidos += 1
            continue # El nombre es obligatorio, si no hay, saltamos la fila
            
        # Buscar si el DNI ya existe para no duplicar
        paciente_existente = db.query(PacienteDB).filter(PacienteDB.cedula == cedula).first() if cedula else None
            
        if paciente_existente:
            # Si existe, actualizamos sus datos con los del Excel
            for key, value in row.items():
                if hasattr(paciente_existente, key) and key != "id" and value.strip():
                    setattr(paciente_existente, key, value.strip())
            actualizados += 1
        else:
            # Si no existe, creamos uno nuevo
            nuevo_paciente = PacienteDB(**{k: v.strip() for k, v in row.items() if hasattr(PacienteDB, k) and k != "id"})
            db.add(nuevo_paciente)
            nuevos += 1

    try:
        db.commit()
        return {"message": f"Éxito: {nuevos} nuevos, {actualizados} actualizados, {omitidos} omitidos."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al guardar: {str(e)}")


# =====================================================
# FRONTEND REACT
# =====================================================

def obtener_directorio_frontend() -> Path:
    """
    Devuelve la ubicación del frontend compilado.

    Desarrollo:
        frontend-moderno/dist

    PyInstaller:
        frontend/
    """
    if getattr(sys, "frozen", False):
        base_dir = Path(sys._MEIPASS)
        return base_dir / "frontend"

    return Path(__file__).resolve().parent / "frontend-moderno" / "dist"


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
        """
        Permite que React maneje las futuras rutas internas.
        Ejemplos:
            /pacientes
            /agenda
            /finanzas
        """

        # Las rutas API inexistentes deben devolver 404,
        # no el index.html de React.
        if ruta.startswith("api/"):
            raise HTTPException(
                status_code=404,
                detail="Ruta API no encontrada",
            )

        archivo_solicitado = (FRONTEND_DIR / ruta).resolve()
        frontend_resuelto = FRONTEND_DIR.resolve()

        # Protección contra rutas como ../../archivo
        try:
            archivo_solicitado.relative_to(frontend_resuelto)
        except ValueError:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")

        if archivo_solicitado.is_file():
            return FileResponse(archivo_solicitado)

        # React controla cualquier ruta que no sea un archivo.
        return FileResponse(FRONTEND_DIR / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def estado_backend():
        return {
            "message": "API DentalPro activa",
            "frontend": "No compilado",
            "instruccion": (
                "Ejecuta npm run dev o compila React con npm run build"
            ),
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)