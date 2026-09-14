"""Fachlogik des Bereichs »ausgaben«: Eingangsbelege, Kategorien, Beleg-Datei,
wiederkehrende Ausgaben, Belegausleser.

Was vom alten Werkzeug übrig blieb, ist die FORM (Titel, Lieferant, Belegnummer,
Netto/Steuer/Brutto, Kategorie, Zahlstatus, wiederkehrend, Beleg-Upload mit
OCR). Die REGELN sind neu und stehen ausschließlich hier:

  * Beträge rechnet der Server aus Brutto ODER Netto + Steuersatz; liefert der
    Client mehrere, müssen sie zusammenpassen (sonst 422). Kein 19-%-Default.
  * Währung aus dem Body, sonst aus `tenants.currency`; fehlt beides → 422.
  * Jede per-ID-Ladung über `load_scoped` (Wurzel 3).
  * Beleg-Datei: Magic-Bytes, 15 MB, privater Bucket, signierte URL (Wurzel 8).
  * Wiederkehrend: der Lauf legt je fälligem Termin EINE Kopie an; der
    Unique-Index (0656) fängt Retry/Doppellauf → wird als „übersprungen"
    gezählt, nicht als Fehler (Wurzel 2).
  * GoBD-Sperre: gesperrte Belege → 409 bei Fachdaten-Änderung und Löschen.
  * Belegausleser: Gemini über `VertexClient.erzeuge_multimodal`, Tagesdeckel
    VOR dem Aufruf, Buchung DANACH — und nur, wenn der Funktionsname
    `beleg_ocr` in `ki_nutzung.FUNKTIONEN` steht (sonst 503, fail-closed;
    eine stumme Nicht-Buchung wäre eine Attrappe des Deckels).
"""

from __future__ import annotations

import base64
import json
import re
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any, Protocol
from uuid import uuid4

from postgrest.exceptions import APIError
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.features.site_config import ki_nutzung

from .schemas import (
    MAX_LIMIT,
    MAX_ZEITRAUM_TAGE,
    PAYMENT_STATUSES,
    RECURRING_INTERVALS,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseResponse,
    ExpenseUpdate,
    ReceiptExtraction,
    ReceiptUrlResponse,
    RecurringRunResult,
)

log = get_logger("nextdays.buchhaltung.ausgaben")

# Privater Bucket (0657). 15 MB — doppelt geprüft: die Bucket-Grenze schützt
# den Speicher, diese hier den Vertex-Aufruf (base64 = +33 %).
BELEG_BUCKET = "ausgaben-belege"
BELEG_MAX_BYTES = 15 * 1024 * 1024
BELEG_URL_TTL = 600

# KI-Funktionsname (0658). MUSS in `ki_nutzung.FUNKTIONEN` stehen.
OCR_FUNKTION = "beleg_ocr"
OCR_MAX_ANTWORT_TOKENS = 2_000

# Höchstens so viele Kopien je Vorlage und Lauf — eine Vorlage, deren
# `next_due_date` drei Jahre zurückliegt, erzeugt sonst tausend Zeilen.
MAX_KOPIEN_JE_VORLAGE = 36

_ZWEI_STELLEN = Decimal("0.01")
_TOLERANZ = Decimal("0.02")
_ISO_WAEHRUNG = re.compile(r"^[A-Z]{3}$")

# Felder, die ein GoBD-gesperrter Beleg nicht mehr ändern darf — deckungsgleich
# mit dem Trigger `expenses_gobd_sperre` (0656).
GESPERRTE_FELDER: frozenset[str] = frozenset(
    {
        "net_amount", "tax_amount", "gross_amount", "tax_rate", "currency",
        "expense_date", "receipt_number", "supplier_name", "supplier_id",
        "receipt_path", "title",
    }
)

# Magic-Bytes → (MIME, Endung). HEIC/HEIF ist ISO-BMFF: `ftyp` ab Byte 4 und
# eine der bekannten Marken ab Byte 8.
_HEIC_MARKEN = {b"heic", b"heix", b"hevc", b"hevx", b"heif", b"mif1", b"msf1"}


def _dateiart(inhalt: bytes) -> tuple[str, str] | None:
    """Erkennt PDF/JPEG/PNG/HEIC an den ersten Bytes — nie am Client-Typ."""
    if inhalt.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if inhalt.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if inhalt.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(inhalt) >= 12 and inhalt[4:8] == b"ftyp" and inhalt[8:12] in _HEIC_MARKEN:
        heif = inhalt[8:12] in {b"heif", b"mif1", b"msf1"}
        return ("image/heif" if heif else "image/heic"), "heic"
    return None


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _dec_oder_none(wert: object) -> Decimal | None:
    if wert is None or wert == "":
        return None
    try:
        return _q(Decimal(str(wert).replace(",", ".")))
    except (InvalidOperation, ValueError):
        return None


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, date):
        return wert
    try:
        return date.fromisoformat(str(wert)[:10])
    except ValueError:
        return None


def _dateiname_saeubern(name: str) -> str:
    name = re.sub(r"[^\w.\- ]+", "_", name.strip(), flags=re.UNICODE)[:120]
    return name or "beleg"


class AusgabenError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> AusgabenError:
    return AusgabenError(f"{was} nicht gefunden.", status_code=404)


def _naechster_termin(termin: date, intervall: str) -> date:
    if intervall == "daily":
        return termin + timedelta(days=1)
    if intervall == "weekly":
        return termin + timedelta(days=7)
    monate = {"monthly": 1, "quarterly": 3, "yearly": 12}[intervall]
    jahr = termin.year + (termin.month - 1 + monate) // 12
    monat = (termin.month - 1 + monate) % 12 + 1
    # Monatsende bleibt Monatsende (31.01. → 28.02.), statt in den März zu rutschen.
    letzter = (date(jahr + (monat == 12), monat % 12 + 1, 1) - timedelta(days=1)).day
    return date(jahr, monat, min(termin.day, letzter))


def betraege_rechnen(
    *,
    gross: Decimal | None,
    net: Decimal | None,
    tax: Decimal | None,
    tax_rate: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    """(netto, steuer, brutto) aus dem, was da ist. Pflicht: Brutto ODER Netto.

    Mitgelieferte Zweitwerte werden GEPRÜFT (± 2 Cent Rundung), nicht
    überschrieben — eine Abweichung ist ein Erfassungsfehler, den der Nutzer
    sehen muss, kein Fall für „wir nehmen den plausibleren".
    """
    faktor = Decimal(1) + tax_rate / Decimal(100)
    if gross is None and net is None:
        raise AusgabenError("Brutto- oder Nettobetrag fehlt.", status_code=422)
    if net is None:
        assert gross is not None  # noqa: S101 — oben geprüft
        brutto = _q(gross)
        netto = _q(brutto / faktor)
    else:
        netto = _q(net)
        brutto = _q(net * faktor) if gross is None else _q(gross)
    steuer = _q(brutto - netto)
    if gross is not None and net is not None and abs(_q(net * faktor) - _q(gross)) > _TOLERANZ:
        raise AusgabenError(
            f"Netto {netto} und Brutto {brutto} passen nicht zu {tax_rate} % Steuer.",
            status_code=422,
        )
    if tax is not None and abs(_q(tax) - steuer) > _TOLERANZ:
        raise AusgabenError(
            f"Steuerbetrag {_q(tax)} passt nicht zu {netto} netto bei {tax_rate} %.",
            status_code=422,
        )
    if steuer < 0:
        raise AusgabenError("Steuerbetrag wäre negativ.", status_code=422)
    return netto, steuer, brutto


class _Ausleser(Protocol):
    def erzeuge_multimodal(self, **kw: object) -> KiAntwort: ...


def _ocr_prompt() -> str:
    return (
        "Du liest einen Eingangsbeleg (Rechnung, Quittung, Kassenbon) eines "
        "Betriebs und ziehst daraus die Buchungsangaben.\n"
        "Regeln:\n"
        "- Übernimm NUR, was auf dem Beleg STEHT. Erfinde nichts, rate nicht.\n"
        "- Steht eine Angabe nicht da, lass das Feld WEG.\n"
        "- Beträge als Zahl mit Punkt als Dezimaltrenner, ohne Währungszeichen.\n"
        "- Datum als YYYY-MM-DD. Währung als ISO-Code (EUR, DKK, CHF …).\n"
        "- taxRate = der Steuersatz in Prozent als Zahl (z. B. 25 oder 19).\n"
        "- supplierName = der AUSSTELLER des Belegs (Verkäufer), nicht der Empfänger.\n"
        "- confidence = wie gut der Beleg lesbar war: \"hoch\" | \"mittel\" | \"niedrig\".\n"
        "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Rahmentext und "
        "ohne Markdown-Zaun, mit diesen möglichen Schlüsseln: supplierName, "
        "supplierAddress, supplierVatId, supplierEmail, receiptNumber, "
        "expenseDate, dueDate, netAmount, taxAmount, grossAmount, taxRate, "
        "currency, iban, description, confidence."
    )


def _json_objekt(roh: str) -> dict:
    text = roh.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        daten = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AusgabenError(
            "Der Beleg konnte nicht ausgelesen werden (Antwort war kein JSON).",
            status_code=502,
        ) from exc
    if not isinstance(daten, dict):
        raise AusgabenError("Der Beleg konnte nicht ausgelesen werden.", status_code=502)
    return daten


class AusgabenService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client, *, ausleser: _Ausleser | None = None) -> None:
        self._db = db
        self._ausleser = ausleser

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise AusgabenError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    def _tenant_currency(self, tenant_id: str) -> str:
        """Mandanten-Währung aus den Daten (Wurzel 4: kein erfundenes EUR)."""
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        currency = rows[0].get("currency") if rows else None
        if not currency:
            raise AusgabenError(
                "Mandanten-Währung fehlt — bitte im Konto die Währung setzen.", status_code=422
            )
        return str(currency)

    def _waehrung(self, tenant_id: str, aus_body: str | None) -> str:
        if aus_body:
            code = aus_body.strip().upper()
            if not _ISO_WAEHRUNG.match(code):
                raise AusgabenError("Währung muss ein ISO-Code sein (z. B. DKK).", status_code=422)
            return code
        return self._tenant_currency(tenant_id)

    def _eigene(self, tenant_id: str, expense_id: str) -> dict:
        return load_scoped(
            self._db, "expenses", expense_id, tenant_id, not_found=_nicht_gefunden("Ausgabe")
        )

    def _eigene_kategorie(self, tenant_id: str, category_id: str) -> dict:
        return load_scoped(
            self._db, "expense_categories", category_id, tenant_id,
            not_found=_nicht_gefunden("Kategorie"),
        )

    def _kategorie_aufloesen(
        self, tenant_id: str, *, category_id: str | None, name: str | None
    ) -> tuple[str | None, str | None]:
        """(category_id, category_name): per ID (muss dem Mandanten gehören)
        oder per Name (Treffer → ID, sonst nur Schnappschuss)."""
        if category_id:
            kat = self._eigene_kategorie(tenant_id, category_id)
            return str(kat["id"]), str(kat["name"])
        if name and name.strip():
            gesucht = name.strip().lower()
            rows = (
                self._db.table("expense_categories")
                .select("id, name")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data or []
            for r in rows:
                if str(r["name"]).strip().lower() == gesucht:
                    return str(r["id"]), str(r["name"])
            return None, name.strip()
        return None, None

    def _lieferant_pruefen(self, tenant_id: str, supplier_id: str | None) -> None:
        if supplier_id:
            load_scoped(
                self._db, "customers", supplier_id, tenant_id,
                columns="id", not_found=_nicht_gefunden("Lieferant"),
            )

    @staticmethod
    def _antwort(row: dict) -> ExpenseResponse:
        return ExpenseResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            supplier_id=str(row["supplier_id"]) if row.get("supplier_id") else None,
            supplier_name=row.get("supplier_name"),
            supplier_address=row.get("supplier_address"),
            supplier_vat_id=row.get("supplier_vat_id"),
            supplier_email=row.get("supplier_email"),
            supplier_phone=row.get("supplier_phone"),
            title=str(row["title"]),
            description=row.get("description"),
            receipt_number=row.get("receipt_number"),
            expense_date=_datum(row["expense_date"]) or date.min,
            due_date=_datum(row.get("due_date")),
            payment_terms=row.get("payment_terms"),
            net_amount=_dec(row.get("net_amount")),
            tax_amount=_dec(row.get("tax_amount")),
            gross_amount=_dec(row.get("gross_amount")),
            tax_rate=_dec(row.get("tax_rate")),
            currency=str(row["currency"]),
            tax_deductible=row.get("tax_deductible"),
            category_id=str(row["category_id"]) if row.get("category_id") else None,
            category_name=row.get("category_name"),
            booking_account=row.get("booking_account"),
            cost_center=row.get("cost_center"),
            payment_status=row.get("payment_status") or "open",
            payment_method=row.get("payment_method"),
            paid_at=_datum(row.get("paid_at")),
            is_recurring=bool(row.get("is_recurring")),
            recurring_interval=row.get("recurring_interval"),
            next_due_date=_datum(row.get("next_due_date")),
            template_id=str(row["template_id"]) if row.get("template_id") else None,
            has_receipt=bool(row.get("receipt_path")),
            receipt_filename=row.get("receipt_filename"),
            receipt_mime=row.get("receipt_mime"),
            receipt_size_bytes=row.get("receipt_size_bytes"),
            ocr_raw=row.get("ocr_raw"),
            is_locked=bool(row.get("is_locked")),
            locked_at=row.get("locked_at"),
            notes=row.get("notes"),
            source=row.get("source") or "manual",
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ------------------------------------------------------------ Listen
    def list_expenses(  # noqa: PLR0913 — Filterparameter der Route
        self,
        ctx: AuthContext,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        category_id: str | None = None,
        recurring: bool | None = None,
        search: str | None = None,
        limit: int = 200,
    ) -> ExpenseListResponse:
        tenant_id = self._tenant(ctx)
        if limit < 1 or limit > MAX_LIMIT:
            raise AusgabenError(f"limit muss zwischen 1 und {MAX_LIMIT} liegen.", status_code=422)
        if status is not None and status not in PAYMENT_STATUSES:
            raise AusgabenError("Unbekannter Zahlstatus.", status_code=422)
        if date_from and date_to:
            if date_to < date_from:
                raise AusgabenError("Zeitraum: 'bis' liegt vor 'von'.", status_code=422)
            if (date_to - date_from).days > MAX_ZEITRAUM_TAGE:
                raise AusgabenError(
                    f"Zeitraum darf höchstens {MAX_ZEITRAUM_TAGE} Tage umfassen.", status_code=422
                )
        query = (
            self._db.table("expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("expense_date", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if date_from:
            query = query.gte("expense_date", date_from.isoformat())
        if date_to:
            query = query.lte("expense_date", date_to.isoformat())
        if status:
            query = query.eq("payment_status", status)
        if category_id:
            query = query.eq("category_id", category_id)
        if recurring is not None:
            query = query.eq("is_recurring", recurring)
        rows = query.execute().data or []
        if search and search.strip():
            s = search.strip().lower()
            rows = [
                r for r in rows
                if any(
                    s in str(r.get(f) or "").lower()
                    for f in ("title", "supplier_name", "receipt_number", "description")
                )
            ]
        items = [self._antwort(r) for r in rows]
        summen: dict[str, Decimal] = {}
        for it in items:
            if it.payment_status != "cancelled":
                summen[it.currency] = _q(summen.get(it.currency, Decimal(0)) + it.gross_amount)
        return ExpenseListResponse(items=items, total=len(items), sum_gross_by_currency=summen)

    def get_expense(self, ctx: AuthContext, expense_id: str) -> ExpenseResponse:
        return self._antwort(self._eigene(self._tenant(ctx), expense_id))

    # ----------------------------------------------------------- Anlegen
    def _wiederkehrend_pruefen(
        self, *, is_recurring: bool, intervall: str | None, naechste: date | None
    ) -> None:
        if is_recurring and (not intervall or not naechste):
            raise AusgabenError(
                "Wiederkehrende Ausgabe braucht Intervall und nächste Fälligkeit.",
                status_code=422,
            )

    def create_expense(self, ctx: AuthContext, body: ExpenseCreate) -> ExpenseResponse:
        tenant_id = self._tenant(ctx)
        self._lieferant_pruefen(tenant_id, body.supplier_id)
        netto, steuer, brutto = betraege_rechnen(
            gross=body.gross_amount, net=body.net_amount, tax=body.tax_amount,
            tax_rate=body.tax_rate,
        )
        waehrung = self._waehrung(tenant_id, body.currency)
        kat_id, kat_name = self._kategorie_aufloesen(
            tenant_id, category_id=body.category_id, name=body.category
        )
        self._wiederkehrend_pruefen(
            is_recurring=body.is_recurring, intervall=body.recurring_interval,
            naechste=body.next_due_date,
        )
        if body.payment_status == "paid" and body.paid_at is None:
            body.paid_at = self._heute()
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "supplier_id": body.supplier_id,
            "supplier_name": (body.supplier_name or "").strip() or None,
            "supplier_address": body.supplier_address,
            "supplier_vat_id": body.supplier_vat_id,
            "supplier_email": body.supplier_email,
            "supplier_phone": body.supplier_phone,
            "title": body.title.strip(),
            "description": body.description,
            "receipt_number": (body.receipt_number or "").strip() or None,
            "expense_date": body.expense_date.isoformat(),
            "due_date": body.due_date.isoformat() if body.due_date else None,
            "payment_terms": body.payment_terms,
            "net_amount": str(netto),
            "tax_amount": str(steuer),
            "gross_amount": str(brutto),
            "tax_rate": str(_q(body.tax_rate)),
            "currency": waehrung,
            "tax_deductible": body.tax_deductible,
            "category_id": kat_id,
            "category_name": kat_name,
            "booking_account": body.booking_account,
            "cost_center": body.cost_center,
            "payment_status": body.payment_status,
            "payment_method": body.payment_method,
            "paid_at": body.paid_at.isoformat() if body.paid_at else None,
            "is_recurring": body.is_recurring,
            "recurring_interval": body.recurring_interval if body.is_recurring else None,
            "next_due_date": (
                body.next_due_date.isoformat() if body.is_recurring and body.next_due_date else None
            ),
            "ocr_raw": body.ocr_raw,
            "notes": body.notes,
            "source": body.source,
            "created_by": ctx.user_id,
        }
        res = self._db.table("expenses").insert(zeile).execute()
        neu = (res.data or [None])[0]
        if not neu:
            raise AusgabenError("Ausgabe konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "ausgabe_angelegt", tenant_id=tenant_id, expense_id=neu["id"],
            gross=str(brutto), currency=waehrung, source=body.source,
            recurring=body.is_recurring,
        )
        return self._antwort(neu)

    # ------------------------------------------------------------ Ändern
    def update_expense(
        self, ctx: AuthContext, expense_id: str, body: ExpenseUpdate
    ) -> ExpenseResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, expense_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}

        if "supplier_id" in gesetzt:
            self._lieferant_pruefen(tenant_id, gesetzt["supplier_id"])
        if "category_id" in gesetzt:
            kat_id, kat_name = self._kategorie_aufloesen(
                tenant_id, category_id=gesetzt.pop("category_id"), name=None
            )
            aenderung["category_id"], aenderung["category_name"] = kat_id, kat_name

        # Beträge: sobald EIN Betragsfeld oder der Satz kommt, wird neu gerechnet.
        betrag_felder = {"gross_amount", "net_amount", "tax_amount", "tax_rate"}
        if betrag_felder & gesetzt.keys():
            satz = gesetzt.pop("tax_rate", None)
            satz = _dec(row.get("tax_rate")) if satz is None else Decimal(str(satz))
            gross = gesetzt.pop("gross_amount", None)
            net = gesetzt.pop("net_amount", None)
            tax = gesetzt.pop("tax_amount", None)
            if gross is None and net is None:
                # Nur der Satz geändert → Brutto bleibt die Tatsache des Belegs.
                gross = _dec(row.get("gross_amount"))
            netto, steuer, brutto = betraege_rechnen(
                gross=Decimal(str(gross)) if gross is not None else None,
                net=Decimal(str(net)) if net is not None else None,
                tax=Decimal(str(tax)) if tax is not None else None,
                tax_rate=satz,
            )
            aenderung.update(
                net_amount=str(netto), tax_amount=str(steuer),
                gross_amount=str(brutto), tax_rate=str(_q(satz)),
            )

        if "currency" in gesetzt:
            aenderung["currency"] = self._waehrung(tenant_id, gesetzt.pop("currency"))

        for feld, wert in gesetzt.items():
            aenderung[feld] = wert.isoformat() if isinstance(wert, date) else wert

        if "title" in aenderung and aenderung["title"]:
            aenderung["title"] = str(aenderung["title"]).strip()

        is_rec = aenderung.get("is_recurring", row.get("is_recurring"))
        self._wiederkehrend_pruefen(
            is_recurring=bool(is_rec),
            intervall=aenderung.get("recurring_interval", row.get("recurring_interval")),
            naechste=_datum(aenderung.get("next_due_date", row.get("next_due_date"))),
        )
        if is_rec and row.get("template_id"):
            raise AusgabenError(
                "Eine aus einer Vorlage erzeugte Ausgabe kann nicht selbst wiederkehrend werden.",
                status_code=422,
            )
        if aenderung.get("payment_status") == "paid" and not (
            aenderung.get("paid_at") or row.get("paid_at")
        ):
            aenderung["paid_at"] = self._heute().isoformat()

        if row.get("is_locked"):
            def _norm(wert: object) -> str:
                return "" if wert is None else str(wert)

            verboten = sorted(
                f for f in GESPERRTE_FELDER & aenderung.keys()
                if _norm(row.get(f)) != _norm(aenderung[f])
            )
            if verboten:
                log.info("ausgabe_sperre_verweigert", tenant_id=tenant_id,
                         expense_id=expense_id, felder=verboten)
                raise AusgabenError(
                    "Beleg ist GoBD-gesperrt: " + ", ".join(verboten) + " sind unveränderlich.",
                    status_code=409,
                )
            for f in GESPERRTE_FELDER:
                aenderung.pop(f, None)

        if aenderung:
            self._db.table("expenses").update(aenderung).eq("id", expense_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info("ausgabe_geaendert", tenant_id=tenant_id, expense_id=expense_id,
                     felder=sorted(aenderung))
        return self.get_expense(ctx, expense_id)

    def lock_expense(self, ctx: AuthContext, expense_id: str) -> ExpenseResponse:
        """GoBD-Sperre setzen. Idempotent: schon gesperrt → unverändert zurück."""
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, expense_id)
        if row.get("is_locked"):
            return self._antwort(row)
        self._db.table("expenses").update(
            {"is_locked": True, "locked_at": datetime.now(UTC).isoformat()}
        ).eq("id", expense_id).eq("tenant_id", tenant_id).execute()
        log.info("ausgabe_gesperrt", tenant_id=tenant_id, expense_id=expense_id)
        return self.get_expense(ctx, expense_id)

    def delete_expense(self, ctx: AuthContext, expense_id: str) -> None:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, expense_id)
        if row.get("is_locked"):
            raise AusgabenError("Beleg ist GoBD-gesperrt und kann nicht gelöscht werden.",
                                status_code=409)
        self._db.table("expenses").delete().eq("id", expense_id).eq(
            "tenant_id", tenant_id
        ).execute()
        if row.get("receipt_path"):
            self._datei_entfernen(str(row["receipt_path"]))
        log.info("ausgabe_geloescht", tenant_id=tenant_id, expense_id=expense_id)

    # ------------------------------------------------------------- Beleg
    def _datei_entfernen(self, pfad: str) -> None:
        try:
            self._db.storage.from_(BELEG_BUCKET).remove([pfad])
        except Exception as exc:  # noqa: BLE001 — best-effort, kippt den Hauptpfad nicht
            log.warning("ausgabe_beleg_entfernen_fehlgeschlagen", pfad=pfad, error=str(exc)[:200])

    @staticmethod
    def _beleg_pruefen(inhalt: bytes) -> tuple[str, str]:
        if not inhalt:
            raise AusgabenError("Datei ist leer.", status_code=422)
        if len(inhalt) > BELEG_MAX_BYTES:
            raise AusgabenError("Beleg ist größer als 15 MB.", status_code=413)
        art = _dateiart(inhalt)
        if art is None:
            raise AusgabenError(
                "Nur PDF, JPEG, PNG oder HEIC werden als Beleg angenommen.", status_code=415
            )
        return art

    def upload_receipt(
        self, ctx: AuthContext, expense_id: str, *, inhalt: bytes, dateiname: str | None
    ) -> ExpenseResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, expense_id)
        if row.get("is_locked") and row.get("receipt_path"):
            raise AusgabenError(
                "Beleg ist GoBD-gesperrt: die Belegdatei kann nicht ersetzt werden.",
                status_code=409,
            )
        mime, endung = self._beleg_pruefen(inhalt)
        pfad = f"{tenant_id}/{expense_id}/{uuid4().hex}.{endung}"
        try:
            self._db.storage.from_(BELEG_BUCKET).upload(pfad, inhalt, {"content-type": mime})
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            log.error("ausgabe_beleg_upload_fehlgeschlagen", tenant_id=tenant_id,
                      expense_id=expense_id, error=str(exc)[:300])
            raise AusgabenError("Die Datei konnte nicht abgelegt werden.", status_code=502) from exc
        name = _dateiname_saeubern(dateiname or f"beleg.{endung}")
        alt = row.get("receipt_path")
        self._db.table("expenses").update(
            {
                "receipt_path": pfad,
                "receipt_filename": name,
                "receipt_mime": mime,
                "receipt_size_bytes": len(inhalt),
            }
        ).eq("id", expense_id).eq("tenant_id", tenant_id).execute()
        if alt and alt != pfad:
            self._datei_entfernen(str(alt))
        log.info("ausgabe_beleg_hochgeladen", tenant_id=tenant_id, expense_id=expense_id,
                 mime=mime, bytes=len(inhalt))
        return self.get_expense(ctx, expense_id)

    def receipt_url(self, ctx: AuthContext, expense_id: str) -> ReceiptUrlResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, expense_id)
        pfad = row.get("receipt_path")
        if not pfad:
            raise AusgabenError("Zu dieser Ausgabe liegt kein Beleg vor.", status_code=404)
        try:
            antwort = self._db.storage.from_(BELEG_BUCKET).create_signed_url(
                str(pfad), BELEG_URL_TTL
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            log.error("ausgabe_beleg_url_fehlgeschlagen", tenant_id=tenant_id,
                      expense_id=expense_id, error=str(exc)[:300])
            raise AusgabenError(
                "Beleg-Adresse konnte nicht erzeugt werden.", status_code=502
            ) from exc
        url = (antwort or {}).get("signedURL") or (antwort or {}).get("signedUrl")
        if not url:
            raise AusgabenError("Beleg-Adresse konnte nicht erzeugt werden.", status_code=502)
        return ReceiptUrlResponse(
            url=str(url), filename=row.get("receipt_filename"), mime=row.get("receipt_mime"),
            expires_in_seconds=BELEG_URL_TTL,
        )

    # ------------------------------------------------------- Wiederkehrend
    def run_recurring(
        self, ctx: AuthContext, *, stichtag: date | None = None
    ) -> RecurringRunResult:
        """Alle fälligen Wiederholungen des Mandanten anlegen.

        Je Vorlage und Termin EINE Kopie; die Vorlage rückt auf den nächsten
        Termin vor. Der Unique-Index (tenant_id, template_id, expense_date)
        macht den Lauf retry-sicher: ein 23505 heißt „gab es schon" und wird
        gezählt, nicht als Fehler gemeldet (Wurzel 2).
        """
        tenant_id = self._tenant(ctx)
        heute = stichtag or self._heute()
        vorlagen = (
            self._db.table("expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("is_recurring", True)
            .lte("next_due_date", heute.isoformat())
            .order("next_due_date")
            .limit(MAX_LIMIT)
            .execute()
        ).data or []
        angelegt: list[str] = []
        uebersprungen = 0
        for vorlage in vorlagen:
            termin = _datum(vorlage.get("next_due_date"))
            intervall = vorlage.get("recurring_interval")
            if termin is None or intervall not in RECURRING_INTERVALS:
                log.warning("ausgabe_vorlage_unvollstaendig", tenant_id=tenant_id,
                            expense_id=vorlage["id"])
                continue
            schritte = 0
            while termin <= heute and schritte < MAX_KOPIEN_JE_VORLAGE:
                neu_id = self._kopie_anlegen(tenant_id, vorlage, termin, ctx.user_id)
                if neu_id:
                    angelegt.append(neu_id)
                else:
                    uebersprungen += 1
                termin = _naechster_termin(termin, str(intervall))
                schritte += 1
            self._db.table("expenses").update({"next_due_date": termin.isoformat()}).eq(
                "id", vorlage["id"]
            ).eq("tenant_id", tenant_id).execute()
        log.info("ausgaben_wiederholungen_lauf", tenant_id=tenant_id,
                 vorlagen=len(vorlagen), angelegt=len(angelegt), uebersprungen=uebersprungen)
        return RecurringRunResult(
            templates_checked=len(vorlagen), created=len(angelegt),
            skipped_existing=uebersprungen, created_ids=angelegt,
        )

    def _kopie_anlegen(
        self, tenant_id: str, vorlage: dict, termin: date, user_id: str | None
    ) -> str | None:
        faellig_alt = _datum(vorlage.get("due_date"))
        datum_alt = _datum(vorlage.get("expense_date"))
        frist = (faellig_alt - datum_alt).days if faellig_alt and datum_alt else None
        uebernehmen = (
            "supplier_id", "supplier_name", "supplier_address", "supplier_vat_id",
            "supplier_email", "supplier_phone", "title", "description", "payment_terms",
            "net_amount", "tax_amount", "gross_amount", "tax_rate", "currency",
            "tax_deductible", "category_id", "category_name", "booking_account",
            "cost_center", "payment_method", "notes",
        )
        zeile: dict[str, Any] = {f: vorlage.get(f) for f in uebernehmen}
        zeile.update(
            tenant_id=tenant_id,
            expense_date=termin.isoformat(),
            due_date=(termin + timedelta(days=frist)).isoformat() if frist is not None else None,
            payment_status="open",
            is_recurring=False,
            recurring_interval=None,
            next_due_date=None,
            template_id=vorlage["id"],
            source="recurring",
            created_by=user_id,
        )
        try:
            res = self._db.table("expenses").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                return None
            raise
        neu = (res.data or [None])[0]
        return str(neu["id"]) if neu else None

    # ---------------------------------------------------------- Kategorien
    @staticmethod
    def _kat_antwort(row: dict) -> ExpenseCategoryResponse:
        return ExpenseCategoryResponse(
            id=str(row["id"]), tenant_id=str(row["tenant_id"]), name=str(row["name"]),
            kind=row["kind"], booking_account=row.get("booking_account"),
            color=row.get("color"), abbreviation=row.get("abbreviation"),
            is_active=bool(row.get("is_active", True)),
            created_at=row["created_at"], updated_at=row["updated_at"],
        )

    def list_categories(
        self, ctx: AuthContext, *, include_inactive: bool = False
    ) -> list[ExpenseCategoryResponse]:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("expense_categories").select("*").eq("tenant_id", tenant_id)
            .order("name").limit(MAX_LIMIT)
        )
        if not include_inactive:
            query = query.eq("is_active", True)
        return [self._kat_antwort(r) for r in query.execute().data or []]

    def create_category(
        self, ctx: AuthContext, body: ExpenseCategoryCreate
    ) -> ExpenseCategoryResponse:
        tenant_id = self._tenant(ctx)
        zeile = {
            "tenant_id": tenant_id,
            "name": body.name.strip(),
            "kind": body.kind,
            "booking_account": (body.booking_account or "").strip() or None,
            "color": body.color,
            "abbreviation": (body.abbreviation or "").strip() or None,
        }
        try:
            res = self._db.table("expense_categories").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                raise AusgabenError(
                    f"Kategorie '{zeile['name']}' existiert bereits.", status_code=409
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise AusgabenError("Kategorie konnte nicht gespeichert werden.", status_code=500)
        log.info("ausgabenkategorie_angelegt", tenant_id=tenant_id, category_id=neu["id"])
        return self._kat_antwort(neu)

    def update_category(
        self, ctx: AuthContext, category_id: str, body: ExpenseCategoryUpdate
    ) -> ExpenseCategoryResponse:
        tenant_id = self._tenant(ctx)
        self._eigene_kategorie(tenant_id, category_id)
        aenderung = body.model_dump(exclude_unset=True, by_alias=False)
        if "name" in aenderung and aenderung["name"]:
            aenderung["name"] = str(aenderung["name"]).strip()
        if aenderung:
            try:
                self._db.table("expense_categories").update(aenderung).eq("id", category_id).eq(
                    "tenant_id", tenant_id
                ).execute()
            except APIError as exc:
                if getattr(exc, "code", None) == "23505":
                    raise AusgabenError("Eine Kategorie mit diesem Namen existiert bereits.",
                                        status_code=409) from exc
                raise
            if "name" in aenderung:
                # Schnappschuss an den Belegen mitziehen — nur der Name, nicht die Zahlen.
                self._db.table("expenses").update({"category_name": aenderung["name"]}).eq(
                    "tenant_id", tenant_id
                ).eq("category_id", category_id).execute()
            log.info("ausgabenkategorie_geaendert", tenant_id=tenant_id,
                     category_id=category_id, felder=sorted(aenderung))
        return self._kat_antwort(self._eigene_kategorie(tenant_id, category_id))

    def delete_category(self, ctx: AuthContext, category_id: str) -> None:
        tenant_id = self._tenant(ctx)
        self._eigene_kategorie(tenant_id, category_id)
        # FK `on delete set null` löst die Belege; ihr `category_name` bleibt.
        self._db.table("expense_categories").delete().eq("id", category_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("ausgabenkategorie_geloescht", tenant_id=tenant_id, category_id=category_id)

    # -------------------------------------------------------- Belegausleser
    def extract_receipt(
        self, ctx: AuthContext, *, inhalt: bytes, dateiname: str | None
    ) -> ReceiptExtraction:
        """Beleg durch Gemini lesen lassen — Vorschläge, keine Speicherung."""
        tenant_id = self._tenant(ctx)
        if OCR_FUNKTION not in ki_nutzung.FUNKTIONEN:
            # Fail-closed: ohne registrierten Funktionsnamen würde `buchen`
            # still aussteigen und der Tagesdeckel wäre eine Attrappe.
            log.error("ausgabe_ocr_funktion_nicht_registriert", funktion=OCR_FUNKTION)
            raise AusgabenError(
                "Der Belegausleser ist noch nicht freigeschaltet.", status_code=503
            )
        mime, _endung = self._beleg_pruefen(inhalt)
        try:
            ki_nutzung.deckel_pruefen(self._db, tenant_id)
        except KiError as exc:
            raise AusgabenError(exc.message, status_code=exc.status_code) from exc

        ki = self._ausleser or VertexClient()
        try:
            antwort = ki.erzeuge_multimodal(
                system=_ocr_prompt(),
                teile=[
                    {"inlineData": {"mimeType": mime, "data": base64.b64encode(inhalt).decode()}},
                    {"text": "Lies die Buchungsangaben aus diesem Beleg."},
                ],
                temperature=0.1,
                max_tokens=OCR_MAX_ANTWORT_TOKENS,
                abbruch_ist_fehler=True,
            )
        except KiError as exc:
            log.warning("ausgabe_ocr_fehlgeschlagen", tenant_id=tenant_id,
                        status_code=exc.status_code, error=exc.message[:200])
            raise AusgabenError(exc.message, status_code=exc.status_code) from exc

        daten = _json_objekt(antwort.text)
        ki_nutzung.buchen(self._db, tenant_id, user_id=ctx.user_id, funktion=OCR_FUNKTION,
                          antwort=antwort)
        ergebnis = self._extraktion(daten)
        gefunden = sum(
            1 for k, v in ergebnis.model_dump().items() if v is not None and k != "raw"
        )
        log.info("ausgabe_ocr_gelesen", tenant_id=tenant_id, datei=dateiname or "",
                 mime=mime, tokens_ein=antwort.tokens_ein, tokens_aus=antwort.tokens_aus,
                 felder=gefunden)
        return ergebnis

    @staticmethod
    def _extraktion(daten: dict) -> ReceiptExtraction:
        def _text(key: str, maxlen: int = 200) -> str | None:
            wert = daten.get(key)
            if wert is None:
                return None
            text = str(wert).strip()
            return text[:maxlen] or None

        waehrung = (_text("currency", 3) or "").upper() or None
        if waehrung and not _ISO_WAEHRUNG.match(waehrung):
            waehrung = None
        satz = _dec_oder_none(daten.get("taxRate"))
        if satz is not None and not Decimal(0) <= satz <= Decimal(100):
            satz = None
        sicher = (_text("confidence", 10) or "").lower()
        return ReceiptExtraction(
            supplier_name=_text("supplierName"),
            supplier_address=_text("supplierAddress", 1000),
            supplier_vat_id=_text("supplierVatId", 40),
            supplier_email=_text("supplierEmail"),
            receipt_number=_text("receiptNumber", 100),
            expense_date=_datum(daten.get("expenseDate")),
            due_date=_datum(daten.get("dueDate")),
            net_amount=_dec_oder_none(daten.get("netAmount")),
            tax_amount=_dec_oder_none(daten.get("taxAmount")),
            gross_amount=_dec_oder_none(daten.get("grossAmount")),
            tax_rate=satz,
            currency=waehrung,
            iban=_text("iban", 40),
            description=_text("description", 500),
            confidence=sicher if sicher in ("hoch", "mittel", "niedrig") else None,
            raw=daten,
        )
