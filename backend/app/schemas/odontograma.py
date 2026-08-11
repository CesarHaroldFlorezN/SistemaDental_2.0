from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


PIEZAS_PERMANENTES = {
    f"{cuadrante}{pieza}"
    for cuadrante in (1, 2, 3, 4)
    for pieza in range(1, 9)
}
PIEZAS_DECIDUAS = {
    f"{cuadrante}{pieza}"
    for cuadrante in (5, 6, 7, 8)
    for pieza in range(1, 6)
}
PIEZAS_FDI = PIEZAS_PERMANENTES | PIEZAS_DECIDUAS


class HallazgoOdontogramaPayload(BaseModel):
    codigo: str = Field(min_length=2, max_length=60)
    nombre: str = Field(min_length=2, max_length=120)
    piezas: list[str] = Field(min_length=1, max_length=32)
    sigla: str = Field(default="", max_length=20)
    color: Literal["azul", "rojo"]
    superficies: list[Literal["vestibular", "lingual", "palatino", "mesial", "distal", "oclusal", "incisal", "raiz"]] = Field(default_factory=list, max_length=8)
    detalle: str = Field(default="", max_length=1000)

    @field_validator("piezas")
    @classmethod
    def validar_piezas_fdi(cls, piezas: list[str]) -> list[str]:
        normalizadas = [str(pieza).strip() for pieza in piezas]
        invalidas = [pieza for pieza in normalizadas if pieza not in PIEZAS_FDI]
        if invalidas:
            raise ValueError(f"Piezas FDI no válidas: {', '.join(invalidas)}")
        if len(set(normalizadas)) != len(normalizadas):
            raise ValueError("Una pieza no puede repetirse en el mismo hallazgo.")
        return normalizadas


class OdontogramaPayload(BaseModel):
    pacienteId: int = Field(gt=0)
    motivo: Literal[
        "inicio_plan",
        "nuevo_hallazgo",
        "fin_plan",
        "reingreso",
        "evaluacion_inicial",
        "solicitud_legal_personal",
    ]
    denticion: Literal["permanente", "decidua", "mixta"] = "permanente"
    hallazgos: list[HallazgoOdontogramaPayload] = Field(default_factory=list, max_length=200)
    especificaciones: str = Field(default="", max_length=10000)
    observaciones: str = Field(default="", max_length=10000)

    @model_validator(mode="after")
    def validar_piezas_de_denticion(self) -> "OdontogramaPayload":
        piezas = {
            pieza
            for hallazgo in self.hallazgos
            for pieza in hallazgo.piezas
        }
        if self.denticion == "permanente" and piezas - PIEZAS_PERMANENTES:
            raise ValueError("La dentición permanente solo admite piezas FDI 11–48.")
        if self.denticion == "decidua" and piezas - PIEZAS_DECIDUAS:
            raise ValueError("La dentición decidua solo admite piezas FDI 51–85.")
        return self
