from sqlalchemy import JSON, Column, Integer, String, Text

from ..database import Base


class OdontogramaDB(Base):
    """Versión clínica inalterable del odontograma de un paciente."""

    __tablename__ = "odontogramas"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, nullable=False, index=True)
    motivo = Column(String(80), nullable=False)
    denticion = Column(String(20), nullable=False, default="permanente")
    hallazgos = Column(JSON, nullable=False)
    especificaciones = Column(Text)
    observaciones = Column(Text)
    norma = Column(String(100), nullable=False, default="NTS 188-MINSA/DGIESP-2022")
    profesionalId = Column(Integer, nullable=False)
    profesionalNombre = Column(String(120), nullable=False)
    creadoEn = Column(String(50), nullable=False)
