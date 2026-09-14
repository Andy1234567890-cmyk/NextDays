"""Fachlogik des Bereichs »belege«: EIN Beleg-Modell für die ganze Kette.

Leitsatz aus dem Bestand-Dokument: „Einen Editor portieren, nicht acht." Die
acht alten Beleg-Editoren waren Kopien; hier gibt es EINE Tabelle (`invoices`,
0023, mit `invoice_type`) und EINE Logik für Anlegen, Umwandeln, Festschreiben
und Wiederholen. Angebote (`quotes`, 0024) sind der Anfang der Kette und werden
als Belegart `quote` mitgelesen.

Regeln, die hier stehen und nirgends sonst:

  * Kette: quote → order_confirmation → delivery_note → invoice → credit_note.
    Glieder dürfen übersprungen werden (Angebot direkt zur Rechnung), die
    Richtung nie umgekehrt. Storno hat seinen eigenen Weg (../../storno.py).
  * Umwandeln kopiert die Positionen und rechnet die Beträge NEU — dieselbe
    Rechnung wie `BuchhaltungService._compute_totals` (Rabatt-Positionen
    negativ, kaufmännisch gerundet je Position), hier als
    `_positionen_rechnen`, weil die Bestandsmethode privat ist.
  * Ein Folgebeleg ist ein ENTWURF ohne Nummer. Die GoBD-Nummer zieht erst
    `finalize` aus dem Nummernkreis SEINER Art (AB-/LS-/RE-/GU-) über die
    DB-Funktion `next_document_number` (0025/0105) — nach aller Prüfung, damit
    kein Fehler eine Nummer verbrennt (Lücke).
  * Festgeschrieben = Nummer vorhanden ODER Status ≠ draft ODER is_locked
    (identisch zu `_MUTABLE_INVOICE_STATUSES` im Bestand; DB-Backstop 0662).
  * Gutschrift = negierte Beträge der Rechnung, Verweis `source_document_id`;
    das Original bleibt gültig (Unterschied zum Storno).
  * Wiederkehrend: eine VORLAGE (`invoice_type='recurring'`, nie nummeriert)
    erzeugt je fälliger Periode eine Entwurfsrechnung; UNIQUE
    (recurring_template_id, recurring_period_start) (0661) macht den Lauf
    idempotent — Retry, Doppelklick, zwei Worker (Wurzel 2).

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`. Währung IMMER aus Quelle oder Mandant, fehlt sie → 422
(Wurzel 4).
"""

from __future__ import annotations

from calendar import monthrange
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .schemas import (
    BELEGARTEN,
    MAX_LIMIT,
    ConvertRequest,
    DocumentCreate,
    DocumentDerived,
    DocumentListItem,
    DocumentListResponse,
    DocumentResponse,
    PositionInput,
    PositionResponse,
    RecurringCreate,
    RecurringRunResult,
    RecurringUpdate,
)

log = get_logger("nextdays.buchhaltung.belege")

# Belegart → (doc_type in number_sequences, Präfix beim ersten Ziehen).
# invoice/quote/credit_note/storno sind die Werte aus
# `BuchhaltungService._DOC_TYPE_MAP` (nur gelesen, nicht importiert — die
# Methode ist privat); AB-/LS- kommen hier neu dazu.
NUMMERNKREIS: dict[str, tuple[str, str]] = {
    "invoice": ("invoice", "RE-"),
    "credit_note": ("credit_note", "GU-"),
    "order_confirmation": ("order_confirmation", "AB-"),
    "delivery_note": ("delivery_note", "LS-"),
    "quote": ("quote", "AN-"),
    "storno": ("storno", "ST-"),
}

# Erlaubte Übergänge der Kette (Quelle → Zielarten).
KETTE: dict[str, frozenset[str]] = {
    "quote": frozenset({"order_confirmation", "invoice"}),
    "order_confirmation": frozenset({"delivery_note", "invoice"}),
    "delivery_note": frozenset({"invoice"}),
    "invoice": frozenset({"credit_note"}),
}

# Belegarten, die der Editor direkt anlegen darf (Storno nur über storno.py,
# Vorlagen nur aus einer Rechnung).
EDITOR_BELEGARTEN: frozenset[str] = frozenset(
    {"invoice", "order_confirmation", "delivery_note", "credit_note"}
)

# Unique-Indizes aus 0660/0661 — die Namen fängt der Service bei 23505.
_UIDX_FOLGEBELEG = "invoices_folgebeleg_je_quelle_uidx"
_UIDX_FOLGEBELEG_ANGEBOT = "invoices_folgebeleg_je_angebot_uidx"
_UIDX_RECURRING_LAUF = "invoices_recurring_lauf_uidx"
_UIDX_NUMMER = "invoices_tenant_number_uidx"

# Nachhol-Deckel je Vorlage und Lauf (Wurzel 8: kein unbegrenzter Loop) —
# 60 Wochen bei „weekly" reichen für jede realistische Pause.
_MAX_PERIODEN_JE_LAUF = 60

_ZWEI_STELLEN = Decimal("0.01")


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, datetime):
        return wert.date()
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def _monate_weiter(d: date, monate: int) -> date:
    """Kalendermonate addieren, Tag auf das Monatsende klemmen (31.01. + 1 → 28./29.02.)."""
    m0 = d.month - 1 + monate
    jahr = d.year + m0 // 12
    monat = m0 % 12 + 1
    tag = min(d.day, monthrange(jahr, monat)[1])
    return date(jahr, monat, tag)


def naechster_termin(d: date, intervall: str) -> date:
    if intervall == "weekly":
        return d + timedelta(days=7)
    if intervall == "monthly":
        return _monate_weiter(d, 1)
    if intervall == "quarterly":
        return _monate_weiter(d, 3)
    if intervall == "yearly":
        return _monate_weiter(d, 12)
    raise BelegeError("Unbekanntes Intervall.", status_code=422)


class BelegeError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> BelegeError:
    return BelegeError(f"{was} nicht gefunden.", status_code=404)


def festgeschrieben(row: dict) -> bool:
    """Identisch zur Bestandsregel (`_MUTABLE_INVOICE_STATUSES` + Nummer + Lock)."""
    return (
        bool(row.get("is_locked"))
        or (row.get("status") or "draft") != "draft"
        or bool(row.get("invoice_number"))
    )


def _positionen_rechnen(
    items: Iterable[dict], *, is_klein: bool, negieren: bool = False
) -> tuple[list[dict], Decimal, Decimal, Decimal]:
    """Positionen als DB-Zeilen + Netto/Steuer/Brutto — die Rechnung aus
    `BuchhaltungService._compute_totals`/`create_invoice_from_bestand`
    (Rabatt-Positionen negativ, §19 → Satz 0, je Position gerundet).
    `negieren` dreht alle Vorzeichen (Gutschrift)."""
    rows: list[dict] = []
    net_total = Decimal("0")
    tax_total = Decimal("0")
    for pos, it in enumerate(items, start=1):
        qty = _dec(it.get("quantity") or 0)
        price = _dec(it.get("unitPrice") or it.get("unit_price") or 0)
        disc = _dec(it.get("discountPercent") or it.get("discount_percent") or 0)
        rate = Decimal("0") if is_klein else _dec(it.get("taxRate") or it.get("tax_rate") or 0)
        if it.get("category") == "discount":
            price = -abs(price)
        if negieren:
            price = -price
        gross_unit = qty * price
        net = _q(gross_unit - gross_unit * (disc / Decimal(100)))
        tax = _q(net * (rate / Decimal(100)))
        net_total += net
        tax_total += tax
        rows.append(
            {
                "position": pos,
                "description": str(it.get("description") or ""),
                "quantity": str(qty),
                "unit": it.get("unit") or None,
                "unit_price": str(price),
                "tax_rate": str(rate),
                "discount_percent": str(disc),
                "sku": it.get("sku") or None,
                # Abrechnungsbasis + Aufenthalt der Zeile (0698/0702) mitführen:
                # Kopie, Gutschrift und wiederkehrende Rechnung sind derselbe
                # Beleg — sie dürfen Objekt und Zeitraum nicht verlieren.
                "basis": it.get("basis") or None,
                "property_id": it.get("property_id") or it.get("propertyId") or None,
                "check_in": it.get("check_in") or it.get("checkIn") or None,
                "check_out": it.get("check_out") or it.get("checkOut") or None,
                "net_amount": str(net),
                "tax_amount": str(tax),
                "gross_amount": str(_q(net + tax)),
            }
        )
    net_total = _q(net_total)
    tax_total = _q(tax_total)
    return rows, net_total, tax_total, _q(net_total + tax_total)


class BelegeService:
    """Belegkette, Festschreibung, wiederkehrende Rechnungen."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------ Grundlagen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BelegeError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    def _tenant_currency(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        currency = rows[0].get("currency") if rows else None
        if not currency:
            raise BelegeError(
                "Mandanten-Währung fehlt — bitte im Konto die Währung setzen.",
                status_code=422,
            )
        return str(currency)

    def _is_kleinunternehmer(self, tenant_id: str) -> bool:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("is_kleinunternehmer")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows and rows[0].get("is_kleinunternehmer"))

    def _kunden(self, tenant_id: str, ids: Iterable[str]) -> dict[str, str]:
        wanted = sorted({i for i in ids if i})
        if not wanted:
            return {}
        rows = (
            self._db.table("customers")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .in_("id", wanted)
            .execute()
        ).data or []
        return {str(r["id"]): str(r.get("name") or "") for r in rows}

    def _eigener_beleg(self, tenant_id: str, beleg_id: str) -> dict:
        row = load_scoped(
            self._db, "invoices", beleg_id, tenant_id, not_found=_nicht_gefunden("Beleg")
        )
        if row.get("deleted_at"):
            raise _nicht_gefunden("Beleg")
        return row

    def _eigenes_angebot(self, tenant_id: str, quote_id: str) -> dict:
        row = load_scoped(
            self._db, "quotes", quote_id, tenant_id, not_found=_nicht_gefunden("Angebot")
        )
        if row.get("deleted_at"):
            raise _nicht_gefunden("Angebot")
        return row

    def _positionen(self, tabelle: str, schluessel: str, beleg_id: str) -> list[dict]:
        return (
            self._db.table(tabelle)
            .select("*")
            .eq(schluessel, beleg_id)
            .order("position")
            .execute()
        ).data or []

    def _folgebelege(self, tenant_id: str, *, quelle_spalte: str, quelle_id: str) -> list[dict]:
        return (
            self._db.table("invoices")
            .select("id, invoice_type, invoice_number, status")
            .eq("tenant_id", tenant_id)
            .eq(quelle_spalte, quelle_id)
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []

    # ------------------------------------------------------------- Mapping
    @staticmethod
    def _item_aus_invoice(row: dict, kunde: str | None) -> DocumentListItem:
        return DocumentListItem(
            id=str(row["id"]),
            type=row.get("invoice_type") or "invoice",
            number=row.get("invoice_number"),
            status=str(row.get("status") or "draft"),
            customer_id=str(row["customer_id"]) if row.get("customer_id") else None,
            customer_name=kunde,
            issue_date=_datum(row.get("issue_date")),
            due_date=_datum(row.get("due_date")),
            currency=str(row.get("currency") or ""),
            net_amount=_dec(row.get("net_amount")),
            tax_amount=_dec(row.get("tax_amount")),
            gross_amount=_dec(row.get("gross_amount")),
            is_locked=bool(row.get("is_locked")),
            source_document_id=(
                str(row["source_document_id"]) if row.get("source_document_id") else None
            ),
            source_quote_id=str(row["source_quote_id"]) if row.get("source_quote_id") else None,
            is_recurring_template=bool(row.get("is_recurring_template")),
            recurring_interval=row.get("recurring_interval"),
            recurring_status=row.get("recurring_status"),
            recurring_next_at=_datum(row.get("recurring_next_at")),
            recurring_end_at=_datum(row.get("recurring_end_at")),
            recurring_template_id=(
                str(row["recurring_template_id"]) if row.get("recurring_template_id") else None
            ),
            recurring_period_start=_datum(row.get("recurring_period_start")),
            created_at=row["created_at"],
        )

    @staticmethod
    def _item_aus_quote(row: dict, kunde: str | None) -> DocumentListItem:
        return DocumentListItem(
            id=str(row["id"]),
            type="quote",
            number=row.get("quote_number"),
            status=str(row.get("status") or "draft"),
            customer_id=str(row["customer_id"]) if row.get("customer_id") else None,
            customer_name=kunde,
            issue_date=_datum(row.get("issue_date")),
            due_date=_datum(row.get("valid_until")),
            currency=str(row.get("currency") or ""),
            net_amount=_dec(row.get("net_amount")),
            tax_amount=_dec(row.get("tax_amount")),
            gross_amount=_dec(row.get("gross_amount")),
            converted_invoice_id=(
                str(row["converted_invoice_id"]) if row.get("converted_invoice_id") else None
            ),
            created_at=row["created_at"],
        )

    @staticmethod
    def _position_antwort(row: dict) -> PositionResponse:
        return PositionResponse(
            id=str(row["id"]) if row.get("id") else None,
            position=int(row.get("position") or 0),
            description=str(row.get("description") or ""),
            quantity=_dec(row.get("quantity")),
            unit=row.get("unit"),
            unit_price=_dec(row.get("unit_price")),
            tax_rate=_dec(row.get("tax_rate")),
            discount_percent=_dec(row.get("discount_percent")),
            net_amount=_dec(row.get("net_amount")),
            tax_amount=_dec(row.get("tax_amount")),
            gross_amount=_dec(row.get("gross_amount")),
            sku=row.get("sku"),
        )

    def _antwort(
        self, item: DocumentListItem, row: dict, positionen: list[dict], folgebelege: list[dict]
    ) -> DocumentResponse:
        return DocumentResponse(
            **item.model_dump(),
            tax_rule=row.get("tax_rule"),
            head_text=row.get("head_text"),
            footer_text=row.get("footer_text"),
            notes=row.get("notes"),
            language=row.get("language"),
            items=[self._position_antwort(p) for p in positionen],
            derived=[
                DocumentDerived(
                    id=str(f["id"]),
                    type=f.get("invoice_type") or "invoice",
                    number=f.get("invoice_number"),
                    status=str(f.get("status") or "draft"),
                )
                for f in folgebelege
            ],
        )

    def _beleg_antwort(self, tenant_id: str, row: dict) -> DocumentResponse:
        kunde = self._kunden(tenant_id, [str(row.get("customer_id") or "")])
        item = self._item_aus_invoice(row, kunde.get(str(row.get("customer_id") or "")))
        return self._antwort(
            item,
            row,
            self._positionen("invoice_line_items", "invoice_id", str(row["id"])),
            self._folgebelege(
                tenant_id, quelle_spalte="source_document_id", quelle_id=str(row["id"])
            ),
        )

    def _angebot_antwort(self, tenant_id: str, row: dict) -> DocumentResponse:
        kunde = self._kunden(tenant_id, [str(row.get("customer_id") or "")])
        item = self._item_aus_quote(row, kunde.get(str(row.get("customer_id") or "")))
        return self._antwort(
            item,
            row,
            self._positionen("quote_line_items", "quote_id", str(row["id"])),
            self._folgebelege(tenant_id, quelle_spalte="source_quote_id", quelle_id=str(row["id"])),
        )

    # -------------------------------------------------------------- Listen
    def list_documents(
        self,
        ctx: AuthContext,
        *,
        typ: str,
        status: str | None = None,
        customer_id: str | None = None,
        limit: int = 100,
    ) -> DocumentListResponse:
        tenant_id = self._tenant(ctx)
        if typ not in BELEGARTEN:
            raise BelegeError("Unbekannte Belegart.", status_code=422)
        if not 1 <= limit <= MAX_LIMIT:
            raise BelegeError(f"limit muss zwischen 1 und {MAX_LIMIT} liegen.", status_code=422)
        if typ == "quote":
            query = (
                self._db.table("quotes")
                .select("*")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .limit(limit)
            )
        else:
            query = (
                self._db.table("invoices")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("invoice_type", typ)
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .limit(limit)
            )
        if status:
            query = query.eq("status", status)
        if customer_id:
            query = query.eq("customer_id", customer_id)
        rows = query.execute().data or []
        kunden = self._kunden(tenant_id, (str(r.get("customer_id") or "") for r in rows))
        mapper = self._item_aus_quote if typ == "quote" else self._item_aus_invoice
        items = [mapper(r, kunden.get(str(r.get("customer_id") or ""))) for r in rows]
        return DocumentListResponse(items=items, total=len(items), type=typ)

    def get_document(
        self, ctx: AuthContext, beleg_id: str, *, typ: str = "invoice"
    ) -> DocumentResponse:
        tenant_id = self._tenant(ctx)
        if typ == "quote":
            return self._angebot_antwort(tenant_id, self._eigenes_angebot(tenant_id, beleg_id))
        return self._beleg_antwort(tenant_id, self._eigener_beleg(tenant_id, beleg_id))

    # ------------------------------------------------------------- Anlegen
    def _kopf_und_positionen_schreiben(
        self, tenant_id: str, kopf: dict, positionen: list[dict], *, unique_namen: tuple[str, ...]
    ) -> dict | None:
        """Kopf + Positionen einfügen. Gibt None zurück, wenn ein UNIQUE aus
        `unique_namen` kollidierte (der Aufrufer liest dann den Bestand). Schlägt
        der Positions-Insert fehl, wird der Kopf zurückgerollt — sonst bliebe ein
        Beleg mit Summen ohne Positionen (Kopf ≠ Σ Positionen)."""
        kopf = {k: v for k, v in kopf.items() if v is not None}
        try:
            res = self._db.table("invoices").insert(kopf).execute()
        except APIError as exc:
            msg = str(exc)
            if any(name in msg for name in unique_namen):
                return None
            raise
        if not res.data:
            raise BelegeError("Beleg konnte nicht gespeichert werden.", status_code=500)
        row = res.data[0]
        if positionen:
            try:
                self._db.table("invoice_line_items").insert(
                    [{**p, "invoice_id": row["id"]} for p in positionen]
                ).execute()
            except APIError as exc:
                self._db.table("invoices").delete().eq("id", row["id"]).eq(
                    "tenant_id", tenant_id
                ).execute()
                raise BelegeError(
                    "Belegpositionen konnten nicht gespeichert werden.", status_code=500
                ) from exc
        return row

    def create_document(
        self, ctx: AuthContext, *, typ: str, body: DocumentCreate
    ) -> DocumentResponse:
        """Beleg aus dem EINEN Editor anlegen — als Entwurf ohne Nummer."""
        tenant_id = self._tenant(ctx)
        if typ not in EDITOR_BELEGARTEN:
            raise BelegeError(
                "Diese Belegart kann nicht direkt angelegt werden.", status_code=422
            )
        if not body.items:
            raise BelegeError("Ein Beleg braucht mindestens eine Position.", status_code=422)
        if body.customer_id:
            load_scoped(
                self._db, "customers", body.customer_id, tenant_id,
                columns="id", not_found=_nicht_gefunden("Kunde"),
            )
        currency = body.currency or self._tenant_currency(tenant_id)
        is_klein = self._is_kleinunternehmer(tenant_id)
        rows, net, tax, gross = _positionen_rechnen(
            (it.model_dump() for it in body.items),
            is_klein=is_klein,
            negieren=(typ == "credit_note"),
        )
        kopf = {
            "tenant_id": tenant_id,
            "customer_id": body.customer_id,
            "invoice_type": typ,
            "status": "draft",
            "issue_date": body.issue_date.isoformat() if body.issue_date else None,
            "due_date": body.due_date.isoformat() if body.due_date else None,
            "currency": currency,
            "tax_rule": body.tax_rule,
            "is_kleinunternehmer": is_klein,
            "head_text": body.head_text or body.head_text_html,
            "footer_text": body.footer_text,
            "notes": body.notes,
            "language": body.language,
            "net_amount": str(net),
            "tax_amount": str(tax),
            "gross_amount": str(gross),
        }
        row = self._kopf_und_positionen_schreiben(tenant_id, kopf, rows, unique_namen=())
        if row is None:  # ohne Unique-Namen kann es keine Kollision geben
            raise BelegeError("Beleg konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "beleg_angelegt", tenant_id=tenant_id, beleg_id=row["id"], typ=typ, gross=str(gross)
        )
        return self._beleg_antwort(tenant_id, row)

    # ----------------------------------------------------------- Umwandeln
    def _vorhandener_folgebeleg(
        self, tenant_id: str, *, quelle_spalte: str, quelle_id: str, ziel: str
    ) -> dict | None:
        rows = (
            self._db.table("invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq(quelle_spalte, quelle_id)
            .eq("invoice_type", ziel)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def convert(self, ctx: AuthContext, beleg_id: str, body: ConvertRequest) -> DocumentResponse:
        tenant_id = self._tenant(ctx)
        ziel = body.target
        if body.source_type == "quote":
            return self._angebot_umwandeln(tenant_id, beleg_id, ziel)

        quelle = self._eigener_beleg(tenant_id, beleg_id)
        quell_art = str(quelle.get("invoice_type") or "invoice")
        if ziel not in KETTE.get(quell_art, frozenset()):
            raise BelegeError(
                f"Aus einem Beleg der Art '{quell_art}' kann kein '{ziel}' entstehen.",
                status_code=422,
            )
        if ziel == "credit_note":
            if not festgeschrieben(quelle):
                raise BelegeError(
                    "Nur ausgestellte Rechnungen können gutgeschrieben werden. "
                    "Ein Entwurf lässt sich direkt bearbeiten oder löschen.",
                    status_code=409,
                )
            if quelle.get("status") == "cancelled":
                raise BelegeError("Die Rechnung ist bereits storniert.", status_code=409)
        vorhanden = self._vorhandener_folgebeleg(
            tenant_id, quelle_spalte="source_document_id", quelle_id=beleg_id, ziel=ziel
        )
        if vorhanden:
            return self._beleg_antwort(tenant_id, vorhanden)

        currency = quelle.get("currency")
        if not currency:
            raise BelegeError("Der Quellbeleg trägt keine Währung.", status_code=422)
        positionen = self._positionen("invoice_line_items", "invoice_id", beleg_id)
        rows, net, tax, gross = _positionen_rechnen(
            positionen,
            is_klein=bool(quelle.get("is_kleinunternehmer")),
            negieren=(ziel == "credit_note"),
        )
        heute = self._heute().isoformat()
        kopf = {
            "tenant_id": tenant_id,
            "customer_id": quelle.get("customer_id"),
            "invoice_type": ziel,
            "status": "draft",
            "issue_date": heute,
            "currency": currency,
            "tax_rule": quelle.get("tax_rule"),
            "tax_rate": quelle.get("tax_rate"),
            "is_kleinunternehmer": bool(quelle.get("is_kleinunternehmer")),
            "head_text": (
                f"Gutschrift zu Rechnung {quelle.get('invoice_number')}"
                if ziel == "credit_note"
                else quelle.get("head_text")
            ),
            "footer_text": quelle.get("footer_text"),
            "notes": quelle.get("notes"),
            "language": quelle.get("language"),
            "source_document_id": beleg_id,
            "net_amount": str(net),
            "tax_amount": str(tax),
            "gross_amount": str(gross),
        }
        row = self._kopf_und_positionen_schreiben(
            tenant_id, kopf, rows, unique_namen=(_UIDX_FOLGEBELEG,)
        )
        if row is None:
            # Paralleler Request hat den Folgebeleg schon angelegt → idempotent.
            vorhanden = self._vorhandener_folgebeleg(
                tenant_id, quelle_spalte="source_document_id", quelle_id=beleg_id, ziel=ziel
            )
            if not vorhanden:
                raise BelegeError("Folgebeleg konnte nicht angelegt werden.", status_code=500)
            return self._beleg_antwort(tenant_id, vorhanden)
        log.info(
            "beleg_umgewandelt",
            tenant_id=tenant_id, quelle_id=beleg_id, quelle_art=quell_art,
            beleg_id=row["id"], ziel=ziel,
        )
        return self._beleg_antwort(tenant_id, row)

    def _angebot_umwandeln(self, tenant_id: str, quote_id: str, ziel: str) -> DocumentResponse:
        if ziel not in KETTE["quote"]:
            raise BelegeError(
                f"Aus einem Angebot kann kein '{ziel}' entstehen.", status_code=422
            )
        angebot = self._eigenes_angebot(tenant_id, quote_id)
        vorhanden = self._vorhandener_folgebeleg(
            tenant_id, quelle_spalte="source_quote_id", quelle_id=quote_id, ziel=ziel
        )
        if vorhanden:
            return self._beleg_antwort(tenant_id, vorhanden)
        if angebot.get("converted_invoice_id"):
            raise BelegeError("Angebot wurde bereits umgewandelt.", status_code=409)
        currency = angebot.get("currency")
        if not currency:
            raise BelegeError("Das Angebot trägt keine Währung.", status_code=422)
        positionen = self._positionen("quote_line_items", "quote_id", quote_id)
        rows, net, tax, gross = _positionen_rechnen(
            positionen, is_klein=self._is_kleinunternehmer(tenant_id)
        )
        kopf = {
            "tenant_id": tenant_id,
            "customer_id": angebot.get("customer_id"),
            "invoice_type": ziel,
            "status": "draft",
            "issue_date": self._heute().isoformat(),
            "currency": currency,
            "tax_rule": angebot.get("tax_rule"),
            "is_kleinunternehmer": self._is_kleinunternehmer(tenant_id),
            "head_text": angebot.get("head_text"),
            "footer_text": angebot.get("footer_text"),
            "notes": angebot.get("notes"),
            "source_quote_id": quote_id,
            "net_amount": str(net),
            "tax_amount": str(tax),
            "gross_amount": str(gross),
        }
        row = self._kopf_und_positionen_schreiben(
            tenant_id, kopf, rows, unique_namen=(_UIDX_FOLGEBELEG_ANGEBOT,)
        )
        if row is None:
            vorhanden = self._vorhandener_folgebeleg(
                tenant_id, quelle_spalte="source_quote_id", quelle_id=quote_id, ziel=ziel
            )
            if not vorhanden:
                raise BelegeError("Folgebeleg konnte nicht angelegt werden.", status_code=500)
            return self._beleg_antwort(tenant_id, vorhanden)
        # Angebot guarded als umgewandelt markieren (Muster aus
        # convert_quote_to_invoice): verliert dieser Request das Race, ist sein
        # Beleg ein Duplikat und wird wieder entfernt (Entwurf, hard delete).
        gewonnen = (
            self._db.table("quotes")
            .update({"status": "converted", "converted_invoice_id": row["id"]})
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .is_("converted_invoice_id", "null")
            .execute()
        ).data
        if not gewonnen:
            self._db.table("invoices").delete().eq("id", row["id"]).eq(
                "tenant_id", tenant_id
            ).execute()
            raise BelegeError("Angebot wurde bereits umgewandelt.", status_code=409)
        log.info(
            "angebot_umgewandelt", tenant_id=tenant_id, quote_id=quote_id,
            beleg_id=row["id"], ziel=ziel,
        )
        return self._beleg_antwort(tenant_id, row)

    # -------------------------------------------------------- Festschreiben
    def finalize(self, ctx: AuthContext, beleg_id: str) -> DocumentResponse:
        """Nummer aus dem Nummernkreis der Belegart ziehen und festschreiben."""
        tenant_id = self._tenant(ctx)
        beleg = self._eigener_beleg(tenant_id, beleg_id)
        if beleg.get("is_recurring_template"):
            raise BelegeError(
                "Eine Vorlage wird nie festgeschrieben — sie erzeugt Rechnungen.",
                status_code=409,
            )
        if festgeschrieben(beleg):
            raise BelegeError("Der Beleg ist bereits festgeschrieben.", status_code=409)
        art = str(beleg.get("invoice_type") or "invoice")
        if art not in NUMMERNKREIS or art == "storno":
            raise BelegeError("Für diese Belegart gibt es keinen Nummernkreis.", status_code=422)
        if not beleg.get("currency"):
            raise BelegeError("Der Beleg trägt keine Währung.", status_code=422)
        if not self._positionen("invoice_line_items", "invoice_id", beleg_id):
            raise BelegeError(
                "Ein Beleg ohne Positionen kann nicht ausgestellt werden.", status_code=422
            )

        doc_type, prefix = NUMMERNKREIS[art]
        res = self._db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": doc_type, "p_prefix": prefix},
        ).execute()
        num = (res.data or [{}])[0]
        nummer = num.get("formatted_number")
        if not nummer:
            raise BelegeError("Belegnummer konnte nicht vergeben werden.", status_code=500)
        heute = self._heute()
        patch = {
            "invoice_number": str(nummer),
            "invoice_sequence": num.get("sequential_number"),
            "invoice_year": heute.year,
            "status": "finalized",
            "issue_date": beleg.get("issue_date") or heute.isoformat(),
        }
        try:
            upd = (
                self._db.table("invoices")
                .update(patch)
                .eq("id", beleg_id)
                .eq("tenant_id", tenant_id)
                .eq("status", "draft")
                .is_("invoice_number", "null")
                .execute()
            ).data
        except APIError as exc:
            if _UIDX_NUMMER in str(exc):
                raise BelegeError(
                    "Diese Belegnummer ist bereits vergeben.", status_code=409
                ) from exc
            raise
        if not upd:
            # Ein paralleler Request hat den Beleg gerade festgeschrieben.
            raise BelegeError("Der Beleg wurde bereits festgeschrieben.", status_code=409)
        log.info(
            "beleg_festgeschrieben", tenant_id=tenant_id, beleg_id=beleg_id, typ=art, nummer=nummer
        )
        return self._beleg_antwort(tenant_id, {**beleg, **patch})

    # -------------------------------------------------------- Wiederkehrend
    def create_recurring(
        self, ctx: AuthContext, beleg_id: str, body: RecurringCreate
    ) -> DocumentResponse:
        """Aus einer Rechnung eine Vorlage machen (Positionen kopieren)."""
        tenant_id = self._tenant(ctx)
        quelle = self._eigener_beleg(tenant_id, beleg_id)
        if quelle.get("invoice_type") != "invoice":
            raise BelegeError("Nur Rechnungen können wiederkehrend werden.", status_code=422)
        if body.end_at and body.end_at < body.start_at:
            raise BelegeError("Das Ende liegt vor dem Beginn.", status_code=422)
        vorhanden = self._vorhandener_folgebeleg(
            tenant_id, quelle_spalte="source_document_id", quelle_id=beleg_id, ziel="recurring"
        )
        if vorhanden:
            return self._beleg_antwort(tenant_id, vorhanden)
        if not quelle.get("currency"):
            raise BelegeError("Der Quellbeleg trägt keine Währung.", status_code=422)
        positionen = self._positionen("invoice_line_items", "invoice_id", beleg_id)
        rows, net, tax, gross = _positionen_rechnen(
            positionen, is_klein=bool(quelle.get("is_kleinunternehmer"))
        )
        kopf = {
            "tenant_id": tenant_id,
            "customer_id": quelle.get("customer_id"),
            "invoice_type": "recurring",
            "status": "draft",
            "currency": quelle.get("currency"),
            "tax_rule": quelle.get("tax_rule"),
            "tax_rate": quelle.get("tax_rate"),
            "is_kleinunternehmer": bool(quelle.get("is_kleinunternehmer")),
            "head_text": quelle.get("head_text"),
            "footer_text": quelle.get("footer_text"),
            "notes": quelle.get("notes"),
            "language": quelle.get("language"),
            "source_document_id": beleg_id,
            "is_recurring_template": True,
            "recurring_interval": body.interval,
            "recurring_status": "active",
            "recurring_start_at": body.start_at.isoformat(),
            "recurring_next_at": body.start_at.isoformat(),
            "recurring_end_at": body.end_at.isoformat() if body.end_at else None,
            "net_amount": str(net),
            "tax_amount": str(tax),
            "gross_amount": str(gross),
        }
        row = self._kopf_und_positionen_schreiben(
            tenant_id, kopf, rows, unique_namen=(_UIDX_FOLGEBELEG,)
        )
        if row is None:
            vorhanden = self._vorhandener_folgebeleg(
                tenant_id, quelle_spalte="source_document_id", quelle_id=beleg_id, ziel="recurring"
            )
            if not vorhanden:
                raise BelegeError("Vorlage konnte nicht angelegt werden.", status_code=500)
            return self._beleg_antwort(tenant_id, vorhanden)
        log.info(
            "recurring_vorlage_angelegt", tenant_id=tenant_id, quelle_id=beleg_id,
            vorlage_id=row["id"], intervall=body.interval,
        )
        return self._beleg_antwort(tenant_id, row)

    def update_recurring(
        self, ctx: AuthContext, beleg_id: str, body: RecurringUpdate
    ) -> DocumentResponse:
        tenant_id = self._tenant(ctx)
        vorlage = self._eigener_beleg(tenant_id, beleg_id)
        if not vorlage.get("is_recurring_template"):
            raise BelegeError("Dieser Beleg ist keine wiederkehrende Vorlage.", status_code=409)
        patch: dict[str, Any] = {}
        if body.status is not None:
            patch["recurring_status"] = body.status
        if body.interval is not None:
            patch["recurring_interval"] = body.interval
        if body.next_at is not None:
            patch["recurring_next_at"] = body.next_at.isoformat()
        if body.end_at is not None:
            patch["recurring_end_at"] = body.end_at.isoformat()
        if not patch:
            raise BelegeError("Keine Änderung angegeben.", status_code=422)
        naechster = body.next_at or _datum(vorlage.get("recurring_next_at"))
        ende = body.end_at or _datum(vorlage.get("recurring_end_at"))
        if naechster and ende and ende < naechster and patch.get("recurring_status") != "completed":
            raise BelegeError("Das Ende liegt vor dem nächsten Termin.", status_code=422)
        self._db.table("invoices").update(patch).eq("id", beleg_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "recurring_vorlage_geaendert", tenant_id=tenant_id, vorlage_id=beleg_id, patch=patch
        )
        return self._beleg_antwort(tenant_id, {**vorlage, **patch})

    def run_recurring(self, ctx: AuthContext) -> RecurringRunResult:
        """Fällige Vorlagen des Tenants abarbeiten: je Periode EINE Entwurfsrechnung.

        Idempotent über den Unique-Index 0661 — ein zweiter Lauf am selben Tag
        erzeugt nichts, er zählt „skipped". Nachholend (Termin lag mehrere
        Perioden zurück), gedeckelt auf `_MAX_PERIODEN_JE_LAUF`."""
        tenant_id = self._tenant(ctx)
        heute = self._heute()
        vorlagen = (
            self._db.table("invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("is_recurring_template", True)
            .eq("recurring_status", "active")
            .lte("recurring_next_at", heute.isoformat())
            .is_("deleted_at", "null")
            .order("recurring_next_at")
            .limit(MAX_LIMIT)
            .execute()
        ).data or []
        ergebnis = RecurringRunResult(created=0, skipped=0, completed=0)
        for vorlage in vorlagen:
            self._vorlage_abarbeiten(tenant_id, vorlage, heute, ergebnis)
        log.info(
            "recurring_lauf", tenant_id=tenant_id, vorlagen=len(vorlagen),
            created=ergebnis.created, skipped=ergebnis.skipped, completed=ergebnis.completed,
        )
        return ergebnis

    def _vorlage_abarbeiten(
        self, tenant_id: str, vorlage: dict, heute: date, ergebnis: RecurringRunResult
    ) -> None:
        vorlage_id = str(vorlage["id"])
        intervall = str(vorlage.get("recurring_interval") or "")
        termin = _datum(vorlage.get("recurring_next_at"))
        ende = _datum(vorlage.get("recurring_end_at"))
        if not termin or intervall not in {"weekly", "monthly", "quarterly", "yearly"}:
            log.warning(
                "recurring_vorlage_unvollstaendig", tenant_id=tenant_id, vorlage_id=vorlage_id
            )
            return
        positionen = self._positionen("invoice_line_items", "invoice_id", vorlage_id)
        rows, net, tax, gross = _positionen_rechnen(
            positionen, is_klein=bool(vorlage.get("is_kleinunternehmer"))
        )
        abgeschlossen = False
        schritte = 0
        while termin <= heute and schritte < _MAX_PERIODEN_JE_LAUF:
            if ende and termin > ende:
                abgeschlossen = True
                break
            kopf = {
                "tenant_id": tenant_id,
                "customer_id": vorlage.get("customer_id"),
                "invoice_type": "invoice",
                "status": "draft",
                "issue_date": termin.isoformat(),
                "currency": vorlage.get("currency"),
                "tax_rule": vorlage.get("tax_rule"),
                "tax_rate": vorlage.get("tax_rate"),
                "is_kleinunternehmer": bool(vorlage.get("is_kleinunternehmer")),
                "head_text": vorlage.get("head_text"),
                "footer_text": vorlage.get("footer_text"),
                "notes": vorlage.get("notes"),
                "language": vorlage.get("language"),
                "recurring_template_id": vorlage_id,
                "recurring_period_start": termin.isoformat(),
                "net_amount": str(net),
                "tax_amount": str(tax),
                "gross_amount": str(gross),
            }
            row = self._kopf_und_positionen_schreiben(
                tenant_id, kopf, rows, unique_namen=(_UIDX_RECURRING_LAUF,)
            )
            if row is None:
                ergebnis.skipped += 1
            else:
                ergebnis.created += 1
                ergebnis.created_ids.append(str(row["id"]))
            termin = naechster_termin(termin, intervall)
            schritte += 1
        if not abgeschlossen and ende and termin > ende:
            abgeschlossen = True
        patch: dict[str, Any] = {"recurring_next_at": termin.isoformat()}
        if abgeschlossen:
            patch["recurring_status"] = "completed"
            ergebnis.completed += 1
        self._db.table("invoices").update(patch).eq("id", vorlage_id).eq(
            "tenant_id", tenant_id
        ).execute()


__all__ = [
    "KETTE",
    "NUMMERNKREIS",
    "BelegeError",
    "BelegeService",
    "PositionInput",
    "festgeschrieben",
    "naechster_termin",
]
