"""Bereich »erechnung« der Buchhaltung — E-Rechnungen (XRechnung/ZUGFeRD).

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route
trägt `Leserecht`/`Schreibrecht` aus ../../guards (Rollen-Guard + Modul 3).

Pfade: kanonisch `/einvoices…`; dazu der Bestandsaufruf des Browser-Erzeugers
`POST /einvoice/{company_id}` (eInvoiceService.createEInvoice), damit der
Rechnungs-Anlage-Flow, der heute ins Leere läuft, ohne Umbau ankommt. Die
`company_id` aus dem Pfad ist Altlast und wird ignoriert — autoritativ ist
der Tenant aus dem JWT.

Reihenfolge beachten: `/einvoices/compliance` und `/einvoices/settings` stehen
VOR `/einvoices/{e_invoice_id}`, sonst fängt der Parameter-Pfad sie ab.
"""
from datetime import date
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import ERechnungServiceDep
from .schemas import (
    LIMIT_MAX,
    ComplianceResponse,
    EInvoiceCreate,
    EInvoiceResponse,
    EInvoiceSettingsResponse,
    EInvoiceSettingsUpdate,
    TransmissionCreate,
    TransmissionResponse,
    ValidationStatus,
)
from .service import ERechnungError

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=LIMIT_MAX)]


def _http(exc: ERechnungError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Compliance & Einstellungen (vor dem {id}-Pfad) -----------------------------


@router.get("/einvoices/compliance", response_model=ComplianceResponse)
def compliance(
    ctx: Leserecht,
    service: ERechnungServiceDep,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> ComplianceResponse:
    try:
        return service.compliance(ctx, von=from_date, bis=to_date)
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.get("/einvoices/settings", response_model=EInvoiceSettingsResponse)
def get_settings(ctx: Leserecht, service: ERechnungServiceDep) -> EInvoiceSettingsResponse:
    try:
        return service.get_settings(ctx)
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.put("/einvoices/settings", response_model=EInvoiceSettingsResponse)
def put_settings(
    body: EInvoiceSettingsUpdate, ctx: Schreibrecht, service: ERechnungServiceDep
) -> EInvoiceSettingsResponse:
    try:
        return service.put_settings(ctx, body)
    except ERechnungError as exc:
        raise _http(exc) from exc


# --- E-Rechnungen ---------------------------------------------------------------


@router.get("/einvoices", response_model=list[EInvoiceResponse])
def list_einvoices(
    ctx: Leserecht,
    service: ERechnungServiceDep,
    invoice_id: Annotated[str | None, Query(alias="invoiceId", max_length=64)] = None,
    validation_status: Annotated[
        ValidationStatus | None, Query(alias="validationStatus")
    ] = None,
    limit: _Limit = LIMIT_MAX,
) -> list[EInvoiceResponse]:
    try:
        return service.list_einvoices(
            ctx, invoice_id=invoice_id, validation_status=validation_status, limit=limit
        )
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.post(
    "/einvoices", response_model=EInvoiceResponse, status_code=status.HTTP_201_CREATED
)
def create_einvoice(
    body: EInvoiceCreate, ctx: Schreibrecht, service: ERechnungServiceDep
) -> EInvoiceResponse:
    """XML aus dem Browser-Erzeuger annehmen, prüfen, ablegen. Derselbe Inhalt
    zur selben Rechnung liefert die vorhandene Zeile (idempotent)."""
    try:
        return service.create_einvoice(ctx, body)
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.post("/einvoice/{company_id}", status_code=status.HTTP_201_CREATED)
def create_einvoice_legacy(
    company_id: str, body: EInvoiceCreate, ctx: Schreibrecht, service: ERechnungServiceDep
) -> dict:
    """Bestandsaufruf (`eInvoiceService.createEInvoice`): Antwort `{id}`.
    `company_id` wird ignoriert (Tenant aus dem JWT)."""
    del company_id
    try:
        neu = service.create_einvoice(ctx, body)
    except ERechnungError as exc:
        raise _http(exc) from exc
    return {"id": neu.id, "validationStatus": neu.validation_status}


@router.get("/einvoices/{e_invoice_id}", response_model=EInvoiceResponse)
def get_einvoice(
    e_invoice_id: str, ctx: Leserecht, service: ERechnungServiceDep
) -> EInvoiceResponse:
    try:
        return service.get_einvoice(ctx, e_invoice_id)
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.get("/einvoices/{e_invoice_id}/xml")
def download_xml(e_invoice_id: str, ctx: Leserecht, service: ERechnungServiceDep) -> Response:
    """XML-Download mit Content-Disposition — läuft über den Next-Proxy, der
    `content-disposition` durchreicht."""
    try:
        daten, dateiname = service.download_xml(ctx, e_invoice_id)
    except ERechnungError as exc:
        raise _http(exc) from exc
    return Response(
        content=daten,
        media_type="application/xml",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{dateiname}"; filename*=UTF-8\'\'{quote(dateiname)}'
            ),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/einvoices/{e_invoice_id}/validate", response_model=EInvoiceResponse)
def validate_einvoice(
    e_invoice_id: str, ctx: Schreibrecht, service: ERechnungServiceDep
) -> EInvoiceResponse:
    try:
        return service.validate_einvoice(ctx, e_invoice_id)
    except ERechnungError as exc:
        raise _http(exc) from exc


@router.post(
    "/einvoices/{e_invoice_id}/transmissions",
    response_model=TransmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_transmission(
    e_invoice_id: str,
    body: TransmissionCreate,
    ctx: Schreibrecht,
    service: ERechnungServiceDep,
) -> TransmissionResponse:
    """Protokoll-Eintrag. Den Mail-Versand selbst macht der Bereich »versand«
    (`dokument_senden`), der danach hier `channel='email'` einträgt."""
    try:
        return service.add_transmission(ctx, e_invoice_id, body)
    except ERechnungError as exc:
        raise _http(exc) from exc
