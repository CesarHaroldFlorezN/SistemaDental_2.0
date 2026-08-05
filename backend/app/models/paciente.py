from sqlalchemy import Column, Integer, String, Text

from ..database import Base


class PacienteDB(Base):
    __tablename__ = "pacientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cedula = Column(String(50), index=True)
    fechaNacimiento = Column(String(50))
    genero = Column(String(50))
    telefono = Column(String(50))
    correo = Column(String(100))
    codigo_ficha = Column(String(50), index=True)
    direccion = Column(String(200))
    alergias = Column(Text)
    medicamentos = Column(Text)
    fechaReg = Column(String(50))