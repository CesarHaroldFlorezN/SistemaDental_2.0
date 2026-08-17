from sqlalchemy import JSON, Column, Integer, Numeric, String, Text

from ..database import Base
from .tipos import FechaISO, HoraISO


class CitaDB(Base):
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    casoClinicoId = Column(Integer, nullable=True, index=True)
    planId = Column(Integer, nullable=True)
    sesionPlanId = Column(Integer, nullable=True, index=True)
    citaBaseId = Column(Integer, nullable=True)
    tipoCita = Column(String(50), default="procedimiento")
    motivoConsulta = Column(Text)
    piezaDental = Column(String(30))
    fecha = Column(FechaISO(), index=True)
    hora = Column(HoraISO(), index=True)
    horaFin = Column(HoraISO(), index=True)
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
