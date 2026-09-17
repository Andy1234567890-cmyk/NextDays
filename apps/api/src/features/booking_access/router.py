"""Router für booking_access. Gemountet unter /api/v1/booking-access.

Buchungsberechtigungen (Airbnb „Buchungseinstellungen → Voraussetzungen für
Gäste"): Sofortbuchung oder Anfrage, und für wen die Sofortbuchung gilt.

Die Einstellung entscheidet, wie Objekte verkauft werden — sie verlangt
deshalb MANAGE_PROPERTIES, nicht bloß eine Anmeldung (Wurzel 9). Der Betrieb
kommt serverseitig aus ctx.tenant_id, nie aus dem Aufruf (Wurzel 3).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import BookingAccessServiceDep
from .schemas import Buchungsberechtigung, BuchungsberechtigungUpdate
from .service import BookingAccessError

router = APIRouter(prefix="/booking-access", tags=["booking-access"])

_Ctx = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_PROPERTIES))
]


def _fehler(exc: BookingAccessError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("", response_model=Buchungsberechtigung)
def lesen(ctx: _Ctx, service: BookingAccessServiceDep) -> Buchungsberechtigung:
    """Entscheidung des Betriebs plus tatsächlicher Objektstand."""
    try:
        return service.einstellung(ctx)
    except BookingAccessError as exc:
        raise _fehler(exc) from exc


@router.put("", response_model=Buchungsberechtigung)
def setzen(
    req: BuchungsberechtigungUpdate,
    ctx: _Ctx,
    service: BookingAccessServiceDep,
) -> Buchungsberechtigung:
    """Entscheidung setzen — am Betrieb und an allen seinen Objekten."""
    try:
        return service.setzen(ctx, req)
    except BookingAccessError as exc:
        raise _fehler(exc) from exc
