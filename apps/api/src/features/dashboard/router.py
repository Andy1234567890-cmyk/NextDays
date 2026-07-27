"""Router für dashboard. Gemountet unter /api/v1/dashboard.

Enthält den Onboarding-Fortschritt des Tenants (das Frontend zeigt den Setup-
Assistenten, bis 'completed' true ist). Tenant-scoped (tenant_id aus dem JWT).
"""
from fastapi import APIRouter, HTTPException

from src.core.security import CurrentUser

from .dependencies import DashboardServiceDep
from .schemas import (
    DashboardVoiceRequest,
    DashboardVoiceResponse,
    OnboardingStatus,
    OnboardingUpdate,
    SliceHealth,
)
from .service import DashboardError

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/health", response_model=SliceHealth)
def health(service: DashboardServiceDep) -> SliceHealth:
    return service.health()


@router.get("/onboarding", response_model=OnboardingStatus)
def get_onboarding(
    ctx: CurrentUser, service: DashboardServiceDep
) -> OnboardingStatus:
    try:
        return service.get_onboarding(ctx)
    except DashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/onboarding", response_model=OnboardingStatus)
def update_onboarding(
    req: OnboardingUpdate, ctx: CurrentUser, service: DashboardServiceDep
) -> OnboardingStatus:
    try:
        return service.update_onboarding(ctx, req)
    except DashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/voice", response_model=DashboardVoiceResponse)
def voice_assistant(
    req: DashboardVoiceRequest, ctx: CurrentUser, service: DashboardServiceDep
) -> DashboardVoiceResponse:
    """Sprachassistent des eigenen Dashboards (Groq).

    Bewusst nur `CurrentUser`: der Assistent ist ein allgemeines Werkzeug jedes
    eingeloggten Nutzers und liefert nur Daten, die dessen Rolle ohnehin sieht.
    Gegen Kostenmissbrauch greift der eigene strenge `ai`-Rate-Limit-Bucket
    (Wurzel 8), nicht eine zusätzliche Rollenhürde.
    """
    try:
        return service.voice_assistant(ctx, req)
    except DashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
