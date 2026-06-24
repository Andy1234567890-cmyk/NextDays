"""Router für pricing. Gemountet unter /api/v1/pricing.

Zentrale Preis-Endpunkte: Effektivpreis pro Tag und vollständiger Buchungs-Quote.
Lesend (VIEW_CALENDAR genügt) — die Berechnung verändert keine Daten. Dazu die
Dynamic-Pricing-Einstellungen je Objekt (dp_settings) und der tägliche Cron-
Recompute (per Secret abgesichert).
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from src.core.config import get_settings
from src.core.security import AuthContext, CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_lodgify_permission,
    require_permission,
)
from src.features.auth.lodgify_permissions import Permission
from src.features.auth.permissions import Capability

from .recompute import DynamicPricingRecompute
from .resolver import PricingError, PricingResolver
from .schemas import (
    DpSettingsResponse,
    DpSettingsUpdate,
    EffectivePriceDay,
    QuoteRequest,
    QuoteResponse,
    RecomputeResponse,
    SliceHealth,
)
from .settings_service import DpSettingsService

router = APIRouter(prefix="/pricing", tags=["pricing"])


def get_pricing_resolver() -> PricingResolver:
    return PricingResolver(service_client=get_service_client())


def get_dp_settings_service() -> DpSettingsService:
    return DpSettingsService(service_client=get_service_client())


PricingResolverDep = Annotated[PricingResolver, Depends(get_pricing_resolver)]
DpSettingsServiceDep = Annotated[DpSettingsService, Depends(get_dp_settings_service)]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="pricing")


@router.get("/effective", response_model=list[EffectivePriceDay])
def effective_prices(
    resolver: PricingResolverDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> list[EffectivePriceDay]:
    """Effektivpreis je Tag [start, end) — override > dynamic > weekday > base."""
    try:
        return resolver.effective_prices(property_id, start, end)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quote", response_model=QuoteResponse)
def quote(
    req: QuoteRequest,
    resolver: PricingResolverDep,
    _ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
) -> QuoteResponse:
    """Vollständige Preisaufschlüsselung eines Aufenthalts (Wizard/Buchung)."""
    try:
        return resolver.quote(req)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Dynamic Pricing: Einstellungen je Objekt --------------------------------
@router.get("/settings/{property_id}", response_model=DpSettingsResponse)
def get_dp_settings(
    property_id: str,
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpSettingsResponse:
    """Dynamic-Pricing-Einstellungen eines Objekts (Defaults, falls leer)."""
    try:
        return service.get(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put(
    "/settings/{property_id}",
    response_model=DpSettingsResponse,
    dependencies=[Depends(require_lodgify_permission(Permission.EDIT_CALENDAR_BOOKINGS))],
)
def put_dp_settings(
    property_id: str,
    req: DpSettingsUpdate,
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpSettingsResponse:
    """Dynamic-Pricing-Einstellungen setzen. Recompute läuft per Cron/Hook."""
    try:
        result = service.update(ctx, property_id, req)
        # Bei aktiviertem DP sofort einmal rechnen, damit der Kalender direkt
        # dynamische Preise zeigt (sonst erst beim nächsten Cron-Tick).
        if result.enabled:
            DynamicPricingRecompute(
                service_client=get_service_client()
            ).recompute_property(property_id)
        return result
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Dynamic Pricing: täglicher Recompute (Cron, per Secret) -----------------
@router.post("/recompute", response_model=RecomputeResponse, include_in_schema=False)
def recompute(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> RecomputeResponse:
    """Interner Cron-Trigger: berechnet die dynamischen Preise ALLER Objekte mit
    aktiviertem Dynamic Pricing neu (Horizont 540 Tage) und pusht sie an Channex.
    Kein JWT — via geteiltem Secret (CHANNEX_WEBHOOK_SECRET) abgesichert,
    getriggert durch einen Coolify-Scheduled-Task / Host-crontab (curl)."""
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not expected or x_internal_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
    result = DynamicPricingRecompute(
        service_client=get_service_client()
    ).recompute_all()
    return RecomputeResponse(**result)
