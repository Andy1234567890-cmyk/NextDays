"""Angebote in der Form des übernommenen Buchhaltungs-Bestands.

Das Taskilo-Frontend (``web/services/quoteService.ts``, ``QuoteDetailView``,
``DocumentListView``, ``SendDocumentModal``) spricht Angebote in ZWEI Formen
an, die 0024/``service.py`` beide nicht kannten:

* ``quoteService.createQuote`` schickt snake_case mit Cent-Beträgen
  (``quote_date``, ``internal_notes``, ``items[].unit_price_cents``) und liest
  Antworten über ``parseQuoteResponse`` (``subtotal_cents``, ``sent_at`` …).
* Der Editor (``create-invoice/``) schickt das reiche camelCase-Payload der
  Rechnung (``customerName``, ``items[].unitPrice``, ``headTextHtml`` …), und
  der Versand-Dialog PATCHt Vorlage/Farbe/Skonto ebenfalls camelCase.

Bis zum 13.09.2026 lief davon NICHTS: ``GET /quotes/company/{id}`` gab 404,
``POST /quotes`` verwarf jede Position mit 422 (kein ``unit_price``), und die
Angebotsseite war ein eigener 152-Zeilen-Schieber, der nicht aussah wie das
Werkzeug, das übernommen werden sollte.

Dieses Modul übersetzt beide Formen auf den EINEN Schreibpfad
``BuchhaltungService.create_quote`` (Nummer, §19, Beträge serverseitig) und
liefert Angebote zurück, wie der Bestand sie liest. Es kopiert keine
Fachlogik aus ``service.py`` — es ruft sie.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext

from .aufenthalt_kontext import aufenthalt_kontext
from .positionen_kontext import (
    aufenthalt_aus_bestand,
    eltern_positionen,
    eltern_verknuepfen,
    objekt_titel,
    objekte_pruefen,
)
from .schemas import POSITIONS_BASEN, LineItemInput, QuoteCreate
from .service import BuchhaltungError, BuchhaltungService, _q

log = get_logger("nextdays.buchhaltung.angebote")

# Statuskatalog des Bestands (0697 CHECK). `converted` setzt ausschließlich
# `convert_quote_to_invoice`; über PATCH ist er nicht erreichbar.
STATUS_ZULAESSIG: frozenset[str] = frozenset(
    {"draft", "sent", "accepted", "rejected", "expired", "cancelled"}
)
# Welcher Status welchen Zeitstempel setzt — einmal, nie überschreiben.
_STATUS_ZEITPUNKT: dict[str, str] = {
    "sent": "sent_at",
    "accepted": "accepted_at",
    "rejected": "rejected_at",
    "cancelled": "cancelled_at",
}
# Vorlagen-Einstellungen, die der Versand-Dialog am Beleg speichert. Sie landen
# gebündelt in `quotes.design` (jsonb, 0697), nicht als 6 Spalten.
_DESIGN_FELDER: tuple[tuple[str, str], ...] = (
    ("template", "template"),
    ("templateId", "template"),
    ("templateType", "template"),
    ("color", "color"),
    ("logoUrl", "logoUrl"),
    ("logoSize", "logoSize"),
    ("pageMode", "pageMode"),
    ("documentSettings", "documentSettings"),
)
_MAX_TAGS = 50
_MAX_TAG_LAENGE = 60
# Inhaltsfelder des PATCH: (Client-Schreibweise → Spalte), camel und snake.
_INHALT_FELDER: tuple[tuple[str, str], ...] = (
    ("notes", "notes"),
    ("internal_notes", "footer_text"),
    ("footerText", "footer_text"),
    ("footer_text", "footer_text"),
    ("headTextHtml", "head_text"),
    ("head_text", "head_text"),
    ("title", "title"),
    ("customerOrderNumber", "customer_order_number"),
    ("customer_order_number", "customer_order_number"),
    ("taxRule", "tax_rule"),
    ("tax_rule", "tax_rule"),
    ("language", "language"),
    ("documentLanguage", "language"),
)


def _erster(payload: dict, *namen: str) -> object:
    """Erster gesetzter Wert unter mehreren Schreibweisen (camel/snake)."""
    for name in namen:
        wert = payload.get(name)
        if wert not in (None, ""):
            return wert
    return None


def _dec(wert: object, feld: str) -> Decimal:
    try:
        return Decimal(str(wert))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise BuchhaltungError(f"Ungültiger Zahlenwert in „{feld}“.", status_code=422) from exc


def _datum(wert: object) -> date | None:
    """ISO-Datum oder ISO-Zeitstempel → date; alles andere → 422."""
    if wert in (None, ""):
        return None
    if isinstance(wert, date):
        return wert
    text = str(wert)[:10]
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise BuchhaltungError(f"Ungültiges Datum „{wert}“.", status_code=422) from exc


def _cents(wert: object) -> int:
    return int((_q(Decimal(str(wert or 0))) * 100).to_integral_value())


def _position_aus_bestand(item: dict, nummer: int) -> LineItemInput:
    """Eine Position aus einer der beiden Client-Formen bauen.

    Steuersatz ist PFLICHT (Wurzel 4): `LineItemInput` trägt zwar noch den
    deutschen Regelsatz als Vorgabe, hier darf er nicht greifen — ein dänisches
    Angebot mit 25 % würde sonst still mit 19 % gerechnet.
    """
    beschreibung = str(item.get("description") or "").strip()
    if not beschreibung:
        raise BuchhaltungError(f"Position {nummer}: Beschreibung fehlt.", status_code=422)
    satz = _erster(item, "tax_rate", "taxRate", "vatRate")
    if satz is None:
        raise BuchhaltungError(
            f"Position {nummer} „{beschreibung}“: Steuersatz fehlt.", status_code=422
        )
    if item.get("unit_price_cents") is not None:
        preis = _dec(item["unit_price_cents"], "unit_price_cents") / Decimal(100)
    else:
        preis = _dec(_erster(item, "unit_price", "unitPrice") or 0, "unitPrice")
    # Rabatt-Positionen des Editors (category=discount) tragen den Betrag positiv
    # und meinen ihn negativ — wie create_invoice_from_bestand.
    if item.get("category") == "discount":
        preis = -abs(preis)
    basis = item.get("basis")
    if basis is not None and basis not in POSITIONS_BASEN:
        raise BuchhaltungError(
            f"Position {nummer}: unbekannte Abrechnungsbasis „{basis}“.", status_code=422
        )
    try:
        aufenthalt = aufenthalt_aus_bestand(item)
    except ValueError as exc:
        raise BuchhaltungError(f"Position {nummer}: {exc}", status_code=422) from exc
    return LineItemInput(
        description=beschreibung,
        quantity=_dec(item.get("quantity") or 1, "quantity"),
        unit=str(item.get("unit") or "Stk"),
        unit_price=preis,
        tax_rate=_dec(satz, "taxRate"),
        discount_percent=_dec(
            _erster(item, "discount_percent", "discountPercent") or 0, "discountPercent"
        ),
        sku=item.get("sku") or item.get("inventoryItemId") or None,
        basis=basis,
        # Aufenthalt der Zeile + Zugehörigkeit zur Übernachtung (0702).
        property_id=aufenthalt["property_id"],
        check_in=date.fromisoformat(aufenthalt["check_in"]) if aufenthalt["check_in"] else None,
        check_out=date.fromisoformat(aufenthalt["check_out"]) if aufenthalt["check_out"] else None,
        client_line_id=str(item.get("id") or "") or None,
        parent_line_id=str(item.get("parentItemId") or item.get("parent_line_id") or "") or None,
    )


class AngeboteBestand:
    """Bestands-Sicht auf Angebote — Lesen in der Form von
    ``parseQuoteResponse``, Schreiben aus beiden Client-Formen."""

    def __init__(self, service: BuchhaltungService) -> None:
        self._svc = service
        self._db = service._db  # noqa: SLF001  # pylint: disable=protected-access

    # ------------------------------------------------------------ Lesen
    def _kunden(self, tenant_id: str, ids: set[str]) -> dict[str, dict]:
        if not ids:
            return {}
        res = (
            self._db.table("customers")
            .select("id, name, email, phone, customer_number, customer_type, address")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        )
        return {row["id"]: row for row in (res.data or [])}

    @staticmethod
    def _anschrift(address: object) -> str:
        if not address:
            return ""
        if isinstance(address, str):
            return address
        if isinstance(address, dict):
            plz = str(address.get("postalCode") or address.get("postal_code") or "").strip()
            ort = str(address.get("city") or "").strip()
            zeilen = [
                str(address.get("street") or "").strip(),
                " ".join(s for s in (plz, ort) if s),
                str(address.get("country") or "").strip(),
            ]
            return "\n".join(z for z in zeilen if z)
        return str(address)

    def als_bestand(self, row: dict, items: list[dict], kunde: dict | None) -> dict:
        """Eine DB-Zeile (+ Positionen) in die Form bringen, die
        ``quoteService.parseQuoteResponse`` und die Detailansicht lesen.

        Beträge kommen als Cent-Ganzzahlen UND als Dezimalzahlen mit — der
        Parser liest Cents, die PDF-Vorlagen lesen ``total``/``items[].total``.
        """
        design = row.get("design") or {}
        # Objekttitel je Position (0702) — die Ausgabe zeigt „Objekt · Anreise –
        # Abreise"; ohne Titel bleibt die Zeile ohne Zusatz, statt eine ID zu
        # drucken. Nur EIN Zugriff für alle Positionen.
        titel = objekt_titel(
            self._db, str(row.get("tenant_id") or ""), [it.get("property_id") for it in items]
        )
        positionen = []
        for it in items:
            netto = _q(Decimal(str(it.get("net_amount") or 0)))
            positionen.append({
                "id": it.get("id"),
                "position": it.get("position"),
                "description": it.get("description") or "",
                "quantity": str(it.get("quantity") or 0),
                "unit": it.get("unit") or "Stk",
                "unit_price": str(it.get("unit_price") or 0),
                "unit_price_cents": _cents(it.get("unit_price")),
                "total_cents": _cents(netto),
                "total": float(netto),
                "tax_rate": str(it.get("tax_rate") or 0),
                "discount_percent": str(it.get("discount_percent") or 0),
                "sku": it.get("sku"),
                "inventory_item_id": it.get("sku"),
                "basis": it.get("basis"),
                "property_id": it.get("property_id"),
                "property_title": titel.get(str(it.get("property_id") or "")),
                "check_in": it.get("check_in"),
                "check_out": it.get("check_out"),
                "parent_line_id": it.get("parent_line_id"),
            })
        netto = _q(Decimal(str(row.get("net_amount") or 0)))
        steuer = _q(Decimal(str(row.get("tax_amount") or 0)))
        brutto = _q(Decimal(str(row.get("gross_amount") or 0)))
        nummer = row.get("quote_number") or ""
        return {
            "id": row.get("id"),
            "company_id": row.get("tenant_id"),
            "quote_number": nummer,
            "number": nummer,
            "sequentialNumber": row.get("quote_sequence") or 0,
            "status": row.get("status") or "draft",
            "quote_date": row.get("issue_date"),
            "date": row.get("issue_date"),
            "valid_until": row.get("valid_until"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "customer_id": row.get("customer_id"),
            "customer_name": (kunde or {}).get("name") or "",
            "customer_email": (kunde or {}).get("email") or "",
            "customer_phone": (kunde or {}).get("phone") or "",
            "customer_number": (kunde or {}).get("customer_number") or "",
            # private|business — der Editor stellt daraus Person/Organisation
            # (vorher fiel er immer auf seinen Vorgabewert „Organisation").
            "customer_type": (kunde or {}).get("customer_type") or None,
            "customer_address": self._anschrift((kunde or {}).get("address")),
            "title": row.get("title") or "",
            "customer_order_number": row.get("customer_order_number") or "",
            # Aufenthaltsangebot (0701): Objekt und Anzahlung.
            "property_id": row.get("property_id"),
            "deposit_amount": (
                float(row["deposit_amount"]) if row.get("deposit_amount") is not None else None
            ),
            "stay_from": row.get("stay_from"),
            "stay_to": row.get("stay_to"),
            "guest_count": row.get("guest_count"),
            # 0699: Spiegel eines Kalender-Angebots („Reservierung mit Angebot").
            "booking_offer_id": row.get("booking_offer_id"),
            "head_text": row.get("head_text") or "",
            "headTextHtml": row.get("head_text") or "",
            "notes": row.get("notes") or "",
            "internal_notes": row.get("footer_text") or "",
            "footer_text": row.get("footer_text") or "",
            "tax_rule": row.get("tax_rule"),
            # Dokumentsprache (0700): None = Bestand → die Anzeige nimmt de.
            "language": row.get("language"),
            # Wurzel 4: Währung aus der Zeile; fehlt sie, leer statt EUR.
            "currency": row.get("currency") or "",
            "items": positionen,
            "subtotal_cents": _cents(netto),
            "tax_cents": _cents(steuer),
            "total_cents": _cents(brutto),
            "subtotal": float(netto),
            "amount": float(netto),
            "tax": float(steuer),
            "total": float(brutto),
            "pdf_url": row.get("pdf_url"),
            "sent_at": row.get("sent_at"),
            "accepted_at": row.get("accepted_at"),
            "rejected_at": row.get("rejected_at"),
            "cancelled_at": row.get("cancelled_at"),
            "rejection_reason": row.get("rejection_reason"),
            "converted_invoice_id": row.get("converted_invoice_id"),
            "invoice_id": row.get("converted_invoice_id"),
            "converted": bool(row.get("converted_invoice_id")),
            "tags": list(row.get("tags") or []),
            # Vorlagen-Einstellungen flach, wie Detailansicht/Vorschau sie lesen.
            "template": design.get("template"),
            "color": design.get("color"),
            "logoUrl": design.get("logoUrl"),
            "logoSize": design.get("logoSize"),
            "pageMode": design.get("pageMode"),
            "documentSettings": design.get("documentSettings"),
            "created_by": row.get("created_by") or "",
        }

    def liste(self, ctx: AuthContext, status: str | None = None) -> list[dict]:
        """Alle Angebote des Tenants (ohne Positionen) in Bestandsform.
        Sortiert nach Angebotsdatum, nicht nach unserer Uhr (Wurzel 5b)."""
        tenant_id = self._svc._require_tenant(ctx)  # noqa: SLF001  # pylint: disable=protected-access
        abfrage = (
            self._db.table("quotes")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
        )
        if status:
            if status not in STATUS_ZULAESSIG | {"converted"}:
                raise BuchhaltungError(f"Unbekannter Status „{status}“.", status_code=422)
            abfrage = abfrage.eq("status", status)
        rows = (
            abfrage.order("issue_date", desc=True)
            .order("created_at", desc=True)
            .limit(2000)
            .execute()
            .data
            or []
        )
        kunden = self._kunden(tenant_id, {r["customer_id"] for r in rows if r.get("customer_id")})
        return [self.als_bestand(r, [], kunden.get(r.get("customer_id") or "")) for r in rows]

    def einzeln(self, ctx: AuthContext, quote_id: str) -> dict:
        tenant_id = self._svc._require_tenant(ctx)  # noqa: SLF001  # pylint: disable=protected-access
        row = self._eigene(tenant_id, quote_id)
        items = (
            self._db.table("quote_line_items")
            .select("*")
            .eq("quote_id", quote_id)
            .order("position")
            .execute()
        ).data or []
        kunden = self._kunden(tenant_id, {row["customer_id"]} if row.get("customer_id") else set())
        out = self.als_bestand(row, items, kunden.get(row.get("customer_id") or ""))
        # Aufenthaltskontext (Bild, Zeiten, Zahlungsplan, Storno, Hausregeln) nur
        # im Detail — die Liste braucht ihn nicht und zahlt ihn nicht.
        out["stay"] = aufenthalt_kontext(
            self._db,
            tenant_id,
            row.get("property_id"),
            lang=str(row.get("language") or "de"),
            total=row.get("gross_amount"),
            check_in=_datum(row.get("stay_from")),
            deposit=row.get("deposit_amount"),
        )
        return out

    def _eigene(self, tenant_id: str, quote_id: str) -> dict:
        res = (
            self._db.table("quotes")
            .select("*")
            .eq("id", quote_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BuchhaltungError("Angebot nicht gefunden.", status_code=404)
        return res.data[0]

    # --------------------------------------------------------- Schreiben
    def _kunde_aufloesen(self, tenant_id: str, payload: dict) -> str | None:
        """Kunden-ID aus dem Payload — per ID (tenant-geprüft) oder, wie der
        Editor es liefert, per exaktem Namen im Tenant. Fremde IDs → 404."""
        kunde_id = _erster(payload, "customer_id", "customerId")
        if kunde_id:
            rows = (
                self._db.table("customers")
                .select("id")
                .eq("id", str(kunde_id))
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            if not rows:
                raise BuchhaltungError("Kunde nicht gefunden.", status_code=404)
            return str(kunde_id)
        name = str(_erster(payload, "customerName", "customer_name") or "").strip()
        if not name:
            return None
        rows = (
            self._db.table("customers")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("name", name)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        return rows[0]["id"] if rows else None

    @staticmethod
    def _kopfdaten(payload: dict) -> dict[str, Any]:
        """Aufenthalt + Personen (0698) aus beiden Schreibweisen; nichts erfinden."""
        kopf: dict[str, Any] = {}
        von = _datum(_erster(payload, "stayFrom", "stay_from"))
        bis = _datum(_erster(payload, "stayTo", "stay_to"))
        if von:
            kopf["stay_from"] = von.isoformat()
        if bis:
            kopf["stay_to"] = bis.isoformat()
        personen = _erster(payload, "guestCount", "guest_count")
        if personen is not None:
            try:
                n = int(str(personen))
            except ValueError as exc:
                raise BuchhaltungError("guestCount muss eine Zahl sein.", status_code=422) from exc
            if n < 0:
                raise BuchhaltungError("guestCount darf nicht negativ sein.", status_code=422)
            kopf["guest_count"] = n
        objekt = _erster(payload, "propertyId", "property_id")
        if objekt is not None:
            kopf["property_id"] = str(objekt) or None
        anzahlung = _erster(payload, "depositAmount", "deposit_amount")
        if anzahlung is not None:
            if anzahlung == "" or anzahlung is False:
                kopf["deposit_amount"] = None
            else:
                betrag = _dec(anzahlung, "depositAmount")
                if betrag < 0:
                    raise BuchhaltungError(
                        "depositAmount darf nicht negativ sein.", status_code=422
                    )
                kopf["deposit_amount"] = str(betrag)
        return kopf

    @staticmethod
    def _design_aus(payload: dict, bisher: dict | None) -> dict | None:
        design = dict(bisher or {})
        geaendert = False
        for quelle, ziel in _DESIGN_FELDER:
            if payload.get(quelle) is not None:
                design[ziel] = payload[quelle]
                geaendert = True
        return design if geaendert else None

    @staticmethod
    def _tags_pruefen(wert: object) -> list[str]:
        if not isinstance(wert, list):
            raise BuchhaltungError("tags muss eine Liste sein.", status_code=422)
        tags = [str(t).strip() for t in wert if str(t).strip()]
        if len(tags) > _MAX_TAGS or any(len(t) > _MAX_TAG_LAENGE for t in tags):
            raise BuchhaltungError("Zu viele oder zu lange Tags.", status_code=422)
        return list(dict.fromkeys(tags))

    def anlegen(self, ctx: AuthContext, payload: dict) -> dict:
        """Angebot aus einer der beiden Client-Formen anlegen.

        Reihenfolge: alles validieren, DANN ``create_quote`` (zieht die Nummer
        atomar), DANN die Bestandsfelder nachtragen. Scheitert die Validierung,
        wurde keine Nummer verbrannt.
        """
        tenant_id = self._svc._require_tenant(ctx)  # noqa: SLF001  # pylint: disable=protected-access
        roh_items = payload.get("items") or []
        if not isinstance(roh_items, list):
            raise BuchhaltungError("items muss eine Liste sein.", status_code=422)
        # Leere Zeilen des Editors (ohne Beschreibung) sind keine Positionen.
        positionen = [
            _position_aus_bestand(it, i + 1)
            for i, it in enumerate(roh_items)
            if isinstance(it, dict) and str(it.get("description") or "").strip()
        ]
        status = str(payload.get("status") or "draft")
        if status not in ("draft", "sent"):
            raise BuchhaltungError(
                "Ein neues Angebot ist Entwurf oder versendet, nichts anderes.", status_code=422
            )
        kunde_id = self._kunde_aufloesen(tenant_id, payload)
        req = QuoteCreate(
            customer_id=kunde_id,
            status=status,
            issue_date=_datum(_erster(payload, "quote_date", "issueDate", "date", "invoiceDate")),
            valid_until=_datum(_erster(payload, "valid_until", "validUntil", "dueDate")),
            currency=_erster(payload, "currency") or None,
            tax_rule=_erster(payload, "tax_rule", "taxRule", "taxRuleType"),
            head_text=_erster(payload, "head_text", "headTextHtml", "description"),
            footer_text=_erster(payload, "footer_text", "footerText", "internal_notes"),
            notes=payload.get("notes"),
            language=_erster(payload, "language", "documentLanguage"),
            items=positionen,
        )
        angebot = self._svc.create_quote(ctx, req)
        extras: dict[str, Any] = {}
        title = _erster(payload, "title")
        if title:
            extras["title"] = str(title)[:200]
        referenz = _erster(payload, "customer_order_number", "customerOrderNumber", "reference")
        if referenz:
            extras["customer_order_number"] = str(referenz)[:120]
        design = self._design_aus(payload, None)
        if design:
            extras["design"] = design
        extras.update(self._kopfdaten(payload))
        if status == "sent":
            extras["sent_at"] = datetime.now(UTC).isoformat()
        if extras:
            self._db.table("quotes").update(extras).eq("id", angebot.id).eq(
                "tenant_id", tenant_id
            ).execute()
        log.info(
            "angebot_angelegt",
            tenant_id=tenant_id,
            quote_id=angebot.id,
            quote_number=angebot.quote_number,
            positionen=len(positionen),
            form="cents" if roh_items and "unit_price_cents" in roh_items[0] else "editor",
        )
        return self.einzeln(ctx, angebot.id)

    @staticmethod
    def _status_patch(row: dict, payload: dict) -> dict[str, Any]:
        """Statuswechsel samt Zeitstempel (einmal gesetzt, nie überschrieben)."""
        patch: dict[str, Any] = {}
        neuer_status = payload.get("status")
        if neuer_status is not None:
            neuer_status = str(neuer_status)
            if neuer_status not in STATUS_ZULAESSIG:
                raise BuchhaltungError(f"Unzulässiger Status „{neuer_status}“.", status_code=422)
            if neuer_status != row.get("status"):
                patch["status"] = neuer_status
                zeitfeld = _STATUS_ZEITPUNKT.get(neuer_status)
                if zeitfeld and not row.get(zeitfeld):
                    patch[zeitfeld] = datetime.now(UTC).isoformat()
                if neuer_status == "rejected" and payload.get("rejectionReason"):
                    patch["rejection_reason"] = str(payload["rejectionReason"])[:500]
        # Der Versand-Dialog schickt `sentAt` explizit mit — respektieren, wenn
        # noch keiner steht (die eigene Uhr ist nicht der Zeitpunkt, Wurzel 5b).
        gesendet = _erster(payload, "sentAt", "sent_at")
        if gesendet and not row.get("sent_at"):
            patch["sent_at"] = str(gesendet)
        return patch

    def _inhalt_patch(self, tenant_id: str, payload: dict) -> dict[str, Any]:
        """Inhaltliche Felder (Texte, Termine, Kunde, PDF) aus beiden Schreibweisen."""
        inhalt: dict[str, Any] = {}
        for quelle, ziel in _INHALT_FELDER:
            if payload.get(quelle) is not None:
                inhalt[ziel] = payload[quelle]
        for ziel, quellen in (
            ("issue_date", ("quote_date", "date", "issueDate")),
            ("valid_until", ("valid_until", "validUntil")),
        ):
            neu = _datum(_erster(payload, *quellen))
            if neu is not None:
                inhalt[ziel] = neu.isoformat()
        kunde_id = _erster(payload, "customer_id", "customerId")
        if kunde_id:
            inhalt["customer_id"] = self._kunde_aufloesen(tenant_id, {"customer_id": kunde_id})
        pdf_url = _erster(payload, "pdf_url", "pdfUrl")
        if pdf_url:
            inhalt["pdf_url"] = str(pdf_url)
        inhalt.update(self._kopfdaten(payload))
        return inhalt

    def aendern(self, ctx: AuthContext, quote_id: str, payload: dict) -> dict:
        """PATCH in Bestandsform: Status samt Zeitstempel, Texte, Termine,
        Tags, Vorlagen-Einstellungen, optional Positionen.

        Umgewandelte Angebote sind eingefroren (409). Angenommene Angebote
        ändern nur noch Status/Tags/Vorlage, nicht den Inhalt.
        """
        tenant_id = self._svc._require_tenant(ctx)  # noqa: SLF001  # pylint: disable=protected-access
        row = self._eigene(tenant_id, quote_id)
        if row.get("converted_invoice_id") or row.get("status") == "converted":
            raise BuchhaltungError(
                "Angebot wurde bereits in eine Rechnung umgewandelt.", status_code=409
            )
        patch = self._status_patch(row, payload)
        inhalt = self._inhalt_patch(tenant_id, payload)
        if row.get("status") == "accepted" and inhalt:
            raise BuchhaltungError(
                "Angenommene Angebote können nicht mehr inhaltlich geändert werden.",
                status_code=409,
            )
        patch.update(inhalt)

        if "tags" in payload:
            patch["tags"] = self._tags_pruefen(payload["tags"])
        design = self._design_aus(payload, row.get("design"))
        if design is not None:
            patch["design"] = design

        # Skonto-Felder schickt der Versand-Dialog bei jeder Aktion mit; ein
        # Angebot hat dafür keine Spalte. Nicht still schlucken: sichtbar loggen.
        if any(k in payload for k in ("skontoEnabled", "skontoDays", "skontoPercentage")):
            log.info("angebot_skonto_ignoriert", tenant_id=tenant_id, quote_id=quote_id)

        if isinstance(payload.get("items"), list):
            if row.get("status") == "accepted":
                raise BuchhaltungError(
                    "Positionen eines angenommenen Angebots sind eingefroren.", status_code=409
                )
            positionen = [
                _position_aus_bestand(it, i + 1) for i, it in enumerate(payload["items"])
            ]
            # Objektbindung prüfen, BEVOR die bestehenden Zeilen gelöscht werden.
            objekte_pruefen(
                self._db,
                tenant_id,
                [p.property_id for p in positionen],
                not_found=BuchhaltungError("Objekt nicht gefunden.", status_code=404),
            )
            eltern = eltern_positionen(
                [(p.client_line_id, p.parent_line_id) for p in positionen]
            )
            is_klein = self._svc._is_kleinunternehmer(tenant_id)  # noqa: SLF001  # pylint: disable=protected-access
            zeilen = [
                self._svc._compute_line(p, i + 1, is_klein=is_klein)  # noqa: SLF001  # pylint: disable=protected-access
                for i, p in enumerate(positionen)
            ]
            netto = _q(sum((Decimal(z["net_amount"]) for z in zeilen), Decimal(0)))
            steuer = _q(sum((Decimal(z["tax_amount"]) for z in zeilen), Decimal(0)))
            self._db.table("quote_line_items").delete().eq("quote_id", quote_id).execute()
            for z in zeilen:
                z["quote_id"] = quote_id
            if zeilen:
                self._db.table("quote_line_items").insert(zeilen).execute()
                eltern_verknuepfen(
                    self._db, "quote_line_items", "quote_id", quote_id, eltern
                )
            patch.update({
                "net_amount": str(netto),
                "tax_amount": str(steuer),
                "gross_amount": str(_q(netto + steuer)),
            })

        if patch:
            self._db.table("quotes").update(patch).eq("id", quote_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info(
                "angebot_geaendert",
                tenant_id=tenant_id,
                quote_id=quote_id,
                felder=sorted(patch),
                status=patch.get("status"),
            )
        if row.get("booking_offer_id") and (inhalt or "items" in payload):
            # Spiegel eines Kalender-Angebots (0699): der Editor ist der Ort, an
            # dem der Betrieb das Angebot bearbeitet — Zeitraum, Gast, Positionen
            # und Gültigkeit fließen zurück, damit der Gast im Annahmelink
            # denselben Stand sieht wie das PDF.
            from .angebot_bruecke import quelle_nachziehen  # noqa: PLC0415 — zirkulär

            quelle_nachziehen(self._db, tenant_id, self._eigene(tenant_id, quote_id))
        return self.einzeln(ctx, quote_id)
