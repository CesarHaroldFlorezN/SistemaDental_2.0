from sqlalchemy import JSON, Column, Float, Integer, String, Text

from ..database import Base


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


class MovimientoCuentaDB(Base):
    __tablename__ = "movimientosCuenta"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    citaId = Column(Integer, nullable=True, index=True)
    pagoId = Column(Integer, nullable=True, index=True)
    tipo = Column(String(50), index=True)
    descripcion = Column(String(250))
    cargo = Column(Float, default=0)
    abono = Column(Float, default=0)
    fecha = Column(String(50), index=True)
    metodo = Column(String(100))
    referencia = Column(String(150))
    motivo = Column(Text)
    usuario = Column(String(100))
    creadoEn = Column(String(50))
    