"""Router für pricing. Gemountet unter /api/v1/pricing.

Zentrale Preis-Endpunkte: Effektivpreis pro Tag und vollständiger Buchungs-Quote.
Lesend (VIEW_CALENDAR genügt) — die Berechnung verändert keine Daten. Dazu die
Dynamic-Pricing-Einstellungen je Objekt (dp_settings) und der tägliche Cron-
Recompute (per Secret abgesichert).
"""
from datetime import date
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Query,
    status,
)

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
    DpOverviewResponse,
    DpSettingsResponse,
    DpSettingsUpdate,
    EffectivePriceDay,
    PriceExplainResponse,
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


# -- Dynamic Pricing: Objekt-Übersicht (Hostaway-Tabelle) --------------------
@router.get("/overview", response_model=DpOverviewResponse)
def dp_overview(
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpOverviewResponse:
    """Alle Objekte des Kontos mit ihrem Dynamic-Pricing-Status (eine Zeile je
    Objekt: Aktiv, Basispreis-Modus + effektiver Basispreis, Min/Max)."""
    try:
        return service.overview(ctx)
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
    background: BackgroundTasks,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpSettingsResponse:
    """Dynamic-Pricing-Einstellungen setzen. Recompute läuft per Cron/Hook."""
    try:
        result = service.update(ctx, property_id, req)
        # Bei aktiviertem DP einmal rechnen, damit der Kalender direkt dynamische
        # Preise zeigt. Der Recompute rechnet 540 Tage und pusht an Channex —
        # das läuft im Hintergrund, damit der Speichern-Request nicht blockiert
        # (sonst hängt die Antwort am Channex-Push/Rate-Limit).
        if result.enabled:
            background.add_task(_recompute_in_background, property_id)
        return result
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _recompute_in_background(property_id: str) -> None:
    """DP-Recompute eines Objekts im Hintergrund (nach dem Speichern)."""
    DynamicPricingRecompute(
        service_client=get_service_client()
    ).recompute_property(property_id)


@router.get("/explain/{property_id}", response_model=PriceExplainResponse)
def explain_dynamic_price(
    property_id: str,
    day: Annotated[date, Query(description="Aufenthaltstag (ISO)")],
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> PriceExplainResponse:
    """KI-Klartext-Begründung für den berechneten dynamischen Preis eines Tages
    (on-demand, 'Warum dieser Preis?'). Liest den fertig berechneten Preis +
    Faktor-Aufschlüsselung aus dynamic_prices und lässt das LLM sie ausformulieren —
    es rechnet nicht selbst. Ohne dynamischen Preis (DP aus / kein Recompute) oder
    ohne Groq-Key gibt es einen klaren Fehler (keine erfundene Erklärung)."""
    from .explain import PriceExplainError, explain_price

    db = get_service_client()
    if db is None:
        raise HTTPException(status_code=500, detail="Preis-DB nicht verfügbar.")
    # Eigentum/Tenant-Scope über den Settings-Service (wirft 403/404 sauber).
    service = DpSettingsService(service_client=db)
    try:
        service._require_own_property(ctx, property_id)  # noqa: SLF001
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    rows = (
        db.table("dynamic_prices")
        .select("price, factors")
        .eq("property_id", property_id)
        .eq("date", day.isoformat())
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=(
                "Für diesen Tag gibt es keinen dynamischen Preis "
                "(DP aus oder noch nicht berechnet)."
            ),
        )
    price = float(rows[0].get("price") or 0)
    factors = rows[0].get("factors") or {}

    # Basispreis (Anker) für den Vergleich aus dem Rate-Plan.
    rate_rows = (
        db.table("rate_plans")
        .select("base_price, currency, created_at")
        .eq("property_id", property_id)
        .order("created_at")
        .limit(1)
        .execute()
    ).data or []
    base_price = (
        float(rate_rows[0]["base_price"])
        if rate_rows and rate_rows[0].get("base_price") is not None
        else price
    )
    currency = (rate_rows[0].get("currency") if rate_rows else None) or "EUR"

    try:
        explanation = explain_price(
            base_price=base_price,
            final_price=price,
            factors={k: float(v) for k, v in factors.items()},
            currency=currency,
            day=day.isoformat(),
        )
    except PriceExplainError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return PriceExplainResponse(
        property_id=property_id, date=day, price=price, explanation=explanation
    )


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
