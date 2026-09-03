"""Router der Auswertung — ein Endpunkt für alle Reiter.

AUTORISIERUNG (Wurzel 9): `DOWNLOAD_BOOKING_REPORT`, nicht bloß
`get_current_user`. Die Auswertung gibt Umsatz, Provision und Gästeherkunft
aus — nichts davon gehört in die Hand einer Reinigungskraft (§4.3).
"""
from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import AuthContext
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .dependencies import AuswertungServiceDep
from .schemas import AuswertungResponse, Bezug, SliceHealth, Vergleich
from .service import MAX_TAGE, MAX_TAGE_VERGLEICH

router = APIRouter(prefix="/auswertung", tags=["auswertung"])

_BERICHT = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.DOWNLOAD_BOOKING_REPORT
)

Ctx = Annotated[AuthContext, Depends(_BERICHT)]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="auswertung")


@router.get("", response_model=AuswertungResponse)
def auswertung(
    service: AuswertungServiceDep,
    ctx: Ctx,
    von: date,
    bis: date,
    bezug: Bezug = Bezug.ANREISE,
    property_id: Annotated[list[str] | None, Query()] = None,
    channel: Annotated[list[str] | None, Query()] = None,
    vergleich: Vergleich = Vergleich.KEINER,
) -> AuswertungResponse:
    """Kennzahlen, Verlauf, Kanäle, Objekte, Buchungen und Gäste eines Zeitraums."""
    if bis < von:
        raise HTTPException(422, "„Bis“ darf nicht vor „Von“ liegen.")
    # Harte Obergrenze (Wurzel 8): ein offener Zeitraum wäre ein Vollscan über
    # alle Buchungen und Kalendernächte des Betriebs.
    if (bis - von).days > MAX_TAGE:
        raise HTTPException(422, "Der Zeitraum darf höchstens 5 Jahre umfassen.")
    # Ein Vergleich rechnet den GANZEN Bericht ein zweites Mal. Bei einem
    # Zeitraum nahe der Obergrenze wäre das der doppelte Vollscan, also die
    # Grenze durch die Hintertür — deshalb ein eigener, engerer Deckel für den
    # Vergleichsfall (Wurzel 8).
    if vergleich is not Vergleich.KEINER and (bis - von).days > MAX_TAGE_VERGLEICH:
        raise HTTPException(
            422,
            "Mit Vergleich darf der Zeitraum höchstens 1 Jahr umfassen.",
        )
    return service.auswerten(
        ctx,
        von=von,
        bis=bis,
        bezug=bezug,
        property_ids=property_id,
        channels=channel,
        vergleich=vergleich,
    )
