from sqlalchemy import Boolean, Column, Integer, Numeric, String

from ..database import Base


class ServicioCatalogoDB(Base):
    __tablename__ = "serviciosCatalogo"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(80), nullable=False, unique=True, index=True)
    nombre = Column(String(150), nullable=False)
    claveNormalizada = Column(String(180), nullable=False, unique=True, index=True)
    categoria = Column(String(100), nullable=False)
    precio = Column(Numeric(10, 2), nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True, index=True)
    creadoEn = Column(String(50), nullable=False)
    actualizadoEn = Column(String(50), nullable=False)
