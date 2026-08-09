"""Router für dashboard. Gemountet unter /api/v1/dashboard.

Enthält den Onboarding-Fortschritt des Tenants (das Frontend zeigt den Setup-
Assistenten, bis 'completed' true ist). Tenant-scoped (tenant_id aus dem JWT).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

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

# Das Onboarding richtet den BETRIEB ein (Firmenstammdaten, Kundentyp,
# Portal-Auswahl, Abschluss-Flag) — es ist Mandanten-Verwaltung, keine
# allgemeine Auskunft für jeden Eingeloggten. Vorher hing es nur an
# `CurrentUser`, also an der reinen AUTHENTIFIZIERUNG: jeder Eigentümer,
# Mitarbeiter oder Reinigungskraft konnte den Fortschritt des Betriebs lesen
# UND per PATCH umschreiben (Wurzel 9 — Autorisierung fehlte komplett).
# Gemessen: ein `owner` bekam 200 auf GET und konnte `company_data_set`
# umschalten. Das ist kein Anzeigefehler: das Frontend leitet die Sichtbarkeit
# des Setup-Assistenten aus diesen Flags ab, ein fremdes Umschalten blendet
# also den Assistenten des Betriebs ein oder aus.
#
# MANAGE_TENANT ist die passende Fähigkeit: sie besitzt ausschliesslich `admin`
# (siehe permissions.py `_ALL`) — owner/staff/cleaner und auch co_admin haben
# sie bewusst NICHT, weil das Anlegen des Betriebs Sache der Betriebsführung
# ist. Fail-CLOSED: eine unbekannte/fehlende Rolle besitzt keine Fähigkeit und
# fliegt damit ebenfalls auf 403.
_MANAGE_TENANT = Annotated[  # pylint: disable=invalid-name
    AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
]


@router.get("/health", response_model=SliceHealth)
def health(service: DashboardServiceDep) -> SliceHealth:
    return service.health()


@router.get("/onboarding", response_model=OnboardingStatus)
def get_onboarding(
    ctx: _MANAGE_TENANT, service: DashboardServiceDep
) -> OnboardingStatus:
    try:
        return service.get_onboarding(ctx)
    except DashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/onboarding", response_model=OnboardingStatus)
def update_onboarding(
    req: OnboardingUpdate, ctx: _MANAGE_TENANT, service: DashboardServiceDep
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
