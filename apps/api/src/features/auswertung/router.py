"""Router der Auswertung — ein Endpunkt für alle Reiter, dazu Pace und Ansichten.

AUTORISIERUNG (Wurzel 9): `DOWNLOAD_BOOKING_REPORT`, nicht bloß
`get_current_user`. Die Auswertung gibt Umsatz, Provision und Gästeherkunft
aus — nichts davon gehört in die Hand einer Reinigungskraft (§4.3).

Die gespeicherten Ansichten sind je NUTZER (Hostaway „Custom Views"): der
Service scopet auf tenant UND user, die DB-Policy ebenfalls (0563).
"""
from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .dependencies import AuswertungServiceDep
from .schemas import (
    Ansicht,
    AnsichtAnlegen,
    AuswertungResponse,
    Bezug,
    PaceBericht,
    SliceHealth,
    Vergleich,
)
from .service import MAX_TAGE, MAX_TAGE_VERGLEICH

router = APIRouter(prefix="/auswertung", tags=["auswertung"])

_BERICHT = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.DOWNLOAD_BOOKING_REPORT
)

Ctx = Annotated[AuthContext, Depends(_BERICHT)]

# Hostaways Status-Filter. Die Werte sind die des DB-Enums
# `reservation_status`; ein unbekannter Wert wird abgewiesen, statt still
# nichts zu treffen (Wurzel 5).
_STATUS_ERLAUBT = frozenset({
    "pending", "confirmed", "checked_in", "checked_out", "completed",
    "cancelled", "declined", "expired", "requested",
})


def _status_pruefen(status_werte: list[str] | None) -> list[str] | None:
    if not status_werte:
        return None
    fremd = sorted(set(status_werte) - _STATUS_ERLAUBT)
    if fremd:
        raise HTTPException(422, f"Unbekannter Status: {', '.join(fremd)}")
    return sorted(set(status_werte))


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="auswertung")


@router.get("", response_model=AuswertungResponse)
def auswertung(  # noqa: PLR0913 — die Filterleiste, eins zu eins
    service: AuswertungServiceDep,
    ctx: Ctx,
    von: date,
    bis: date,
    bezug: Bezug = Bezug.ANREISE,
    property_id: Annotated[list[str] | None, Query()] = None,
    channel: Annotated[list[str] | None, Query()] = None,
    status_wert: Annotated[list[str] | None, Query(alias="status")] = None,
    vergleich: Vergleich = Vergleich.KEINER,
) -> AuswertungResponse:
    """Kennzahlen, Verlauf, Kanäle, Objekte, Buchungen, Gäste, Muster, Stornos,
    Ausgaben eines Zeitraums."""
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
        status=_status_pruefen(status_wert),
        vergleich=vergleich,
    )


@router.get("/pace", response_model=PaceBericht)
def pace(
    service: AuswertungServiceDep,
    ctx: Ctx,
    property_id: Annotated[list[str] | None, Query()] = None,
    channel: Annotated[list[str] | None, Query()] = None,
) -> PaceBericht:
    """Buchungsstand der nächsten zwölf Monate gegen denselben Stichtag im
    Vorjahr (SiteMinder „Pace"). Kein Zeitraum-Parameter: der Bericht blickt
    immer von heute nach vorn."""
    return service.pace(ctx, property_ids=property_id, channels=channel)


@router.get("/ansichten", response_model=list[Ansicht])
def ansichten(
    service: AuswertungServiceDep,
    ctx: Ctx,
    reiter: str | None = None,
) -> list[Ansicht]:
    """Die gespeicherten Ansichten des angemeldeten Nutzers."""
    return service.ansichten(ctx, reiter)


@router.post("/ansichten", response_model=Ansicht, status_code=status.HTTP_201_CREATED)
def ansicht_anlegen(
    service: AuswertungServiceDep,
    ctx: Ctx,
    req: AnsichtAnlegen,
) -> Ansicht:
    """Ansicht speichern. Gleicher Name im selben Reiter ersetzt (idempotent)."""
    return service.ansicht_anlegen(ctx, req)


@router.delete("/ansichten/{ansicht_id}", status_code=status.HTTP_204_NO_CONTENT)
def ansicht_loeschen(
    service: AuswertungServiceDep,
    ctx: Ctx,
    ansicht_id: str,
) -> Response:
    """Eigene Ansicht löschen. Wurzel 9: derselbe Scope wie die Liste."""
    service.ansicht_loeschen(ctx, ansicht_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
