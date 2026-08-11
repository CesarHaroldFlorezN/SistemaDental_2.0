from sqlalchemy import JSON, Column, Integer, Numeric, String, Text

from ..database import Base


class PagoDB(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    casoClinicoId = Column(Integer, nullable=True, index=True)
    planId = Column(Integer, nullable=True, index=True)
    citaId = Column(Integer, nullable=True, index=True)
    concepto = Column(String(200))
    fecha = Column(String(50))
    total = Column(Numeric(10, 2))
    cobrado = Column(Numeric(10, 2))
    saldo = Column(Numeric(10, 2))
    metodo = Column(String(50))
    tipoPago = Column(String(50))
    cuotas = Column(JSON)
    creadoEn = Column(String(50))
    fechaUltPago = Column(String(50))
    nota = Column(Text)
    devuelto = Column(Numeric(10, 2))
    creditoFavor = Column(Numeric(10, 2))


class PlanDB(Base):
    __tablename__ = "planes"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    casoClinicoId = Column(Integer, nullable=True, index=True)
    pagoId = Column(Integer, nullable=True, index=True)
    nombre = Column(String(150))
    tipo = Column(String(100))
    duracion = Column(String(50))
    costo = Column(Numeric(10, 2))
    nSesiones = Column(Integer)
    descripcion = Column(Text)
    estado = Column(String(50))
    creadoEn = Column(String(50))


class PlanPagoDB(Base):
    __tablename__ = "planPagos"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    casoClinicoId = Column(Integer, nullable=True, index=True)
    planId = Column(Integer, nullable=True, index=True)
    pagoId = Column(Integer, nullable=True, index=True)
    citaId = Column(Integer, nullable=True, index=True)
    origen = Column(String(50), default="procedimiento")
    concepto = Column(String(200))
    totalAcordado = Column(Numeric(10, 2))
    anticipo = Column(Numeric(10, 2))
    metodoPreferido = Column(String(50))
    estado = Column(String(50))
    cuotas = Column(JSON)
    totalCuotas = Column(Numeric(10, 2))
    cobrado = Column(Numeric(10, 2))
    saldo = Column(Numeric(10, 2))
    fechaCreacion = Column(String(50))
    creadoEn = Column(String(50))


class MovimientoCuentaDB(Base):
    __tablename__ = "movimientosCuenta"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    casoClinicoId = Column(Integer, nullable=True, index=True)
    planId = Column(Integer, nullable=True, index=True)
    citaId = Column(Integer, nullable=True, index=True)
    pagoId = Column(Integer, nullable=True, index=True)
    tipo = Column(String(50), index=True)
    descripcion = Column(String(250))
    cargo = Column(Numeric(10, 2), default=0)
    abono = Column(Numeric(10, 2), default=0)
    fecha = Column(String(50), index=True)
    metodo = Column(String(100))
    referencia = Column(String(150))
    motivo = Column(Text)
    usuario = Column(String(100))
    creadoEn = Column(String(50))
