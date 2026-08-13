"""Router für payouts. Gemountet unter /api/v1/payouts.

Auszahlungen an Betriebe nach dem Modell von Booking.com: Die Plattform hält
das Geld bis zur Abreise, ein Storno wird verrechnet statt zurückgeholt.

Autorisierung: Auszahlungen sind Finanzdaten — ALLE Routen verlangen
MANAGE_BILLING, auch die lesenden (Rollen-Datensplit §4.3). Der Betriebs-Scope
kommt aus dem Token, nie aus dem Body (Wurzel 3).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import PayoutsServiceDep, StripeSaldoServiceDep
from .schemas import (
    PayoutOverview,
    PayoutSettings,
    PayoutSettingsUpdate,
    ProtokollAntwort,
    StripeAuszahlung,
    StripeAuszahlungAnfordern,
    StripeGuthaben,
    StripeRhythmusUpdate,
)
from .service import PayoutsError
from .stripe_saldo import StripeSaldoFehler

router = APIRouter(prefix="/payouts", tags=["payouts"])

_billing = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_BILLING))
]


@router.get("", response_model=PayoutOverview)
def get_overview(
    ctx: _billing,
    service: PayoutsServiceDep,
    limit: int = Query(25, ge=1, le=100),
) -> PayoutOverview:
    """Auszahlungsübersicht: Rhythmus, Summen, Verlauf, Verrechnungsposten."""
    try:
        return service.overview(ctx, limit=limit)
    except PayoutsError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.get("/settings", response_model=PayoutSettings)
def get_settings(ctx: _billing, service: PayoutsServiceDep) -> PayoutSettings:
    """Aktueller Auszahlungsrhythmus."""
    try:
        return service.settings(ctx)
    except PayoutsError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.put("/settings", response_model=PayoutSettings)
def update_settings(
    req: PayoutSettingsUpdate,
    ctx: _billing,
    service: PayoutsServiceDep,
) -> PayoutSettings:
    """Rhythmus ändern — täglich, wöchentlich (Do) oder monatlich (bis 15.)."""
    try:
        return service.update_settings(ctx, req)
    except PayoutsError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


# --- Guthaben auf dem verbundenen Stripe-Konto -------------------------------
#
# Der zweite Topf der Abrechnung: Geld, das der Betrieb selbst kassiert hat
# (Zusatzleistungen, Direktbuchungen) und das auf SEINEM Stripe-Saldo liegt.
# Quelle ist durchgehend Stripe, nicht eine Kopie bei uns.

@router.get("/guthaben", response_model=StripeGuthaben)
def get_guthaben(ctx: _billing, service: StripeSaldoServiceDep) -> StripeGuthaben:
    """Saldo (verfügbar/ausstehend), Rhythmus und letzte Auszahlungen."""
    try:
        return service.guthaben(ctx)
    except StripeSaldoFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.post("/guthaben/auszahlung", response_model=StripeAuszahlung)
def auszahlung_anfordern(
    req: StripeAuszahlungAnfordern,
    ctx: _billing,
    service: StripeSaldoServiceDep,
) -> StripeAuszahlung:
    """Auszahlung des verfügbaren Guthabens auf das eigene Bankkonto beantragen."""
    try:
        return service.auszahlung_anfordern(
            ctx, currency=req.currency, amount_cents=req.amount_cents
        )
    except StripeSaldoFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.put("/guthaben/rhythmus", response_model=StripeGuthaben)
def rhythmus_setzen(
    req: StripeRhythmusUpdate,
    ctx: _billing,
    service: StripeSaldoServiceDep,
) -> StripeGuthaben:
    """Auszahlungs-Rhythmus wählen: automatisch (täglich/wöchentlich/monatlich)
    oder nur auf Antrag."""
    try:
        return service.rhythmus_setzen(ctx, req)
    except StripeSaldoFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.get("/protokoll", response_model=ProtokollAntwort)
def get_protokoll(
    ctx: _billing,
    service: StripeSaldoServiceDep,
    limit: int = Query(50, ge=1, le=100),
) -> ProtokollAntwort:
    """Jede Geldbewegung des verbundenen Kontos, getrennt nach Richtung —
    empfangene Zahlungen und versendete Auszahlungen/Erstattungen. Angereichert
    um Buchung und bezahlte Zusatzleistungen."""
    try:
        return service.protokoll(ctx, limit=limit)
    except StripeSaldoFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
