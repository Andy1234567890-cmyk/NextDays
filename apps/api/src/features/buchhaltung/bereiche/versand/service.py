"""Fachlogik des Bereichs »versand«: Belegversand, Versand-Protokoll, Textvorlagen.

Was vom alten Werkzeug übrig blieb, ist die FORM der beiden Modals
(Empfänger/CC/BCC, Betreff, Text, Signatur, Anhänge als Base64) und der
Textvorlagen (`category`/`objectType`/`textType`, Platzhalter `[%…%]`). Die
REGELN sind neu und stehen ausschließlich hier:

  * Idempotenz (Wurzel 2): derselbe Inhalt (Belegart, Beleg, Empfänger,
    Betreff, Text, Anhänge → SHA-256) innerhalb von 60 s wird NICHT ein
    zweites Mal verschickt — der vorhandene Protokolleintrag kommt zurück.
    Der Eintrag wird VOR dem Versand als `pending` geschrieben (Claim); der
    Unique-Index (tenant, hash, minute) fängt den gleichzeitigen Doppelklick.
  * Anhänge: Base64 gültig, ≤ 15 MB, `.pdf` MUSS mit `%PDF-` beginnen
    (Magic Bytes, Wurzel 8). Ohne Anhang geht die Mail ohne Anhang — es wird
    kein PDF erfunden.
  * Nach erfolgreichem Versand: Rechnung/Angebot auf `sent` + `sent_at`, aber
    NUR aus draft/finalized heraus UND nur mit vergebener Nummer — ein Entwurf
    ohne Nummer darf nicht als ausgestellt gelten (Lückenlosigkeit, siehe
    BuchhaltungService.update_invoice_raw). Sonst bleibt der Status, und das
    Ergebnis sagt es (`belegStatusGesetzt=false`).
  * Fehlschlag des Mailservers → Eintrag `failed` mit Meldung, Antwort 502
    (503, wenn Mail gar nicht konfiguriert ist).
  * Drossel je Betrieb: mehr als `SENDS_JE_MINUTE` Versände in 60 s → 429.
    Das IP-Limit der Middleware ist eine Koordinator-Aufgabe (config.py); diese
    Bremse hier liegt in der Hand des Bereichs.
  * Textvorlagen werden beim Speichern mit `nh3` bereinigt (Allowlist, kein
    Regex); Platzhalter werden serverseitig aus dem Beleg gefüllt.

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

import nh3
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.mail import MailError
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .dienst import Anhang as MailAnhang
from .dienst import VersandError, dokument_senden
from .schemas import (
    LIMIT_MAX,
    Anhang,
    DocumentSendResponse,
    SendDocumentRequest,
    SendDocumentResult,
    TextTemplateCreate,
    TextTemplateRenderRequest,
    TextTemplateRenderResponse,
    TextTemplateResponse,
    TextTemplateUpdate,
)

log = get_logger("nextdays.buchhaltung.versand")

# Idempotenz-Fenster (Wurzel 2): gleicher Inhalt innerhalb dieser Spanne = ein Versand.
IDEMPOTENZ_FENSTER = timedelta(seconds=60)
# Drossel je Betrieb: Belegmails in 60 s. Mail ist teuer und missbrauchbar
# (fremde Postfächer, unsere Absender-Reputation).
SENDS_JE_MINUTE = 30

_PDF_MAX_BYTES = 15 * 1024 * 1024
_PDF_MAGIC = b"%PDF-"
_MIME_PDF = "application/pdf"
_MIME_ERLAUBT: frozenset[str] = frozenset({
    _MIME_PDF, "image/png", "image/jpeg", "text/plain", "text/csv",
    "application/xml", "text/xml",
})
_MIME_NACH_ENDUNG: dict[str, str] = {
    ".pdf": _MIME_PDF, ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".txt": "text/plain", ".csv": "text/csv", ".xml": "application/xml",
}
_TEXT_VORSCHAU_MAX = 300

# Belegarten, die eine Tabelle in diesem Schema haben — nur dort lässt sich
# die Zugehörigkeit zum Tenant prüfen und ein Status setzen.
_BELEG_TABELLEN: dict[str, str] = {
    "invoice": "invoices", "quote": "quotes", "reminder": "reminders",
}
_NUMMER_SPALTE: dict[str, str] = {
    "invoice": "invoice_number", "quote": "quote_number", "reminder": "reminder_number",
}
# Aus welchen Status heraus der Versand auf `sent` hebt.
_SENT_AUS_STATUS: dict[str, frozenset[str]] = {
    "invoice": frozenset({"draft", "finalized"}),
    "quote": frozenset({"draft"}),
}

# nh3-Allowlist für Textvorlagen: Absätze, Hervorhebung, Listen, Links.
_TEMPLATE_TAGS: frozenset[str] = frozenset({
    "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "h2", "h3", "blockquote",
})
_TEMPLATE_ATTRS: dict[str, set[str]] = {"a": {"href"}}
_TEMPLATE_URL_SCHEMES: set[str] = {"http", "https", "mailto", "tel"}

# Platzhalter: `[%NAME%]` (Bestand, web/types/textTemplates.ts) und kurze
# `{name}`-Form aus dem Auftrag — beide werden serverseitig gefüllt.
_PLATZHALTER_RE = re.compile(r"\[%([A-Z_]+)%\]|\{([a-z_]+)\}")
_KURZ_ALIASE: dict[str, str] = {
    "kunde": "KUNDENNAME", "belegnummer": "BELEGNUMMER", "betrag": "BETRAG",
    "faelligkeit": "ZAHLUNGSZIEL", "datum": "DATUM", "firma": "FIRMENNAME",
    "waehrung": "WAEHRUNG", "netto": "NETTOBETRAG", "steuer": "STEUERBETRAG",
}
# Sprachen mit Komma als Dezimaltrenner (DIN/EU-Schreibweise). Alles andere:
# Punkt. Kein Fantasie-Symbol — der ISO-Code steht hinter dem Betrag.
_KOMMA_SPRACHEN: frozenset[str] = frozenset({
    "de", "da", "sv", "nb", "nl", "fr", "es", "it", "pt", "pl", "cs", "fi", "hu",
    "ro", "bg", "el", "hr", "sk", "sl", "lt", "lv", "et", "tr",
})

VersandFunktion = Callable[..., str]


class VersandServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> VersandServiceError:
    return VersandServiceError(f"{was} nicht gefunden.", status_code=404)


def _dec(wert: object) -> Decimal | None:
    if wert is None or wert == "":
        return None
    return Decimal(str(wert))


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, datetime):
        return wert.date()
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def betrag_formatieren(betrag: Decimal | None, waehrung: str | None, sprache: str) -> str:
    """`1.234,56 EUR` (Komma-Sprachen) bzw. `1,234.56 EUR`. Ohne Währung nur
    die Zahl — nie ein erfundenes Symbol (Wurzel 4)."""
    if betrag is None:
        return ""
    roh = f"{betrag:,.2f}"
    if sprache in _KOMMA_SPRACHEN:
        roh = roh.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    return f"{roh} {waehrung}".strip() if waehrung else roh


def datum_formatieren(d: date | None, sprache: str) -> str:
    if d is None:
        return ""
    if sprache == "en":
        return d.strftime("%d/%m/%Y")
    if sprache in ("sv", "lt", "hu"):
        return d.isoformat()
    return d.strftime("%d.%m.%Y")


def text_bereinigen(text: str) -> str:
    """Vorlagentext mit `nh3` auf die Allowlist bringen. Reiner Text (mit
    Zeilenumbrüchen) bleibt reiner Text; Skripte, Event-Attribute und
    `javascript:`-Links existieren danach nicht mehr. Leer nach der Reinigung
    = Fehler, kein stilles leeres Feld (Wurzel 5)."""
    sauber = nh3.clean(
        text,
        tags=set(_TEMPLATE_TAGS),
        attributes={k: set(v) for k, v in _TEMPLATE_ATTRS.items()},
        url_schemes=set(_TEMPLATE_URL_SCHEMES),
        link_rel="noopener noreferrer",
    ).strip()
    if not sauber:
        raise VersandServiceError(
            "Der Text enthält nichts Erlaubtes (nur Skript/Markup entfernt).", status_code=422
        )
    return sauber


class VersandService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet; `company_id` aus
    dem Pfad ist Altlast und wird ignoriert."""

    def __init__(self, db: Client, *, versand: VersandFunktion | None = None) -> None:
        self._db = db
        self._versand = versand or dokument_senden

    # ------------------------------------------------------------- Hilfen
    @property
    def db(self) -> Client:
        """Der Datenbank-Client — für Helfer neben dem Service (Standardvorlagen)."""
        return self._db

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise VersandServiceError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _jetzt() -> datetime:
        return datetime.now(UTC)

    # ----------------------------------------------------------- Anhänge
    @staticmethod
    def _anhang_pruefen(anhang: Anhang) -> MailAnhang:
        roh = anhang.content_base64
        if roh.startswith("data:"):
            roh = roh.split(",", 1)[1] if "," in roh else ""
        try:
            daten = base64.b64decode(roh, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise VersandServiceError(
                f"Anhang {anhang.filename}: kein gültiges Base64.", status_code=422
            ) from exc
        if not daten:
            raise VersandServiceError(f"Anhang {anhang.filename} ist leer.", status_code=422)
        if len(daten) > _PDF_MAX_BYTES:
            raise VersandServiceError(
                f"Anhang {anhang.filename} ist größer als 15 MB.", status_code=413
            )
        name = anhang.filename.strip().replace("/", "_").replace("\\", "_")
        endung = ("." + name.rsplit(".", 1)[1].lower()) if "." in name else ""
        mime = (anhang.content_type or _MIME_NACH_ENDUNG.get(endung) or "").lower().strip()
        if endung == ".pdf" or mime == _MIME_PDF:
            if not daten.startswith(_PDF_MAGIC):
                raise VersandServiceError(
                    f"Anhang {name} ist kein PDF (Magic Bytes fehlen).", status_code=422
                )
            mime = _MIME_PDF
        if mime not in _MIME_ERLAUBT:
            raise VersandServiceError(
                f"Anhang {name}: Dateityp {mime or endung or 'unbekannt'} nicht erlaubt.",
                status_code=422,
            )
        return (name, daten, mime)

    # ------------------------------------------------------- Idempotenz
    @staticmethod
    def _inhalt_hash(body: SendDocumentRequest, anhaenge: list[MailAnhang]) -> str:
        h = hashlib.sha256()
        h.update(json.dumps({
            "art": body.document_type,
            "id": body.document_id,
            "to": sorted(body.to),
            "cc": sorted(body.cc or []),
            "bcc": sorted(body.bcc or []),
            "subject": body.subject.strip(),
            "message": body.message.strip(),
            "signature": (body.signature or "").strip(),
            "copy": body.send_copy,
        }, sort_keys=True, ensure_ascii=False).encode("utf-8"))
        for name, daten, _ in anhaenge:
            h.update(name.encode("utf-8"))
            h.update(hashlib.sha256(daten).digest())
        return h.hexdigest()

    def _juengster_gleicher(self, tenant_id: str, inhalt_hash: str, seit: datetime) -> dict | None:
        rows = (
            self._db.table("document_sends")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("inhalt_hash", inhalt_hash)
            .gte("created_at", seit.isoformat())
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _drossel_pruefen(self, tenant_id: str, seit: datetime) -> None:
        rows = (
            self._db.table("document_sends")
            .select("id")
            .eq("tenant_id", tenant_id)
            .gte("created_at", seit.isoformat())
            .limit(SENDS_JE_MINUTE + 1)
            .execute()
        ).data or []
        if len(rows) >= SENDS_JE_MINUTE:
            log.warning("versand_drossel", tenant_id=tenant_id, in_60s=len(rows))
            raise VersandServiceError(
                f"Zu viele Belegmails in kurzer Zeit (max. {SENDS_JE_MINUTE} pro Minute). "
                "Bitte kurz warten.",
                status_code=429,
            )

    # ------------------------------------------------------------ Beleg
    def _beleg_laden(self, tenant_id: str, art: str, beleg_id: str) -> dict | None:
        """Der Beleg, wenn seine Art eine Tabelle hat — gescopet (Wurzel 3).
        Für Arten ohne Tabelle `None`: dann gibt es nichts zu prüfen."""
        tabelle = _BELEG_TABELLEN.get(art)
        if not tabelle:
            return None
        row = load_scoped(
            self._db, tabelle, beleg_id, tenant_id, not_found=_nicht_gefunden("Beleg")
        )
        if row.get("deleted_at"):
            raise _nicht_gefunden("Beleg")
        return row

    def _beleg_als_versendet(
        self, tenant_id: str, art: str, beleg: dict, gesendet: datetime
    ) -> bool | None:
        """Rechnung/Angebot auf `sent` heben — nur mit Nummer und aus einem
        erlaubten Status. Gibt `None` zurück, wenn die Art keinen Status kennt."""
        erlaubt = _SENT_AUS_STATUS.get(art)
        if erlaubt is None:
            return None
        nummer = beleg.get(_NUMMER_SPALTE[art])
        status = str(beleg.get("status") or "")
        if status == "sent":
            return True  # idempotent: schon versendet
        if status not in erlaubt or not nummer:
            log.info("versand_beleg_status_unveraendert", tenant_id=tenant_id, art=art,
                     beleg_id=beleg["id"], status=status, nummer=bool(nummer))
            return False
        aenderung: dict[str, Any] = {"status": "sent"}
        if not beleg.get("sent_at"):
            aenderung["sent_at"] = gesendet.isoformat()
        self._db.table(_BELEG_TABELLEN[art]).update(aenderung).eq("id", beleg["id"]).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("versand_beleg_status_sent", tenant_id=tenant_id, art=art,
                 beleg_id=beleg["id"], von=status)
        return True

    # ---------------------------------------------------------- Antwort
    @staticmethod
    def _antwort(row: dict) -> DocumentSendResponse:
        return DocumentSendResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            document_type=row["document_type"],
            document_id=str(row["document_id"]),
            document_number=row.get("document_number"),
            kanal=row.get("kanal") or "email",
            empfaenger=list(row.get("empfaenger") or []),
            cc=list(row.get("cc") or []),
            bcc=list(row.get("bcc") or []),
            betreff=row["betreff"],
            text_vorschau=row.get("text_vorschau"),
            anhaenge=list(row.get("anhaenge") or []),
            status=row["status"],
            message_id=row.get("message_id"),
            fehler=row.get("fehler"),
            sent_at=row.get("sent_at"),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _eigener_send(self, tenant_id: str, send_id: str) -> dict:
        return load_scoped(
            self._db, "document_sends", send_id, tenant_id, not_found=_nicht_gefunden("Versand")
        )

    # ----------------------------------------------------------- Versand
    def send_document(self, ctx: AuthContext, body: SendDocumentRequest) -> SendDocumentResult:
        tenant_id = self._tenant(ctx)
        anhaenge = [self._anhang_pruefen(a) for a in body.attachments]
        beleg = self._beleg_laden(tenant_id, body.document_type, body.document_id)
        nummer = body.document_number or (
            beleg.get(_NUMMER_SPALTE.get(body.document_type, "")) if beleg else None
        )
        jetzt = self._jetzt()
        inhalt_hash = self._inhalt_hash(body, anhaenge)

        # Wurzel 2: gleicher Inhalt in den letzten 60 s → vorhandenen Eintrag
        # zurückgeben, keine zweite Mail. Auch ein `pending` (läuft gerade)
        # zählt; nur ein `failed` darf wiederholt werden.
        vorhanden = self._juengster_gleicher(tenant_id, inhalt_hash, jetzt - IDEMPOTENZ_FENSTER)
        if vorhanden and vorhanden.get("status") != "failed":
            log.info("versand_wiederverwendet", tenant_id=tenant_id, send_id=vorhanden["id"],
                     status=vorhanden["status"], document_id=body.document_id)
            return self._ergebnis(vorhanden, anhaenge, wiederverwendet=True)

        self._drossel_pruefen(tenant_id, jetzt - timedelta(seconds=60))
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "document_type": body.document_type,
            "document_id": body.document_id,
            "document_number": nummer,
            "kanal": "email",
            "empfaenger": list(body.to),
            "cc": list(body.cc or []),
            "bcc": list(body.bcc or []),
            "betreff": body.subject.strip(),
            "text_vorschau": body.message.strip()[:_TEXT_VORSCHAU_MAX],
            "anhaenge": [
                {"filename": n, "bytes": len(d), "contentType": m} for n, d, m in anhaenge
            ],
            "inhalt_hash": inhalt_hash,
            "fenster": int(jetzt.timestamp()) // 60,
            "status": "pending",
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("document_sends").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                # Gleichzeitiger Doppelklick: der andere Aufruf hat den Claim.
                bestehend = self._juengster_gleicher(
                    tenant_id, inhalt_hash, jetzt - IDEMPOTENZ_FENSTER
                )
                if bestehend:
                    log.info("versand_doppelklick_abgefangen", tenant_id=tenant_id,
                             send_id=bestehend["id"])
                    return self._ergebnis(bestehend, anhaenge, wiederverwendet=True)
            raise
        eintrag = (res.data or [None])[0]
        if not eintrag:
            raise VersandServiceError("Versand konnte nicht protokolliert werden.", status_code=500)
        send_id = str(eintrag["id"])
        log.info("versand_gestartet", tenant_id=tenant_id, send_id=send_id,
                 document_type=body.document_type, document_id=body.document_id,
                 empfaenger=len(body.to), anhaenge=len(anhaenge))

        try:
            message_id = self._versand(
                ctx,
                an=body.to,
                betreff=body.subject.strip(),
                text=body.message.strip(),
                anhaenge=anhaenge,
                cc=body.cc,
                bcc=body.bcc,
                kopie_an_absender=body.send_copy,
                signatur=body.signature,
            )
        except (VersandError, MailError) as exc:
            status_code = int(getattr(exc, "status_code", 502) or 502)
            # 503 = Mail nicht konfiguriert (bleibt), alles andere ist ein
            # Fehler des Mailservers → 502 Bad Gateway.
            if status_code not in (503, 422, 403):
                status_code = 502
            meldung = str(getattr(exc, "message", exc))
            self._db.table("document_sends").update(
                {"status": "failed", "fehler": meldung[:1000]}
            ).eq("id", send_id).eq("tenant_id", tenant_id).execute()
            log.warning("versand_fehlgeschlagen", tenant_id=tenant_id, send_id=send_id,
                        status_code=status_code, error=meldung[:200])
            raise VersandServiceError(
                f"Versand fehlgeschlagen: {meldung}", status_code=status_code
            ) from exc

        gesendet = self._jetzt()
        self._db.table("document_sends").update(
            {"status": "sent", "message_id": str(message_id), "sent_at": gesendet.isoformat()}
        ).eq("id", send_id).eq("tenant_id", tenant_id).execute()
        beleg_status = (
            self._beleg_als_versendet(tenant_id, body.document_type, beleg, gesendet)
            if beleg else None
        )
        log.info("versand_abgeschlossen", tenant_id=tenant_id, send_id=send_id,
                 message_id=str(message_id)[:80], beleg_status_gesetzt=beleg_status)
        frisch = self._eigener_send(tenant_id, send_id)
        return self._ergebnis(frisch, anhaenge, wiederverwendet=False, beleg_status=beleg_status)

    def _ergebnis(
        self, row: dict, anhaenge: list[MailAnhang], *, wiederverwendet: bool,
        beleg_status: bool | None = None,
    ) -> SendDocumentResult:
        pdfs = [n for n, _, m in anhaenge if m == _MIME_PDF] or [
            a.get("filename") for a in (row.get("anhaenge") or [])
            if a.get("contentType") == _MIME_PDF
        ]
        return SendDocumentResult(
            success=row["status"] != "failed",
            send=self._antwort(row),
            pdf_attached=bool(pdfs),
            attachment_filename=pdfs[0] if pdfs else None,
            wiederverwendet=wiederverwendet,
            beleg_status_gesetzt=beleg_status,
            kopie_an=None,
        )

    # ----------------------------------------------------------- Verlauf
    def list_sends(
        self, ctx: AuthContext, *, document_id: str | None = None,
        document_type: str | None = None, limit: int = 100,
    ) -> list[DocumentSendResponse]:
        tenant_id = self._tenant(ctx)
        if limit < 1 or limit > LIMIT_MAX:
            raise VersandServiceError(
                f"limit muss zwischen 1 und {LIMIT_MAX} liegen.", status_code=422
            )
        query = (
            self._db.table("document_sends")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if document_id:
            query = query.eq("document_id", document_id)
        if document_type:
            query = query.eq("document_type", document_type)
        return [self._antwort(r) for r in (query.execute().data or [])]

    def get_send(self, ctx: AuthContext, send_id: str) -> DocumentSendResponse:
        return self._antwort(self._eigener_send(self._tenant(ctx), send_id))

    # ------------------------------------------------------ Textvorlagen
    @staticmethod
    def _vorlage(row: dict) -> TextTemplateResponse:
        return TextTemplateResponse(
            id=str(row["id"]),
            company_id=str(row["tenant_id"]),
            name=row["name"],
            category=row["category"],
            object_type=row["object_type"],
            text_type=row["text_type"],
            text=row["text"],
            language=row.get("language"),
            is_default=bool(row.get("is_default")),
            is_private=bool(row.get("is_private")),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _sichtbar(row: dict, user_id: str) -> bool:
        return not row.get("is_private") or str(row.get("created_by") or "") == user_id

    def _eigene_vorlage(self, ctx: AuthContext, template_id: str) -> dict:
        row = load_scoped(
            self._db, "text_templates", template_id, self._tenant(ctx),
            not_found=_nicht_gefunden("Textvorlage"),
        )
        if not self._sichtbar(row, ctx.user_id):
            raise _nicht_gefunden("Textvorlage")  # private Vorlage eines anderen: kein Leak
        return row

    def list_text_templates(
        self, ctx: AuthContext, *, category: str | None = None, object_type: str | None = None,
        text_type: str | None = None, language: str | None = None, limit: int = LIMIT_MAX,
    ) -> list[TextTemplateResponse]:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("text_templates")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("is_default", desc=True)
            .order("name")
            .limit(min(max(limit, 1), LIMIT_MAX))
        )
        if category:
            query = query.eq("category", category.upper())
        if object_type:
            query = query.eq("object_type", object_type.upper())
        if text_type:
            query = query.eq("text_type", text_type.upper())
        rows = query.execute().data or []
        if language:
            rows = [r for r in rows if r.get("language") in (None, language.lower())]
        return [self._vorlage(r) for r in rows if self._sichtbar(r, ctx.user_id)]

    def get_text_template(self, ctx: AuthContext, template_id: str) -> TextTemplateResponse:
        return self._vorlage(self._eigene_vorlage(ctx, template_id))

    def default_text_template(
        self, ctx: AuthContext, *, category: str, object_type: str, text_type: str,
        language: str | None = None,
    ) -> TextTemplateResponse | None:
        """Die Standardvorlage der Art: sprachspezifisch vor sprachneutral."""
        kandidaten = [
            t for t in self.list_text_templates(
                ctx, category=category, object_type=object_type, text_type=text_type,
                language=language,
            )
            if t.is_default
        ]
        if not kandidaten:
            return None
        if language:
            passend = [t for t in kandidaten if t.language == language.lower()]
            if passend:
                return passend[0]
        return kandidaten[0]

    def _stern_wegnehmen(self, tenant_id: str, body: dict[str, Any], ausser_id: str | None) -> None:
        """Wurzel 1: eine neue Standardvorlage nimmt der bisherigen derselben
        Art und Sprache den Stern — sonst greift der Unique-Index mit 23505."""
        query = (
            self._db.table("text_templates")
            .update({"is_default": False})
            .eq("tenant_id", tenant_id)
            .eq("category", body["category"])
            .eq("object_type", body["object_type"])
            .eq("text_type", body["text_type"])
            .eq("is_default", True)
        )
        if body.get("language") is None:
            query = query.is_("language", "null")
        else:
            query = query.eq("language", body["language"])
        if ausser_id:
            query = query.neq("id", ausser_id)
        query.execute()

    def create_text_template(
        self, ctx: AuthContext, body: TextTemplateCreate
    ) -> TextTemplateResponse:
        tenant_id = self._tenant(ctx)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "name": body.name.strip(),
            "category": body.category,
            "object_type": body.object_type,
            "text_type": body.text_type,
            "language": body.language,
            "text": text_bereinigen(body.text),
            "is_default": body.is_default,
            "is_private": body.is_private,
            "created_by": ctx.user_id,
        }
        if body.is_default:
            self._stern_wegnehmen(tenant_id, zeile, None)
        try:
            res = self._db.table("text_templates").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                raise VersandServiceError(
                    "Für diese Art gibt es bereits eine Standardvorlage.", status_code=409
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise VersandServiceError(
                "Textvorlage konnte nicht gespeichert werden.", status_code=500
            )
        log.info("versand_vorlage_angelegt", tenant_id=tenant_id, template_id=neu["id"],
                 category=body.category, object_type=body.object_type, text_type=body.text_type,
                 is_default=body.is_default)
        return self._vorlage(neu)

    def update_text_template(
        self, ctx: AuthContext, template_id: str, body: TextTemplateUpdate
    ) -> TextTemplateResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene_vorlage(ctx, template_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}
        for feld in ("name", "category", "object_type", "text_type", "is_default", "is_private"):
            if feld in gesetzt and gesetzt[feld] is not None:
                aenderung[feld] = gesetzt[feld].strip() if feld == "name" else gesetzt[feld]
        if "language" in gesetzt:
            aenderung["language"] = gesetzt["language"]
        if gesetzt.get("text") is not None:
            aenderung["text"] = text_bereinigen(gesetzt["text"])
        if not aenderung:
            return self._vorlage(row)
        ziel = {**row, **aenderung}
        if ziel.get("is_default"):
            self._stern_wegnehmen(tenant_id, ziel, template_id)
        try:
            self._db.table("text_templates").update(aenderung).eq("id", template_id).eq(
                "tenant_id", tenant_id
            ).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                raise VersandServiceError(
                    "Für diese Art gibt es bereits eine Standardvorlage.", status_code=409
                ) from exc
            raise
        log.info("versand_vorlage_geaendert", tenant_id=tenant_id, template_id=template_id,
                 felder=sorted(aenderung))
        return self.get_text_template(ctx, template_id)

    def delete_text_template(self, ctx: AuthContext, template_id: str) -> None:
        tenant_id = self._tenant(ctx)
        row = self._eigene_vorlage(ctx, template_id)
        self._db.table("text_templates").delete().eq("id", template_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("versand_vorlage_geloescht", tenant_id=tenant_id, template_id=template_id,
                 name=row.get("name"))

    # ------------------------------------------------------- Platzhalter
    def _kunde(self, tenant_id: str, customer_id: object) -> dict:
        if not customer_id:
            return {}
        rows = (
            self._db.table("customers")
            .select("id, name, customer_number, email, address")
            .eq("tenant_id", tenant_id)
            .eq("id", str(customer_id))
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else {}

    def _firma(self, tenant_id: str) -> dict:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("legal_name, email, vat_id, tax_number")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else {}

    def _platzhalter_werte(
        self, tenant_id: str, art: str, beleg: dict | None, sprache: str
    ) -> dict[str, str]:
        beleg = beleg or {}
        kunde = self._kunde(tenant_id, beleg.get("customer_id"))
        firma = self._firma(tenant_id)
        adresse = kunde.get("address") if isinstance(kunde.get("address"), dict) else {}
        waehrung = beleg.get("currency")
        brutto, netto, steuer = (
            _dec(beleg.get(k)) for k in ("gross_amount", "net_amount", "tax_amount")
        )
        if art == "reminder":
            brutto = _dec(beleg.get("amount_total"))
        nummer = beleg.get(_NUMMER_SPALTE.get(art, "")) or ""
        faellig = _datum(beleg.get("due_date"))
        werte: dict[str, str] = {
            "KUNDENNAME": str(kunde.get("name") or ""),
            "VOLLEANREDE": str(kunde.get("name") or ""),
            "KUNDENNUMMER": str(kunde.get("customer_number") or ""),
            "EMAIL": str(kunde.get("email") or ""),
            "STRASSE": " ".join(
                str(adresse.get(k) or "") for k in ("street", "house_number")
            ).strip(),
            "PLZ": str(adresse.get("postal_code") or adresse.get("zipCode") or ""),
            "ORT": str(adresse.get("city") or ""),
            "BETRAG": betrag_formatieren(brutto, waehrung, sprache),
            "NETTOBETRAG": betrag_formatieren(netto, waehrung, sprache),
            "STEUERBETRAG": betrag_formatieren(steuer, waehrung, sprache),
            "WAEHRUNG": str(waehrung or ""),
            "BELEGNUMMER": str(nummer),
            "RECHNUNGSNUMMER": str(nummer) if art == "invoice" else "",
            "ANGEBOTSNUMMER": str(nummer) if art == "quote" else "",
            "ZAHLUNGSZIEL": datum_formatieren(faellig, sprache),
            "ZAHLDATUM": datum_formatieren(_datum(beleg.get("paid_at")), sprache),
            "DATUM": datum_formatieren(self._jetzt().date(), sprache),
            "ANGEBOTSDATUM": datum_formatieren(_datum(beleg.get("issue_date")), sprache),
            "GUELTIG_BIS": datum_formatieren(_datum(beleg.get("valid_until")), sprache),
            "FIRMENNAME": str(firma.get("legal_name") or ""),
            "FIRMEN_EMAIL": str(firma.get("email") or ""),
            "USTIDNR": str(firma.get("vat_id") or ""),
        }
        return werte

    def render_text_template(
        self, ctx: AuthContext, body: TextTemplateRenderRequest
    ) -> TextTemplateRenderResponse:
        tenant_id = self._tenant(ctx)
        if body.text is not None:
            text = body.text
        else:
            text = self._eigene_vorlage(ctx, body.template_id or "")["text"]
        beleg = self._beleg_laden(tenant_id, body.document_type, body.document_id)
        sprache = body.language or "en"
        if body.language is None:
            rows = (
                self._db.table("tenants").select("default_language").eq("id", tenant_id)
                .limit(1).execute()
            ).data or []
            sprache = str((rows[0].get("default_language") if rows else None) or "en").lower()[:2]
        werte = self._platzhalter_werte(tenant_id, body.document_type, beleg, sprache)
        offen: list[str] = []

        def _ersetzen(m: re.Match[str]) -> str:
            lang, kurz = m.group(1), m.group(2)
            schluessel = lang or _KURZ_ALIASE.get(kurz or "", (kurz or "").upper())
            wert = werte.get(schluessel)
            if wert is None or wert == "":
                offen.append(m.group(0))
                return ""
            return wert

        return TextTemplateRenderResponse(
            text=_PLATZHALTER_RE.sub(_ersetzen, text),
            offene_platzhalter=sorted(set(offen)),
            language=sprache,
        )
