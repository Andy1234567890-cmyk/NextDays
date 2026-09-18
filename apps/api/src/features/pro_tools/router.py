"""Router für pro_tools. Gemountet unter /api/v1/pro-tools.

„Professionelle Tools" (Airbnb, Hilfe-Artikel 2499) und die Massenbearbeitung
(Booking.com, Gruppen-Extranet).

Alle drei Routen verlangen MANAGE_PROPERTIES, nicht bloß eine Anmeldung: der
Schalter gibt eine Funktion frei, die den halben Bestand auf einmal ändert, und
die Massenbearbeitung TUT es (Wurzel 9 — derselbe Scope wie beim
Einzel-Endpunkt, der dieselbe Änderung an einem Objekt vornimmt). Der Betrieb
kommt serverseitig aus ctx.tenant_id, nie aus dem Aufruf (Wurzel 3).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import ProToolsServiceDep
from .schemas import Massenaenderung, MassenErgebnis, ProfiTools, ProfiToolsUpdate
from .service import ProToolsError

router = APIRouter(prefix="/pro-tools", tags=["pro-tools"])

_Ctx = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_PROPERTIES))
]


def _fehler(exc: ProToolsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("", response_model=ProfiTools)
def lesen(ctx: _Ctx, service: ProToolsServiceDep) -> ProfiTools:
    """Stand des Schalters plus Objektzahl (für Bookings Kriterium)."""
    try:
        return service.stand(ctx)
    except ProToolsError as exc:
        raise _fehler(exc) from exc


@router.put("", response_model=ProfiTools)
def setzen(
    req: ProfiToolsUpdate, ctx: _Ctx, service: ProToolsServiceDep
) -> ProfiTools:
    """Schalter umlegen."""
    try:
        return service.setzen(ctx, req.aktiv)
    except ProToolsError as exc:
        raise _fehler(exc) from exc


@router.post("/massenbearbeitung", response_model=MassenErgebnis)
def massenbearbeiten(
    req: Massenaenderung, ctx: _Ctx, service: ProToolsServiceDep
) -> MassenErgebnis:
    """Einen Wert auf mehrere Objekte anwenden.

    Antwortet auch dann mit 200, wenn einzelne Objekte scheitern — welche und
    warum, steht im Ergebnis. Ein 500 für den ganzen Auftrag würde die
    gelungenen Änderungen verschweigen, die trotzdem geschrieben sind.
    """
    try:
        return service.massenbearbeiten(ctx, req)
    except ProToolsError as exc:
        raise _fehler(exc) from exc
