"""Routen des Dienstplan-Ausbaus (0544, Vertrag §1.3–§1.5).

Eigener `APIRouter()` OHNE prefix — `router.py` inkludiert ihn unter
`/personal` (§0). Guards aus `._guards`, weil ein Teil-Router nichts aus
`router.py` importieren kann, ohne einen Import-Zirkel zu bauen.

Autorisierung (Wurzel 9): `Plan` für alles, was den Plan schreibt, `Team` für
das Fenster-Lesen, `Own` für die eigenen Tausch-Antworten, `Absence` für die
Antrags-Vorschau. Der Personen-Scope sitzt zusätzlich im Dienst.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from ._base import PersonalError
from ._guards import Absence, Own, Plan, Team, fehler
from .planung import PlanungService, get_planung_service
from .planung_schemas import (
    AbwesenheitVorschau,
    AbwesenheitVorschauRequest,
    LeerenResponse,
    MehrfachRequest,
    MehrfachResponse,
    TauschCreate,
    TauschEntscheiden,
    Wochenvorlage,
    WochenvorlageAnwenden,
    WochenvorlageCreate,
    WochenvorlageDetail,
    WochenvorlageUpdate,
)
from .schemas import BedarfResponse, Tausch, WochenplanResponse

router = APIRouter()

PlanungServiceDep = Annotated[PlanungService, Depends(get_planung_service)]


# --- Fenster lesen (§1.3) ---------------------------------------------------


@router.get("/dienstplan/zeitraum", response_model=WochenplanResponse)
def dienstplan_zeitraum(
    ctx: Team,
    service: PlanungServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> WochenplanResponse:
    """Freies Fenster (Tag, Woche, Monat) — höchstens 42 Tage, sonst 422."""
    try:
        return service.zeitraum(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Woche leeren, Mehrfachaktion (§1.4) ------------------------------------


@router.post("/dienstplan/leeren", response_model=LeerenResponse)
def dienstplan_leeren(
    ctx: Plan,
    service: PlanungServiceDep,
    woche: Annotated[date, Query()],
    arbeitsbereich_id: Annotated[str | None, Query()] = None,
) -> LeerenResponse:
    try:
        return service.leeren(ctx, woche, arbeitsbereich_id=arbeitsbereich_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/schichten/mehrfach", response_model=MehrfachResponse)
def schichten_mehrfach(
    req: MehrfachRequest, ctx: Plan, service: PlanungServiceDep
) -> MehrfachResponse:
    """Verschieben, zuweisen, freigeben oder löschen in einem Zug (409/422 wie einzeln)."""
    try:
        return service.mehrfach(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Wochenvorlagen (§1.4) --------------------------------------------------


@router.get("/wochenvorlagen", response_model=list[Wochenvorlage])
def wochenvorlagen(ctx: Team, service: PlanungServiceDep) -> list[Wochenvorlage]:
    try:
        return service.vorlagen(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/wochenvorlagen", response_model=WochenvorlageDetail, status_code=201)
def wochenvorlage_anlegen(
    req: WochenvorlageCreate, ctx: Plan, service: PlanungServiceDep
) -> WochenvorlageDetail:
    try:
        return service.vorlage_anlegen(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/wochenvorlagen/{vorlage_id}", response_model=WochenvorlageDetail)
def wochenvorlage(
    vorlage_id: str, ctx: Team, service: PlanungServiceDep
) -> WochenvorlageDetail:
    try:
        return service.vorlage(ctx, vorlage_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.patch("/wochenvorlagen/{vorlage_id}", response_model=WochenvorlageDetail)
def wochenvorlage_aendern(
    vorlage_id: str, req: WochenvorlageUpdate, ctx: Plan, service: PlanungServiceDep
) -> WochenvorlageDetail:
    try:
        return service.vorlage_aendern(ctx, vorlage_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.delete("/wochenvorlagen/{vorlage_id}", status_code=status.HTTP_204_NO_CONTENT)
def wochenvorlage_loeschen(
    vorlage_id: str, ctx: Plan, service: PlanungServiceDep
) -> Response:
    try:
        service.vorlage_loeschen(ctx, vorlage_id)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/wochenvorlagen/{vorlage_id}/anwenden", response_model=BedarfResponse)
def wochenvorlage_anwenden(
    vorlage_id: str,
    req: WochenvorlageAnwenden,
    ctx: Plan,
    service: PlanungServiceDep,
    woche: Annotated[date, Query()],
) -> BedarfResponse:
    """Gerüst auf eine Woche legen — idempotent, zweiter Lauf legt nichts an."""
    try:
        return service.vorlage_anwenden(ctx, vorlage_id, woche, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Schichttausch (§1.4) ---------------------------------------------------


@router.post("/schichten/{schicht_id}/tausch", response_model=Tausch, status_code=201)
def tausch_anfragen(
    schicht_id: str, req: TauschCreate, ctx: Own, service: PlanungServiceDep
) -> Tausch:
    """Die eigene Schicht anbieten; die Planung darf auch fremde vermitteln."""
    try:
        return service.tausch_anfragen(ctx, schicht_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/tausch", response_model=list[Tausch])
def tausch_liste(
    ctx: Own,
    service: PlanungServiceDep,
    woche: Annotated[date | None, Query()] = None,
    tausch_status: Annotated[str | None, Query(alias="status", max_length=20)] = None,
) -> list[Tausch]:
    try:
        return service.tausch_liste(ctx, woche=woche, status=tausch_status)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/tausch/{tausch_id}/annehmen", response_model=Tausch)
def tausch_annehmen(tausch_id: str, ctx: Own, service: PlanungServiceDep) -> Tausch:
    try:
        return service.tausch_annehmen(ctx, tausch_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/tausch/{tausch_id}/ablehnen", response_model=Tausch)
def tausch_ablehnen(tausch_id: str, ctx: Own, service: PlanungServiceDep) -> Tausch:
    try:
        return service.tausch_ablehnen(ctx, tausch_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/tausch/{tausch_id}/zurueckziehen", response_model=Tausch)
def tausch_zurueckziehen(tausch_id: str, ctx: Own, service: PlanungServiceDep) -> Tausch:
    try:
        return service.tausch_zurueckziehen(ctx, tausch_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/tausch/{tausch_id}/entscheiden", response_model=Tausch)
def tausch_entscheiden(
    tausch_id: str, req: TauschEntscheiden, ctx: Plan, service: PlanungServiceDep
) -> Tausch:
    """Freigabe: erst beide Schichten prüfen, dann beide schreiben (Wurzel 1)."""
    try:
        return service.tausch_entscheiden(ctx, tausch_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Export und Antrags-Vorschau (§1.4/§1.5) --------------------------------


@router.get("/dienstplan/export.csv")
def dienstplan_export(
    ctx: Team, service: PlanungServiceDep, woche: Annotated[date, Query()]
) -> Response:
    """Wochenplan als CSV — ohne Finanzzahlen (die Fähigkeit sieht keine Löhne)."""
    try:
        datei, inhalt = service.export_csv(ctx, woche)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(
        content=inhalt,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{datei}"'},
    )


@router.post("/abwesenheiten/vorschau", response_model=AbwesenheitVorschau)
def abwesenheit_vorschau(
    req: AbwesenheitVorschauRequest, ctx: Absence, service: PlanungServiceDep
) -> AbwesenheitVorschau:
    """Live-Zähler des Antrags: Tage, Rest, Sperre, Schichten, Kollegen — ohne Seiteneffekt."""
    try:
        return service.abwesenheit_vorschau(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


__all__ = ["router"]
