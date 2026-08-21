"""Router für buchhaltung. Gemountet unter /api/v1/buchhaltung.

Rechnungen + Kunden, tenant-scoped (tenant_id aus dem JWT). Schreibende
Endpoints erfordern die Berechtigung OWNER_REPORTING (Buchhaltung).
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
from src.core.supabase import get_service_client
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission
from src.features.subscriptions.entitlements import modul_aktiv

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


def _require_agency_finance(
    ctx: Annotated[
        AuthContext, Depends(require_granular_permission(Permission.OWNER_REPORTING))
    ],
) -> AuthContext:
    """Zugang zur AGENTUR-Debitorenbuchhaltung (Kunden/Rechnungen/Nummernkreise
    des Betriebs).

    Zwei Ebenen: (1) OWNER_REPORTING (staff/cleaner ohne Finanz-Zugang raus).
    (2) Die owner-Rolle BESITZT OWNER_REPORTING zwar (für ihre eigene
    Auszahlungs-Abrechnung in owner_statements, dort self-scoped), hat in der
    tenant-weiten Debitorenbuchhaltung aber NICHTS zu suchen — sie würde sonst
    Rechnungen/Kunden-PII ALLER Objekte des Tenants sehen und sogar schreiben
    (§4.2: Owner read-only + nur eigene Daten). Deshalb Owner hier hart mit 403
    aussperren — die Owner-Finanzsicht ist ausschließlich /owner-statements.
    """
    if ctx.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf die Betriebsbuchhaltung.",
        )
    return ctx


# module_key des kostenpflichtigen Moduls, das diesen Slice freischaltet.
# Quelle: subscriptions.schemas.MODULE_KEYS / PLAN-stripe-preisliste.md Z. 94.
BUCHHALTUNG_MODULE_KEY = "modul3_buchhaltung"


def _require_buchhaltung_modul(ctx: AuthContext) -> AuthContext:
    """Ist „Modul 3 — Buchhaltung" für diesen Betrieb gebucht?

    Drei getrennte Dinge (nicht zusammenlegen): Authentifizierung (wer bist du),
    Autorisierung (`_require_agency_finance`: darf deine Rolle Finanzdaten sehen)
    und ENTITLEMENT (hat der Betrieb das Modul bezahlt). Dieser Guard prüft nur
    das Dritte — er ersetzt keinen Rollen-Guard, er kommt zusätzlich.

    Fail-CLOSED (Wurzel 5): ohne Tenant, ohne Zeile oder bei ``active = false``
    gilt das Modul als nicht gebucht → 402, wie in
    `pricing.settings_service` für „Dynamische Preise". Eine Quelle für die
    Antwort: `subscriptions.entitlements.modul_aktiv` — hier keine eigene
    Abfrage (drei Kopien heißt: eine wird fail-OPEN, ohne dass es auffällt).

    Serverseitig erzwungen, nicht nur im Frontend ausgeblendet
    (PLAN-stripe-preisliste.md Z. 142-144, Wurzel 3).
    """
    if not modul_aktiv(get_service_client(), ctx.tenant_id, BUCHHALTUNG_MODULE_KEY):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Buchhaltung ist ein kostenpflichtiges Modul. "
            "Bitte zuerst unter Erweiterungen aktivieren.",
        )
    return ctx


def _require_agency_finance_with_modul(
    ctx: Annotated[AuthContext, Depends(_require_agency_finance)],
) -> AuthContext:
    """Rollen-Guard UND Entitlement — in dieser Reihenfolge: erst 403 für die
    falsche Rolle, dann 402 für den fehlenden Kauf."""
    return _require_buchhaltung_modul(ctx)


# Schreib- UND Leserechte: Agentur-Finanzzugang (OWNER_REPORTING, ohne Owner)
# PLUS gebuchtes Modul 3 (402, wenn nicht gebucht).
_write = Annotated[AuthContext, Depends(_require_agency_finance_with_modul)]
_read = _write

# OHNE Entitlement: das Firmen-/Rechnungsprofil des Betriebs (`companies/me`,
# Logo, Stripe-Sync) sind KONTO-Stammdaten. Sie liegen historisch in diesem
# Slice, gehören aber zu Onboarding und /konto (web/lib/firmenprofil.ts) und
# müssen JEDEM Betrieb offenstehen — hinter Modul 3 gesperrt käme kein
# Neukunde durch das Onboarding und niemand an seine eigenen Firmendaten.
# Rollen-Guard bleibt, nur das Entitlement fällt weg.
_profile_write = Annotated[  # pylint: disable=invalid-name
    AuthContext, Depends(_require_agency_finance)
]


def _require_company_profile_read(ctx: CurrentUser) -> AuthContext:
    """Firmen-/Kontaktprofil des Betriebs LESEN (/konto): das sind Konto-
    Stammdaten, KEIN Debitoren-Finanzeinblick — deshalb eigener Guard statt
    OWNER_REPORTING (sonst sah der co_admin ein leeres /konto). admin und
    co_admin dürfen lesen; staff/cleaner (§4.3) und owner (§4.2) bleiben
    draußen. Schreiben bleibt am Finanz-Guard (admin)."""
    if ctx.role not in ("admin", "co_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf das Firmenprofil.",
        )
    return ctx


# Lesen des Firmenprofils (admin+co_admin). Alias-Muster wie _read/_write.
_profile_read = Annotated[  # pylint: disable=invalid-name
    AuthContext, Depends(_require_company_profile_read)
]


@router.get("/health", response_model=SliceHealth)
def health(service: BuchhaltungServiceDep) -> SliceHealth:
    return service.health()


# --- Kunden -----------------------------------------------------------------
@router.get("/customers")
def list_customers(
    ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Kunden/Lieferanten als Array (vom übernommenen Bestand erwartet)."""
    try:
        return service.list_customers_array(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/customers/company/{company_id}")
def list_customers_for_company(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
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
    ctx: _read, service: BuchhaltungServiceDep
) -> InvoiceListResponse:
    try:
        return service.list_invoices(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoices/company/{company_id}")
def list_invoices_for_company(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Rechnungen im `InvoiceData`-Format für das Buchhaltungs-Frontend.

    `company_id` aus dem Pfad dient nur der Kompatibilität mit dem Frontend-
    Aufruf; autoritativ ist der Tenant aus dem JWT (RLS/Tenant-Scope im Service).
    """
    try:
        return service.list_invoices_as_invoicedata(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/invoices/{invoice_id}/storno")
async def create_storno_invoice(
    invoice_id: str,
    request: Request,
    service: BuchhaltungServiceDep,
    ctx: _write,
) -> dict:
    """Stornorechnung erzeugen (GoBD-Korrekturweg): negierter ST-Beleg mit
    Verweis aufs Original; Original wird 'cancelled' (gibt bei Buchungs-
    rechnungen den Unique-Index für eine korrigierte Rechnung frei)."""
    payload = await request.json()
    try:
        return service.create_storno_invoice(
            ctx, invoice_id, str(payload.get("reason") or "")
        )
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/vat-check")
def check_vat_id(
    vat_id: str,
    ctx: _read,
    service: BuchhaltungServiceDep,
) -> dict:
    """USt-IdNr. gegen den offiziellen EU-Prüfdienst VIES prüfen (27 EU-Länder).
    422 = Format falsch, 503 = VIES nicht erreichbar (Prüfung offen)."""
    try:
        return service.check_vat_id(ctx, vat_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Zimmerrechnungen aus Buchungen (Booking→Invoice-Brücke, 0092) ------------
@router.get("/billable-reservations")
def billable_reservations(
    service: BuchhaltungServiceDep,
    ctx: _write,
    query: str = "",
) -> list[dict]:
    """Abrechenbare Buchungen (eingecheckt, nicht storniert, ohne aktive
    Rechnung) für den Buchungs-Picker im Erstellformular."""
    try:
        return service.billable_reservations(ctx, query)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoice-preview")
def invoice_preview(
    reservation_id: str,
    service: BuchhaltungServiceDep,
    ctx: _write,
) -> dict:
    """Vorbefüllung „Rechnung aus Buchung" (Kunde + Positionen aus Aufenthalt
    und Upsells) — dieselbe Positions-Logik wie die Check-out-Rechnung."""
    try:
        return service.invoice_preview(ctx, reservation_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Firmenprofil / Read-Endpoints für den Buchhaltungs-Bestand --------------
@router.get("/companies/{company_id}/transaction-links")
def list_transaction_links(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Beleg↔Bank-Verknüpfungen (Bankabgleich folgt separat → vorerst leer)."""
    try:
        return service.list_transaction_links(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/companies/{company_id}")
def get_company_profile(
    company_id: str, ctx: _profile_read, service: BuchhaltungServiceDep
) -> dict:
    """Firmen-/Rechnungsprofil des Tenants (tenant_billing_profile)."""
    try:
        return service.get_company_profile(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/booking-accounts/{company_id}")
def list_booking_accounts(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Buchungskonten/Kontenplan (eigenes Modul folgt → vorerst leer)."""
    try:
        return service.list_booking_accounts(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Nummernkreis / Schreib-Endpoints für den Buchhaltungs-Bestand -----------
# HINWEIS: Es gibt bewusst KEINEN öffentlichen POST /number-sequences/next mehr.
# Das Ziehen einer fortlaufenden Nummer erhöht den GoBD-Zähler DAUERHAFT — würde
# der Endpunkt zur bloßen Anzeige der „nächsten Nummer" aufgerufen (oder danach
# abgebrochen), verbrennt jeder Aufruf eine RE-Nummer, ohne dass je ein Beleg mit
# dieser Nummer existiert → nicht erklärbare Lücke im Nummernkreis (GoBD-Lückenlos-
# heit verletzt). Die echte Nummer wird AUSSCHLIESSLICH serverseitig beim Speichern
# des Belegs gezogen (create_invoice_from_bestand); für die reine Anzeige der
# nächsten Nummer dient der nicht-inkrementierende GET /number-sequences/{company_id}
# (next_number_preview).


@router.patch("/companies/{company_id}")
async def update_company_profile(
    company_id: str, request: Request, service: BuchhaltungServiceDep, ctx: _profile_write
) -> dict:
    """Firmen-/Rechnungsprofil speichern (tenant_billing_profile)."""
    payload = await request.json()
    try:
        return service.update_company_profile(ctx, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/companies/{company_id}/stripe-sync")
def resync_stripe_profile(
    company_id: str, ctx: _profile_write, service: BuchhaltungServiceDep
) -> dict:
    """Die GESPEICHERTEN Stammdaten erneut an den Connected Account übertragen.

    Bisher lief der Stripe-Sync AUSSCHLIESSLICH beim Speichern des Stammdaten-
    Formulars. Scheiterte er dort (abgelehntes Feld, Stripe kurz weg), gab es aus
    der Zahlungen-Karte keinen Weg zurück: die Angaben standen im Profil, bei
    Stripe fehlten sie, und die UI verlangte Felder, die längst ausgefüllt waren.
    Dieser Endpunkt ist der Wiederanlauf — er ändert KEINE Daten, er sendet den
    vorhandenen Stand erneut."""
    try:
        return service.resync_stripe_profile(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/companies/{company_id}/logo")
async def upload_company_logo(
    company_id: str,
    request: Request,
    service: BuchhaltungServiceDep,
    ctx: _profile_write,
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
def list_inline_services(ctx: _read) -> list[dict]:
    """Inline-Services lesen (Stub → leer)."""
    return []


@router.get("/text-templates/{company_id}")
def list_text_templates(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Textbausteine (Stub → leer; verhindert den 404-Render-Loop)."""
    try:
        return service.list_text_templates(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/text-templates/{company_id}/default")
def get_default_text_template(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> dict | None:
    """Standard-Textbaustein (Stub → null)."""
    return None


@router.get("/number-sequences")
def list_number_sequences(
    ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Nummernkreise des Tenants (nur lesen)."""
    try:
        return service.list_number_sequences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/number-sequences/{company_id}")
def list_number_sequences_for_company(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
) -> list[dict]:
    """Nummernkreise eines Unternehmens als Array (Bestands-Pfad)."""
    try:
        return service.list_number_sequences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoices/next-number/{company_id}")
def get_next_invoice_number(
    company_id: str, ctx: _read, service: BuchhaltungServiceDep
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
async def update_user_preferences(
    user_id: str, request: Request, ctx: _profile_write
) -> dict:
    """Nutzer-Präferenzen speichern (Stub → bestätigt, persistiert noch nicht)."""
    return {"ok": True}


@router.post("/text-templates/{company_id}/initialize")
async def initialize_text_templates(company_id: str, request: Request, ctx: _write) -> dict:
    """Standard-Textbausteine initialisieren (Stub → No-Op)."""
    return {"ok": True}


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str, ctx: _read, service: BuchhaltungServiceDep
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
    ctx: _read, service: BuchhaltungServiceDep
) -> QuoteListResponse:
    try:
        return service.list_quotes(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: str, ctx: _read, service: BuchhaltungServiceDep
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
