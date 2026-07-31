from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from typing import Dict, Any
import uvicorn
import os

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

# --- CONEXIÓN PARA SERVIR EL FRONTEND ---
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)