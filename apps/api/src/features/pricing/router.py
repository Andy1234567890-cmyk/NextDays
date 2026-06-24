"""Router für pricing. Gemountet unter /api/v1/pricing.

Zentrale Preis-Endpunkte: Effektivpreis pro Tag und vollständiger Buchungs-Quote.
Lesend (VIEW_CALENDAR genügt) — die Berechnung verändert keine Daten.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .resolver import PricingError, PricingResolver
from .schemas import EffectivePriceDay, QuoteRequest, QuoteResponse, SliceHealth

router = APIRouter(prefix="/pricing", tags=["pricing"])


def get_pricing_resolver() -> PricingResolver:
    return PricingResolver(service_client=get_service_client())


PricingResolverDep = Annotated[PricingResolver, Depends(get_pricing_resolver)]


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
    """Effektivpreis je Tag [start, end) — override > weekday > base, sonst None."""
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
