from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

# ══════════════════════════════════════════
# 1. CONFIGURACIÓN DE BASE DE DATOS
# ══════════════════════════════════════════
# Para desarrollo usamos SQLite. Para AWS RDS cambiarías esto a: 
# "mysql+pymysql://usuario:password@endpoint-aws:3306/dentalpro"
DATABASE_URL = "sqlite:///./dentalpro.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ══════════════════════════════════════════
# 2. MODELOS SQL (Creación de Tablas)
# ══════════════════════════════════════════
class PacienteDB(Base):
    __tablename__ = "pacientes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cedula = Column(String(50))
    nacimiento = Column(String(50))
    genero = Column(String(50))
    telefono = Column(String(50))
    codigo_ficha = Column(String(50)) # <--- ESTE ES EL NUEVO CAMPO
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
    cuotas = Column(JSON) # Almacena el array de cuotas como JSON nativo
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

# Crear las tablas en la base de datos (si no existen)
Base.metadata.create_all(bind=engine)


# ══════════════════════════════════════════
# 3. INICIALIZACIÓN FASTAPI Y CORS
# ══════════════════════════════════════════
app = FastAPI(title="API DentalPro")

# Permitir que el HTML/JS local se conecte a esta API
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

# ══════════════════════════════════════════
# 4. RUTAS DINÁMICAS (CRUD Universal)
# ══════════════════════════════════════════
# Mapeo de los nombres de las tablas de JS a los modelos SQL de Python
MODELOS = {
    "pacientes": PacienteDB,
    "citas": CitaDB,
    "pagos": PagoDB,
    "planes": PlanDB,
    "planPagos": PlanPagoDB
}

# GET: Obtener todos los registros de una tabla
@app.get("/api/{store}")
def get_all(store: str, db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
    registros = db.query(MODELOS[store]).all()
    # Convertir registros SQL a diccionarios
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in registros]

# POST: Crear un nuevo registro
@app.post("/api/{store}")
def create_record(store: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
    
    # Extraemos el ID si viene (para ignorarlo al crear)
    data.pop("id", None)
    
    nuevo_registro = MODELOS[store](**data)
    db.add(nuevo_registro)
    db.commit()
    db.refresh(nuevo_registro)
    
    # Devolver el objeto creado (incluyendo el ID autogenerado)
    return {c.name: getattr(nuevo_registro, c.name) for c in nuevo_registro.__table__.columns}

# PUT: Actualizar un registro existente
@app.put("/api/{store}/{item_id}")
def update_record(store: str, item_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    if store not in MODELOS:
        raise HTTPException(status_code=404, detail="Tabla no encontrada")
    
    registro = db.query(MODELOS[store]).filter(MODELOS[store].id == item_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Actualizar campos
    for key, value in data.items():
        if hasattr(registro, key) and key != "id":
            setattr(registro, key, value)
            
    db.commit()
    return {"message": "Actualizado exitosamente", "id": item_id}

# DELETE: Eliminar un registro
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