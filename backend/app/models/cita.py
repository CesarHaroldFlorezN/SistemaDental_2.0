from sqlalchemy import JSON, Column, Integer, Numeric, String, Text

from ..database import Base


class CitaDB(Base):
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    planId = Column(Integer, nullable=True)
    citaBaseId = Column(Integer, nullable=True)
    fecha = Column(String(50), index=True)
    hora = Column(String(50), index=True)
    horaFin = Column(String(50), index=True)
    duracionMinutos = Column(Integer)
    procedimiento = Column(String(200))
    servicios = Column(JSON)
    notas = Column(Text)
    notasFin = Column(Text)
    costo = Column(Numeric(10, 2))
    tipoPago = Column(String(50))
    estado = Column(String(50), index=True)
    sesionNum = Column(Integer)
    totalSesiones = Column(Integer)
    creadaEn = Column(String(50))
    inicio = Column(String(50))
    fin = Column(String(50))
    motivoCancelacion = Column(Text)
    canceladaEn = Column(String(50))
