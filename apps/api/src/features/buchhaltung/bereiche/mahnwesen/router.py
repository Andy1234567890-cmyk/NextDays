"""Router des Bereichs »mahnwesen« — gemountet über bereiche/__init__.py unter
/api/v1/buchhaltung, also `/api/v1/buchhaltung/reminders/…`.

Der Bestand (`web/components/finance/SendDocumentModal.tsx`) ruft
`GET/PATCH /api/v1/reminders/{id}?company_id=…`; `api-client.ts` biegt das
Segment `reminders` auf `/api/v1/buchhaltung/reminders/…` um. `company_id`
wird ignoriert — autoritativ ist der Tenant aus dem JWT (Wurzel 3).

Reihenfolge ist Absicht: `/reminders/settings` und `/reminders/overdue-invoices`
stehen VOR `/reminders/{reminder_id}`, sonst fängt der Pfadparameter sie ab.

Guards: `Leserecht`/`Schreibrecht` aus ../../guards (OWNER_REPORTING ohne
Owner + Modul 3). `MahnwesenError` → HTTPException wie ../../router.py.
"""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import MahnwesenServiceDep
from .schemas import (
    LIMIT_MAX,
    LIMIT_STANDARD,
    MAX_LEVEL,
    OverdueInvoiceResponse,
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    ReminderSend,
    ReminderSettingsResponse,
    ReminderSettingsUpdate,
    ReminderStatus,
    ReminderStatusUpdate,
    ReminderUpdate,
    SendResult,
)
from .service import MahnwesenError

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=LIMIT_MAX)]
_Level = Annotated[int | None, Query(ge=1, le=MAX_LEVEL)]
_Id = Annotated[str | None, Query(max_length=64, alias="invoiceId")]


def _http(exc: MahnwesenError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Einstellungen -------------------------------------------------------------


@router.get("/reminders/settings", response_model=ReminderSettingsResponse)
def get_settings(ctx: Leserecht, service: MahnwesenServiceDep) -> ReminderSettingsResponse:
    """Stufen, Zinssatz, Überfälligkeits-Schalter. Ohne Zeile `configured=false`."""
    try:
        return service.get_settings(ctx)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.put("/reminders/settings", response_model=ReminderSettingsResponse)
def put_settings(
    body: ReminderSettingsUpdate, ctx: Schreibrecht, service: MahnwesenServiceDep
) -> ReminderSettingsResponse:
    try:
        return service.put_settings(ctx, body)
    except MahnwesenError as exc:
        raise _http(exc) from exc


# --- Überfällige Rechnungen ----------------------------------------------------


@router.get("/reminders/overdue-invoices", response_model=list[OverdueInvoiceResponse])
def list_overdue_invoices(
    ctx: Leserecht, service: MahnwesenServiceDep
) -> list[OverdueInvoiceResponse]:
    """Offene, fällige Rechnungen mit Tagen überfällig und nächster Mahnstufe."""
    try:
        return service.list_overdue(ctx)
    except MahnwesenError as exc:
        raise _http(exc) from exc


# --- Mahnungen -----------------------------------------------------------------


@router.get("/reminders", response_model=ReminderListResponse)
def list_reminders(
    ctx: Leserecht,
    service: MahnwesenServiceDep,
    reminder_status: Annotated[ReminderStatus | None, Query(alias="status")] = None,
    invoice_id: _Id = None,
    level: _Level = None,
    limit: _Limit = LIMIT_STANDARD,
) -> ReminderListResponse:
    try:
        items = service.list_reminders(
            ctx, invoice_id=invoice_id, status=reminder_status, level=level, limit=limit
        )
    except MahnwesenError as exc:
        raise _http(exc) from exc
    return ReminderListResponse(items=items, total=len(items))


@router.post("/reminders", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
def create_reminder(
    body: ReminderCreate, ctx: Schreibrecht, service: MahnwesenServiceDep
) -> ReminderResponse:
    """Nächste Mahnstufe zu einer überfälligen Rechnung; Beträge rechnet der Server."""
    try:
        return service.create_reminder(ctx, body)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.get("/reminders/{reminder_id}", response_model=ReminderResponse)
def get_reminder(
    reminder_id: str, ctx: Leserecht, service: MahnwesenServiceDep
) -> ReminderResponse:
    try:
        return service.get_reminder(ctx, reminder_id)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.patch("/reminders/{reminder_id}", response_model=ReminderResponse)
def update_reminder(
    reminder_id: str, body: ReminderUpdate, ctx: Schreibrecht, service: MahnwesenServiceDep
) -> ReminderResponse:
    """Texte/Fristen eines Entwurfs; Darstellungsfelder des Versand-Dialogs immer."""
    try:
        return service.update_reminder(ctx, reminder_id, body)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: str, ctx: Schreibrecht, service: MahnwesenServiceDep) -> None:
    """Nur Entwürfe — eine versendete Mahnung ist ein Schreiben, kein Zwischenstand."""
    try:
        service.delete_reminder(ctx, reminder_id)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.patch("/reminders/{reminder_id}/status", response_model=ReminderResponse)
def set_reminder_status(
    reminder_id: str,
    body: ReminderStatusUpdate,
    ctx: Schreibrecht,
    service: MahnwesenServiceDep,
) -> ReminderResponse:
    """draft→sent|cancelled, sent→paid|cancelled; alles andere 409."""
    try:
        return service.set_status(ctx, reminder_id, body.status)
    except MahnwesenError as exc:
        raise _http(exc) from exc


@router.post("/reminders/{reminder_id}/send", response_model=SendResult)
def send_reminder(
    reminder_id: str, body: ReminderSend, ctx: Schreibrecht, service: MahnwesenServiceDep
) -> SendResult:
    """Mahnung per Mail (PDF Base64 vom Client, Magic-Bytes + 15-MB-Deckel)."""
    try:
        return service.send_reminder(ctx, reminder_id, body)
    except MahnwesenError as exc:
        raise _http(exc) from exc
