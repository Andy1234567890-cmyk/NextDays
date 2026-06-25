"""Router für buchhaltung. Gemountet unter /api/v1/buchhaltung.

Rechnungen + Kunden, tenant-scoped (tenant_id aus dem JWT). Schreibende
Endpoints erfordern die Lodgify-Berechtigung OWNER_REPORTING (Buchhaltung).
"""
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from src.core.security import AuthContext, CurrentUser
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_lodgify_permission
from src.features.auth.lodgify_permissions import Permission

from .dependencies import BuchhaltungServiceDep
from .schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    InvoiceListResponse,
    InvoiceResponse,
    QuoteCreate,
    QuoteListResponse,
    QuoteResponse,
    QuoteUpdate,
    SliceHealth,
)
from .service import BuchhaltungError

router = APIRouter(prefix="/buchhaltung", tags=["buchhaltung"])

# Schreibrechte für Buchhaltung: OWNER_REPORTING (Finanz-/Buchhaltungszugang).
_write = Annotated[
    AuthContext, Depends(require_lodgify_permission(Permission.OWNER_REPORTING))
]


@router.get("/health", response_model=SliceHealth)
def health(service: BuchhaltungServiceDep) -> SliceHealth:
    return service.health()


# --- Kunden -----------------------------------------------------------------
@router.get("/customers")
def list_customers(
    ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Kunden/Lieferanten als Array (vom übernommenen Bestand erwartet)."""
    try:
        return service.list_customers_array(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/customers/company/{company_id}")
def list_customers_for_company(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Kunden eines Unternehmens als Array (Bestands-Pfad)."""
    try:
        return service.list_customers_array(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    req: CustomerCreate, service: BuchhaltungServiceDep, ctx: _write
) -> CustomerResponse:
    try:
        return service.create_customer(ctx, req)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    req: CustomerUpdate,
    service: BuchhaltungServiceDep,
    ctx: _write,
) -> CustomerResponse:
    try:
        return service.update_customer(ctx, customer_id, req)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_customer(
    customer_id: str, service: BuchhaltungServiceDep, ctx: _write
) -> None:
    try:
        service.delete_customer(ctx, customer_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Rechnungen -------------------------------------------------------------
@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices(
    ctx: CurrentUser, service: BuchhaltungServiceDep
) -> InvoiceListResponse:
    try:
        return service.list_invoices(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoices/company/{company_id}")
def list_invoices_for_company(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Rechnungen im `InvoiceData`-Format für das Buchhaltungs-Frontend.

    `company_id` aus dem Pfad dient nur der Kompatibilität mit dem Frontend-
    Aufruf; autoritativ ist der Tenant aus dem JWT (RLS/Tenant-Scope im Service).
    """
    try:
        return service.list_invoices_as_invoicedata(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Firmenprofil / Read-Endpoints für den Buchhaltungs-Bestand --------------
@router.get("/companies/{company_id}/transaction-links")
def list_transaction_links(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Beleg↔Bank-Verknüpfungen (Bankabgleich folgt separat → vorerst leer)."""
    try:
        return service.list_transaction_links(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/companies/{company_id}")
def get_company_profile(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> dict:
    """Firmen-/Rechnungsprofil des Tenants (tenant_billing_profile)."""
    try:
        return service.get_company_profile(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/booking-accounts/{company_id}")
def list_booking_accounts(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Buchungskonten/Kontenplan (eigenes Modul folgt → vorerst leer)."""
    try:
        return service.list_booking_accounts(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Nummernkreis / Schreib-Endpoints für den Buchhaltungs-Bestand -----------
@router.post("/number-sequences/next")
async def next_number(
    request: Request, service: BuchhaltungServiceDep, ctx: _write
) -> dict:
    """Nächste fortlaufende Dokumentnummer ziehen (GoBD-lückenlos)."""
    body = await request.json()
    doc_type = body.get("type") or "Rechnung"
    try:
        return service.next_number(ctx, doc_type)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/companies/{company_id}")
async def update_company_profile(
    company_id: str, request: Request, service: BuchhaltungServiceDep, ctx: _write
) -> dict:
    """Firmen-/Rechnungsprofil speichern (tenant_billing_profile)."""
    payload = await request.json()
    try:
        return service.update_company_profile(ctx, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/companies/{company_id}/logo")
async def upload_company_logo(
    company_id: str,
    request: Request,
    service: BuchhaltungServiceDep,
    ctx: _write,
) -> dict:
    """Firmenlogo hochladen (multipart) → URL ins Profil schreiben, Profil zurück."""
    content, content_type = await read_upload(request)
    try:
        return service.upload_logo(
            ctx, content, content_type or "application/octet-stream"
        )
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/inline-invoice-services")
async def create_inline_service(
    request: Request, ctx: _write
) -> dict:
    """Inline-Service (Service-Usage-Tracking) — vorerst No-Op-Bestätigung,
    da Analytics ein eigenes Modul ist. Verhindert 404 beim Speichern."""
    return {"ok": True}


@router.get("/inline-invoice-services")
def list_inline_services(ctx: CurrentUser) -> list[dict]:
    """Inline-Services lesen (Stub → leer)."""
    return []


@router.get("/text-templates/{company_id}")
def list_text_templates(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Textbausteine (Stub → leer; verhindert den 404-Render-Loop)."""
    try:
        return service.list_text_templates(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/text-templates/{company_id}/default")
def get_default_text_template(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> dict | None:
    """Standard-Textbaustein (Stub → null)."""
    return None


@router.get("/number-sequences")
def list_number_sequences(
    ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Nummernkreise des Tenants (nur lesen)."""
    try:
        return service.list_number_sequences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/number-sequences/{company_id}")
def list_number_sequences_for_company(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> list[dict]:
    """Nummernkreise eines Unternehmens als Array (Bestands-Pfad)."""
    try:
        return service.list_number_sequences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoices/next-number/{company_id}")
def get_next_invoice_number(
    company_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> dict:
    """Nächste Rechnungsnummer nur ANZEIGEN (ohne Zähler zu erhöhen)."""
    try:
        return service.next_number_preview(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/users/{user_id}/preferences")
def get_user_preferences(
    user_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> dict:
    """Nutzer-Präferenzen (Stub → leeres Objekt)."""
    try:
        return service.get_user_preferences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/users/{user_id}/preferences")
async def update_user_preferences(user_id: str, request: Request, ctx: _write) -> dict:
    """Nutzer-Präferenzen speichern (Stub → bestätigt, persistiert noch nicht)."""
    return {"ok": True}


@router.post("/text-templates/{company_id}/initialize")
async def initialize_text_templates(company_id: str, request: Request, ctx: _write) -> dict:
    """Standard-Textbausteine initialisieren (Stub → No-Op)."""
    return {"ok": True}


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> InvoiceResponse:
    try:
        return service.get_invoice(ctx, invoice_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    request: Request, service: BuchhaltungServiceDep, ctx: _write
) -> dict:
    """Rechnung aus dem Buchhaltungs-Bestand speichern (reiches camelCase-
    Payload). Beträge werden serverseitig aus den Positionen berechnet."""
    payload = await request.json()
    try:
        return service.create_invoice_from_bestand(ctx, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    request: Request,
    service: BuchhaltungServiceDep,
    ctx: _write,
) -> dict:
    """Rechnung aktualisieren (Bestand-Payload, z.B. E-Rechnung-XML nachtragen)."""
    payload = await request.json()
    try:
        return service.update_invoice_raw(ctx, invoice_id, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: str, service: BuchhaltungServiceDep, ctx: _write
) -> None:
    try:
        service.delete_invoice(ctx, invoice_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Angebote ---------------------------------------------------------------
@router.get("/quotes", response_model=QuoteListResponse)
def list_quotes(
    ctx: CurrentUser, service: BuchhaltungServiceDep
) -> QuoteListResponse:
    try:
        return service.list_quotes(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep
) -> QuoteResponse:
    try:
        return service.get_quote(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    req: QuoteCreate, service: BuchhaltungServiceDep, ctx: _write
) -> QuoteResponse:
    try:
        return service.create_quote(ctx, req)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/quotes/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: str, req: QuoteUpdate, service: BuchhaltungServiceDep, ctx: _write
) -> QuoteResponse:
    try:
        return service.update_quote(ctx, quote_id, req)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: str, service: BuchhaltungServiceDep, ctx: _write
) -> None:
    try:
        service.delete_quote(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quotes/{quote_id}/convert", response_model=InvoiceResponse)
def convert_quote(
    quote_id: str, service: BuchhaltungServiceDep, ctx: _write
) -> InvoiceResponse:
    """Angebot in eine Rechnung umwandeln."""
    try:
        return service.convert_quote_to_invoice(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
