"""Router für buchhaltung. Gemountet unter /api/v1/buchhaltung.

Rechnungen + Kunden, tenant-scoped (tenant_id aus dem JWT). Schreibende
Endpoints erfordern die Berechtigung OWNER_REPORTING (Buchhaltung).
"""

from typing import Annotated

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    Request,
    status,
)

from src.core.security import CurrentUser
from src.core.uploads import read_upload

from .angebote_bestand import AngeboteBestand
from .bereiche.versand.dependencies import VersandServiceDep
from .bereiche.versand.schemas import TextTemplateResponse
from .bereiche.versand.service import VersandServiceError
from .bereiche.versand.standardvorlagen import standardvorlagen_anlegen
from .dependencies import BuchhaltungServiceDep
from .guards import _profile_read, _profile_write, _read, _write
from .preisliste import preisliste as _preisliste
from .schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    InvoiceListResponse,
    InvoiceResponse,
    QuoteListResponse,
    SliceHealth,
)
from .service import BuchhaltungError, BuchhaltungService

router = APIRouter(prefix="/buchhaltung", tags=["buchhaltung"])


@router.get("/health", response_model=SliceHealth)
def health(service: BuchhaltungServiceDep) -> SliceHealth:
    return service.health()


# --- Kunden -----------------------------------------------------------------
# Die Query-Parameter der Kundensuche. Als Annotated-Alias, weil drei Routen
# dieselben Filter annehmen — der Bestand ruft sie unter drei Pfaden auf
# (`/customers`, `/customers/company/{id}`, historisch `/finance/customers`).
_Suche = Annotated[str | None, Query(max_length=200)]
_Limit = Annotated[int | None, Query(ge=1, le=200)]


@router.get("/customers")
def list_customers(
    ctx: _read,
    service: BuchhaltungServiceDep,
    search: _Suche = None,
    name: _Suche = None,
    email: _Suche = None,
    is_supplier: Annotated[bool | None, Query(alias="isSupplier")] = None,
    limit: _Limit = None,
) -> list[dict]:
    """Kunden/Lieferanten als Array, serverseitig gefiltert.

    Ohne Parameter alle Kunden des Tenants (wie bisher). `company_id` aus der
    Abfrage wird bewusst ignoriert — autoritativ ist der Tenant aus dem JWT.
    """
    try:
        return service.search_customers(
            ctx,
            search=search,
            name=name,
            email=email,
            is_supplier=is_supplier,
            limit=limit,
        )
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/customers/company/{company_id}")
def list_customers_for_company(
    company_id: str,
    ctx: _read,
    service: BuchhaltungServiceDep,
    is_supplier: Annotated[bool | None, Query(alias="isSupplier")] = None,
) -> list[dict]:
    """Kunden eines Unternehmens als Array (Bestands-Pfad).

    `?isSupplier=true` wurde bis zum 11.09.2026 stillschweigend ignoriert —
    die Lieferantenliste zeigte damit alle Kunden.
    """
    try:
        return service.search_customers(ctx, is_supplier=is_supplier)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/customers/next-number/{company_id}")
def get_next_customer_number(company_id: str, ctx: _read, service: BuchhaltungServiceDep) -> dict:
    """Nächste Kundennummer nur ANZEIGEN — vergeben wird beim Anlegen."""
    try:
        return service.next_customer_number_preview(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/customers/{customer_id}")
def get_customer(customer_id: str, ctx: _read, service: BuchhaltungServiceDep) -> dict:
    """EIN Kunde. Fehlte bis zum 11.09.2026 — der Bestand rief die Route an
    drei Stellen auf (Vorbelegung aus der Kontakte-Seite, `customerService`)
    und bekam 405, weil nur PATCH/DELETE existierten."""
    try:
        return service.get_customer(ctx, customer_id)
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


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: str, service: BuchhaltungServiceDep, ctx: _write) -> None:
    try:
        service.delete_customer(ctx, customer_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Rechnungen -------------------------------------------------------------
@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices(ctx: _read, service: BuchhaltungServiceDep) -> InvoiceListResponse:
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
        return service.create_storno_invoice(ctx, invoice_id, str(payload.get("reason") or ""))
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
        return service.upload_logo(ctx, content, content_type or "application/octet-stream")
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/inline-invoice-services")
async def create_inline_service(request: Request, ctx: _write) -> dict:
    """Inline-Service (Service-Usage-Tracking) — vorerst No-Op-Bestätigung,
    da Analytics ein eigenes Modul ist. Verhindert 404 beim Speichern."""
    return {"ok": True}


@router.get("/inline-invoice-services")
def list_inline_services(ctx: _read) -> list[dict]:
    """Inline-Services lesen (Stub → leer)."""
    return []


@router.get("/text-templates/{company_id}", response_model=list[TextTemplateResponse])
def list_text_templates(
    company_id: str,  # noqa: ARG001 — Bestands-Pfad; autoritativ ist der Tenant
    ctx: _read,
    versand: VersandServiceDep,
    category: str | None = None,
    object_type: Annotated[str | None, Query(alias="objectType")] = None,
    text_type: Annotated[str | None, Query(alias="textType")] = None,
    language: str | None = None,
) -> list[TextTemplateResponse]:
    """Textvorlagen des Betriebs (Kopf-/Fußtexte). Bis zum 14.09.2026 ein Stub,
    der IMMER eine leere Liste gab — das Vorlagen-Menü des Editors blieb leer,
    egal was in `text_templates` stand."""
    try:
        return versand.list_text_templates(
            ctx, category=category, object_type=object_type, text_type=text_type, language=language
        )
    except VersandServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/text-templates/{company_id}/default", response_model=TextTemplateResponse | None)
def get_default_text_template(
    company_id: str,  # noqa: ARG001 — Bestands-Pfad
    ctx: _read,
    versand: VersandServiceDep,
    category: str = "DOCUMENT",
    object_type: Annotated[str, Query(alias="objectType")] = "INVOICE",
    text_type: Annotated[str, Query(alias="textType")] = "HEAD",
    language: str | None = None,
) -> TextTemplateResponse | None:
    """Standardvorlage einer Art — sprachspezifisch vor sprachneutral."""
    try:
        return versand.default_text_template(
            ctx, category=category, object_type=object_type, text_type=text_type, language=language
        )
    except VersandServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/number-sequences")
def list_number_sequences(ctx: _read, service: BuchhaltungServiceDep) -> list[dict]:
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
def get_next_invoice_number(company_id: str, ctx: _read, service: BuchhaltungServiceDep) -> dict:
    """Nächste Rechnungsnummer nur ANZEIGEN (ohne Zähler zu erhöhen)."""
    try:
        return service.next_number_preview(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/users/{user_id}/preferences")
def get_user_preferences(user_id: str, ctx: CurrentUser, service: BuchhaltungServiceDep) -> dict:
    """Nutzer-Präferenzen (Stub → leeres Objekt)."""
    try:
        return service.get_user_preferences(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/users/{user_id}/preferences")
async def update_user_preferences(user_id: str, request: Request, ctx: _profile_write) -> dict:
    """Nutzer-Präferenzen speichern (Stub → bestätigt, persistiert noch nicht)."""
    return {"ok": True}


@router.post("/text-templates/{company_id}/initialize")
def initialize_text_templates(
    company_id: str,  # noqa: ARG001 — Bestands-Pfad
    ctx: _write,
    versand: VersandServiceDep,
) -> dict:
    """Standard-Textvorlagen anlegen, falls der Betrieb noch keine hat
    (Kopf-/Fußtext für Angebot und Rechnung in der Betriebssprache)."""
    try:
        return {"ok": True, "angelegt": standardvorlagen_anlegen(versand, ctx)}
    except VersandServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: str, ctx: _read, service: BuchhaltungServiceDep) -> InvoiceResponse:
    try:
        return service.get_invoice(ctx, invoice_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(request: Request, service: BuchhaltungServiceDep, ctx: _write) -> dict:
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
def delete_invoice(invoice_id: str, service: BuchhaltungServiceDep, ctx: _write) -> None:
    try:
        service.delete_invoice(ctx, invoice_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Preisliste (Artikelstamm + Zusatzleistungen der Objekte, 0698) --------
@router.get("/preisliste")
def get_preisliste(
    ctx: _read,
    service: BuchhaltungServiceDep,
    property_id: Annotated[str | None, Query(alias="propertyId", max_length=64)] = None,
    language: Annotated[str | None, Query(max_length=8)] = None,
) -> dict:
    """„Aus Preisliste“ im Beleg-Editor, aufgebaut wie Hostaways „Prices &
    Fees“: je Objekt Gebühren, Zusatzleistungen und Abgaben (Kurtaxe), dazu der
    Artikelstamm des Betriebs. `propertyId` wählt das Objekt; ohne Angabe
    kommen die Einträge aller Objekte."""
    if not ctx.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Kein Mandant.")
    return _preisliste(
        service._db,  # noqa: SLF001  # pylint: disable=protected-access
        ctx.tenant_id,
        property_id=property_id,
        sprache=(language or "de")[:2].lower(),
    )


# --- Angebote ---------------------------------------------------------------
# Zwei Formen, ein Schreibpfad: die Bestands-Routen (`/quotes/company/{id}`,
# camelCase-PATCH, `convert-to-invoice`) laufen über `angebote_bestand`, das
# auf `service.create_quote`/`convert_quote_to_invoice` abbildet. Die
# snake_case-Pydantic-Routen bleiben für Server-Actions/Tests bestehen.
def _angebote(service: BuchhaltungService) -> AngeboteBestand:
    return AngeboteBestand(service)


@router.get("/quotes", response_model=QuoteListResponse)
def list_quotes(ctx: _read, service: BuchhaltungServiceDep) -> QuoteListResponse:
    try:
        return service.list_quotes(ctx)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes/company/{company_id}")
def list_quotes_bestand(
    company_id: str,
    ctx: _read,
    service: BuchhaltungServiceDep,
    status_: Annotated[str | None, Query(alias="status", max_length=20)] = None,
) -> list[dict]:
    """Angebote in der Form des Bestands (`quoteService.getQuotes`). `company_id`
    aus dem Pfad wird ignoriert — autoritativ ist der Tenant aus dem JWT."""
    try:
        return _angebote(service).liste(ctx, status_)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes/next-number/{company_id}")
def get_next_quote_number(company_id: str, ctx: _read, service: BuchhaltungServiceDep) -> dict:
    """Nächste Angebotsnummer nur ANZEIGEN (ohne Zähler zu erhöhen)."""
    try:
        return service.next_number_preview(ctx, "Angebot")
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes/{quote_id}")
def get_quote(quote_id: str, ctx: _read, service: BuchhaltungServiceDep) -> dict:
    """Ein Angebot in Bestandsform (Positionen, Kunde, Cents, Zeitstempel,
    Vorlagen-Einstellungen) — gelesen von Detailansicht, Vorschau und Versand."""
    try:
        return _angebote(service).einzeln(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quotes", status_code=status.HTTP_201_CREATED)
async def create_quote(request: Request, service: BuchhaltungServiceDep, ctx: _write) -> dict:
    """Angebot anlegen — aus dem Cent-Payload von `quoteService.createQuote`
    ODER dem camelCase-Payload des Editors. Beträge, Nummer und §19 rechnet
    der Server (`service.create_quote`)."""
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Objekt erwartet.")
    try:
        return _angebote(service).anlegen(ctx, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/quotes/{quote_id}")
async def update_quote(
    quote_id: str, request: Request, service: BuchhaltungServiceDep, ctx: _write
) -> dict:
    """Angebot ändern (Bestandsform: Status + Zeitstempel, Texte, Tags,
    Vorlage, optional Positionen)."""
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Objekt erwartet.")
    try:
        return _angebote(service).aendern(ctx, quote_id, payload)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(quote_id: str, service: BuchhaltungServiceDep, ctx: _write) -> None:
    try:
        service.delete_quote(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quotes/{quote_id}/convert", response_model=InvoiceResponse)
def convert_quote(quote_id: str, service: BuchhaltungServiceDep, ctx: _write) -> InvoiceResponse:
    """Angebot in eine Rechnung umwandeln."""
    try:
        return service.convert_quote_to_invoice(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quotes/{quote_id}/convert-to-invoice")
def convert_quote_bestand(
    quote_id: str, service: BuchhaltungServiceDep, ctx: _write
) -> dict:
    """Alias des Bestands (`quoteService.convertToInvoice`): liefert
    `invoice_id` neben der vollen Rechnung."""
    try:
        invoice = service.convert_quote_to_invoice(ctx, quote_id)
    except BuchhaltungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"invoice_id": invoice.id, "invoice": invoice.model_dump(mode="json")}


# Die Bereiche (Ausgaben, Mahnwesen, Zahlungen …) hängen sich hier ein — die
# Liste steht in `bereiche/__init__.py`, damit dreizehn parallel entstehende
# Bereiche nicht dieselbe Import-Zeile umkämpfen.
from .bereiche import BEREICHS_ROUTER  # noqa: E402  pylint: disable=wrong-import-position

for _bereich in BEREICHS_ROUTER:
    router.include_router(_bereich)
