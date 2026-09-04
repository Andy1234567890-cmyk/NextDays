"""Routen der KI-Werkzeuge im Dienstplan (0546, Vertrag §2.3).

Eigener `APIRouter()` OHNE Prefix; `router.py` (Integrator) inkludiert ihn
unter `/personal`. Guards aus `._guards`.

Erzeugen und Übernehmen ist `Plan` (wer den Plan schreibt), Lesen und Assistent
`Team`. Der Assistent gibt keine Löhne heraus (Kontextaufbau im Dienst), darum
reicht `Team` — 503 ohne Vertex-Konfiguration.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ._base import PersonalError
from ._guards import Plan, Team, fehler
from .ki_planung import KiPlanungService, get_ki_planung_service
from .ki_schemas import (
    AssistentAntwort,
    AssistentRequest,
    AutoplanRequest,
    KiStatus,
    Planungslauf,
    Prognose,
    UebernehmenRequest,
    VerworfenResponse,
)
from .schemas import BedarfResponse

router = APIRouter()

KiDep = Annotated[KiPlanungService, Depends(get_ki_planung_service)]


@router.get("/ki/status", response_model=KiStatus)
def ki_status(ctx: Team, service: KiDep) -> KiStatus:
    try:
        return service.status(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Prognose ---------------------------------------------------------------


@router.post("/ki/prognose", response_model=Prognose)
def prognose_erzeugen(
    ctx: Plan, service: KiDep, woche: Annotated[date, Query()]
) -> Prognose:
    try:
        return service.prognose_erzeugen(ctx, woche)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/ki/prognosen", response_model=list[Prognose])
def prognosen(ctx: Team, service: KiDep, woche: Annotated[date, Query()]) -> list[Prognose]:
    try:
        return service.prognosen(ctx, woche)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/ki/prognosen/{prognose_id}/uebernehmen", response_model=BedarfResponse)
def prognose_uebernehmen(prognose_id: str, ctx: Plan, service: KiDep) -> BedarfResponse:
    try:
        return service.prognose_uebernehmen(ctx, prognose_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Autoplanung ------------------------------------------------------------


@router.post("/ki/autoplan", response_model=Planungslauf)
def autoplan(
    req: AutoplanRequest, ctx: Plan, service: KiDep, woche: Annotated[date, Query()]
) -> Planungslauf:
    try:
        return service.autoplan(ctx, woche, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/ki/planungslaeufe", response_model=list[Planungslauf])
def planungslaeufe(
    ctx: Team, service: KiDep, woche: Annotated[date, Query()]
) -> list[Planungslauf]:
    try:
        return service.planungslaeufe(ctx, woche)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/ki/planungslaeufe/{lauf_id}/uebernehmen", response_model=BedarfResponse)
def lauf_uebernehmen(
    lauf_id: str, req: UebernehmenRequest, ctx: Plan, service: KiDep
) -> BedarfResponse:
    try:
        return service.lauf_uebernehmen(ctx, lauf_id, req.variante)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/ki/planungslaeufe/{lauf_id}/verwerfen", response_model=VerworfenResponse)
def lauf_verwerfen(lauf_id: str, ctx: Plan, service: KiDep) -> VerworfenResponse:
    try:
        return service.lauf_verwerfen(ctx, lauf_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Assistent --------------------------------------------------------------


@router.post("/ki/assistent", response_model=AssistentAntwort)
def assistent(req: AssistentRequest, ctx: Team, service: KiDep) -> AssistentAntwort:
    try:
        return service.assistent(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc
