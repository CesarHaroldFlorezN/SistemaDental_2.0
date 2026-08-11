from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import exigir_personal_clinico
from ..models import OdontogramaDB, UsuarioDB
from ..schemas import OdontogramaPayload
from ..services import ahora_iso, obtener_paciente, serializar_modelo

router = APIRouter(tags=["Odontograma"])

CODIGOS_AZULES = {
    "diastema",
    "edentulo_total",
    "fosas_fisuras",
    "fusion",
    "geminacion",
    "giroversion",
    "impactacion",
    "macrodoncia",
    "microdoncia",
    "ausente",
    "clavija",
    "ectopica",
    "erupcion",
    "extruida",
    "intruida",
    "supernumeraria",
    "posicion_anormal",
    "transposicion",
}
CODIGOS_ROJOS = {
    "corona_temporal",
    "defecto_esmalte",
    "fractura",
    "caries",
    "movilidad",
    "remanente_radicular",
    "restauracion_temporal",
    "superficie_desgastada",
}
CODIGOS_VARIABLES = {
    "ortodontico_fijo",
    "ortodontico_removible",
    "corona",
    "espigo_munon",
    "implante",
    "pulpotomia",
    "protesis_fija",
    "protesis_completa",
    "protesis_removible",
    "restauracion_definitiva",
    "sellante",
    "tratamiento_conducto",
}
CODIGOS_NTS = CODIGOS_AZULES | CODIGOS_ROJOS | CODIGOS_VARIABLES


def _validar_hallazgos(payload: OdontogramaPayload) -> list[dict]:
    hallazgos = []
    for hallazgo in payload.hallazgos:
        datos = hallazgo.model_dump()
        if datos["codigo"] not in CODIGOS_NTS:
            raise HTTPException(
                status_code=422,
                detail=f"El hallazgo {datos['codigo']} no pertenece a la nomenclatura NTS 188.",
            )
        color_obligatorio = (
            "azul"
            if datos["codigo"] in CODIGOS_AZULES
            else "rojo"
            if datos["codigo"] in CODIGOS_ROJOS
            else None
        )
        if color_obligatorio and datos["color"] != color_obligatorio:
            raise HTTPException(
                status_code=422,
                detail=f"{datos['nombre']} debe registrarse en color {color_obligatorio}.",
            )
        hallazgos.append(datos)
    return hallazgos


@router.get("/api/odontogramas")
def listar_odontogramas(
    paciente_id: int = Query(alias="pacienteId", gt=0),
    db: Session = Depends(get_db),
):
    obtener_paciente(db, paciente_id)
    registros = (
        db.query(OdontogramaDB)
        .filter(OdontogramaDB.pacienteId == paciente_id)
        .order_by(OdontogramaDB.id.desc())
        .all()
    )
    return [serializar_modelo(registro) for registro in registros]


@router.post("/api/odontogramas")
def crear_odontograma(
    payload: OdontogramaPayload,
    db: Session = Depends(get_db),
    usuario: UsuarioDB = Depends(exigir_personal_clinico),
):
    obtener_paciente(db, payload.pacienteId)
    registro = OdontogramaDB(
        pacienteId=payload.pacienteId,
        motivo=payload.motivo,
        denticion=payload.denticion,
        hallazgos=_validar_hallazgos(payload),
        especificaciones=payload.especificaciones.strip(),
        observaciones=payload.observaciones.strip(),
        norma="NTS 188-MINSA/DGIESP-2022",
        profesionalId=usuario.id,
        profesionalNombre=usuario.nombre,
        creadoEn=ahora_iso(),
    )
    try:
        db.add(registro)
        db.commit()
        db.refresh(registro)
        return serializar_modelo(registro)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar la versión del odontograma.",
        ) from error
