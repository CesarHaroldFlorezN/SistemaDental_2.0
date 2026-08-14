from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)

from ..database import Base


class UsuarioDB(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    nombre_usuario = Column(String(80), nullable=False)
    contrasena_hash = Column(String(255), nullable=False)
    rol = Column(String(30), nullable=False)
    activo = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )
    intentos_fallidos = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    bloqueado_hasta = Column(String(50))
    creado_en = Column(String(50), nullable=False)
    actualizado_en = Column(String(50), nullable=False)
    ultimo_acceso_en = Column(String(50))
    debe_cambiar_contrasena = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )

    __table_args__ = (
        CheckConstraint(
            "TRIM(nombre_usuario) <> ''",
            name="ck_usuarios_nombre_usuario_no_vacio",
        ),
        CheckConstraint(
            "rol IN ('administrador', 'odontologo', 'recepcion')",
            name="ck_usuarios_rol_valido",
        ),
        Index(
            "ux_usuarios_nombre_usuario_normalizado",
            func.lower(func.trim(nombre_usuario)),
            unique=True,
        ),
    )


class SesionDB(Base):
    __tablename__ = "sesiones"

    id = Column(Integer, primary_key=True)
    usuario_id = Column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash = Column(String(64), nullable=False)
    creada_en = Column(String(50), nullable=False)
    expira_en = Column(String(50), nullable=False)
    revocada_en = Column(String(50))

    __table_args__ = (
        Index(
            "ux_sesiones_token_hash",
            "token_hash",
            unique=True,
        ),
        Index(
            "ix_sesiones_usuario_id",
            "usuario_id",
        ),
        Index(
            "ix_sesiones_expira_en",
            "expira_en",
        ),
    )
