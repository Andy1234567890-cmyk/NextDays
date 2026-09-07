"""Router für booking_offers. Gemountet unter /api/v1/booking-offers.

ZWEI ZUGANGSWEGEN, bewusst getrennt:

* Die internen Routen verlangen `MANAGE_CALENDAR` — ein Angebot ist ein
  Verkaufsvorgang mit Preis und Gastdaten; Eigentümer und Mitarbeiter haben
  darauf keinen Zugriff (§4.2/§4.3, zusätzlich in der RLS von 0586 verankert).
* Die öffentlichen Routen (`/public/offers/{token}`) haben KEINE Anmeldung —
  der Token ist der ganze Zugang. Sie liegen im strengen Rate-Limit-Bucket
  `public_support` (siehe `core/ratelimit_middleware.py`), weil jeder Aufruf
  einen Zahlungslink erzeugen bzw. einen Token durchprobieren kann (Wurzel 8).

Der öffentliche Teil hängt an einem EIGENEN Router ohne Auth-Dependency; wäre
er im selben Router, würde ein später ergänzter globaler Guard ihn versehentlich
mitschützen und die Annahmeseite unbrauchbar machen.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .common import BookingOfferError
from .dependencies import BookingOffersServiceDep
from .schemas import (
    BookingOfferCreate,
    BookingOfferList,
    BookingOfferOut,
    PublicOfferAcceptResponse,
    PublicOfferOut,
    SliceHealth,
)

router = APIRouter(prefix="/booking-offers", tags=["booking-offers"])

# Der Token ist ein `secrets.token_urlsafe(32)` — 43 Zeichen aus dem
# URL-sicheren Alphabet. Die Längen- und Zeichenprüfung am Pfadparameter hält
# Unsinn aus dem Service (Wurzel 8) und liefert 422 statt 404.
TOKEN_MUSTER = r"^[A-Za-z0-9_-]{20,128}$"  # noqa: S105 — Muster, kein Geheimnis

oeffentlich = APIRouter(prefix="/public/offers", tags=["booking-offers"])

# Der Guard aller internen Routen. Als Alias, damit er an fünf Stellen gleich
# lautet — ein abweichender Guard an EINER Route wäre die Lücke (Wurzel 9:
# Item-Level-Autorisierung prüft denselben Scope wie die Liste).
Leitung = Annotated[
    CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(status="ok")


@router.get("", response_model=BookingOfferList)
def liste(
    service: BookingOffersServiceDep,
    ctx: Leitung,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    property_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BookingOfferList:
    """Angebote des Mandanten, neueste zuerst."""
    try:
        return service.liste(
            ctx,
            status=status_filter,
            property_id=property_id,
            limit=limit,
            offset=offset,
        )
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=BookingOfferOut, status_code=201)
def anlegen(
    req: BookingOfferCreate,
    service: BookingOffersServiceDep,
    ctx: Leitung,
) -> BookingOfferOut:
    """Ein Angebot anlegen — Preis rechnet der Server."""
    try:
        return service.anlegen(ctx, req)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{offer_id}", response_model=BookingOfferOut)
def detail(
    service: BookingOffersServiceDep,
    ctx: Leitung,
    offer_id: Annotated[str, Path()],
) -> BookingOfferOut:
    try:
        return service.detail(ctx, offer_id)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{offer_id}/send", response_model=BookingOfferOut)
def senden(
    service: BookingOffersServiceDep,
    ctx: Leitung,
    offer_id: Annotated[str, Path()],
) -> BookingOfferOut:
    """Angebotsmail an den Gast schicken (auch erneut)."""
    try:
        return service.senden(ctx, offer_id)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{offer_id}/cancel", response_model=BookingOfferOut)
def zurueckziehen(
    service: BookingOffersServiceDep,
    ctx: Leitung,
    offer_id: Annotated[str, Path()],
) -> BookingOfferOut:
    """Angebot zurückziehen; der Link wird unbrauchbar."""
    try:
        return service.zurueckziehen(ctx, offer_id)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Öffentlich (kein Login, Token in der URL) -----------------------------


@oeffentlich.get("/{token}", response_model=PublicOfferOut)
def oeffentlich_lesen(
    service: BookingOffersServiceDep,
    token: Annotated[str, Path(pattern=TOKEN_MUSTER)],
) -> PublicOfferOut:
    """Die Annahmeseite des Gastes."""
    try:
        return service.oeffentlich_lesen(token)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@oeffentlich.post("/{token}/accept", response_model=PublicOfferAcceptResponse)
def annehmen(
    service: BookingOffersServiceDep,
    token: Annotated[str, Path(pattern=TOKEN_MUSTER)],
) -> PublicOfferAcceptResponse:
    """Zusage des Gastes → Zahlungslink. Die Buchung entsteht erst mit der Zahlung."""
    try:
        return service.annehmen(token)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@oeffentlich.post("/{token}/decline", response_model=PublicOfferOut)
def ablehnen(
    service: BookingOffersServiceDep,
    token: Annotated[str, Path(pattern=TOKEN_MUSTER)],
) -> PublicOfferOut:
    """Absage des Gastes."""
    try:
        return service.ablehnen(token)
    except BookingOfferError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
