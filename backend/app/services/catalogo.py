from __future__ import annotations

import re

from sqlalchemy.orm import Session

from ..catalogo_inicial import CODIGO_POR_ALIAS, normalizar_clave_servicio
from ..models.catalogo import ServicioCatalogoDB
from .comun import ahora_iso, redondear_monto


class ErrorCatalogo(ValueError):
    """Error de validación del catálogo clínico."""


def _validar_identidad_servicio(nombre: str, categoria: str) -> str:
    clave = normalizar_clave_servicio(nombre)
    if len(nombre) < 2 or not clave:
        raise ErrorCatalogo("El nombre del servicio no es válido.")
    if len(categoria) < 2:
        raise ErrorCatalogo("La categoría del servicio no es válida.")
    return clave


def _codigo_disponible(db: Session, nombre: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", normalizar_clave_servicio(nombre)).strip("-")
    base = base[:70] or "servicio"
    candidato = base
    consecutivo = 2

    while db.query(ServicioCatalogoDB).filter_by(codigo=candidato).first():
        candidato = f"{base[:65]}-{consecutivo}"
        consecutivo += 1

    return candidato


def listar_servicios_catalogo(
    db: Session,
    *,
    incluir_inactivos: bool = False,
) -> list[ServicioCatalogoDB]:
    consulta = db.query(ServicioCatalogoDB)
    if not incluir_inactivos:
        consulta = consulta.filter(ServicioCatalogoDB.activo.is_(True))
    return consulta.order_by(
        ServicioCatalogoDB.categoria,
        ServicioCatalogoDB.nombre,
    ).all()


def obtener_servicio_catalogo(
    db: Session,
    servicio_id: int,
) -> ServicioCatalogoDB | None:
    return db.query(ServicioCatalogoDB).filter_by(id=servicio_id).first()


def buscar_servicio_catalogo_por_nombre(
    db: Session,
    nombre: str,
) -> ServicioCatalogoDB | None:
    clave = normalizar_clave_servicio(nombre)
    codigo_alias = CODIGO_POR_ALIAS.get(clave)

    if codigo_alias:
        servicio = (
            db.query(ServicioCatalogoDB)
            .filter(ServicioCatalogoDB.codigo == codigo_alias)
            .first()
        )
        if servicio:
            return servicio

    return (
        db.query(ServicioCatalogoDB)
        .filter(ServicioCatalogoDB.claveNormalizada == clave)
        .first()
    )


def crear_servicio_catalogo(
    db: Session,
    *,
    nombre: str,
    categoria: str,
    precio,
    activo: bool,
) -> ServicioCatalogoDB:
    nombre = nombre.strip()
    categoria = categoria.strip()
    clave = _validar_identidad_servicio(nombre, categoria)

    if buscar_servicio_catalogo_por_nombre(db, nombre):
        raise ErrorCatalogo("Ya existe un servicio equivalente en el catálogo.")

    ahora = ahora_iso()
    servicio = ServicioCatalogoDB(
        codigo=_codigo_disponible(db, nombre),
        nombre=nombre,
        claveNormalizada=clave,
        categoria=categoria,
        precio=redondear_monto(precio),
        activo=activo,
        creadoEn=ahora,
        actualizadoEn=ahora,
    )
    db.add(servicio)
    return servicio


def actualizar_servicio_catalogo(
    db: Session,
    servicio: ServicioCatalogoDB,
    *,
    nombre: str,
    categoria: str,
    precio,
    activo: bool,
) -> ServicioCatalogoDB:
    nombre = nombre.strip()
    categoria = categoria.strip()
    clave = _validar_identidad_servicio(nombre, categoria)
    duplicado = buscar_servicio_catalogo_por_nombre(db, nombre)
    if duplicado and duplicado.id != servicio.id:
        raise ErrorCatalogo("Ya existe un servicio equivalente en el catálogo.")

    servicio.nombre = nombre
    servicio.claveNormalizada = clave
    servicio.categoria = categoria
    servicio.precio = redondear_monto(precio)
    servicio.activo = activo
    servicio.actualizadoEn = ahora_iso()
    return servicio


def resolver_servicio_guardado(
    db: Session,
    *,
    servicio_id: int | None,
    nombre: str,
) -> tuple[int | None, str]:
    """Devuelve ID y nombre canónico, o conserva un servicio personalizado."""

    servicio = (
        obtener_servicio_catalogo(db, servicio_id)
        if servicio_id is not None
        else buscar_servicio_catalogo_por_nombre(db, nombre)
    )
    if servicio:
        return servicio.id, servicio.nombre
    return None, nombre.strip()
