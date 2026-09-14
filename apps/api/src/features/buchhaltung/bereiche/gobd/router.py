"""Bereich »gobd« der Buchhaltung — Festschreibung, Prüfprotokoll, Datenträgerüberlassung.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route trägt
`Leserecht`/`Schreibrecht` aus ../../guards (Rollen-Guard + Modul-Entitlement).

Pfade decken den Bestand (`web/services/gobdService.ts`, über
`api-client.mapEndpoint` → `/buchhaltung/gobd/...`) ab, wo er fachlich passt:
`GET settings/{company_id}`, `PUT settings`, `POST lock/manual`, `POST lock/auto`.
`company_id` aus dem Pfad ist Altlast — autoritativ ist der Tenant aus dem JWT.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import GobdServiceDep
from .schemas import (
    LIMIT_MAX,
    LIMIT_STANDARD,
    AuditEntry,
    AutoLockRunResult,
    GobdSettingsResponse,
    GobdSettingsUpdate,
    GobdStatus,
    LockRequest,
    LockResult,
    OffeneRechnung,
    UnlockRequest,
    VerifyResult,
)
from .service import GobdError

router = APIRouter(prefix="/gobd", tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=LIMIT_MAX)]


def _http(exc: GobdError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Einstellungen -----------------------------------------------------------


@router.get("/settings", response_model=GobdSettingsResponse, response_model_by_alias=True)
def get_settings(ctx: Leserecht, service: GobdServiceDep) -> GobdSettingsResponse:
    try:
        return service.get_settings(ctx)
    except GobdError as exc:
        raise _http(exc) from exc


@router.get(
    "/settings/{company_id}", response_model=GobdSettingsResponse, response_model_by_alias=True
)
def get_settings_bestand(
    company_id: str, ctx: Leserecht, service: GobdServiceDep
) -> GobdSettingsResponse:
    """Bestands-Pfad (`gobdService.getSettings(companyId)`)."""
    try:
        return service.get_settings(ctx)
    except GobdError as exc:
        raise _http(exc) from exc


@router.put("/settings", response_model=GobdSettingsResponse, response_model_by_alias=True)
def put_settings(
    body: GobdSettingsUpdate, ctx: Schreibrecht, service: GobdServiceDep
) -> GobdSettingsResponse:
    try:
        return service.put_settings(ctx, body)
    except GobdError as exc:
        raise _http(exc) from exc


# --- Festschreiben -----------------------------------------------------------


@router.post("/lock", response_model=LockResult, response_model_by_alias=True)
def lock(body: LockRequest, ctx: Schreibrecht, service: GobdServiceDep) -> LockResult:
    """Rechnungen festschreiben. Idempotent: bereits festgeschriebene landen in
    `alreadyLocked`; Entwürfe → 422; fremde/fehlende IDs → 404."""
    try:
        return service.lock_invoices(ctx, body, modus="manual")
    except GobdError as exc:
        raise _http(exc) from exc


@router.post("/lock/manual", response_model=LockResult, response_model_by_alias=True)
def lock_manual_bestand(
    body: LockRequest, ctx: Schreibrecht, service: GobdServiceDep
) -> LockResult:
    """Bestands-Pfad (`gobdService.lockDocument` → `documentId`)."""
    try:
        return service.lock_invoices(ctx, body, modus="manual")
    except GobdError as exc:
        raise _http(exc) from exc


@router.post("/lock/auto", response_model=LockResult, response_model_by_alias=True)
def lock_auto_bestand(
    body: LockRequest, ctx: Schreibrecht, service: GobdServiceDep
) -> LockResult:
    """Bestands-Pfad (`gobdService.autoLockOnSend` nach dem Versand)."""
    try:
        return service.lock_invoices(ctx, body, modus="on_send")
    except GobdError as exc:
        raise _http(exc) from exc


@router.post("/unlock", status_code=status.HTTP_403_FORBIDDEN)
def unlock(body: UnlockRequest, ctx: Schreibrecht, service: GobdServiceDep) -> None:
    """Gibt es nicht — die Anfrage wird protokolliert (`unlock_denied`) und
    IMMER mit 403 beantwortet. Korrektur nur per Stornorechnung."""
    try:
        service.deny_unlock(ctx, body)
    except GobdError as exc:
        raise _http(exc) from exc


@router.post("/auto-lock/run", response_model=AutoLockRunResult, response_model_by_alias=True)
def auto_lock_run(ctx: Schreibrecht, service: GobdServiceDep) -> AutoLockRunResult:
    """Nach den Einstellungen fällige Belege festschreiben (der Worker ruft
    `GobdService.auto_lock_alle_tenants` — Koordinator-Aufgabe)."""
    try:
        return service.run_auto_lock(ctx)
    except GobdError as exc:
        raise _http(exc) from exc


@router.get("/open-invoices", response_model=list[OffeneRechnung], response_model_by_alias=True)
def open_invoices(
    ctx: Leserecht, service: GobdServiceDep, limit: _Limit = 200
) -> list[OffeneRechnung]:
    """Ausgestellt, noch nicht festgeschrieben — Auswahl für die manuelle Festschreibung."""
    try:
        return service.list_open_invoices(ctx, limit=limit)
    except GobdError as exc:
        raise _http(exc) from exc


@router.get("/status", response_model=GobdStatus, response_model_by_alias=True)
def gobd_status(ctx: Leserecht, service: GobdServiceDep) -> GobdStatus:
    try:
        return service.status(ctx)
    except GobdError as exc:
        raise _http(exc) from exc


# --- Prüfprotokoll -------------------------------------------------------------


@router.get("/audit-log", response_model=list[AuditEntry], response_model_by_alias=True)
def audit_log(  # noqa: PLR0913 — Filter der Liste
    ctx: Leserecht,
    service: GobdServiceDep,
    object_type: Annotated[str | None, Query(alias="objectType", max_length=20)] = None,
    object_id: Annotated[str | None, Query(alias="objectId", max_length=100)] = None,
    action: Annotated[str | None, Query(max_length=20)] = None,
    von: Annotated[date | None, Query(alias="from")] = None,
    bis: Annotated[date | None, Query(alias="to")] = None,
    limit: _Limit = LIMIT_STANDARD,
) -> list[AuditEntry]:
    try:
        return service.list_audit(
            ctx, object_type=object_type, object_id=object_id, action=action,
            von=von, bis=bis, limit=limit,
        )
    except GobdError as exc:
        raise _http(exc) from exc


@router.get("/audit-log/verify", response_model=VerifyResult, response_model_by_alias=True)
def audit_log_verify(ctx: Leserecht, service: GobdServiceDep) -> VerifyResult:
    """Hash-Kette des Mandanten nachrechnen; nennt den ERSTEN Bruch."""
    try:
        return service.verify(ctx)
    except GobdError as exc:
        raise _http(exc) from exc


# --- Datenträgerüberlassung ----------------------------------------------------


@router.get("/export")
def export(
    ctx: Leserecht,
    service: GobdServiceDep,
    von: Annotated[date, Query(alias="from")],
    bis: Annotated[date, Query(alias="to")],
) -> Response:
    """ZIP (CSV-Belege, Positionen, Prüfprotokoll, index.xml nach GDPdU-
    Beschreibungsstandard). Zeitraum ≤ 366 Tage, ≤ 20 000 Belege, ≤ 50 MB."""
    try:
        daten, dateiname = service.export_zip(ctx, von, bis)
    except GobdError as exc:
        raise _http(exc) from exc
    return Response(
        content=daten,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{dateiname}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
