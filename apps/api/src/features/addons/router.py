"""Router für addons (Zusatzleistungen/Upsells). Gemountet unter /api/v1/addons.

Katalog-CRUD je Objekt + Medien-Upload sind MANAGE_PROPERTIES-geschützt
(Agentur/Co-Admin) und tenant-gescoped. Verkaufslesen auf den öffentlichen
Flächen läuft über booking_engine bzw. public_portal, nicht hier.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security import AuthContext
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import AddonsServiceDep, AddonZahlungServiceDep
from .schemas import (
    AddonApplyRequest,
    AddonApplyResponse,
    AddonCreate,
    AddonLibraryResponse,
    AddonListResponse,
    AddonResponse,
    AddonUpdate,
    ReservationAddonAdd,
    ReservationAddonListResponse,
    ReservationAddonQty,
    ReservationAddonResponse,
    SliceHealth,
    ZahlungslinkResponse,
)
from .service import AddonError
from .zahlung import ZahlungslinkFehler

_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_PROPERTIES
)

router = APIRouter(prefix="/addons", tags=["addons"])


@router.get("/health", response_model=SliceHealth)
def health(service: AddonsServiceDep) -> SliceHealth:
    return service.health()


@router.get("/properties/{property_id}", response_model=AddonListResponse)
def list_property_addons(
    property_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonListResponse:
    """Alle Zusatzleistungen eines Objekts (Katalog, inkl. inaktiver)."""
    try:
        return service.list_for_property(ctx, property_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/properties/{property_id}",
    response_model=AddonResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_addon(
    property_id: str,
    req: AddonCreate,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    try:
        return service.create(ctx, property_id, req)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/properties/{property_id}/library", response_model=AddonLibraryResponse)
def get_addon_library(
    property_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonLibraryResponse:
    """Zusatzleistungen anderer Objekte, die auf DIESES übernehmbar sind.

    Speist „Bestehende Zusatzleistung übernehmen" — das Gegenstück zur
    Gebühren-Bibliothek. Nur Objekte desselben Betriebs und derselben Währung;
    was hier schon liegt, fehlt bewusst."""
    try:
        return AddonLibraryResponse(**service.addon_library(ctx, property_id))
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{addon_id}/apply", response_model=AddonApplyResponse)
def apply_addon_to_properties(
    addon_id: str,
    req: AddonApplyRequest,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonApplyResponse:
    """Dieselbe Zusatzleistung auf weitere eigene Objekte übertragen.

    Jede Ziel-ID wird einzeln tenant-gescopt; Währungskonflikte werden VOR dem
    ersten Schreiben abgelehnt, nicht halb durchgelaufen. Ein zweiter Aufruf
    aktualisiert die vorhandene Zeile, statt eine Dublette anzulegen."""
    try:
        return AddonApplyResponse(
            **service.apply_addon_to_properties(ctx, addon_id, req.property_ids)
        )
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{addon_id}", response_model=AddonResponse)
def update_addon(
    addon_id: str,
    req: AddonUpdate,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    try:
        return service.update(ctx, addon_id, req)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{addon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_addon(
    addon_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete(ctx, addon_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{addon_id}/media", response_model=AddonResponse)
async def add_addon_media(
    addon_id: str,
    request: Request,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonResponse:
    """Ein Medium (Foto) hochladen (multipart). JPEG/PNG/WebP, 10 KB–20 MB, max. 5.

    Liest das Formular mit angehobenem Part-Limit (sonst lehnt Starlette Fotos
    >1 MB mit rohem 413 ab); die 20-MB-Grenze prüft der Service."""
    content, content_type = await read_upload(request)
    try:
        return service.add_media(ctx, addon_id, content, content_type)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/reservations/{reservation_id}", response_model=ReservationAddonListResponse
)
def list_reservation_addons(
    reservation_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonListResponse:
    """Gekaufte Zusatzleistungen einer Reservierung (Dashboard-Sicht)."""
    try:
        return service.list_for_reservation(ctx, reservation_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/reservations/{reservation_id}/available", response_model=AddonListResponse
)
def available_reservation_addons(
    reservation_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AddonListResponse:
    """Aktive Katalog-Add-ons des Objekts dieser Reservierung (Schnell-Auswahl)."""
    try:
        return service.available_for_reservation(ctx, reservation_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/addons",
    response_model=ReservationAddonListResponse,
)
def add_reservation_addon(
    reservation_id: str,
    req: ReservationAddonAdd,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonListResponse:
    """Schnelltaste: Zusatzleistung zu einer bestehenden Buchung hinzufügen."""
    try:
        return service.add_to_reservation(ctx, reservation_id, req.addon_id, req.qty)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservation-addons/{res_addon_id}/mark-paid",
    response_model=ReservationAddonResponse,
)
def mark_addon_paid(
    res_addon_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonResponse:
    """Manuell als bezahlt markieren (solange kein Payment-Provider live ist)."""
    try:
        return service.mark_paid(ctx, res_addon_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch(
    "/reservation-addons/{res_addon_id}/qty",
    response_model=ReservationAddonResponse,
)
def change_addon_qty(
    res_addon_id: str,
    payload: ReservationAddonQty,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonResponse:
    """Menge einer offenen Zusatzleistung ändern; der Betrag wird neu gerechnet.

    Der Fall, für den es das gibt: eine Buchung über 4 Personen bestellt nur 2
    Wäschepakete. 409, wenn die Position bereits bezahlt, storniert oder auf
    einer festgeschriebenen Rechnung steht."""
    try:
        return service.change_qty(ctx, res_addon_id, payload.qty)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservation-addons/{res_addon_id}/cancel",
    response_model=ReservationAddonResponse,
)
def cancel_reservation_addon(
    res_addon_id: str,
    service: AddonsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ReservationAddonResponse:
    """Eine falsch gebuchte Zusatzleistung stornieren (status=cancelled).

    Kein DELETE: die Zeile bleibt als Beleg stehen und fällt aus Rechnung,
    Eigentümer-Abrechnung und Gast-Portal heraus. 409, wenn schon bezahlt oder
    bereits auf einer festgeschriebenen Rechnung."""
    try:
        return service.cancel_reservation_addon(ctx, res_addon_id)
    except AddonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Zahlungslink (Stripe, Direct Charge im Konto des Betriebs) ---------------
#
# Zugriff: MANAGE_PROPERTIES wie der übrige Slice. Wer eine Zusatzleistung
# verkaufen darf, muss sie auch kassieren können — die Rezeption bucht das Extra
# und schickt den Link. Keine Finanzdaten des Betriebs werden dabei sichtbar
# (Saldo/Auszahlung liegen unter MANAGE_BILLING in /payouts).

@router.get(
    "/reservations/{reservation_id}/zahlungslink",
    response_model=ZahlungslinkResponse | None,
)
def get_zahlungslink(
    reservation_id: str,
    service: AddonZahlungServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ZahlungslinkResponse | None:
    """Offenen Zahlungslink der Buchung — null, wenn keiner offen ist.

    Gleicht dabei mit Stripe ab, ob inzwischen bezahlt wurde (Netz unter dem
    Webhook)."""
    try:
        return service.lesen(ctx, reservation_id)
    except ZahlungslinkFehler as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/zahlungslink",
    response_model=ZahlungslinkResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_zahlungslink(
    reservation_id: str,
    service: AddonZahlungServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ZahlungslinkResponse:
    """Zahlungslink über alle offenen Zusatzleistungen der Buchung erstellen.

    Idempotent: ein bereits offener Link mit denselben Positionen wird
    zurückgegeben, statt einen zweiten zu erzeugen."""
    try:
        return service.erstellen(ctx, reservation_id)
    except ZahlungslinkFehler as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/reservations/{reservation_id}/zahlungslink",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_zahlungslink(
    reservation_id: str,
    service: AddonZahlungServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    """Offenen Zahlungslink zurückziehen (bei Stripe deaktivieren)."""
    try:
        service.zurueckziehen(ctx, reservation_id)
    except ZahlungslinkFehler as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
