"""Routen der Zeit-Listen, Überstundenanträge, Guttage und Akte-Änderungen
(0544, Vertrag §3.1/§3.4/§3.5).

Eigener `APIRouter()` OHNE prefix — `router.py` inkludiert ihn unter
`/personal` (§0). Guards aus `._guards`.

Autorisierung (Wurzel 9): `Time` beantragt eigene Überstunden, `Confirm`
entscheidet und bucht Konten, `Team` liest die Listen im Personen-Scope, `Own`
sieht die eigenen Anträge und das eigene Guttagekonto, `Manage` pflegt die
terminierten Akte-Änderungen. Den Personen-Scope prüft zusätzlich der Dienst.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from ._base import PersonalError
from ._guards import Confirm, Manage, Own, Team, Time, fehler
from .akte_aenderungen import AkteAenderungenService, get_akte_aenderungen_service
from .dependencies import UeberstundenServiceDep, ZeiterfassungServiceDep
from .ueberstunden_schemas import (
    AkteAenderung,
    AkteAenderungCreate,
    GuttageBuchungCreate,
    Guttagekonto,
    Ueberstundenantrag,
    UeberstundenCreate,
    UeberstundenEntscheiden,
    ZeitOffenPunkte,
    ZeitZusammenfassung,
)

router = APIRouter()

AenderungenServiceDep = Annotated[
    AkteAenderungenService, Depends(get_akte_aenderungen_service)
]


# --- Zeit-Listen (§3.4) -----------------------------------------------------


@router.get("/zeiterfassung/zusammenfassung", response_model=list[ZeitZusammenfassung])
def zeit_zusammenfassung(
    ctx: Team,
    service: ZeiterfassungServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> list[ZeitZusammenfassung]:
    """Je Person eine Zeile: Ist, Soll, Überstunden, Fehltage, Offenes."""
    try:
        return service.zusammenfassung(ctx, von, bis)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/zeiterfassung/unbestaetigt", response_model=list[ZeitOffenPunkte])
def zeit_unbestaetigt(
    ctx: Confirm, service: ZeiterfassungServiceDep
) -> list[ZeitOffenPunkte]:
    """Wer hat unbestätigte Zeiten und wo fehlt eine Stempelung ganz?"""
    try:
        return service.unbestaetigt(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Überstundenanträge (§3.5) ----------------------------------------------


@router.post("/ueberstunden", response_model=Ueberstundenantrag, status_code=201)
def ueberstunden_beantragen(
    req: UeberstundenCreate, ctx: Time, service: UeberstundenServiceDep
) -> Ueberstundenantrag:
    """Immer für die eigene Person — kein `user_id` im Request."""
    try:
        return service.beantragen(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.get("/ueberstunden", response_model=list[Ueberstundenantrag])
def ueberstunden(
    ctx: Own,
    service: UeberstundenServiceDep,
    von: Annotated[date | None, Query()] = None,
    bis: Annotated[date | None, Query()] = None,
    antrag_status: Annotated[str | None, Query(alias="status", max_length=20)] = None,
) -> list[Ueberstundenantrag]:
    try:
        return service.liste(ctx, von=von, bis=bis, status=antrag_status)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/ueberstunden/{antrag_id}/entscheiden", response_model=Ueberstundenantrag)
def ueberstunden_entscheiden(
    antrag_id: str,
    req: UeberstundenEntscheiden,
    ctx: Confirm,
    service: UeberstundenServiceDep,
) -> Ueberstundenantrag:
    """Genehmigt bucht die Minuten auf das Arbeitszeitkonto (Gegenzustand, Wurzel 1)."""
    try:
        return service.entscheiden(ctx, antrag_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Guttage (§3.5) ---------------------------------------------------------


@router.get("/mitarbeiter/{user_id}/guttage", response_model=Guttagekonto)
def guttage(user_id: str, ctx: Own, service: UeberstundenServiceDep) -> Guttagekonto:
    try:
        return service.guttagekonto(ctx, user_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/guttage", response_model=Guttagekonto, status_code=201)
def guttage_buchen(
    req: GuttageBuchungCreate, ctx: Confirm, service: UeberstundenServiceDep
) -> Guttagekonto:
    try:
        return service.guttage_buchen(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


# --- Terminierte Akte-Änderungen (§3.1) -------------------------------------


@router.get("/mitarbeiter/{user_id}/aenderungen", response_model=list[AkteAenderung])
def akte_aenderungen(
    user_id: str, ctx: Manage, service: AenderungenServiceDep
) -> list[AkteAenderung]:
    try:
        return service.liste(ctx, user_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post(
    "/mitarbeiter/{user_id}/aenderungen", response_model=AkteAenderung, status_code=201
)
def akte_aenderung_anlegen(
    user_id: str,
    req: AkteAenderungCreate,
    ctx: Manage,
    service: AenderungenServiceDep,
) -> AkteAenderung:
    """Wirkt erst am Stichtag; der Worker wendet sie an (§1.7)."""
    try:
        return service.anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.delete(
    "/kartei/aenderungen/{aenderung_id}", status_code=status.HTTP_204_NO_CONTENT
)
def akte_aenderung_loeschen(
    aenderung_id: str, ctx: Manage, service: AenderungenServiceDep
) -> Response:
    """Nur solange nicht angewendet — danach steht der Wert in der Akte."""
    try:
        service.loeschen(ctx, aenderung_id)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
