"""Fachlogik des Bereichs »mahnwesen«: Mahnungen in drei Stufen.

Was hier vom alten Werkzeug übrig blieb, ist die FORM (drei Stufen, Gebühr je
Stufe, Zahlungsfrist je Stufe, Kopf-/Fußtext, Status draft/sent/paid). Die
REGELN sind neu und stehen ausschließlich hier — der Browser rechnete sie
vorher selbst und schickte fertige Beträge:

  * Der offene Betrag kommt aus der Rechnung (`gross_amount - paid_amount`),
    nie vom Client.
  * Stufe n+1 gibt es nur, wenn n existiert; die dritte ist die letzte.
  * Gebühr, Zinssatz und Texte kommen aus `reminder_settings`; fehlen sie,
    schlägt das Anlegen mit 422 fehl (kein „5 €"-Ersatz, Wurzel 4).
  * Verzugszinsen: amount_open × rate/100 × Tage überfällig / 365, kaufmännisch
    gerundet. Tage überfällig = Mahndatum − Fälligkeit der Rechnung.
  * Die Nummer zieht `next_document_number(tenant, 'reminder', 'MA-')` beim
    Anlegen; der Unique-Index (0640) fängt Doppelklick und Retry (Wurzel 2).

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`.
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.mail import MailError
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .schemas import (
    LIMIT_MAX,
    LIMIT_STANDARD,
    MAX_FRIST_TAGE,
    MAX_LEVEL,
    MAX_RUECKDATIERUNG_TAGE,
    REMINDER_STATUSES,
    OverdueInvoiceResponse,
    ReminderCreate,
    ReminderResponse,
    ReminderSend,
    ReminderSettingsResponse,
    ReminderSettingsUpdate,
    ReminderUpdate,
    SendResult,
    StufenEinstellung,
    UeberfaelligLaufResult,
)

log = get_logger("nextdays.buchhaltung.mahnwesen")

# Rechnungsstatus, in denen ein Beleg AUSGESTELLT und noch offen ist. `finalized`
# setzt der Versand-Dialog des Bestands beim Drucken; `overdue` der Tages-Lauf.
OFFENE_RECHNUNGSSTATUS: frozenset[str] = frozenset({"sent", "finalized", "overdue"})
# Was der Tages-Lauf `ueberfaellig_markieren` auf `overdue` hebt — bewusst NUR
# `sent` (ein `finalized` ist gedruckt, aber nicht nachweislich zugestellt).
STATUS_VERSENDET = "sent"
STATUS_UEBERFAELLIG = "overdue"
# Harte Obergrenzen des Tages-Laufs: so viele Betriebe je Lauf, so viele
# Rechnungen je Betrieb. Was übrig bleibt, holt der nächste Lauf — kein Lauf
# ohne Ende (Wurzel 8).
_TENANTS_JE_LAUF = 1000
_RECHNUNGEN_JE_TENANT = 500

_ZULAESSIGE_UEBERGAENGE: dict[str, frozenset[str]] = {
    "draft": frozenset({"sent", "cancelled"}),
    "sent": frozenset({"paid", "cancelled"}),
    "paid": frozenset(),
    "cancelled": frozenset(),
}

# Obergrenze für das Base64-PDF aus dem Client (Wurzel 8): 15 MB entschlüsselt.
# Die Base64-Länge wird VOR dem Dekodieren geprüft — sonst liegt ein 200-MB-
# String erst vollständig entschlüsselt im Speicher, bevor der Deckel greift.
_PDF_MAX_BYTES = 15 * 1024 * 1024
_PDF_MAX_BASE64_ZEICHEN = (_PDF_MAX_BYTES * 4) // 3 + 4
_MIME_PDF = "application/pdf"
_PDF_MAGIC = b"%PDF-"

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
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def _anschrift_text(address: object) -> str | None:
    """`customers.address` (jsonb) als mehrzeiligen Text — nur aus dem, was da ist."""
    if not isinstance(address, dict):
        return None
    if isinstance(address.get("text"), str) and address["text"].strip():
        return address["text"].strip()
    zeilen = [
        " ".join(str(address.get(k) or "").strip() for k in ("street", "house_number")).strip(),
        " ".join(str(address.get(k) or "").strip() for k in ("postal_code", "city")).strip(),
        str(address.get("country") or "").strip(),
    ]
    text = "\n".join(z for z in zeilen if z)
    return text or None


VersandFunktion = Callable[..., str]


class MahnwesenError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> MahnwesenError:
    return MahnwesenError(f"{was} nicht gefunden.", status_code=404)


def _versand_aufloesen() -> tuple[VersandFunktion, tuple[type[Exception], ...]]:
    """`dokument_senden` des Bereichs »versand« erst beim Aufruf importieren.

    Die Bereiche entstehen parallel; ein Import zur Ladezeit würde dieses Modul
    an die Existenz des Nachbarn ketten. Fehlt er, ist das ein 503 mit klarem
    Text — kein stiller Zweitweg über SMTP (Regel: EIN Mailweg).
    """
    try:
        from ..versand import dienst  # pylint: disable=import-outside-toplevel
    except ImportError as exc:
        log.warning("mahnwesen_versand_nicht_verfuegbar", error=str(exc)[:200])
        raise MahnwesenError(
            "Der Belegversand ist noch nicht verfügbar.", status_code=503
        ) from exc
    fehlerklassen: list[type[Exception]] = [MailError]
    versand_fehler = getattr(dienst, "VersandError", None)
    if isinstance(versand_fehler, type) and issubclass(versand_fehler, Exception):
        fehlerklassen.append(versand_fehler)
    return dienst.dokument_senden, tuple(fehlerklassen)


class MahnwesenService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet; `company_id` aus
    dem Pfad ist Altlast und wird ignoriert."""

    def __init__(self, db: Client, *, versand: VersandFunktion | None = None) -> None:
        self._db = db
        self._versand = versand

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise MahnwesenError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    # ------------------------------------------------------- Einstellungen
    def _settings_row(self, tenant_id: str) -> dict | None:
        rows = (
            self._db.table("reminder_settings")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    @staticmethod
    def _stufe(row: dict, level: int) -> StufenEinstellung | None:
        days, fee, title = (row.get(f"level{level}_{k}") for k in ("days", "fee", "title"))
        if days is None or fee is None or not title:
            return None
        return StufenEinstellung(
            days=int(days), fee=_dec(fee), title=str(title), text=row.get(f"level{level}_text")
        )

    def _settings_antwort(self, row: dict | None) -> ReminderSettingsResponse:
        if not row:
            return ReminderSettingsResponse(configured=False)
        stufen = {lvl: self._stufe(row, lvl) for lvl in (1, 2, 3)}
        zins = row.get("interest_rate")
        auto = row.get("auto_mark_overdue")
        vollstaendig = all(stufen.values()) and zins is not None and auto is not None
        return ReminderSettingsResponse(
            level1=stufen[1],
            level2=stufen[2],
            level3=stufen[3],
            interest_rate=_dec(zins) if zins is not None else None,
            auto_mark_overdue=auto,
            configured=vollstaendig,
            updated_at=row.get("updated_at"),
        )

    def get_settings(self, ctx: AuthContext) -> ReminderSettingsResponse:
        return self._settings_antwort(self._settings_row(self._tenant(ctx)))

    def put_settings(
        self, ctx: AuthContext, body: ReminderSettingsUpdate
    ) -> ReminderSettingsResponse:
        tenant_id = self._tenant(ctx)
        zeile: dict[str, Any] = {"tenant_id": tenant_id}
        for lvl, stufe in ((1, body.level1), (2, body.level2), (3, body.level3)):
            zeile[f"level{lvl}_days"] = stufe.days
            zeile[f"level{lvl}_fee"] = str(_q(stufe.fee))
            zeile[f"level{lvl}_title"] = stufe.title.strip()
            zeile[f"level{lvl}_text"] = (stufe.text or "").strip() or None
        zeile["interest_rate"] = str(_q(body.interest_rate))
        zeile["auto_mark_overdue"] = body.auto_mark_overdue
        self._db.table("reminder_settings").upsert(zeile, on_conflict="tenant_id").execute()
        log.info("mahnwesen_einstellungen_gespeichert", tenant_id=tenant_id,
                 auto_mark_overdue=body.auto_mark_overdue)
        return self._settings_antwort(self._settings_row(tenant_id))

    def _settings_pflicht(self, tenant_id: str) -> ReminderSettingsResponse:
        antwort = self._settings_antwort(self._settings_row(tenant_id))
        if not antwort.configured:
            log.warning("mahnwesen_einstellungen_fehlen", tenant_id=tenant_id)
            raise MahnwesenError(
                "Mahnwesen nicht eingerichtet: bitte zuerst Fristen, Gebühren und "
                "Zinssatz je Mahnstufe unter Einstellungen festlegen.",
                status_code=422,
            )
        return antwort

    # ------------------------------------------------------------ Laden
    def _rechnungen(self, tenant_id: str, ids: Iterable[str]) -> dict[str, dict]:
        ids = sorted(set(ids))
        if not ids:
            return {}
        rows = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, customer_id, status, issue_date, due_date, "
                "gross_amount, paid_amount, currency, invoice_type, deleted_at"
            )
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _kunden(self, tenant_id: str, ids: Iterable[str]) -> dict[str, dict]:
        ids = sorted({i for i in ids if i})
        if not ids:
            return {}
        rows = (
            self._db.table("customers")
            .select("id, name, email, address")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _antwort(
        self, row: dict, rechnung: dict | None, kunde: dict | None
    ) -> ReminderResponse:
        faellig_rechnung = _datum(rechnung.get("due_date")) if rechnung else None
        mahndatum = _datum(row.get("reminder_date")) or self._heute()
        tage = (mahndatum - faellig_rechnung).days if faellig_rechnung else 0
        return ReminderResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            reminder_number=row["reminder_number"],
            number=row["reminder_number"],
            invoice_id=str(row["invoice_id"]),
            invoice_number=(rechnung or {}).get("invoice_number"),
            customer_id=str(row["customer_id"]) if row.get("customer_id") else None,
            customer_name=(kunde or {}).get("name"),
            customer_email=(kunde or {}).get("email"),
            customer_address=_anschrift_text((kunde or {}).get("address")),
            level=int(row["level"]),
            reminder_date=mahndatum,
            due_date=_datum(row["due_date"]) or mahndatum,
            invoice_due_date=faellig_rechnung,
            days_overdue=max(tage, 0),
            fee=_dec(row.get("fee")),
            interest=_dec(row.get("interest")),
            interest_rate=_dec(row.get("interest_rate")),
            amount_open=_dec(row.get("amount_open")),
            amount_total=_dec(row.get("amount_total")),
            currency=row["currency"],
            status=row["status"],
            sent_at=row.get("sent_at"),
            sent_message_id=row.get("sent_message_id"),
            text_header=row.get("text_header"),
            text_footer=row.get("text_footer"),
            notes=row.get("notes"),
            template_settings=row.get("template_settings") or {},
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _anreichern(self, tenant_id: str, rows: list[dict]) -> list[ReminderResponse]:
        rechnungen = self._rechnungen(tenant_id, (str(r["invoice_id"]) for r in rows))
        kunden = self._kunden(
            tenant_id, (str(r["customer_id"]) for r in rows if r.get("customer_id"))
        )
        return [
            self._antwort(r, rechnungen.get(str(r["invoice_id"])),
                          kunden.get(str(r["customer_id"]) if r.get("customer_id") else ""))
            for r in rows
        ]

    def _eigene(self, tenant_id: str, reminder_id: str) -> dict:
        return load_scoped(
            self._db, "reminders", reminder_id, tenant_id, not_found=_nicht_gefunden("Mahnung")
        )

    # ----------------------------------------------------------- Listen
    def list_reminders(
        self,
        ctx: AuthContext,
        *,
        invoice_id: str | None = None,
        status: str | None = None,
        level: int | None = None,
        limit: int = LIMIT_STANDARD,
    ) -> list[ReminderResponse]:
        tenant_id = self._tenant(ctx)
        if status is not None and status not in REMINDER_STATUSES:
            raise MahnwesenError("Unbekannter Mahnstatus.", status_code=422)
        if level is not None and not 1 <= level <= MAX_LEVEL:
            raise MahnwesenError("Unbekannte Mahnstufe.", status_code=422)
        if not 1 <= limit <= LIMIT_MAX:
            raise MahnwesenError(f"limit muss zwischen 1 und {LIMIT_MAX} liegen.", status_code=422)
        query = (
            self._db.table("reminders")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("reminder_date", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if invoice_id:
            query = query.eq("invoice_id", invoice_id)
        if status:
            query = query.eq("status", status)
        if level is not None:
            query = query.eq("level", level)
        return self._anreichern(tenant_id, query.execute().data or [])

    def get_reminder(self, ctx: AuthContext, reminder_id: str) -> ReminderResponse:
        tenant_id = self._tenant(ctx)
        return self._anreichern(tenant_id, [self._eigene(tenant_id, reminder_id)])[0]

    def list_overdue(self, ctx: AuthContext) -> list[OverdueInvoiceResponse]:
        """Überfällige Rechnungen des Betriebs mit Tagen überfällig und letzter
        Mahnstufe. Überfällig = ausgestellt, offen, Fälligkeit vor heute,
        offener Betrag > 0."""
        tenant_id = self._tenant(ctx)
        heute = self._heute()
        rechnungen = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, customer_id, status, issue_date, due_date, "
                "gross_amount, paid_amount, currency, invoice_type, deleted_at"
            )
            .eq("tenant_id", tenant_id)
            .in_("status", sorted(OFFENE_RECHNUNGSSTATUS))
            .lt("due_date", heute.isoformat())
            .is_("deleted_at", "null")
            .order("due_date")
            .limit(LIMIT_MAX)
            .execute()
        ).data or []
        rechnungen = [
            r for r in rechnungen
            if (r.get("invoice_type") or "invoice") == "invoice"
            and _dec(r.get("gross_amount")) - _dec(r.get("paid_amount")) > 0
        ]
        if not rechnungen:
            return []
        ids = [str(r["id"]) for r in rechnungen]
        mahnungen = (
            self._db.table("reminders")
            .select("id, invoice_id, level, status")
            .eq("tenant_id", tenant_id)
            .in_("invoice_id", ids)
            .order("level")
            .execute()
        ).data or []
        letzte: dict[str, dict] = {}
        for m in mahnungen:
            iid = str(m["invoice_id"])
            if iid not in letzte or int(m["level"]) > int(letzte[iid]["level"]):
                letzte[iid] = m
        kunden = self._kunden(
            tenant_id, (str(r["customer_id"]) for r in rechnungen if r.get("customer_id"))
        )
        ergebnis: list[OverdueInvoiceResponse] = []
        for r in rechnungen:
            faellig = _datum(r.get("due_date"))
            if faellig is None:
                continue
            kunde = kunden.get(str(r.get("customer_id") or ""), {})
            brutto, bezahlt = _dec(r.get("gross_amount")), _dec(r.get("paid_amount"))
            letzte_m = letzte.get(str(r["id"]))
            letzte_stufe = int(letzte_m["level"]) if letzte_m else 0
            ergebnis.append(
                OverdueInvoiceResponse(
                    id=str(r["id"]),
                    invoice_number=r.get("invoice_number"),
                    status=str(r.get("status")),
                    customer_id=str(r["customer_id"]) if r.get("customer_id") else None,
                    customer_name=kunde.get("name"),
                    customer_email=kunde.get("email"),
                    issue_date=_datum(r.get("issue_date")),
                    due_date=faellig,
                    days_overdue=(heute - faellig).days,
                    gross_amount=brutto,
                    paid_amount=bezahlt,
                    amount_open=_q(brutto - bezahlt),
                    currency=str(r.get("currency") or ""),
                    last_level=letzte_stufe,
                    last_reminder_id=str(letzte_m["id"]) if letzte_m else None,
                    last_reminder_status=letzte_m["status"] if letzte_m else None,
                    next_level=letzte_stufe + 1 if letzte_stufe < MAX_LEVEL else None,
                )
            )
        return ergebnis

    # ---------------------------------------------------------- Anlegen
    def _naechste_stufe(self, tenant_id: str, invoice_id: str) -> int:
        rows = (
            self._db.table("reminders")
            .select("level")
            .eq("tenant_id", tenant_id)
            .eq("invoice_id", invoice_id)
            .execute()
        ).data or []
        hoechste = max((int(r["level"]) for r in rows), default=0)
        if hoechste >= MAX_LEVEL:
            raise MahnwesenError(
                "Für diese Rechnung existiert bereits die dritte Mahnstufe.", status_code=409
            )
        return hoechste + 1

    def _rechnung_fuer_mahnung(self, tenant_id: str, invoice_id: str, mahndatum: date) -> dict:
        rechnung = load_scoped(
            self._db, "invoices", invoice_id, tenant_id, not_found=_nicht_gefunden("Rechnung")
        )
        if rechnung.get("deleted_at"):
            raise _nicht_gefunden("Rechnung")
        if (rechnung.get("invoice_type") or "invoice") != "invoice":
            raise MahnwesenError("Nur Rechnungen können gemahnt werden.", status_code=422)
        if rechnung.get("status") not in OFFENE_RECHNUNGSSTATUS:
            raise MahnwesenError(
                f"Rechnung ist nicht offen (Status {rechnung.get('status')}).", status_code=422
            )
        faellig = _datum(rechnung.get("due_date"))
        if faellig is None or faellig >= mahndatum:
            raise MahnwesenError("Rechnung ist am Mahndatum nicht überfällig.", status_code=422)
        if not rechnung.get("currency"):
            raise MahnwesenError(
                "Rechnung ohne Währung — Datenfehler, bitte Rechnung prüfen.", status_code=422
            )
        return rechnung

    def _nummer_ziehen(self, tenant_id: str) -> str:
        res = self._db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": "reminder", "p_prefix": "MA-"},
        ).execute()
        row = (res.data or [{}])[0]
        nummer = row.get("formatted_number")
        if not nummer:
            raise MahnwesenError("Mahnnummer konnte nicht vergeben werden.", status_code=500)
        return str(nummer)

    def create_reminder(self, ctx: AuthContext, body: ReminderCreate) -> ReminderResponse:
        tenant_id = self._tenant(ctx)
        einstellungen = self._settings_pflicht(tenant_id)
        heute = self._heute()
        mahndatum = body.reminder_date or heute
        # Datumsdeckel (Wurzel 8): kein Mahndatum in der Zukunft, keine
        # Rückdatierung über ein Jahr — beides wäre ein erfundener Zeitpunkt.
        if mahndatum > heute:
            raise MahnwesenError("Mahndatum liegt in der Zukunft.", status_code=422)
        if (heute - mahndatum).days > MAX_RUECKDATIERUNG_TAGE:
            raise MahnwesenError(
                f"Mahndatum liegt mehr als {MAX_RUECKDATIERUNG_TAGE} Tage zurück.", status_code=422
            )
        rechnung = self._rechnung_fuer_mahnung(tenant_id, body.invoice_id, mahndatum)
        stufe = self._naechste_stufe(tenant_id, body.invoice_id)
        if body.level is not None and body.level != stufe:
            raise MahnwesenError(
                f"Die nächste Mahnstufe für diese Rechnung ist {stufe}.", status_code=409
            )
        offen = _q(_dec(rechnung.get("gross_amount")) - _dec(rechnung.get("paid_amount")))
        if offen <= 0:
            raise MahnwesenError("Rechnung ist vollständig bezahlt.", status_code=422)

        vorgabe: StufenEinstellung | None = getattr(einstellungen, f"level{stufe}")
        # `configured=True` garantiert beides — trotzdem explizit werfen statt
        # `assert` (unter `python -O` wäre ein assert stumm, Wurzel 5).
        if vorgabe is None or einstellungen.interest_rate is None:
            raise MahnwesenError(
                f"Mahnstufe {stufe} ist nicht eingerichtet.", status_code=422
            )
        gebuehr = _q(body.fee if body.fee is not None else vorgabe.fee)
        zinssatz = _q(
            body.interest_rate if body.interest_rate is not None else einstellungen.interest_rate
        )
        faellig_rechnung = _datum(rechnung["due_date"])
        if faellig_rechnung is None:
            raise MahnwesenError("Rechnung ohne Fälligkeit.", status_code=422)
        tage = (mahndatum - faellig_rechnung).days
        zinsen = _q(offen * zinssatz / Decimal(100) * Decimal(tage) / Decimal(365))
        faellig_mahnung = body.due_date or (mahndatum + timedelta(days=vorgabe.days))
        if faellig_mahnung < mahndatum:
            raise MahnwesenError("Zahlungsfrist liegt vor dem Mahndatum.", status_code=422)
        if (faellig_mahnung - mahndatum).days > MAX_FRIST_TAGE:
            raise MahnwesenError(
                f"Zahlungsfrist liegt mehr als {MAX_FRIST_TAGE} Tage nach dem Mahndatum.",
                status_code=422,
            )

        zeile = {
            "tenant_id": tenant_id,
            "reminder_number": self._nummer_ziehen(tenant_id),
            "invoice_id": body.invoice_id,
            "customer_id": rechnung.get("customer_id"),
            "level": stufe,
            "reminder_date": mahndatum.isoformat(),
            "due_date": faellig_mahnung.isoformat(),
            "fee": str(gebuehr),
            "interest": str(zinsen),
            "interest_rate": str(zinssatz),
            "amount_open": str(offen),
            "amount_total": str(_q(offen + gebuehr + zinsen)),
            "currency": rechnung["currency"],
            "status": "draft",
            "text_header": (body.text_header if body.text_header is not None else vorgabe.text),
            "text_footer": body.text_footer,
            "notes": body.notes,
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("reminders").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                log.info("mahnwesen_doppelte_stufe", tenant_id=tenant_id,
                         invoice_id=body.invoice_id, level=stufe)
                raise MahnwesenError(
                    f"Mahnstufe {stufe} existiert für diese Rechnung bereits.", status_code=409
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise MahnwesenError("Mahnung konnte nicht gespeichert werden.", status_code=500)
        log.info("mahnwesen_angelegt", tenant_id=tenant_id, reminder_id=neu["id"],
                 invoice_id=body.invoice_id, level=stufe, amount_total=zeile["amount_total"],
                 currency=zeile["currency"])
        return self._anreichern(tenant_id, [neu])[0]

    # ------------------------------------------------------------ Ändern
    _TEMPLATE_FELDER = (
        "template_id", "template", "template_type", "color", "logo_url",
        "logo_size", "page_mode", "document_settings",
    )

    def update_reminder(
        self, ctx: AuthContext, reminder_id: str, body: ReminderUpdate
    ) -> ReminderResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, reminder_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}

        inhalt = {
            "text_header": gesetzt.get("text_header", gesetzt.get("head_text")),
            "text_footer": gesetzt.get("text_footer", gesetzt.get("footer_text")),
            "notes": gesetzt.get("notes"),
            "due_date": gesetzt["due_date"].isoformat() if gesetzt.get("due_date") else None,
        }
        inhalt = {k: v for k, v in inhalt.items() if v is not None}
        if row["status"] != "draft":
            # Der Versand-Dialog patcht den Fußtext auch an versendeten Belegen
            # mit — unverändert ist das kein Fehler, verändert schon (409).
            geaendert = {k: v for k, v in inhalt.items() if str(row.get(k) or "") != str(v)}
            if geaendert:
                raise MahnwesenError(
                    "Eine versendete Mahnung kann inhaltlich nicht mehr geändert werden.",
                    status_code=409,
                )
        else:
            aenderung.update(inhalt)

        vorlage = {k: gesetzt[k] for k in self._TEMPLATE_FELDER if k in gesetzt}
        if vorlage:
            aenderung["template_settings"] = {**(row.get("template_settings") or {}), **vorlage}

        if aenderung:
            self._db.table("reminders").update(aenderung).eq("id", reminder_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info("mahnwesen_geaendert", tenant_id=tenant_id, reminder_id=reminder_id,
                     felder=sorted(aenderung))
        return self.get_reminder(ctx, reminder_id)

    def set_status(self, ctx: AuthContext, reminder_id: str, status: str) -> ReminderResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, reminder_id)
        alt = str(row["status"])
        if status == alt:
            return self.get_reminder(ctx, reminder_id)  # idempotent (Wurzel 2)
        if status not in _ZULAESSIGE_UEBERGAENGE.get(alt, frozenset()):
            log.info("mahnwesen_status_verweigert", tenant_id=tenant_id,
                     reminder_id=reminder_id, von=alt, nach=status)
            raise MahnwesenError(
                f"Statuswechsel {alt} → {status} ist nicht zulässig.", status_code=409
            )
        aenderung: dict[str, Any] = {"status": status}
        if status == "sent" and not row.get("sent_at"):
            aenderung["sent_at"] = datetime.now(UTC).isoformat()
        self._db.table("reminders").update(aenderung).eq("id", reminder_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("mahnwesen_status", tenant_id=tenant_id, reminder_id=reminder_id,
                 von=alt, nach=status)
        return self.get_reminder(ctx, reminder_id)

    def delete_reminder(self, ctx: AuthContext, reminder_id: str) -> None:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, reminder_id)
        if row["status"] != "draft":
            raise MahnwesenError("Nur Entwürfe können gelöscht werden.", status_code=409)
        self._db.table("reminders").delete().eq("id", reminder_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("mahnwesen_geloescht", tenant_id=tenant_id, reminder_id=reminder_id,
                 reminder_number=row.get("reminder_number"))

    # ----------------------------------------------------------- Versand
    @staticmethod
    def _pdf_dekodieren(pdf_base64: str) -> bytes:
        roh = pdf_base64.split(",", 1)[1] if pdf_base64.startswith("data:") else pdf_base64
        if len(roh) > _PDF_MAX_BASE64_ZEICHEN:
            raise MahnwesenError("PDF ist größer als 15 MB.", status_code=413)
        try:
            daten = base64.b64decode(roh, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise MahnwesenError("PDF ist kein gültiges Base64.", status_code=422) from exc
        if len(daten) > _PDF_MAX_BYTES:
            raise MahnwesenError("PDF ist größer als 15 MB.", status_code=413)
        if not daten.startswith(_PDF_MAGIC):
            raise MahnwesenError("Anhang ist kein PDF.", status_code=422)
        return daten

    def _claim_zuruecknehmen(self, tenant_id: str, reminder_id: str) -> None:
        """Gescheiterter Versand: den Claim `sent` wieder auf `draft` setzen.
        Best-effort — der eigentliche Fehler wird vom Aufrufer geworfen."""
        try:
            self._db.table("reminders").update(
                {"status": "draft", "sent_at": None}
            ).eq("id", reminder_id).eq("tenant_id", tenant_id).eq("status", "sent").is_(
                "sent_message_id", "null"
            ).execute()
        except APIError as exc:  # noqa: BLE001 — Rücknahme darf den Fehlerpfad nicht kippen
            log.error("mahnwesen_claim_ruecknahme_fehlgeschlagen", tenant_id=tenant_id,
                      reminder_id=reminder_id, error=str(exc)[:200])

    def send_reminder(
        self, ctx: AuthContext, reminder_id: str, body: ReminderSend
    ) -> SendResult:
        """Mahnung per Mail über den Bereich »versand« verschicken und als
        versendet buchen. Ein zweiter Aufruf trifft `status='sent'` → 409,
        damit ein Retry keine zweite Mail auslöst (Wurzel 2)."""
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, reminder_id)
        if row["status"] != "draft":
            raise MahnwesenError(
                f"Mahnung {row['reminder_number']} ist bereits {row['status']}.", status_code=409
            )
        pdf = self._pdf_dekodieren(body.pdf_base64)
        dateiname = (body.filename or f"{row['reminder_number']}.pdf").strip()
        if not dateiname.lower().endswith(".pdf"):
            dateiname += ".pdf"

        if self._versand is not None:
            senden, fehlerklassen = self._versand, (MailError,)
        else:
            senden, fehlerklassen = _versand_aufloesen()

        # Claim-Guard VOR dem Seiteneffekt (Wurzel 2): der Wechsel draft→sent
        # ist bedingt auf `status = 'draft'`. Zwei parallele Klicks lesen beide
        # „draft" — aber nur EIN Update trifft eine Zeile; der zweite bekommt
        # 409 und löst keine zweite Mail aus. Scheitert der Versand danach,
        # geht der Claim zurück auf `draft`.
        gesendet = datetime.now(UTC)
        claim = (
            self._db.table("reminders")
            .update({"status": "sent", "sent_at": gesendet.isoformat()})
            .eq("id", reminder_id)
            .eq("tenant_id", tenant_id)
            .eq("status", "draft")
            .execute()
        ).data or []
        if not claim:
            raise MahnwesenError(
                f"Mahnung {row['reminder_number']} wird bereits versendet.", status_code=409
            )
        try:
            nachricht_id = senden(
                ctx,
                an=list(body.to),
                betreff=body.subject,
                text=body.text,
                anhaenge=[(dateiname, pdf, _MIME_PDF)],
                cc=list(body.cc) if body.cc else None,
                bcc=list(body.bcc) if body.bcc else None,
                kopie_an_absender=body.kopie_an_absender,
            )
        except fehlerklassen as exc:
            self._claim_zuruecknehmen(tenant_id, reminder_id)
            status_code = int(getattr(exc, "status_code", 502) or 502)
            meldung = str(getattr(exc, "message", exc))
            log.warning("mahnwesen_versand_fehlgeschlagen", tenant_id=tenant_id,
                        reminder_id=reminder_id, status_code=status_code, error=meldung[:200])
            raise MahnwesenError(
                f"Versand fehlgeschlagen: {meldung}", status_code=status_code
            ) from exc
        except Exception:
            # Unerwarteter Fehler im Versandweg: Claim zurück, Fehler NICHT
            # verschlucken (Wurzel 5) — er soll als 500 sichtbar werden.
            self._claim_zuruecknehmen(tenant_id, reminder_id)
            raise

        self._db.table("reminders").update(
            {"sent_message_id": str(nachricht_id)}
        ).eq("id", reminder_id).eq("tenant_id", tenant_id).execute()
        log.info("mahnwesen_versendet", tenant_id=tenant_id, reminder_id=reminder_id,
                 empfaenger=len(body.to), message_id=str(nachricht_id)[:80])
        return SendResult(
            id=reminder_id, status="sent", sent_at=gesendet, sent_message_id=str(nachricht_id)
        )


# ------------------------------------------------------------- Tages-Lauf
def _ueberfaellig_je_tenant(db: Client, tenant_id: str, heute: date) -> tuple[int, bool]:
    """Versendete, fällige, unbezahlte Rechnungen EINES Betriebs auf `overdue`
    heben. Gibt (markiert, rest_vorhanden) zurück — gedeckelt je Lauf."""
    rows = (
        db.table("invoices")
        .select("id, gross_amount, paid_amount, invoice_type")
        .eq("tenant_id", tenant_id)
        .eq("status", STATUS_VERSENDET)
        .lt("due_date", heute.isoformat())
        .is_("deleted_at", "null")
        .order("due_date")
        .limit(_RECHNUNGEN_JE_TENANT + 1)
        .execute()
    ).data or []
    rest = len(rows) > _RECHNUNGEN_JE_TENANT
    ids = [
        str(r["id"]) for r in rows[:_RECHNUNGEN_JE_TENANT]
        if (r.get("invoice_type") or "invoice") == "invoice"
        and _dec(r.get("gross_amount")) - _dec(r.get("paid_amount")) > 0
    ]
    if not ids:
        return 0, rest
    # Bedingt auf `status = 'sent'` (Wurzel 2): läuft der Tick doppelt oder
    # zahlt der Kunde zwischen Select und Update, trifft das Update nichts.
    geaendert = (
        db.table("invoices")
        .update({"status": STATUS_UEBERFAELLIG})
        .eq("tenant_id", tenant_id)
        .eq("status", STATUS_VERSENDET)
        .in_("id", ids)
        .execute()
    ).data or []
    log.info("mahnwesen_ueberfaellig_markiert", tenant_id=tenant_id,
             rechnungen=len(geaendert), rest=rest)
    return len(geaendert), rest


def ueberfaellig_markieren(db: Client, heute: date | None = None) -> UeberfaelligLaufResult:
    """Tages-Lauf: `sent` → `overdue` für alle Betriebe mit
    `reminder_settings.auto_mark_overdue = true`.

    Fasst NUR Betriebe an, die den Schalter gesetzt haben (0641: kein Default,
    der Betrieb entscheidet). Je Lauf höchstens `_TENANTS_JE_LAUF` Betriebe und
    `_RECHNUNGEN_JE_TENANT` Rechnungen je Betrieb; der Rest kommt beim nächsten
    Lauf. Idempotent: ein zweiter Lauf am selben Tag findet nichts mehr.

    Fehler EINES Betriebs (APIError) werden geloggt und der Lauf geht weiter —
    ein Betrieb mit kaputten Daten darf nicht 999 andere blockieren; jeder
    andere Fehler bricht ab und ist im Worker sichtbar (Wurzel 5).

    Anbindung an den Worker: `apps/api/src/worker.py` reiht am täglichen Tick
    (neben `feiertage_tick.einreihen`) einen Job ein, dessen Handler diese
    Funktion ruft. Der Bereich fasst `worker.py` nicht an (Koordinator).
    """
    tag = heute or datetime.now(UTC).date()
    tenants = (
        db.table("reminder_settings")
        .select("tenant_id")
        .eq("auto_mark_overdue", True)
        .order("tenant_id")
        .limit(_TENANTS_JE_LAUF)
        .execute()
    ).data or []
    markiert = 0
    mit_rest = 0
    for zeile in tenants:
        tenant_id = str(zeile["tenant_id"])
        try:
            anzahl, rest = _ueberfaellig_je_tenant(db, tenant_id, tag)
        except APIError as exc:
            log.error("mahnwesen_ueberfaellig_tenant_fehler", tenant_id=tenant_id,
                      error=str(exc)[:200])
            continue
        markiert += anzahl
        mit_rest += int(rest)
    ergebnis = UeberfaelligLaufResult(
        tenants_geprueft=len(tenants), rechnungen_markiert=markiert, tenants_mit_rest=mit_rest
    )
    log.info("mahnwesen_ueberfaellig_lauf", datum=tag.isoformat(),
             **ergebnis.model_dump(by_alias=False))
    return ergebnis
