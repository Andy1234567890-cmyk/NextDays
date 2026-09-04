"""Routen der Berichte und des Lohnlaufs (0547, Vertrag §4).

Eigener `APIRouter()` OHNE prefix — `router.py` inkludiert ihn unter
`/personal` (§0). Guards aus `._guards`, weil ein Teil-Router nichts aus
`router.py` importieren kann, ohne einen Import-Zirkel zu bauen.

Autorisierung (Wurzel 9): `Team` für die Team-Berichte, `Export` für Finanzen
und den ganzen Lohnlauf. Der Dienst prüft die Leitungsrolle zusätzlich FRISCH
AUS DER DB — der Guard sieht nur den Token.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from ._base import PersonalError
from ._guards import Export, Team, fehler
from .berichte import BerichteService, get_berichte_service
from .berichte_schemas import (
    BerichtKatalogItem,
    BerichtResponse,
    Lohnlauf,
    LohnlaufCreate,
    LohnlaufExport,
    LohnlaufExportResponse,
    LohnlaufZuruecksetzen,
)
from .lohnlauf import LohnlaufService, get_lohnlauf_service
from .schemas import Beschaeftigungsart

router = APIRouter()

BerichteServiceDep = Annotated[BerichteService, Depends(get_berichte_service)]
LohnlaufServiceDep = Annotated[LohnlaufService, Depends(get_lohnlauf_service)]


@router.get("/berichte", response_model=list[BerichtKatalogItem])
def berichte_katalog(ctx: Team, service: BerichteServiceDep) -> list[BerichtKatalogItem]:
    """Der Katalog, gefiltert nach dem Recht des Aufrufers (§4.1)."""
    try:
        return service.katalog(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/berichte/{name}", response_model=None)
def bericht(  # noqa: PLR0913 — die fünf Filter des Vertrags plus das Format
    # pylint: disable=redefined-builtin  # `format` ist der Query-Name (s. u.)
    name: str,
    ctx: Team,
    service: BerichteServiceDep,
    von: Annotated[date | None, Query()] = None,
    bis: Annotated[date | None, Query()] = None,
    arbeitsbereich_id: Annotated[str | None, Query()] = None,
    property_id: Annotated[str | None, Query()] = None,
    user_id: Annotated[str | None, Query()] = None,
    beschaeftigungsart: Annotated[Beschaeftigungsart | None, Query()] = None,
    # `format` ist der QUERY-Name aus dem Vertrag (?format=csv) und damit nicht
    # frei wählbar — FastAPI leitet ihn aus dem Parameternamen ab. Beide Prüfer
    # melden dasselbe: ruff A002 hier, pylint W0622 oben an der Signatur (dort,
    # weil pylint den Befund der Funktion zuordnet, nicht der Parameterzeile).
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",  # noqa: A002
) -> Response | BerichtResponse:
    """Ein Bericht als JSON oder CSV (§4.2). Guard je Bericht sitzt im Dienst."""
    try:
        antwort = service.bericht(
            ctx,
            name,
            von=von,
            bis=bis,
            arbeitsbereich_id=arbeitsbereich_id,
            property_id=property_id,
            user_id=user_id,
            beschaeftigungsart=beschaeftigungsart,
        )
    except PersonalError as exc:
        raise fehler(exc) from exc
    if format == "json":
        return antwort
    datei, inhalt, mime = service.csv_datei(antwort)
    return Response(
        content=inhalt,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{datei}"'},
    )


# --- Lohnlauf (§4.3) --------------------------------------------------------


@router.get("/lohnlaeufe", response_model=list[Lohnlauf])
def lohnlaeufe(
    ctx: Export, service: LohnlaufServiceDep, jahr: Annotated[int, Query(ge=2000, le=2100)]
) -> list[Lohnlauf]:
    try:
        return service.liste(ctx, jahr)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/lohnlaeufe", response_model=Lohnlauf)
def lohnlauf_anlegen(
    req: LohnlaufCreate, ctx: Export, service: LohnlaufServiceDep
) -> Lohnlauf:
    """Idempotent: ein vorhandener Lauf kommt zurück (200), kein zweiter entsteht."""
    try:
        return service.anlegen(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/lohnlaeufe/{lauf_id}/pruefen", response_model=Lohnlauf)
def lohnlauf_pruefen(lauf_id: str, ctx: Export, service: LohnlaufServiceDep) -> Lohnlauf:
    try:
        return service.pruefen(ctx, lauf_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/lohnlaeufe/{lauf_id}/freigeben", response_model=Lohnlauf)
def lohnlauf_freigeben(lauf_id: str, ctx: Export, service: LohnlaufServiceDep) -> Lohnlauf:
    try:
        return service.freigeben(ctx, lauf_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/lohnlaeufe/{lauf_id}/exportieren", response_model=LohnlaufExportResponse)
def lohnlauf_exportieren(
    lauf_id: str, req: LohnlaufExport, ctx: Export, service: LohnlaufServiceDep
) -> LohnlaufExportResponse:
    try:
        return service.exportieren(ctx, lauf_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/lohnlaeufe/{lauf_id}/zuruecksetzen", response_model=Lohnlauf)
def lohnlauf_zuruecksetzen(
    lauf_id: str, req: LohnlaufZuruecksetzen, ctx: Export, service: LohnlaufServiceDep
) -> Lohnlauf:
    try:
        return service.zuruecksetzen(ctx, lauf_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


__all__ = ["router"]
