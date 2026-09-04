"""Routen der Bedarfsplanung und der Kennzahlen (0545, Vertrag §2.1/§2.2).

Eigener `APIRouter()` OHNE prefix — `router.py` inkludiert ihn unter
`/personal` (§0). Guards aus `._guards`.

Autorisierung (Wurzel 9): `Team` liest Bedarf und Kennzahlen (die Finanzfelder
liefert der Dienst nur mit `EXPORT_LOHN` und Leitungsrolle FRISCH AUS DER DB),
`Plan` schreibt den Bedarf, `Manage` die Produktivitätsannahmen, `Export`
Budget und Umsatzbuch — das sind Finanzdaten.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from ._base import PersonalError
from ._guards import Export, Manage, Plan, Team, fehler
from .bedarf import (
    BedarfService,
    KennzahlenService,
    get_bedarf_service,
    get_kennzahlen_service,
)
from .bedarf_schemas import (
    BedarfListe,
    BedarfZeile,
    BudgetListe,
    BudgetZeile,
    KennzahlenResponse,
    ProduktivitaetZeile,
    UmsatzbuchSchreiben,
    UmsatzbuchZeile,
)

router = APIRouter()

BedarfServiceDep = Annotated[BedarfService, Depends(get_bedarf_service)]
KennzahlenServiceDep = Annotated[KennzahlenService, Depends(get_kennzahlen_service)]


# --- Kennzahlen (§2.1) ------------------------------------------------------


@router.get("/dienstplan/kennzahlen", response_model=KennzahlenResponse)
def dienstplan_kennzahlen(
    ctx: Team,
    service: KennzahlenServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> KennzahlenResponse:
    """Hotel-Zeile, Umsatz, Kosten, Quote, Produktivität, Bedarf je Bereich.

    Ohne Finanzrecht sind die Geldfelder `None` — nicht 0 (Wurzel 4).
    """
    try:
        return service.kennzahlen(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Bedarf (Schichthüllen, §2.2) -------------------------------------------


@router.get("/bedarf", response_model=BedarfListe)
def bedarf(
    ctx: Team,
    service: BedarfServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> BedarfListe:
    try:
        return service.bedarf(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/bedarf/vorlagen", response_model=BedarfListe)
def bedarf_vorlagen_setzen(
    zeilen: list[BedarfZeile], ctx: Plan, service: BedarfServiceDep
) -> BedarfListe:
    """Ersetzt ALLE Wochentag-Vorlagen des Betriebs."""
    try:
        return service.bedarf_vorlagen_setzen(ctx, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/bedarf/tage", response_model=BedarfListe)
def bedarf_tage_setzen(
    zeilen: list[BedarfZeile],
    ctx: Plan,
    service: BedarfServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> BedarfListe:
    """Ersetzt die MANUELLEN Tageszeilen im Fenster; Prognose-Zeilen bleiben."""
    try:
        return service.bedarf_tage_setzen(ctx, von, bis, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.delete("/bedarf/{bedarf_id}", status_code=status.HTTP_204_NO_CONTENT)
def bedarf_loeschen(bedarf_id: str, ctx: Plan, service: BedarfServiceDep) -> Response:
    try:
        service.bedarf_loeschen(ctx, bedarf_id)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Produktivitätsannahmen (§2.2) ------------------------------------------


@router.get("/produktivitaet", response_model=list[ProduktivitaetZeile])
def produktivitaet(ctx: Manage, service: BedarfServiceDep) -> list[ProduktivitaetZeile]:
    try:
        return service.produktivitaet(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/produktivitaet", response_model=list[ProduktivitaetZeile])
def produktivitaet_setzen(
    zeilen: list[ProduktivitaetZeile], ctx: Manage, service: BedarfServiceDep
) -> list[ProduktivitaetZeile]:
    try:
        return service.produktivitaet_setzen(ctx, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Budget (Finanzen, §2.2) ------------------------------------------------


@router.get("/budget", response_model=BudgetListe)
def budget(
    ctx: Export,
    service: BedarfServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> BudgetListe:
    try:
        return service.budget(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/budget/vorlagen", response_model=BudgetListe)
def budget_vorlagen_setzen(
    zeilen: list[BudgetZeile], ctx: Export, service: BedarfServiceDep
) -> BudgetListe:
    try:
        return service.budget_vorlagen_setzen(ctx, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/budget/tage", response_model=BudgetListe)
def budget_tage_setzen(
    zeilen: list[BudgetZeile],
    ctx: Export,
    service: BedarfServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> BudgetListe:
    try:
        return service.budget_tage_setzen(ctx, von, bis, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Umsatzbuch (Finanzen, §2.2) --------------------------------------------


@router.get("/umsatzbuch", response_model=list[UmsatzbuchZeile])
def umsatzbuch(
    ctx: Export,
    service: BedarfServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> list[UmsatzbuchZeile]:
    """Je Tag eine Zeile — auch ohne gespeicherten Wert (dann `quelle` leer)."""
    try:
        return service.umsatzbuch(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.put("/umsatzbuch", response_model=list[UmsatzbuchZeile])
def umsatzbuch_setzen(
    zeilen: list[UmsatzbuchSchreiben], ctx: Export, service: BedarfServiceDep
) -> list[UmsatzbuchZeile]:
    """Upsert je (Tag, Bereich); beide Beträge leer löscht die Zeile."""
    try:
        return service.umsatzbuch_setzen(ctx, zeilen)
    except PersonalError as exc:
        raise fehler(exc) from exc


__all__ = ["router"]
