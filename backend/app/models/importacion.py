from sqlalchemy import JSON, Column, Integer, String

from ..database import Base


class ImportacionOficialDB(Base):
    """Trazabilidad de una sustitución realizada desde un JSON oficial."""

    __tablename__ = "importacionesOficiales"

    id = Column(Integer, primary_key=True, index=True)
    versionFuente = Column(Integer, nullable=False)
    fechaFuente = Column(String(50), nullable=False)
    nombreArchivo = Column(String(250), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    conteos = Column(JSON, nullable=False)
    advertencias = Column(JSON, nullable=False)
    ajustes = Column(JSON, nullable=False)
    importadaEn = Column(String(50), nullable=False)
