"""Router für cohosts. Gemountet unter /api/v1/cohosts.

Co-Gastgeber (Airbnb „Co-Hosts") für den Plattform-Marktplatz: Eine Person mit
EIGENEM Tenant hilft auf einem FREMDEN Objekt mit. Nicht zu verwechseln mit dem
Team-Modell des PMS (co_admin/staff/cleaner im eigenen Tenant).

Zwei Sichten, strikt getrennt:

  • Der EIGENTÜMER verwaltet die Co-Gastgeber seiner Objekte. Jede Route
    verlangt MANAGE_PROPERTIES und scopt zusätzlich auf den eigenen Tenant
    (_require_own_property) — Rolle allein genügt nicht (Wurzel 3).
  • Der EINGELADENE sieht nur, was an ihn gerichtet ist: die Einladung zu
    seinem Token und seine eigenen Zuordnungen.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import CohostServiceDep, CohostStripeServiceDep
from .payouts import BeteiligungFehler
from .schemas import (
    Cohost,
    CohostAccessUpdate,
    CohostAssignment,
    CohostInvitation,
    CohostInvite,
    CohostInviteResponse,
    CohostOnboardingRequest,
    CohostShareUpdate,
    CohostStripeCreate,
    CohostStripeStatus,
    PendingInvitation,
)
from .service import CohostError
from .stripe_service import CohostStripeError

router = APIRouter(prefix="/cohosts", tags=["cohosts"])

# Wer Objekte verwalten darf, darf auch deren Co-Gastgeber verwalten. Der
# Objekt-Scope kommt zusätzlich aus dem Service.
_OwnerCtx = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_PROPERTIES))
]


def _fehler(exc: CohostError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Sicht des Eigentümers --------------------------------------------------


@router.get("/property/{property_id}", response_model=list[Cohost])
def list_cohosts(
    property_id: str, ctx: _OwnerCtx, service: CohostServiceDep
) -> list[Cohost]:
    """Co-Gastgeber eines Objekts (aktiv und noch offen)."""
    try:
        return service.list_for_property(ctx, property_id)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.get("/platform-fee", response_model=dict)
def platform_fee(ctx: _OwnerCtx, service: CohostServiceDep) -> dict:
    """Die feste Plattform-Gebühr dieses Betriebs in Basispunkten.

    Die Oberfläche braucht sie für die Beispielrechnung („davon bleiben dir
    X €"). Nur der eigene Satz — er kommt aus dem Token-Tenant, nie aus einem
    Client-Parameter (Wurzel 3).
    """
    return {"platform_fee_bps": service.plattform_bps(ctx)}


@router.post(
    "/property/{property_id}/invite",
    response_model=CohostInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_cohost(
    property_id: str,
    req: CohostInvite,
    ctx: _OwnerCtx,
    service: CohostServiceDep,
) -> CohostInviteResponse:
    """Einen Co-Gastgeber einladen. Zugriff entsteht erst mit der Annahme."""
    try:
        return service.invite(ctx, property_id, req)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.get(
    "/property/{property_id}/invitations", response_model=list[CohostInvitation]
)
def list_invitations(
    property_id: str, ctx: _OwnerCtx, service: CohostServiceDep
) -> list[CohostInvitation]:
    """Offene Einladungen eines Objekts."""
    try:
        return service.list_invitations(ctx, property_id)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.delete(
    "/property/{property_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_invitation(
    property_id: str,
    invitation_id: str,
    ctx: _OwnerCtx,
    service: CohostServiceDep,
) -> None:
    """Eine offene Einladung zurückziehen."""
    try:
        service.cancel_invitation(ctx, property_id, invitation_id)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.patch(
    "/property/{property_id}/{cohost_id}", response_model=Cohost
)
def update_access(
    property_id: str,
    cohost_id: str,
    req: CohostAccessUpdate,
    ctx: _OwnerCtx,
    service: CohostServiceDep,
) -> Cohost:
    """Zugriffsstufe eines Co-Gastgebers ändern."""
    try:
        return service.update_access(ctx, property_id, cohost_id, req.access)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.patch(
    "/property/{property_id}/{cohost_id}/share", response_model=Cohost
)
def update_share(
    property_id: str,
    cohost_id: str,
    req: CohostShareUpdate,
    ctx: _OwnerCtx,
    service: CohostServiceDep,
) -> Cohost:
    """Beteiligung eines Co-Gastgebers je Buchung festlegen.

    Kommt ZUSÄTZLICH zur festen Plattform-Gebühr und geht zulasten des
    Gastgebers — deshalb entscheidet allein er darüber.
    """
    try:
        return service.update_share(ctx, property_id, cohost_id, req)
    except BeteiligungFehler as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.delete(
    "/property/{property_id}/{cohost_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_cohost(
    property_id: str,
    cohost_id: str,
    ctx: _OwnerCtx,
    service: CohostServiceDep,
) -> None:
    """Einem Co-Gastgeber den Zugriff entziehen. Wirkt sofort."""
    try:
        service.remove(ctx, property_id, cohost_id)
    except CohostError as exc:
        raise _fehler(exc) from exc


# --- Sicht des Eingeladenen -------------------------------------------------


@router.get("/invitation/{token}", response_model=PendingInvitation)
def open_invitation(
    token: str, service: CohostServiceDep
) -> PendingInvitation:
    """Eine Einladung ansehen.

    Bewusst OHNE Login: Der Eingeladene hat womöglich noch kein Konto und muss
    erst sehen, worum es geht. Der Token ist das Geheimnis; ausgeliefert werden
    nur Objekt-Titel, Stufe und Absender — keine Gast- oder Finanzdaten.
    """
    try:
        return service.invitation_by_token(token)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.post("/invitation/{token}/accept", response_model=CohostAssignment)
def accept_invitation(
    token: str, ctx: CurrentUser, service: CohostServiceDep
) -> CohostAssignment:
    """Einladung annehmen. Setzt Login, passende E-Mail und geprüfte Identität voraus."""
    try:
        return service.accept(ctx, token)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.post("/invitation/{token}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_invitation(token: str, service: CohostServiceDep) -> None:
    """Einladung ablehnen. Kein Login nötig — der Token genügt."""
    try:
        service.decline(token)
    except CohostError as exc:
        raise _fehler(exc) from exc


@router.get("/mine", response_model=list[CohostAssignment])
def my_assignments(
    ctx: CurrentUser, service: CohostServiceDep
) -> list[CohostAssignment]:
    """Objekte, die ich als Co-Gastgeber mitbetreue."""
    return service.my_assignments(ctx)


# --- Auszahlungskonto des Co-Gastgebers -------------------------------------


@router.get("/mine/stripe", response_model=CohostStripeStatus)
def stripe_status(
    ctx: CurrentUser, service: CohostStripeServiceDep
) -> CohostStripeStatus:
    """Stand meines Auszahlungskontos.

    Ohne auszahlungsbereites Konto lässt sich keine Einladung annehmen — eine
    vereinbarte Beteiligung könnte sonst nie fließen.
    """
    return service.status(ctx.user_id)


@router.post("/mine/stripe", response_model=CohostStripeStatus)
def create_stripe_account(
    req: CohostStripeCreate, ctx: CurrentUser, service: CohostStripeServiceDep
) -> CohostStripeStatus:
    """Auszahlungskonto anlegen. Idempotent — ein zweiter Aufruf gibt den
    bestehenden Stand zurück, statt ein zweites Konto zu erzeugen."""
    try:
        return service.create_account(
            ctx.user_id,
            email=req.email,
            country=req.country,
            business_type=req.business_type,
        )
    except CohostStripeError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.post("/mine/stripe/onboarding", response_model=dict)
def stripe_onboarding_link(
    req: CohostOnboardingRequest,
    ctx: CurrentUser,
    service: CohostStripeServiceDep,
) -> dict:
    """Stripe-Onboarding-Link für die noch fehlenden Angaben."""
    try:
        return {"url": service.onboarding_link(ctx.user_id, return_url=req.return_url)}
    except CohostStripeError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.delete("/mine/{cohost_id}", status_code=status.HTTP_204_NO_CONTENT)
def leave(
    cohost_id: str, ctx: CurrentUser, service: CohostServiceDep
) -> None:
    """Selbst als Co-Gastgeber austreten."""
    try:
        service.leave(ctx, cohost_id)
    except CohostError as exc:
        raise _fehler(exc) from exc
