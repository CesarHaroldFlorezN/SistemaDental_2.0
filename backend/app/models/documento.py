from sqlalchemy import Column, Integer, String, Text

from ..database import Base


class DocumentoPacienteDB(Base):
    __tablename__ = "documentosPaciente"

    id = Column(Integer, primary_key=True, index=True)
    pacienteId = Column(Integer, index=True)
    nombre = Column(String(250))
    tipo = Column(String(100))
    ruta = Column(String(500))
    descripcion = Column(Text)
    fecha = Column(String(50))
    creadoEn = Column(String(50))