from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencias import exigir_personal_clinico
from ..models import CasoClinicoDB, SesionPlanDB
from ..schemas import CasoClinicoPayload, DiagnosticoCasoPayload
from ..services import ahora_iso, obtener_paciente, serializar_modelo

router = APIRouter(tags=["Casos clínicos"])


@router.get("/api/casosClinicos")
def listar_casos_clinicos(
    paciente_id: int | None = Query(default=None, alias="pacienteId"),
    db: Session = Depends(get_db),
):
    consulta = db.query(CasoClinicoDB)
    if paciente_id:
        consulta = consulta.filter(CasoClinicoDB.pacienteId == paciente_id)
    casos = consulta.order_by(CasoClinicoDB.id.desc()).all()
    return [serializar_modelo(caso) for caso in casos]


@router.post(
    "/api/casosClinicos",
    dependencies=[Depends(exigir_personal_clinico)],
)
def crear_caso_clinico(
    payload: CasoClinicoPayload,
    db: Session = Depends(get_db),
):
    obtener_paciente(db, payload.pacienteId)
    ahora = ahora_iso()
    caso = CasoClinicoDB(
        **payload.model_dump(),
        creadoEn=ahora,
        actualizadoEn=ahora,
    )
    try:
        db.add(caso)
        db.commit()
        db.refresh(caso)
        return serializar_modelo(caso)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo crear el caso clínico.",
        ) from error


@router.put(
    "/api/casosClinicos/{caso_id}",
    dependencies=[Depends(exigir_personal_clinico)],
)
def actualizar_caso_clinico(
    caso_id: int,
    payload: CasoClinicoPayload,
    db: Session = Depends(get_db),
):
    caso = db.query(CasoClinicoDB).filter(CasoClinicoDB.id == caso_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso clínico no encontrado.")
    obtener_paciente(db, payload.pacienteId)
    for clave, valor in payload.model_dump().items():
        setattr(caso, clave, valor)
    caso.actualizadoEn = ahora_iso()
    try:
        db.commit()
        db.refresh(caso)
        return {"message": "Caso actualizado.", "registro": serializar_modelo(caso)}
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el caso clínico.",
        ) from error


@router.patch(
    "/api/casosClinicos/{caso_id}/diagnostico",
    dependencies=[Depends(exigir_personal_clinico)],
)
def registrar_diagnostico(
    caso_id: int,
    payload: DiagnosticoCasoPayload,
    db: Session = Depends(get_db),
):
    caso = db.query(CasoClinicoDB).filter(CasoClinicoDB.id == caso_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso clínico no encontrado.")
    caso.diagnostico = payload.diagnostico.strip()
    caso.estado = payload.estado
    caso.actualizadoEn = ahora_iso()
    db.commit()
    db.refresh(caso)
    return {"message": "Diagnóstico registrado.", "registro": serializar_modelo(caso)}


@router.get("/api/sesionesPlan")
def listar_sesiones_plan(
    plan_id: int | None = Query(default=None, alias="planId"),
    db: Session = Depends(get_db),
):
    consulta = db.query(SesionPlanDB)
    if plan_id:
        consulta = consulta.filter(SesionPlanDB.planId == plan_id)
    sesiones = consulta.order_by(SesionPlanDB.planId, SesionPlanDB.numero).all()
    return [serializar_modelo(sesion) for sesion in sesiones]
