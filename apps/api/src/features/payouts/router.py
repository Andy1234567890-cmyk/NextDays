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

from .dependencies import PayoutsServiceDep
from .schemas import PayoutOverview, PayoutSettings, PayoutSettingsUpdate
from .service import PayoutsError

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
