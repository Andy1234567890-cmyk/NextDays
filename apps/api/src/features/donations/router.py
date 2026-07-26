"""Router für donations. Gemountet unter /api/v1/donations.

Spenden vom Auszahlungsanteil (Airbnb-Modell). Der Gastgeber legt EINEN
Prozentsatz fest, der je Buchung von seinem Anteil abgeht — die Plattform-
Gebühr bleibt unberührt.

Autorisierung: Der Spendensatz bestimmt einen Geldfluss, deshalb verlangen ALLE
Routen MANAGE_BILLING — auch die lesenden. Wer keine Finanzhoheit hat, soll
weder sehen noch ändern, wie viel der Betrieb spendet (Rollen-Datensplit §4.3).
Der Betriebs-Scope kommt zusätzlich aus dem Token, nie aus dem Body (Wurzel 3).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import DonationsServiceDep
from .schemas import (
    DonationOverview,
    DonationRecipient,
    DonationSettings,
    DonationSettingsUpdate,
)
from .service import DonationsError

router = APIRouter(prefix="/donations", tags=["donations"])

_billing = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_BILLING))
]


def _fehler(exc: DonationsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("", response_model=DonationOverview)
def get_overview(
    ctx: _billing,
    service: DonationsServiceDep,
    limit: int = Query(20, ge=1, le=100),
) -> DonationOverview:
    """Alles für die Spenden-Ansicht: Einstellung, Empfänger, Summen, Verlauf."""
    try:
        return service.overview(ctx, limit=limit)
    except DonationsError as exc:
        raise _fehler(exc) from exc


@router.get("/settings", response_model=DonationSettings)
def get_settings(
    ctx: _billing, service: DonationsServiceDep
) -> DonationSettings:
    """Aktueller Spendensatz inkl. echter Obergrenze."""
    try:
        return service.settings(ctx)
    except DonationsError as exc:
        raise _fehler(exc) from exc


@router.get("/recipients", response_model=list[DonationRecipient])
def get_recipients(
    ctx: _billing,  # noqa: ARG001 — Auth erzwingen, Liste ist nicht öffentlich
    service: DonationsServiceDep,
) -> list[DonationRecipient]:
    """Wählbare Organisationen."""
    return service.recipients()


@router.put("/settings", response_model=DonationSettings)
def update_settings(
    req: DonationSettingsUpdate,
    ctx: _billing,
    service: DonationsServiceDep,
) -> DonationSettings:
    """Spendensatz festlegen oder ändern.

    Fail-closed: ohne Empfänger, ohne Zustimmung oder ohne abrechnungsfähiges
    Auszahlungskonto wird kein Satz > 0 gesetzt.
    """
    try:
        return service.update_settings(ctx, req)
    except DonationsError as exc:
        raise _fehler(exc) from exc
