from sqlalchemy import Column, Integer, String, Text

from ..database import Base


class CasoClinicoDB(Base):
    __tablename__ = "casosClinicos"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, nullable=False, index=True)
    planId = Column(Integer, nullable=True, index=True)
    titulo = Column(String(180), nullable=False)
    tipo = Column(String(50), nullable=False, default="procedimiento")
    motivoConsulta = Column(Text)
    piezaDental = Column(String(30))
    diagnostico = Column(Text)
    estado = Column(String(50), nullable=False, default="abierto", index=True)
    creadoEn = Column(String(50), nullable=False)
    actualizadoEn = Column(String(50))


class SesionPlanDB(Base):
    __tablename__ = "sesionesPlan"

    id = Column(Integer, primary_key=True, index=True)
    planId = Column(Integer, nullable=False, index=True)
    numero = Column(Integer, nullable=False)
    titulo = Column(String(180), nullable=False)
    estado = Column(String(50), nullable=False, default="pendiente", index=True)
    citaId = Column(Integer, nullable=True, index=True)
    fechaProgramada = Column(String(50))
    cuotaNum = Column(Integer, nullable=True)
    notas = Column(Text)
    creadoEn = Column(String(50), nullable=False)
    actualizadoEn = Column(String(50))
