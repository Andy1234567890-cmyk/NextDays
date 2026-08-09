"""Router des announcements-Slice — zwei Router, zwei Welten.

  * ``router`` (/announcements) — Kundendashboard. Guard
    ``require_role(admin, co_admin)``: Ankündigungen sind Leitungssache.
    `owner`, `staff` und `cleaner` bekommen 403.
  * ``platform_router`` (/platform/announcements) — Backoffice-Redaktion.
    ``CurrentPlatformAdmin``; jeder SCHREIBENDE Handler ruft
    ``require_platform_write(ctx)`` als ERSTE Zeile. `platform_support` darf
    lesen, aber nichts auslösen, was gleichzeitig alle Kunden-Dashboards
    unterbricht.

Warum der Dashboard-Guard NICHT allein genügt: `require_role` liest `ctx.role`
aus dem JWT, das bis zu eine Stunde alt sein kann. Die verbindliche Prüfung
liegt im Service (`_rolle_pruefen`, frisch aus public.users) und steht dort in
JEDER Methode (Wurzel 9). Der Guard hier ist die billige erste Hürde ohne
DB-Roundtrip.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.core.security import (
    AuthContext,
    CurrentPlatformAdmin,
    require_platform_write,
)
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_role
from src.features.auth.schemas import UserRole
from src.features.platform_admin import audit

from .dependencies import AnnouncementServiceDep
from .schemas import (
    Announcement,
    AnnouncementCreate,
    AnnouncementList,
    AnnouncementUpdate,
    BildResponse,
    PopupResponse,
    QuittierenResponse,
    SliceHealth,
)
from .service import AnnouncementError

# Erstnutzer von `require_role`: der Guard existiert seit Langem und ist
# getestet, wurde bisher aber von keinem Router verwendet.
_LEITUNG = require_role(  # noqa: N816  pylint: disable=invalid-name
    UserRole.admin, UserRole.co_admin
)

router = APIRouter(prefix="/announcements", tags=["announcements"])
platform_router = APIRouter(
    prefix="/platform/announcements", tags=["announcements"]
)


def _fehler(exc: AnnouncementError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# === Kundendashboard ========================================================
@router.get("/health", response_model=SliceHealth)
def health(service: AnnouncementServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=AnnouncementList)
def liste(
    service: AnnouncementServiceDep,
    ctx: Annotated[AuthContext, Depends(_LEITUNG)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AnnouncementList:
    """Historie für /neuerungen — nur Veröffentlichtes, neueste zuerst."""
    try:
        return service.liste(ctx, limit=limit, offset=offset)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc


@router.get("/popup", response_model=PopupResponse)
def popup(
    service: AnnouncementServiceDep,
    ctx: Annotated[AuthContext, Depends(_LEITUNG)],
) -> PopupResponse:
    """Die EINE Ankündigung, die jetzt unterbrechen darf — oder `item: null`.

    Nach jedem Quittieren fragt das Frontend erneut, statt eine Liste zu
    puffern: so bleibt die Reihenfolge Server-Sache.
    """
    try:
        return service.popup(ctx)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc


@router.post("/{announcement_id}/quittieren", response_model=QuittierenResponse)
def quittieren(
    announcement_id: str,
    service: AnnouncementServiceDep,
    ctx: Annotated[AuthContext, Depends(_LEITUNG)],
) -> QuittierenResponse:
    """Aktives Schließen festhalten. Idempotent — ein zweiter Aufruf ist kein
    Fehler, meldet aber `neu: false`."""
    try:
        return service.quittieren(ctx, announcement_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc


# === Backoffice =============================================================
@platform_router.get("", response_model=AnnouncementList)
def backoffice_liste(
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AnnouncementList:
    """Alle Ankündigungen inklusive Entwürfen."""
    _ = ctx
    try:
        return service.backoffice_liste(limit=limit, offset=offset)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc


@platform_router.get("/{announcement_id}", response_model=Announcement)
def backoffice_detail(
    announcement_id: str,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
) -> Announcement:
    _ = ctx
    try:
        return service.backoffice_detail(announcement_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc


@platform_router.post("", response_model=Announcement, status_code=status.HTTP_201_CREATED)
def erstellen(
    req: AnnouncementCreate,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> Announcement:
    """Neuen Entwurf anlegen. Erreicht noch niemanden — siehe /veroeffentlichen."""
    require_platform_write(ctx)
    try:
        item = service.erstellen(req, erstellt_von=ctx.user_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.create",
        target_type="announcement",
        target_id=item.id,
        request=request,
    )
    return item


@platform_router.patch("/{announcement_id}", response_model=Announcement)
def aktualisieren(
    announcement_id: str,
    req: AnnouncementUpdate,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> Announcement:
    require_platform_write(ctx)
    try:
        item = service.aktualisieren(announcement_id, req)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.update",
        target_type="announcement",
        target_id=announcement_id,
        request=request,
    )
    return item


@platform_router.post("/{announcement_id}/veroeffentlichen", response_model=Announcement)
def veroeffentlichen(
    announcement_id: str,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> Announcement:
    """Freigeben. Ab dem nächsten Login jedes Betriebs sichtbar — nicht sofort
    (bewusst keine Realtime-Zustellung, siehe 0337)."""
    require_platform_write(ctx)
    try:
        item = service.veroeffentlichen(announcement_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.publish",
        target_type="announcement",
        target_id=announcement_id,
        request=request,
    )
    return item


@platform_router.post("/{announcement_id}/zurueckziehen", response_model=Announcement)
def zurueckziehen(
    announcement_id: str,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> Announcement:
    """Weiterverbreitung stoppen. Erreicht nicht, wer schon quittiert hat."""
    require_platform_write(ctx)
    try:
        item = service.zurueckziehen(announcement_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.retract",
        target_type="announcement",
        target_id=announcement_id,
        request=request,
    )
    return item


@platform_router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def loeschen(
    announcement_id: str,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> None:
    """Entwurf endgültig entfernen (inkl. seiner Bilder). Nur im Status
    `entwurf` — Veröffentlichtes wird zurückgezogen, nicht gelöscht."""
    require_platform_write(ctx)
    try:
        service.loeschen(announcement_id)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.delete",
        target_type="announcement",
        target_id=announcement_id,
        request=request,
    )


@platform_router.post("/{announcement_id}/bild", response_model=BildResponse)
async def bild_hochladen(
    announcement_id: str,
    ctx: CurrentPlatformAdmin,
    service: AnnouncementServiceDep,
    request: Request,
) -> BildResponse:
    """Screenshot in den Bucket legen und die URL für das <img> zurückgeben.

    `read_upload` hebt Starlettes 1-MB-Part-Limit an — ohne ihn scheitert jeder
    Screenshot am Transport, bevor der Service ihn sieht. Der mitgeschickte
    content_type wird verworfen: der Typ kommt aus den Magic-Bytes.
    """
    require_platform_write(ctx)
    content, _content_type = await read_upload(request)
    try:
        url = service.bild_hochladen(announcement_id, content=content)
    except AnnouncementError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "announcement.image_upload",
        target_type="announcement",
        target_id=announcement_id,
        request=request,
    )
    return BildResponse(url=url)
