"""Router fuer dashboard_layout. Gemountet unter /api/v1/dashboard-layout.

Zwei Ebenen mit ZWEI verschiedenen Guards:

* Das EIGENE Layout haengt an `CurrentUser` — jeder eingeloggte Nutzer darf
  seine Startseite fuer sich anordnen. Der Scope ist die eigene user_id, im
  Service erzwungen (Wurzel 3).
* Die ROLLEN-STANDARDS haengen an `require_permission(MANAGE_TENANT)` — das ist
  eine tenant-weite Vorgabe fuer fremde Konten. Item-Level wie List-Level
  denselben Scope (Wurzel 9): auch `{role}` laeuft ueber `ctx.tenant_id`, und
  `role` ist ein `Literal` — ein freier String kaeme nie in die DB.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import DashboardLayoutServiceDep
from .schemas import (
    DashboardLayout,
    DashboardLayoutAntwort,
    RollenName,
    RollenStandardAntwort,
)
from .service import DashboardLayoutError

router = APIRouter(prefix="/dashboard-layout", tags=["dashboard-layout"])

# Eigener Alias statt `require_permission(...)` an jedem Endpunkt: derselbe
# Guard, dreimal gebraucht.
TenantAdmin = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
]


@router.get("", response_model=DashboardLayoutAntwort)
def get_dashboard_layout(
    ctx: CurrentUser, service: DashboardLayoutServiceDep
) -> DashboardLayoutAntwort:
    """Wirksames Layout des eingeloggten Nutzers samt Herkunft.

    Kein 404, wenn nichts gespeichert ist: dann `layout=null` und
    `quelle="standard"` — das Frontend nimmt seinen Katalog-Standard.
    """
    return service.get(ctx)


@router.put("", response_model=DashboardLayoutAntwort)
def put_dashboard_layout(
    layout: DashboardLayout,
    ctx: CurrentUser,
    service: DashboardLayoutServiceDep,
) -> DashboardLayoutAntwort:
    """Eigenes Layout speichern. Die Form erzwingt Pydantic (Katalog-IDs,
    Koordinatengrenzen, max. 40 Eintraege) — alles andere 422."""
    try:
        return service.speichern(ctx, layout)
    except DashboardLayoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("", response_model=DashboardLayoutAntwort)
def delete_dashboard_layout(
    ctx: CurrentUser, service: DashboardLayoutServiceDep
) -> DashboardLayoutAntwort:
    """Eigenes Layout verwerfen — der Rollen- bzw. Katalog-Standard greift
    wieder. Idempotent: auch ohne gespeichertes Layout ein 200."""
    try:
        return service.zuruecksetzen(ctx)
    except DashboardLayoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/rollen-standard/{role}", response_model=RollenStandardAntwort)
def get_rollen_standard(
    role: RollenName,
    ctx: TenantAdmin,
    service: DashboardLayoutServiceDep,
) -> RollenStandardAntwort:
    """Startseiten-Standard einer Rolle im eigenen Betrieb lesen."""
    try:
        return service.rollen_standard_lesen(ctx, role)
    except DashboardLayoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/rollen-standard/{role}", response_model=RollenStandardAntwort)
def put_rollen_standard(
    role: RollenName,
    layout: DashboardLayout,
    ctx: TenantAdmin,
    service: DashboardLayoutServiceDep,
) -> RollenStandardAntwort:
    """Startseiten-Standard einer Rolle setzen. Neue Nutzer dieser Rolle erben
    ihn; „Zuruecksetzen" faellt darauf zurueck."""
    try:
        return service.rollen_standard_setzen(ctx, role, layout)
    except DashboardLayoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/rollen-standard/{role}", response_model=RollenStandardAntwort)
def delete_rollen_standard(
    role: RollenName,
    ctx: TenantAdmin,
    service: DashboardLayoutServiceDep,
) -> RollenStandardAntwort:
    """Startseiten-Standard einer Rolle entfernen — sie erbt dann wieder den
    Katalog-Standard aus dem Code."""
    try:
        return service.rollen_standard_entfernen(ctx, role)
    except DashboardLayoutError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
