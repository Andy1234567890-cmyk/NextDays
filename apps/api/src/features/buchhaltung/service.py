"""Service-Schicht für buchhaltung (Rechnungen + Kunden).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input. Gleiches Muster wie
properties/auth.account_service (PROJECT.md §2 — Business-Logik im Backend).

Beträge werden serverseitig aus den Positionen berechnet (Decimal,
ROUND_HALF_UP, 2 Nachkommastellen) — der Client kann sie nicht fälschen.
"""
# Bewusst gebündelter Service (Rechnungen + Kunden + Angebote + Firmenprofil/Logo)
# knapp über der 1300-Zeilen-Warnschwelle. Eine Aufspaltung ist als eigener
# Refactor geplant, nicht in einer Bugfix-Änderung — daher hier explizit erlaubt.
# pylint: disable=too-many-lines
import secrets
from decimal import ROUND_HALF_UP, Decimal

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    CustomerCreate,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdate,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUpdate,
    LineItemInput,
    QuoteCreate,
    QuoteListResponse,
    QuoteResponse,
    QuoteUpdate,
    SliceHealth,
)

log = get_logger("nextdays.buchhaltung")

_CENT = Decimal("0.01")


def _q(value: Decimal) -> Decimal:
    """Auf 2 Nachkommastellen runden (kaufmännisch)."""
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def _num(value: object) -> float:
    """DB-Numeric/None robust in float wandeln (für InvoiceData-Beträge)."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _row_to_invoicedata(row: dict, customer_name: str | None) -> dict:
    """Eine DB-Rechnung (Migration 0023) auf die `InvoiceData`-Form mappen,
    die das übernommene Buchhaltungs-Frontend (InvoiceListView) erwartet.
    Feldnamen folgen 1:1 dem Bestands-Typ (types/invoiceTypes.ts)."""
    number = row.get("invoice_number") or ""
    return {
        "id": row.get("id"),
        "number": number,
        "invoiceNumber": number,
        "sequentialNumber": row.get("invoice_sequence") or 0,
        "date": row.get("issue_date"),
        "issueDate": row.get("issue_date"),
        "dueDate": row.get("due_date"),
        "customerName": customer_name or "",
        "customerEmail": "",
        "customerAddress": "",
        "description": row.get("notes") or "",
        "status": row.get("status") or "draft",
        "isStorno": (row.get("invoice_type") == "storno")
        or bool(row.get("original_invoice_id")),
        "originalInvoiceId": row.get("original_invoice_id"),
        "stornoReason": row.get("storno_reason"),
        "isSmallBusiness": bool(row.get("is_kleinunternehmer")),
        "vatRate": _num(row.get("tax_rate")),
        "priceInput": "netto",
        "taxRuleType": row.get("tax_rule") or "DE_TAXABLE",
        "items": [],
        "amount": _num(row.get("net_amount")),
        "tax": _num(row.get("tax_amount")),
        "total": _num(row.get("gross_amount")),
        "createdAt": row.get("created_at"),
        "year": row.get("invoice_year") or 0,
        "companyId": row.get("tenant_id"),
        "currency": row.get("currency") or "EUR",
        "notes": row.get("notes"),
        "footerText": row.get("footer_text"),
        # Buchungs-Brücke (0092): gesetzt bei Zimmerrechnungen aus Buchungen.
        "reservationId": row.get("reservation_id"),
    }


def _normalize_document_language(value: object) -> str | None:
    """Roh-Sprachcode aus dem Formular-Payload auf eine unterstützte
    Dokumentsprache normalisieren (doc_i18n): None bleibt None (→ de bei der
    Anzeige), alles andere wird ein gültiger Code (unbekannt → de)."""
    if value is None or str(value).strip() == "":
        return None
    from . import doc_i18n  # noqa: PLC0415 — lokaler Import vermeidet Zyklus

    return doc_i18n.resolve_language(value)


class BuchhaltungError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BuchhaltungService:
    slice_name = "buchhaltung"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BuchhaltungError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # ---------------------------------------------------------------- Kunden
    def _customers_rows(self, ctx: AuthContext) -> list[dict]:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("customers")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        return res.data or []

    def list_customers(self, ctx: AuthContext) -> CustomerListResponse:
        """{items,total}-Form (Nachbau-Server-Action lib/buchhaltung.ts)."""
        rows = self._customers_rows(ctx)
        items = [CustomerResponse(**row) for row in rows]
        return CustomerListResponse(items=items, total=len(items))

    def list_customers_array(self, ctx: AuthContext) -> list[dict]:
        """Reines Array (vom übernommenen Buchhaltungs-Bestand erwartet)."""
        return self._customers_rows(ctx)

    def create_customer(
        self, ctx: AuthContext, req: CustomerCreate
    ) -> CustomerResponse:
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        res = self._db.table("customers").insert(payload).execute()
        if not res.data:
            raise BuchhaltungError("Kunde konnte nicht angelegt werden.", status_code=500)
        return CustomerResponse(**res.data[0])

    def update_customer(
        self, ctx: AuthContext, customer_id: str, req: CustomerUpdate
    ) -> CustomerResponse:
        tenant_id = self._require_tenant(ctx)
        patch = req.model_dump(mode="json", exclude_unset=True)
        if not patch:
            raise BuchhaltungError("Keine Felder zum Aktualisieren.", status_code=400)
        res = (
            self._db.table("customers")
            .update(patch)
            .eq("id", customer_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Kunde nicht gefunden.", status_code=404)
        return CustomerResponse(**res.data[0])

    def delete_customer(self, ctx: AuthContext, customer_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        # Soft-Delete (Buchhaltung: nichts hart löschen).
        res = (
            self._db.table("customers")
            .update({"deleted_at": "now()"})
            .eq("id", customer_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Kunde nicht gefunden.", status_code=404)

    # ------------------------------------------------------------- Rechnungen
    def list_invoices(self, ctx: AuthContext) -> InvoiceListResponse:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, customer_id, invoice_type, status, "
                "issue_date, due_date, gross_amount, currency, is_locked, created_at"
            )
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .execute()
        )
        data = res.data or []
        from .schemas import InvoiceListItem

        items = [InvoiceListItem(**row) for row in data]
        return InvoiceListResponse(items=items, total=len(items))

    def list_invoices_as_invoicedata(self, ctx: AuthContext) -> list[dict]:
        """Rechnungen im `InvoiceData`-Format des Buchhaltungs-Frontends liefern.

        Mappt die GoBD-Tabelle (Migration 0023) auf die Felder, die die
        übernommene InvoiceListView rendert (status, number, total, datum,
        customerName, isStorno …). Kundennamen werden per Tenant-Join aufgelöst.
        """
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []

        # Kundennamen einmalig für den Tenant laden (Join im Code, RLS-sicher).
        cust_res = (
            self._db.table("customers")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        names = {c["id"]: c.get("name") for c in (cust_res.data or [])}

        return [_row_to_invoicedata(r, names.get(r.get("customer_id"))) for r in rows]

    # --- Zimmerrechnungen aus Buchungen (Booking→Invoice-Brücke, 0092) --------
    def billable_reservations(self, ctx: AuthContext, query: str = "") -> list[dict]:
        """Abrechenbare Buchungen fürs Erstellformular: eingecheckt, nicht
        storniert, noch ohne aktive Rechnung. Gastnamen/Beträge maskierungs-
        konform (GuestMask). Suche über Gastname/Objekttitel."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("reservations")
            .select(
                "id, property_id, check_in, check_out, currency, total_amount, "
                "checked_in_at, guests(name), properties(title)"
            )
            .eq("tenant_id", tenant_id)
            .neq("status", "cancelled")
            .not_.is_("checked_in_at", "null")
            # Ausgecheckte haben per Definition eine Rechnung (Check-out-
            # Pflicht) — sie hier auszuschließen hält die Liste dauerhaft
            # klein, statt dass alte abgerechnete Aufenthalte das Limit füllen.
            .is_("checked_out_at", "null")
            .order("checked_in_at", desc=True)
            .limit(100)
            .execute()
        ).data or []
        if not rows:
            return []

        billed = {
            r["reservation_id"]
            for r in (
                self._db.table("invoices")
                .select("reservation_id")
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", [r["id"] for r in rows])
                .eq("invoice_type", "invoice")
                .neq("status", "cancelled")
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
        }

        from src.features.auth.guest_masking import load_guest_mask  # noqa: PLC0415

        mask = load_guest_mask(self._db, ctx.user_id)
        needle = (query or "").strip().lower()
        out: list[dict] = []
        for r in rows:
            if r["id"] in billed:
                continue
            guest = r.get("guests") or {}
            guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
            prop = r.get("properties") or {}
            title = prop.get("title", "") if isinstance(prop, dict) else ""
            if needle and needle not in f"{guest_name} {title}".lower():
                continue
            out.append(
                {
                    "id": r["id"],
                    "guestName": mask.name(guest_name) or "",
                    "propertyTitle": title,
                    "checkIn": r.get("check_in"),
                    "checkOut": r.get("check_out"),
                    "checkedInAt": r.get("checked_in_at"),
                    "currency": (r.get("currency") or "") if mask.amounts else "",
                    "totalAmount": mask.amount(_num(r.get("total_amount"))),
                }
            )
        return out

    def invoice_preview(self, ctx: AuthContext, reservation_id: str) -> dict:
        """Vorbefüllung „Rechnung aus Buchung" — dieselbe Positions-Logik wie
        der Check-out (reservation_invoice, eine Quelle der Wahrheit)."""
        tenant_id = self._require_tenant(ctx)
        # Lazy: reservation_invoice importiert BuchhaltungError aus DIESEM Modul.
        from . import reservation_invoice  # noqa: PLC0415

        return reservation_invoice.preview_for_reservation(
            self._db, tenant_id, reservation_id
        )

    def create_storno_invoice(
        self, ctx: AuthContext, invoice_id: str, reason: str
    ) -> dict:
        """Stornorechnung (GoBD-Korrekturweg) — Logik in storno.py (Facade)."""
        tenant_id = self._require_tenant(ctx)
        # Lazy: storno importiert BuchhaltungError/_q/… aus DIESEM Modul.
        from . import storno  # noqa: PLC0415

        return storno.create_storno_invoice(self._db, tenant_id, invoice_id, reason)

    def check_vat_id(self, ctx: AuthContext, vat_id: str) -> dict:
        """USt-IdNr. gegen VIES prüfen — Logik in vat_check.py (Slice-Facade)."""
        self._require_tenant(ctx)
        # Lazy: vat_check importiert BuchhaltungError aus DIESEM Modul.
        from . import vat_check  # noqa: PLC0415

        return vat_check.check_vat_id(vat_id)

    def get_company_profile(self, ctx: AuthContext) -> dict:
        """Firmen-/Rechnungsprofil des Tenants (für das Buchhaltungs-Frontend).

        Liefert die Felder, die der Bestand für Auto-Detection/Rechnungskopf
        erwartet (companyName/name, vat_id, iban …). Quelle:
        tenant_billing_profile (Migration 0023). Fehlt das Profil, wird ein
        leeres Objekt mit der Tenant-Id zurückgegeben (kein Fehler)."""
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("tenant_billing_profile")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        p = (res.data or [{}])[0]
        name = p.get("legal_name") or ""

        # Geschäftstyp + Land aus dem Tenant (für Frontend-Steuerung).
        trow = (
            self._db.table("tenants")
            .select("business_type, country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        t = trow[0] if trow else {}

        def s(key: str) -> str:
            """None → '' (der Footer würde sonst Fallback-Werte ziehen)."""
            return p.get(key) or ""

        return {
            "id": tenant_id,
            "businessType": t.get("business_type") or "agency",
            "tenantCountry": t.get("country"),
            # Name / Header
            "companyName": name,
            "name": name,
            # Adresse
            "companyStreet": s("company_street"),
            "companyHouseNumber": s("company_house_number"),
            "companyPostalCode": s("company_postal_code"),
            "companyCity": s("company_city"),
            "companyCountry": s("company_country"),
            # Kontakt
            "email": s("email"),
            "phoneNumber": s("phone_number"),
            "website": s("website"),
            # Steuer / Register
            "vatId": s("vat_id"),
            "taxNumber": s("tax_number"),
            "companyRegister": s("company_register"),
            "districtCourt": s("district_court"),
            "legalForm": s("legal_form"),
            # Geschäftsführer
            "firstName": s("managing_director_first_name"),
            "lastName": s("managing_director_last_name"),
            # Bank
            "iban": s("iban"),
            "bic": s("bic"),
            "bankName": s("bank_name"),
            "accountHolder": s("account_holder"),
            # Logo
            "companyLogo": s("company_logo_url"),
            # Stripe-KYC: Kontotyp + Geburtsdatum (damit die Stammdaten-UI die
            # gespeicherten Werte wieder anzeigt).
            "accountType": s("account_type"),
            "ownerDob": s("owner_dob"),
            # Flags
            "isSmallBusiness": bool(p.get("is_kleinunternehmer")),
            "eInvoiceFormat": p.get("e_invoice_format"),
            "leitwegId": p.get("leitweg_id"),
            # USt-Satz Übernachtung (0092) — None = nicht konfiguriert (die
            # automatische Buchungsrechnung verlangt ihn, kein Default).
            "lodgingTaxRate": (
                _num(p.get("lodging_tax_rate"))
                if p.get("lodging_tax_rate") is not None
                else None
            ),
        }

    def list_transaction_links(self, ctx: AuthContext) -> list[dict]:
        """Verknüpfungen Beleg↔Banktransaktion. Noch nicht implementiert →
        leere Liste (der Bestand verträgt das, Bankabgleich folgt separat)."""
        self._require_tenant(ctx)
        return []

    def list_booking_accounts(self, ctx: AuthContext) -> list[dict]:
        """Buchungskonten (Kontenplan). Noch nicht implementiert → leere Liste
        (eigenständiges Modul Kontenplan folgt separat)."""
        self._require_tenant(ctx)
        return []

    def list_text_templates(self, ctx: AuthContext) -> list[dict]:
        """Textbausteine (Kopf-/Fußtexte). Eigenes Modul folgt → leere Liste.
        Verhindert den 404-Render-Loop der Erstellen-Seite."""
        self._require_tenant(ctx)
        return []

    def list_number_sequences(self, ctx: AuthContext) -> list[dict]:
        """Vorhandene Nummernkreise des Tenants (nur Lesen, ohne Hochzählen)."""
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("number_sequences")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return res.data or []

    def next_number_preview(self, ctx: AuthContext) -> dict:
        """Nächste Rechnungsnummer NUR ANZEIGEN (ohne den Zähler zu erhöhen)."""
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("number_sequences")
            .select("prefix, next_value, padding, suffix")
            .eq("tenant_id", tenant_id)
            .eq("doc_type", "invoice")
            .is_("year", "null")
            .limit(1)
            .execute()
        )
        row = (res.data or [{}])[0]
        prefix = row.get("prefix") or "RE-"
        nxt = row.get("next_value") or 1
        padding = row.get("padding") or 4
        suffix = row.get("suffix") or ""
        formatted = f"{prefix}{str(nxt).zfill(padding)}{suffix}"
        return {"formattedNumber": formatted, "sequentialNumber": nxt}

    def get_user_preferences(self, ctx: AuthContext) -> dict:
        """Nutzer-Präferenzen (Buchhaltung). Eigenes Modul folgt → leeres Objekt."""
        self._require_tenant(ctx)
        return {}

    # --- Nummernkreis + Rechnung speichern (Buchhaltungs-Bestand) ------------
    _DOC_TYPE_MAP = {
        "Rechnung": ("invoice", "RE-"),
        "Angebot": ("quote", "AN-"),
        "Gutschrift": ("credit_note", "GU-"),
        "Storno": ("storno", "ST-"),
    }

    def next_number(self, ctx: AuthContext, doc_type_label: str) -> dict:
        """Nächste fortlaufende Dokumentnummer atomar ziehen (GoBD-lückenlos).
        Nutzt die DB-Funktion next_document_number (Row-Lock)."""
        tenant_id = self._require_tenant(ctx)
        doc_type, prefix = self._DOC_TYPE_MAP.get(doc_type_label, ("invoice", "RE-"))
        res = self._db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": doc_type, "p_prefix": prefix},
        ).execute()
        row = (res.data or [{}])[0]
        seq = row.get("sequential_number") or 1
        formatted = row.get("formatted_number") or f"{prefix}{seq:04d}"
        return {
            "number": seq,
            "sequentialNumber": seq,
            "formattedNumber": formatted,
            "format": prefix + "####",
        }

    def _compute_totals(self, items: list[dict]) -> tuple[Decimal, Decimal, Decimal]:
        """Netto/Steuer/Brutto serverseitig aus den Positionen berechnen
        (Client-Werte werden NICHT vertraut, PROJECT.md §2).

        Rabatt-Positionen (category='discount', Gesamtrabatt des Formulars)
        werden im Client-State POSITIV gehalten und nur in der Anzeige negiert
        — hier MÜSSEN sie abgezogen werden, sonst weicht der gespeicherte
        GoBD-Beleg von der angezeigten/gedruckten Rechnung ab."""
        net_total = Decimal("0")
        tax_total = Decimal("0")
        for it in items:
            qty = Decimal(str(it.get("quantity") or 0))
            price = Decimal(str(it.get("unitPrice") or it.get("unit_price") or 0))
            disc = Decimal(str(it.get("discountPercent") or it.get("discount_percent") or 0))
            rate = Decimal(str(it.get("taxRate") or it.get("tax_rate") or 0))
            if it.get("category") == "discount":
                price = -abs(price)
            gross_unit = qty * price
            net = _q(gross_unit - gross_unit * (disc / Decimal(100)))
            net_total += net
            tax_total += _q(net * (rate / Decimal(100)))
        net_total = _q(net_total)
        tax_total = _q(tax_total)
        return net_total, tax_total, _q(net_total + tax_total)

    def create_invoice_from_bestand(self, ctx: AuthContext, payload: dict) -> dict:
        """Rechnung aus dem reichen camelCase-Payload des Buchhaltungs-Bestands
        anlegen. Mappt auf die GoBD-Tabelle (Migration 0023); Beträge werden
        serverseitig berechnet. Positionen landen in invoice_line_items."""
        tenant_id = self._require_tenant(ctx)
        items = payload.get("items") or []
        net_amount, tax_amount, gross_amount = self._compute_totals(items)

        # §19-Status AUTORITATIV aus tenant_billing_profile — NICHT aus dem
        # (fälschbaren/veralteten) Client-Flag. Dieser Pfad schreibt einen GoBD-
        # festgeschriebenen Beleg mit fortlaufender Nummer; ein falsches Client-Flag
        # (z. B. isSmallBusiness=false trotz Kleinunternehmer) erzeugte sonst eine
        # unlöschbare Rechnung mit fälschlich ausgewiesener USt.
        profile_klein = (
            self._db.table("tenant_billing_profile")
            .select("is_kleinunternehmer")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        is_klein = bool(profile_klein[0].get("is_kleinunternehmer")) if profile_klein else False
        status = payload.get("status") or "draft"

        # Client-übergebenen Debitor gegen den Tenant prüfen (kein fremder Kunde):
        # ohne diese Prüfung landete eine beliebige customer_id im Beleg. Der aus
        # der Buchung abgeleitete Debitor (unten) ist immer tenant-eigen und wird
        # nicht erneut geprüft.
        customer_id = payload.get("customerId") or payload.get("customer_id")
        if customer_id:
            cust_rows = (
                self._db.table("customers")
                .select("id")
                .eq("id", customer_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            if not cust_rows:
                raise BuchhaltungError("Kunde nicht gefunden.", status_code=404)

        # Buchungs-Brücke: „Rechnung aus Buchung" aus dem Formular. Regeln wie
        # beim Check-out: Buchung muss dem Tenant gehören, eingecheckt und
        # nicht storniert sein; nur EINE aktive Rechnung je Buchung (0092).
        # WICHTIG: die gesamte Validierung läuft VOR dem Ziehen der GoBD-Nummer —
        # scheitert sie, darf keine fortlaufende Nummer verbrannt sein (Lücke).
        reservation_id = payload.get("reservationId") or payload.get("reservation_id")
        if reservation_id:
            res_rows = (
                self._db.table("reservations")
                .select(
                    "id, status, checked_in_at, guest_id, guest_email, "
                    "guest_phone, guest_country"
                )
                .eq("id", reservation_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            if not res_rows:
                raise BuchhaltungError("Buchung nicht gefunden.", status_code=404)
            if res_rows[0].get("status") == "cancelled":
                raise BuchhaltungError(
                    "Stornierte Buchung kann nicht abgerechnet werden.",
                    status_code=409,
                )
            if not res_rows[0].get("checked_in_at"):
                raise BuchhaltungError(
                    "Der Gast ist noch nicht eingecheckt — Rechnungen aus "
                    "Buchungen sind erst nach dem Check-in möglich.",
                    status_code=409,
                )
            from . import reservation_invoice  # noqa: PLC0415 — Import-Zyklus

            existing = reservation_invoice.find_active_invoice(
                self._db, tenant_id, str(reservation_id)
            )
            if existing:
                raise BuchhaltungError(
                    f"Zu dieser Buchung existiert bereits Rechnung "
                    f"{existing.get('invoice_number')}.",
                    status_code=409,
                )
            # Gast→Debitor erst JETZT (Schreibpfad) anlegen/verknüpfen — die
            # Vorschau ist bewusst nebenwirkungsfrei. Gast ohne Namen blockiert
            # den manuellen Flow nicht (der Nutzer hat den Empfänger im
            # Formular ausgefüllt) — dann bleibt nur die FK-Verknüpfung leer.
            if not (payload.get("customerId") or payload.get("customer_id")):
                try:
                    guest_customer = reservation_invoice.ensure_customer_for_guest(
                        self._db, tenant_id, res_rows[0]
                    )
                    payload = {**payload, "customerId": guest_customer["id"]}
                except BuchhaltungError as exc:
                    log.warning(
                        "reservation_invoice_customer_link_skipped",
                        reservation_id=reservation_id,
                        reason=exc.message,
                    )

        # GoBD-Nummer NUR bei Finalisierung und NUR serverseitig atomar ziehen —
        # nie die (fälschbare/fabrizierte) Client-Nummer übernehmen. Entwürfe
        # bekommen KEINE Nummer (sonst reißt jeder verworfene Entwurf eine
        # dauerhafte Lücke in den fortlaufenden Nummernkreis). ERST HIER — nach
        # aller Validierung —, sodass eine gescheiterte Prüfung keine Nummer
        # verbrennt (sonst entstünde eine dauerhafte Lücke im Nummernkreis).
        invoice_number = None
        invoice_sequence = None
        if status != "draft":
            num = self.next_number(ctx, "Rechnung")
            invoice_number = num["formattedNumber"]
            invoice_sequence = num["sequentialNumber"]

        row = {
            "tenant_id": tenant_id,
            "customer_id": payload.get("customerId") or payload.get("customer_id"),
            "invoice_number": invoice_number,
            "invoice_sequence": invoice_sequence,
            "invoice_year": payload.get("year"),
            # Dieser Pfad erzeugt IMMER eine reguläre Rechnung. Ein Storno entsteht
            # NUR über create_storno_invoice (Negation, original_invoice_id,
            # invoices_storno_per_original_uidx, Original→cancelled). Ein Client-
            # Flag isStorno darf hier keinen Storno-Beleg mit POSITIVEN Beträgen
            # und ohne Original-Verweis fabrizieren (GoBD-Widerspruch + Aushebeln
            # der „eine aktive Rechnung je Buchung"-Invariante).
            "invoice_type": "invoice",
            "status": status,
            "issue_date": payload.get("issueDate") or payload.get("date"),
            "due_date": payload.get("dueDate"),
            "currency": payload.get("currency") or "EUR",
            "net_amount": str(net_amount),
            "tax_amount": str(Decimal("0") if is_klein else tax_amount),
            "gross_amount": str(net_amount if is_klein else gross_amount),
            # Kleinunternehmer (§19): der Beleg weist KEINE USt aus — der Kopf-Satz
            # MUSS 0 sein (sonst tax_rate=19 bei tax_amount=0 → §19-Inkonsistenz,
            # und die PDF-Templates nutzen data.vatRate als Positions-Fallback).
            "tax_rate": (
                Decimal("0") if is_klein
                else (payload.get("vatRate") or payload.get("taxRate"))
            ),
            "tax_rule": payload.get("taxRule") or payload.get("taxRuleType") or "DE_TAXABLE",
            "is_kleinunternehmer": is_klein,
            "head_text": payload.get("headTextHtml") or payload.get("description"),
            "footer_text": payload.get("footerText"),
            "notes": payload.get("notes"),
            "e_invoice_format": (
                payload.get("eInvoiceType") if payload.get("isEInvoice") else None
            ),
            "reservation_id": reservation_id,
            # Dokumentsprache (0099): auf eine unterstützte Sprache normalisieren
            # (de-AT→de, unbekannt→de), damit kein ungültiger Code in die Spalte
            # gelangt und die PDF-Sprachvorbelegung steuert.
            "language": _normalize_document_language(payload.get("language")),
        }
        row = {k: v for k, v in row.items() if v is not None}

        try:
            res = self._db.table("invoices").insert(row).execute()
        except APIError as exc:
            msg = str(exc)
            # Unique-Index invoices_reservation_active_uq (0092): parallel wurde
            # bereits eine aktive Rechnung zu dieser Buchung erzeugt.
            if reservation_id and "invoices_reservation_active_uq" in msg:
                raise BuchhaltungError(
                    "Zu dieser Buchung existiert bereits eine Rechnung.",
                    status_code=409,
                ) from exc
            # GoBD-Backstop invoices_tenant_number_uidx (0105): zwei aktive Belege
            # desselben Tenants mit identischer Nummer → fachlicher 409 statt
            # eines rohen 500 mit DB-Detailtext.
            if "invoices_tenant_number_uidx" in msg:
                raise BuchhaltungError(
                    "Diese Rechnungsnummer ist bereits vergeben.",
                    status_code=409,
                ) from exc
            raise
        if not res.data:
            raise BuchhaltungError("Rechnung konnte nicht gespeichert werden.", status_code=500)
        invoice_id = res.data[0]["id"]

        # Positionen speichern. Rabatt-Positionen negativ persistieren (siehe
        # _compute_totals) — sonst verliert der Beleg das Vorzeichen und ein
        # Storno würde den Rabatt als Zuschlag negieren.
        line_rows = []
        for pos, it in enumerate(items, start=1):
            # BEIDE Schreibweisen tolerieren (wie _compute_totals): sonst berechnet
            # der Kopf bei snake_case-Payload korrekte Beträge, während jede Position
            # auf 0 fiele → Σ Positionen ≠ Kopf (GoBD-Widerspruch, unlöschbar).
            qty = Decimal(str(it.get("quantity") or 0))
            price = Decimal(str(it.get("unitPrice") or it.get("unit_price") or 0))
            disc = Decimal(
                str(it.get("discountPercent") or it.get("discount_percent") or 0)
            )
            # Kleinunternehmer (§19 UStG): der Beleg weist KEINE USt aus. Der
            # Kopf steht bereits auf tax_amount=0/gross=net — die Positionen
            # MÜSSEN dazu passen (sonst Σ Positionen ≠ Kopf, GoBD-widersprüchlich,
            # und ein späterer Storno erfände eine Steuerzeile). Satz je Position
            # daher auf 0 zwingen, egal was das Formular schickt.
            rate = (
                Decimal("0") if is_klein
                else Decimal(str(it.get("taxRate") or it.get("tax_rate") or 0))
            )
            if it.get("category") == "discount":
                price = -abs(price)
            gross_unit = qty * price
            net = _q(gross_unit - gross_unit * (disc / Decimal(100)))
            tax = _q(net * (rate / Decimal(100)))
            line_rows.append({
                "invoice_id": invoice_id,
                "position": pos,
                "description": it.get("description") or "",
                "quantity": str(qty),
                "unit": it.get("unit") or "Stk",
                "unit_price": str(price),
                "tax_rate": str(rate),
                "discount_percent": str(disc),
                "net_amount": str(net),
                "tax_amount": str(tax),
                "gross_amount": str(_q(net + tax)),
            })
        if line_rows:
            try:
                self._db.table("invoice_line_items").insert(line_rows).execute()
            except APIError as exc:
                # Kopf ist schon geschrieben — schlägt der Positions-Insert fehl,
                # bliebe eine Rechnung mit Summen aber ohne Positionen zurück
                # (Kopf ≠ Σ Positionen, GoBD-widersprüchlich). Kopf zurückrollen
                # (hard delete des gerade angelegten Belegs) und sauber melden.
                self._db.table("invoices").delete().eq("id", invoice_id).eq(
                    "tenant_id", tenant_id
                ).execute()
                raise BuchhaltungError(
                    "Rechnungspositionen konnten nicht gespeichert werden.",
                    status_code=500,
                ) from exc

        return {"id": invoice_id, "invoice_number": invoice_number}

    def update_invoice_raw(self, ctx: AuthContext, invoice_id: str, payload: dict) -> dict:
        """Rechnung aktualisieren (z.B. E-Rechnung-XML nachtragen). Nur ein paar
        unkritische Felder; gesperrte (GoBD) Rechnungen sind tabu."""
        tenant_id = self._require_tenant(ctx)
        existing = (
            self._db.table("invoices")
            .select("is_locked, status, invoice_number")
            .eq("id", invoice_id).eq("tenant_id", tenant_id).limit(1).execute()
        )
        if not existing.data:
            raise BuchhaltungError("Rechnung nicht gefunden.", status_code=404)
        row = existing.data[0]
        # Festgeschrieben = is_locked ODER Status ≠ draft ODER Nummer vergeben
        # (is_locked allein reicht als Gate NICHT — wird nie gesetzt).
        is_finalized = (
            bool(row.get("is_locked"))
            or row.get("status") not in self._MUTABLE_INVOICE_STATUSES
            or bool(row.get("invoice_number"))
        )
        allowed = {
            "status": payload.get("status"),
            "e_invoice_xml": payload.get("eInvoiceXml") or payload.get("e_invoice_xml"),
            "e_invoice_format": payload.get("eInvoiceType") or payload.get("e_invoice_format"),
            "pdf_url": payload.get("pdfUrl") or payload.get("pdf_url"),
            "notes": payload.get("notes"),
        }
        allowed = {k: v for k, v in allowed.items() if v is not None}
        # Ein Entwurf (ohne Nummer) darf über diesen Roh-Endpunkt NICHT auf einen
        # ausgestellten Status (finalized/paid/sent) gehoben werden: dabei würde
        # KEINE fortlaufende GoBD-Nummer gezogen → ein festgeschriebener Beleg ohne
        # Rechnungsnummer (Lückenlosigkeit verletzt) und wegen des Status-Gates
        # danach unrettbar (nicht mehr editier-/löschbar). Finalisierung mit
        # Nummernzug läuft ausschließlich über den regulären Erstell-/Finalisierungs-
        # pfad (create_invoice_from_bestand mit status!=draft).
        new_status = allowed.get("status")
        if (
            not is_finalized
            and not row.get("invoice_number")
            and new_status is not None
            and new_status not in self._MUTABLE_INVOICE_STATUSES
        ):
            raise BuchhaltungError(
                "Ein Entwurf ohne Rechnungsnummer kann hier nicht ausgestellt "
                "werden — bitte über die reguläre Rechnungserstellung finalisieren.",
                status_code=409,
            )
        if is_finalized:
            # An festgeschriebenen Belegen nur technische Anlagen nachtragbar
            # (E-Rechnungs-XML/-Format, PDF-URL); Status/Notizen/Inhalt sind tabu.
            forbidden = set(allowed) - {"e_invoice_xml", "e_invoice_format", "pdf_url"}
            if forbidden:
                raise BuchhaltungError(
                    "Festgeschriebene Rechnung: nur E-Rechnungs-Anlagen "
                    "nachtragbar, keine inhaltlichen Änderungen.",
                    status_code=409,
                )
        if allowed:
            self._db.table("invoices").update(allowed).eq("id", invoice_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return {"id": invoice_id}

    def update_company_profile(self, ctx: AuthContext, payload: dict) -> dict:
        """Firmen-/Rechnungsprofil (tenant_billing_profile) anlegen/aktualisieren.
        Speichert die Angaben, die die GoBD-Warnung der Erstellen-Seite verlangt."""
        tenant_id = self._require_tenant(ctx)
        g = payload.get
        row = {
            "tenant_id": tenant_id,
            "legal_name": g("companyName") or g("name") or g("legal_name"),
            # Adresse
            "company_street": g("companyStreet") or g("company_street"),
            "company_house_number": g("companyHouseNumber") or g("company_house_number"),
            "company_postal_code": g("companyPostalCode") or g("zip") or g("company_postal_code"),
            "company_city": g("companyCity") or g("city") or g("company_city"),
            "company_country": g("companyCountry") or g("country") or g("company_country"),
            # Kontakt
            "email": g("email"),
            "phone_number": g("phoneNumber") or g("phone") or g("phone_number"),
            "website": g("website") or g("companyWebsite"),
            # Steuer / Register
            "tax_number": g("taxNumber") or g("tax_number"),
            "vat_id": g("vatId") or g("vatNumber") or g("vat_id"),
            "company_register": g("companyRegister") or g("company_register"),
            "district_court": g("districtCourt") or g("district_court"),
            "legal_form": g("legalForm") or g("legal_form"),
            # Geschäftsführer
            "managing_director_first_name": g("firstName") or g("managing_director_first_name"),
            "managing_director_last_name": g("lastName") or g("managing_director_last_name"),
            # Bank
            "iban": g("iban"),
            "bic": g("bic"),
            "bank_name": g("bankName") or g("bank_name"),
            "account_holder": g("accountHolder") or g("account_holder"),
            # Stripe-KYC: Kontotyp + Geburtsdatum (für charges_enabled nötig)
            "account_type": g("accountType") or g("account_type"),
            "owner_dob": g("ownerDob") or g("owner_dob"),
            # Logo
            "company_logo_url": g("companyLogo") or g("company_logo_url"),
            # Flags
            "is_kleinunternehmer": g("isSmallBusiness"),
            "e_invoice_format": g("eInvoiceFormat") or g("e_invoice_format"),
            "leitweg_id": g("leitwegId") or g("leitweg_id"),
            # USt-Satz Übernachtung (0092)
            "lodging_tax_rate": g("lodgingTaxRate"),
        }
        row = {k: v for k, v in row.items() if v is not None}
        row["tenant_id"] = tenant_id
        self._db.table("tenant_billing_profile").upsert(
            row, on_conflict="tenant_id"
        ).execute()
        # Plattform-Pflicht: ein Objektbesitzer braucht zum Auszahlen einen Stripe
        # Connected Account. Er entsteht automatisch aus den gerade erfassten
        # Firmendaten (Onboarding), nicht durch einen separaten manuellen Schritt.
        self._ensure_connect_account(tenant_id, row)
        return self.get_company_profile(ctx)

    def _ensure_connect_account(self, tenant_id: str, profile: dict) -> None:
        """Legt — falls noch nicht vorhanden — automatisch einen Stripe Custom
        Connected Account für den Tenant an und überträgt die erfassten Firmen-/
        Bankdaten. Idempotent (kein Doppel-Anlegen). Stripe-Fehler dürfen das
        Speichern des Firmenprofils NICHT scheitern lassen (das Profil ist auch
        ohne Stripe gültig) — sie werden geloggt, nicht verschluckt mit erfundenem
        Erfolg."""
        from src.features.payments.schemas import (  # noqa: PLC0415
            ConnectAccountCreate,
        )
        from src.features.payments.service import (  # noqa: PLC0415
            PaymentsError,
            PaymentsService,
        )

        existing = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if existing and existing[0].get("stripe_account_id"):
            # Account besteht bereits: die AKTUALISIERTEN Firmendaten trotzdem
            # an Stripe synchronisieren — sonst bleiben offene Requirements
            # (z. B. business_profile.url „Provide a business website") für
            # immer offen, obwohl der Nutzer die Daten längst nachgetragen hat.
            # Bankverbindung wird hier bewusst NICHT erneut angefügt (Stripe
            # würde ein zweites externes Konto anlegen).
            try:
                payments = PaymentsService(service_client=self._db)
                fields = _connect_fields_from_profile(profile)
                if fields:
                    payments.update_connect_account(
                        tenant_id, existing[0]["stripe_account_id"], fields
                    )
            except PaymentsError as exc:
                log.warning(
                    "connect_account_sync_failed",
                    tenant_id=tenant_id,
                    error=exc.message,
                )
            return

        email = profile.get("email")
        country = profile.get("company_country")
        if not email or not country:
            # Ohne E-Mail/Land kann kein valider Account erstellt werden — kein
            # Raten (keine Fallbacks). Onboarding fragt beides ab; fehlt es, wird
            # der Account beim nächsten vollständigen Speichern angelegt.
            log.info("connect_account_skipped_incomplete", tenant_id=tenant_id)
            return

        account_type = profile.get("account_type") or "individual"
        try:
            payments = PaymentsService(service_client=self._db)
            account = payments.create_connect_account(
                ConnectAccountCreate(
                    email=email,
                    country=country,
                    tenant_id=tenant_id,
                    business_type=account_type,
                )
            )
            self._db.table("tenant_billing_profile").update(
                {"stripe_account_id": account.stripe_account_id}
            ).eq("tenant_id", tenant_id).execute()
            # Firmen-/Inhaberdaten an den Account übertragen (best effort). Die
            # acct_-ID wurde direkt oben in tenant_billing_profile geschrieben →
            # der _require_own_connect_account-Guard findet sie für diesen Tenant.
            payments.update_connect_account(
                tenant_id,
                account.stripe_account_id,
                _connect_fields_from_profile(profile),
            )
            iban = profile.get("iban")
            holder = profile.get("account_holder") or _account_holder_from(profile)
            if iban and holder:
                payments.set_external_account(
                    tenant_id,
                    account.stripe_account_id,
                    iban=iban, account_holder=holder, country=country,
                )
            log.info(
                "connect_account_created",
                tenant_id=tenant_id,
                stripe_account_id=account.stripe_account_id,
            )
        except PaymentsError as exc:
            # Stripe nicht konfiguriert/erreichbar → Profil bleibt gespeichert,
            # Connect kann später (eigene UI) nachgeholt werden.
            log.warning(
                "connect_account_auto_create_failed",
                tenant_id=tenant_id,
                error=exc.message,
            )

    # Firmenlogo: erlaubte Typen → Dateiendung (analog properties.upload_image).
    LOGO_BUCKET = "company-logos"
    LOGO_MAX_BYTES = 5 * 1024 * 1024
    LOGO_MIME = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/svg+xml": "svg",
    }

    def upload_logo(
        self, ctx: AuthContext, content: bytes, content_type: str
    ) -> dict:
        """Firmenlogo in den Bucket legen, URL ins Profil schreiben → Profil zurück.

        Pfad {tenant_id}/logo.{ext} mit upsert, sodass ein neues Logo das alte
        ersetzt. Validiert Typ/Größe serverseitig. Speichert die öffentliche URL
        (mit Cache-Buster) als company_logo_url und gibt das aktualisierte
        Firmenprofil zurück.
        """
        tenant_id = self._require_tenant(ctx)

        ext = self.LOGO_MIME.get(content_type)
        if not ext:
            raise BuchhaltungError(
                "Nur PNG/JPEG/WebP/SVG erlaubt.", status_code=415
            )
        if len(content) > self.LOGO_MAX_BYTES:
            raise BuchhaltungError("Logo ist zu groß (max. 5 MB).", status_code=413)

        path = f"{tenant_id}/logo.{ext}"
        storage = self._db.storage.from_(self.LOGO_BUCKET)
        try:
            storage.upload(
                path,
                content,
                {"content-type": content_type, "upsert": "true"},
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("company_logo_upload_failed", tenant_id=tenant_id, error=str(exc))
            raise BuchhaltungError("Upload fehlgeschlagen.", status_code=502) from exc

        public_url = storage.get_public_url(path)
        # Cache-Buster, damit Clients trotz gleicher URL das neue Logo laden.
        url = f"{public_url}?v={secrets.token_hex(4)}"
        self._db.table("tenant_billing_profile").upsert(
            {"tenant_id": tenant_id, "company_logo_url": url},
            on_conflict="tenant_id",
        ).execute()
        # Firmenlogo = Unterkunftslogo an den Buchungsportalen → alle Objekte des
        # Tenants sofort neu spiegeln (sonst käme es erst beim nächsten Speichern).
        # Best-effort; darf den Upload nie kippen.
        try:
            from src.features.channel_manager.service import ChannelManagerService

            ChannelManagerService(service_client=self._db).resync_all_content(tenant_id)
        except Exception as exc:  # noqa: BLE001 — Auto-Resync darf nie blockieren
            log.warning("logo_resync_failed", tenant_id=tenant_id, error=str(exc))
        log.info("company_logo_uploaded", tenant_id=tenant_id)
        return self.get_company_profile(ctx)

    def get_invoice(self, ctx: AuthContext, invoice_id: str) -> InvoiceResponse:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("invoices")
            .select("*")
            .eq("id", invoice_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Rechnung nicht gefunden.", status_code=404)
        invoice = res.data[0]
        items = (
            self._db.table("invoice_line_items")
            .select("*")
            .eq("invoice_id", invoice_id)
            .order("position")
            .execute()
        )
        invoice["items"] = items.data or []
        return InvoiceResponse(**invoice)

    def _compute_line(
        self, item: LineItemInput, position: int, *, is_klein: bool = False
    ) -> dict:
        """Netto/Steuer/Brutto einer Position berechnen (mit Rabatt).

        Kleinunternehmer (§19 UStG): der Beleg weist keine USt aus — der Satz
        wird auf 0 gezwungen, damit die Positionen zum steuerfreien Kopf passen
        (Σ Positionen == Kopf, GoBD-konsistent)."""
        rate = Decimal("0") if is_klein else Decimal(item.tax_rate)
        gross_unit = Decimal(item.quantity) * Decimal(item.unit_price)
        discount = gross_unit * (Decimal(item.discount_percent) / Decimal(100))
        net = _q(gross_unit - discount)
        tax = _q(net * (rate / Decimal(100)))
        return {
            "position": position,
            "description": item.description,
            "quantity": str(item.quantity),
            "unit": item.unit,
            "unit_price": str(item.unit_price),
            "tax_rate": str(rate),
            "discount_percent": str(item.discount_percent),
            "sku": item.sku,
            "net_amount": str(net),
            "tax_amount": str(tax),
            "gross_amount": str(_q(net + tax)),
        }

    def create_invoice(self, ctx: AuthContext, req: InvoiceCreate) -> InvoiceResponse:
        tenant_id = self._require_tenant(ctx)
        # Kleinunternehmer-Status aus dem Tenant-Billing-Profil ziehen.
        profile = (
            self._db.table("tenant_billing_profile")
            .select("is_kleinunternehmer")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        is_klein = bool(profile.data and profile.data[0].get("is_kleinunternehmer"))

        lines = [
            self._compute_line(it, i + 1, is_klein=is_klein)
            for i, it in enumerate(req.items)
        ]
        net_total = _q(sum((Decimal(line_var["net_amount"]) for line_var in lines), Decimal(0)))
        # tax_total aus den (bereits kleinunternehmer-bereinigten) Positionen —
        # Kopf und Σ Positionen sind so zwingend konsistent.
        tax_total = _q(sum((Decimal(line_var["tax_amount"]) for line_var in lines), Decimal(0)))
        gross_total = _q(net_total + tax_total)

        payload = {
            "tenant_id": tenant_id,
            "customer_id": req.customer_id,
            "invoice_type": req.invoice_type,
            "status": req.status,
            "issue_date": req.issue_date.isoformat() if req.issue_date else None,
            "due_date": req.due_date.isoformat() if req.due_date else None,
            "currency": req.currency,
            "tax_rule": req.tax_rule,
            "head_text": req.head_text,
            "footer_text": req.footer_text,
            "notes": req.notes,
            "is_kleinunternehmer": is_klein,
            "net_amount": str(net_total),
            "tax_amount": str(tax_total),
            "gross_amount": str(gross_total),
        }
        res = self._db.table("invoices").insert(payload).execute()
        if not res.data:
            raise BuchhaltungError("Rechnung konnte nicht angelegt werden.", status_code=500)
        invoice_id = res.data[0]["id"]
        if lines:
            for line_var in lines:
                line_var["invoice_id"] = invoice_id
            self._db.table("invoice_line_items").insert(lines).execute()
        return self.get_invoice(ctx, invoice_id)

    def update_invoice(
        self, ctx: AuthContext, invoice_id: str, req: InvoiceUpdate
    ) -> InvoiceResponse:
        tenant_id = self._require_tenant(ctx)
        current = (
            self._db.table("invoices")
            .select("is_locked, is_kleinunternehmer, status, invoice_number")
            .eq("id", invoice_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not current.data:
            raise BuchhaltungError("Rechnung nicht gefunden.", status_code=404)
        row = current.data[0]
        # Nur echte Entwürfe ohne Nummer sind änderbar (GoBD, wie delete_invoice).
        if (
            bool(row.get("is_locked"))
            or row.get("status") not in self._MUTABLE_INVOICE_STATUSES
            or bool(row.get("invoice_number"))
        ):
            raise BuchhaltungError(
                "Festgeschriebene Rechnungen sind GoBD-geschützt und nicht "
                "änderbar (nur Entwürfe ohne Nummer).",
                status_code=409,
            )
        is_klein = bool(row.get("is_kleinunternehmer"))

        patch = req.model_dump(mode="json", exclude_unset=True, exclude={"items"})
        # Positionen ersetzen + Summen neu berechnen, falls items übergeben.
        if req.items is not None:
            self._db.table("invoice_line_items").delete().eq(
                "invoice_id", invoice_id
            ).execute()
            lines = [
                self._compute_line(it, i + 1, is_klein=is_klein)
                for i, it in enumerate(req.items)
            ]
            net_total = _q(sum((Decimal(line_var["net_amount"]) for line_var in lines), Decimal(0)))
            tax_total = _q(sum((Decimal(line_var["tax_amount"]) for line_var in lines), Decimal(0)))
            patch["net_amount"] = str(net_total)
            patch["tax_amount"] = str(tax_total)
            patch["gross_amount"] = str(_q(net_total + tax_total))
            if lines:
                for line_var in lines:
                    line_var["invoice_id"] = invoice_id
                self._db.table("invoice_line_items").insert(lines).execute()

        if patch:
            self._db.table("invoices").update(patch).eq("id", invoice_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self.get_invoice(ctx, invoice_id)

    # Festgeschriebene Belege (GoBD): sobald eine Rechnung eine Nummer trägt oder
    # nicht mehr Entwurf ist, ist sie unveränderbar UND unlöschbar. is_locked
    # allein reicht NICHT als Gate (Default false, wird nirgends gesetzt) — sonst
    # ließe sich jede finalisierte, nummerierte Rechnung soft-löschen und ihre
    # Nummer (der Unique-Index greift nur bei deleted_at IS NULL) neu vergeben.
    _MUTABLE_INVOICE_STATUSES = frozenset({"draft"})

    def delete_invoice(self, ctx: AuthContext, invoice_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        current = (
            self._db.table("invoices")
            .select("is_locked, status, invoice_number")
            .eq("id", invoice_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not current.data:
            raise BuchhaltungError("Rechnung nicht gefunden.", status_code=404)
        row = current.data[0]
        # Löschbar sind NUR echte Entwürfe ohne vergebene Nummer. Alles andere
        # (finalized/paid/cancelled/storno oder eine bereits gezogene Nummer) ist
        # ein festgeschriebener GoBD-Beleg → 409.
        is_finalized = (
            bool(row.get("is_locked"))
            or row.get("status") not in self._MUTABLE_INVOICE_STATUSES
            or bool(row.get("invoice_number"))
        )
        if is_finalized:
            raise BuchhaltungError(
                "Festgeschriebene Rechnungen sind GoBD-geschützt und können nicht "
                "gelöscht werden (nur Entwürfe ohne Nummer).",
                status_code=409,
            )
        self._db.table("invoices").update({"deleted_at": "now()"}).eq(
            "id", invoice_id
        ).eq("tenant_id", tenant_id).execute()

    # ------------------------------------------------------------- Angebote
    def list_quotes(self, ctx: AuthContext) -> QuoteListResponse:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("quotes")
            .select(
                "id, quote_number, customer_id, status, issue_date, valid_until, "
                "gross_amount, currency, converted_invoice_id, created_at"
            )
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .execute()
        )
        from .schemas import QuoteListItem

        items = [QuoteListItem(**row) for row in (res.data or [])]
        return QuoteListResponse(items=items, total=len(items))

    def get_quote(self, ctx: AuthContext, quote_id: str) -> QuoteResponse:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("quotes")
            .select("*")
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Angebot nicht gefunden.", status_code=404)
        quote = res.data[0]
        items = (
            self._db.table("quote_line_items")
            .select("*")
            .eq("quote_id", quote_id)
            .order("position")
            .execute()
        )
        quote["items"] = items.data or []
        return QuoteResponse(**quote)

    def create_quote(self, ctx: AuthContext, req: QuoteCreate) -> QuoteResponse:
        tenant_id = self._require_tenant(ctx)
        lines = [self._compute_line(it, i + 1) for i, it in enumerate(req.items)]
        net_total = _q(sum((Decimal(ln["net_amount"]) for ln in lines), Decimal(0)))
        tax_total = _q(sum((Decimal(ln["tax_amount"]) for ln in lines), Decimal(0)))
        gross_total = _q(net_total + tax_total)
        payload = {
            "tenant_id": tenant_id,
            "customer_id": req.customer_id,
            "status": req.status,
            "issue_date": req.issue_date.isoformat() if req.issue_date else None,
            "valid_until": req.valid_until.isoformat() if req.valid_until else None,
            "currency": req.currency,
            "tax_rule": req.tax_rule,
            "head_text": req.head_text,
            "footer_text": req.footer_text,
            "notes": req.notes,
            "net_amount": str(net_total),
            "tax_amount": str(tax_total),
            "gross_amount": str(gross_total),
        }
        res = self._db.table("quotes").insert(payload).execute()
        if not res.data:
            raise BuchhaltungError("Angebot konnte nicht angelegt werden.", status_code=500)
        quote_id = res.data[0]["id"]
        if lines:
            for ln in lines:
                ln["quote_id"] = quote_id
            self._db.table("quote_line_items").insert(lines).execute()
        return self.get_quote(ctx, quote_id)

    def update_quote(
        self, ctx: AuthContext, quote_id: str, req: QuoteUpdate
    ) -> QuoteResponse:
        tenant_id = self._require_tenant(ctx)
        current = (
            self._db.table("quotes")
            .select("converted_invoice_id")
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not current.data:
            raise BuchhaltungError("Angebot nicht gefunden.", status_code=404)
        if current.data[0].get("converted_invoice_id"):
            raise BuchhaltungError(
                "Angebot wurde bereits in eine Rechnung umgewandelt.", status_code=409
            )
        patch = req.model_dump(mode="json", exclude_unset=True, exclude={"items"})
        if req.items is not None:
            self._db.table("quote_line_items").delete().eq(
                "quote_id", quote_id
            ).execute()
            lines = [self._compute_line(it, i + 1) for i, it in enumerate(req.items)]
            net_total = _q(sum((Decimal(ln["net_amount"]) for ln in lines), Decimal(0)))
            tax_total = _q(sum((Decimal(ln["tax_amount"]) for ln in lines), Decimal(0)))
            patch["net_amount"] = str(net_total)
            patch["tax_amount"] = str(tax_total)
            patch["gross_amount"] = str(_q(net_total + tax_total))
            if lines:
                for ln in lines:
                    ln["quote_id"] = quote_id
                self._db.table("quote_line_items").insert(lines).execute()
        if patch:
            self._db.table("quotes").update(patch).eq("id", quote_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self.get_quote(ctx, quote_id)

    def delete_quote(self, ctx: AuthContext, quote_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("quotes")
            .update({"deleted_at": "now()"})
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Angebot nicht gefunden.", status_code=404)

    def convert_quote_to_invoice(
        self, ctx: AuthContext, quote_id: str
    ) -> InvoiceResponse:
        """Angebot in eine Rechnung umwandeln (Positionen übernehmen)."""
        tenant_id = self._require_tenant(ctx)
        quote = self.get_quote(ctx, quote_id)
        if quote.converted_invoice_id:
            raise BuchhaltungError(
                "Angebot wurde bereits umgewandelt.", status_code=409
            )
        items = [
            LineItemInput(
                description=it.description,
                quantity=it.quantity,
                unit=it.unit,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                discount_percent=it.discount_percent,
                sku=it.sku,
            )
            for it in quote.items
        ]
        invoice = self.create_invoice(
            ctx,
            InvoiceCreate(
                customer_id=quote.customer_id,
                currency=quote.currency,
                tax_rule=quote.tax_rule,
                head_text=quote.head_text,
                footer_text=quote.footer_text,
                notes=quote.notes,
                items=items,
            ),
        )
        # Angebot atomar als konvertiert markieren — mit Guard converted_invoice_id
        # IS NULL: bei Doppelklick/Retry passieren zwei parallele Requests den Check
        # oben (converted_invoice_id=NULL), erzeugen je eine Rechnung, aber nur EINER
        # gewinnt dieses guarded UPDATE. Der Verlierer (leeres Ergebnis) verwirft
        # seine gerade erzeugte Rechnung wieder (kein verwaister Doppel-Beleg).
        won = (
            self._db.table("quotes")
            .update({"status": "converted", "converted_invoice_id": invoice.id})
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .is_("converted_invoice_id", "null")
            .execute()
        ).data
        if not won:
            # Ein paralleler Request hat das Angebot bereits umgewandelt → die hier
            # erzeugte Rechnung ist ein Duplikat und wird (soft) gelöscht.
            self._db.table("invoices").update(
                {"deleted_at": "now()"}
            ).eq("id", invoice.id).eq("tenant_id", tenant_id).execute()
            raise BuchhaltungError(
                "Angebot wurde bereits umgewandelt.", status_code=409
            )
        return invoice


def _account_holder_from(profile: dict) -> str | None:
    """Kontoinhaber automatisch ableiten — kein separates Eingabefeld nötig:
    Firma → Firmenname (legal_name), Einzelperson → Vor+Nachname. None, wenn
    nichts davon vorhanden ist (kein erfundener Wert)."""
    account_type = profile.get("account_type") or "individual"
    if account_type == "company" and profile.get("legal_name"):
        return profile["legal_name"]
    name = " ".join(
        p
        for p in (
            profile.get("managing_director_first_name"),
            profile.get("managing_director_last_name"),
        )
        if p
    )
    return name or profile.get("legal_name") or None


def _connect_fields_from_profile(profile: dict) -> dict:
    """Baut das Stripe-Account-Update (`fields`) aus dem Firmenprofil — abhängig
    vom Kontotyp (Einzelperson vs. Firma). Nur vorhandene Felder (keine leeren/
    erfundenen Werte an Stripe). Die ToS-Akzeptanz (date/ip) gehört NICHT hierher
    — sie braucht die echte Nutzer-IP und passiert im expliziten Aktivierungs-
    Schritt des Onboarding-UIs."""
    fields: dict = {}

    street = profile.get("company_street")
    house = profile.get("company_house_number")
    line1 = " ".join(p for p in (street, house) if p) or None
    address = {
        "line1": line1,
        "city": profile.get("company_city"),
        "postal_code": profile.get("company_postal_code"),
        "country": profile.get("company_country"),
    }
    address = {k: v for k, v in address.items() if v}

    # Natürliche Person (Einzelperson direkt, bei Firmen die vertretungs-
    # berechtigte Person). Inklusive Geburtsdatum (Stripe-KYC-Pflicht).
    person = {
        "first_name": profile.get("managing_director_first_name"),
        "last_name": profile.get("managing_director_last_name"),
        "email": profile.get("email"),
        "phone": profile.get("phone_number"),
    }
    if address:
        person["address"] = address
    dob = _dob_parts(profile.get("owner_dob"))
    if dob:
        person["dob"] = dob
    person = {k: v for k, v in person.items() if v}

    account_type = profile.get("account_type") or "individual"
    if account_type == "company":
        company = {"name": profile.get("legal_name")}
        if address:
            company["address"] = address
        company = {k: v for k, v in company.items() if v}
        if company:
            fields["company"] = company
        if person:
            # Bei Firmen ist die Person der Vertreter (representative).
            person["relationship"] = {"representative": True, "title": "Geschäftsführer"}
            fields["individual"] = person
    elif person:
        fields["individual"] = person

    business_profile = {"name": profile.get("legal_name")}
    if profile.get("website"):
        business_profile["url"] = profile["website"]
    business_profile = {k: v for k, v in business_profile.items() if v}
    if business_profile:
        fields["business_profile"] = business_profile

    return fields


def _dob_parts(value: object) -> dict | None:
    """ISO-Datum (YYYY-MM-DD) → Stripe-dob {day, month, year}. None bei leer/ungültig."""
    if not value:
        return None
    try:
        parts = str(value).split("-")
        if len(parts) != 3:
            return None
        year, month, day = (int(p) for p in parts)
        return {"day": day, "month": month, "year": year}
    except (ValueError, TypeError):
        return None
