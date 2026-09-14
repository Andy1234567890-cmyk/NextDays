"""Fachlogik des Bereichs »erechnung«: E-Rechnungen zu Rechnungen.

Es gibt im Backend KEINEN XML-Erzeuger (geprüft 12.09.2026: `grep -rn
"XRechnung|ZUGFeRD|EN16931" apps/api/src` trifft nur einen Docstring in
owner_statements). Das XML entsteht weiterhin im Browser
(web/services/eInvoiceService.ts) und kommt hierher — der Server ist die
Stelle, die es PRÜFT, ABLEGT und AUSLIEFERT:

  * Annahme: Base64 oder Rohtext, Cap 10 MB, DOCTYPE/ENTITY → 422 (Wurzel 8).
  * Das Format muss zur Syntax passen (UBL-Wurzel für xrechnung_ubl, CII für
    die beiden anderen), sonst 422 — ein falsch etikettiertes XML ist ein
    Datenfehler, kein Befund.
  * Idempotenz (Wurzel 2): SHA-256 des Inhalts; dieselbe (Rechnung, Hash)
    liefert die vorhandene Zeile. Der Unique-Index 0688 ist der Backstop.
  * Die Datei liegt im privaten Bucket `e-rechnungen`, Pfad aus Tenant,
    Rechnung und Hash — nie aus Client-Angaben. Download nur über den Server.
  * Jeder XML-Abruf schreibt einen `download`-Eintrag ins Protokoll — das ist
    der Nachweis, dass der Betrieb die Datei hatte.

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`. Beträge werden serverseitig aus dem XML gelesen und mit der
gespeicherten Rechnung verglichen; nichts davon kommt vom Client.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import pruefung
from .schemas import (
    LIMIT_MAX,
    XML_MAX_BYTES,
    ZEITRAUM_MAX_TAGE,
    ComplianceResponse,
    CustomerGap,
    EInvoiceCreate,
    EInvoiceResponse,
    EInvoiceSettingsResponse,
    EInvoiceSettingsUpdate,
    Finding,
    TransmissionCreate,
    TransmissionResponse,
)

log = get_logger("nextdays.buchhaltung.erechnung")

BUCKET = "e-rechnungen"
_MIME_XML = "application/xml"
# Rechnungsstatus, die als AUSGESTELLT gelten (die Compliance zählt nur die).
AUSGESTELLT: frozenset[str] = frozenset({"sent", "finalized", "paid", "overdue"})
_DATEINAME_ERLAUBT = re.compile(r"[^A-Za-z0-9._-]+")
_RECHNUNGS_SPALTEN = (
    "id, invoice_number, customer_id, status, issue_date, gross_amount, currency, "
    "invoice_type, leitweg_id, deleted_at"
)


class ERechnungError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> ERechnungError:
    return ERechnungError(f"{was} nicht gefunden.", status_code=404)


def _xml_bytes(body: EInvoiceCreate) -> bytes:
    """Base64 ODER Rohtext → Bytes, mit Größen-Cap (Wurzel 8)."""
    if (body.xml_base64 is None) == (body.xml_content is None):
        raise ERechnungError(
            "Genau eines von xmlBase64 oder xmlContent angeben.", status_code=422
        )
    if body.xml_content is not None:
        daten = body.xml_content.encode("utf-8")
    else:
        roh = body.xml_base64 or ""
        roh = roh.split(",", 1)[1] if roh.startswith("data:") else roh
        # Grobe Grenze VOR dem Dekodieren: Base64 ist 4/3 so groß wie der Inhalt.
        if len(roh) > XML_MAX_BYTES * 4 // 3 + 4:
            raise ERechnungError("XML ist größer als 10 MB.", status_code=413)
        try:
            daten = base64.b64decode(roh, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ERechnungError("xmlBase64 ist kein gültiges Base64.", status_code=422) from exc
    if len(daten) > XML_MAX_BYTES:
        raise ERechnungError("XML ist größer als 10 MB.", status_code=413)
    return daten


def _dateiname(rechnung: dict | None, fmt: str) -> str:
    nummer = str((rechnung or {}).get("invoice_number") or "e-rechnung")
    sauber = _DATEINAME_ERLAUBT.sub("_", nummer).strip("._") or "e-rechnung"
    return f"{sauber}-{fmt}.xml"


class ERechnungService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ERechnungError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _jetzt() -> datetime:
        return datetime.now(UTC)

    def _eigene(self, tenant_id: str, e_invoice_id: str) -> dict:
        return load_scoped(
            self._db, "e_invoices", e_invoice_id, tenant_id, not_found=_nicht_gefunden("E-Rechnung")
        )

    def _rechnung(self, tenant_id: str, invoice_id: str) -> dict:
        rechnung = load_scoped(
            self._db,
            "invoices",
            invoice_id,
            tenant_id,
            columns=_RECHNUNGS_SPALTEN,
            not_found=_nicht_gefunden("Rechnung"),
        )
        if rechnung.get("deleted_at"):
            raise _nicht_gefunden("Rechnung")
        return rechnung

    def _rechnungen(self, tenant_id: str, ids: list[str]) -> dict[str, dict]:
        ids = sorted(set(ids))
        if not ids:
            return {}
        rows = (
            self._db.table("invoices")
            .select(_RECHNUNGS_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _kunden(self, tenant_id: str, ids: list[str]) -> dict[str, dict]:
        ids = sorted({i for i in ids if i})
        if not ids:
            return {}
        rows = (
            self._db.table("customers")
            .select("id, name, email")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _transmissions(self, tenant_id: str, e_invoice_id: str) -> list[TransmissionResponse]:
        rows = (
            self._db.table("e_invoice_transmissions")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("e_invoice_id", e_invoice_id)
            .order("transmitted_at", desc=True)
            .limit(LIMIT_MAX)
            .execute()
        ).data or []
        return [self._transmission_antwort(r) for r in rows]

    @staticmethod
    def _transmission_antwort(row: dict) -> TransmissionResponse:
        return TransmissionResponse(
            id=str(row["id"]),
            e_invoice_id=str(row["e_invoice_id"]),
            channel=row["channel"],
            recipient=row.get("recipient"),
            status=row["status"],
            transmitted_at=row["transmitted_at"],
            message_id=row.get("message_id"),
            error=row.get("error"),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
        )

    @staticmethod
    def _antwort(
        row: dict,
        rechnung: dict | None,
        kunde: dict | None,
        transmissions: list[TransmissionResponse],
    ) -> EInvoiceResponse:
        return EInvoiceResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            invoice_id=str(row["invoice_id"]),
            invoice_number=(rechnung or {}).get("invoice_number"),
            customer_id=(
                str(rechnung["customer_id"]) if (rechnung or {}).get("customer_id") else None
            ),
            customer_name=(kunde or {}).get("name"),
            format=row["format"],
            validation_status=row["validation_status"],
            findings=[Finding(**b) for b in (row.get("validation_findings") or [])],
            xml_sha256=row["xml_sha256"],
            xml_bytes=int(row["xml_bytes"]),
            version=int(row["version"]),
            download_path=f"/api/v1/buchhaltung/einvoices/{row['id']}/xml",
            generated_at=row["generated_at"],
            validated_at=row.get("validated_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            transmissions=transmissions,
        )

    def _anreichern(
        self, tenant_id: str, rows: list[dict], *, mit_protokoll: bool = False
    ) -> list[EInvoiceResponse]:
        rechnungen = self._rechnungen(tenant_id, [str(r["invoice_id"]) for r in rows])
        kunden = self._kunden(
            tenant_id, [str(r.get("customer_id") or "") for r in rechnungen.values()]
        )
        raus: list[EInvoiceResponse] = []
        for r in rows:
            rechnung = rechnungen.get(str(r["invoice_id"]))
            kunde = kunden.get(str((rechnung or {}).get("customer_id") or ""))
            protokoll = self._transmissions(tenant_id, str(r["id"])) if mit_protokoll else []
            raus.append(self._antwort(r, rechnung, kunde, protokoll))
        return raus

    # ----------------------------------------------------------- Listen
    def list_einvoices(
        self,
        ctx: AuthContext,
        *,
        invoice_id: str | None = None,
        validation_status: str | None = None,
        limit: int = LIMIT_MAX,
    ) -> list[EInvoiceResponse]:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("e_invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("generated_at", desc=True)
            .limit(min(limit, LIMIT_MAX))
        )
        if invoice_id:
            query = query.eq("invoice_id", invoice_id)
        if validation_status:
            query = query.eq("validation_status", validation_status)
        return self._anreichern(tenant_id, query.execute().data or [])

    def get_einvoice(self, ctx: AuthContext, e_invoice_id: str) -> EInvoiceResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, e_invoice_id)
        return self._anreichern(tenant_id, [row], mit_protokoll=True)[0]

    # ---------------------------------------------------------- Anlegen
    def _pruefen(self, daten: bytes, fmt: str, rechnung: dict) -> list[Finding]:
        """Wohlgeformtheit (Exception) + Kernprüfung (Befunde)."""
        try:
            wurzel = pruefung.xml_parsen(daten)
        except pruefung.XmlUngueltig as exc:
            raise ERechnungError(exc.message, status_code=422) from exc
        syntax = pruefung.syntax_erkennen(wurzel)
        erwartet = pruefung.SYNTAX_JE_FORMAT[fmt]
        if syntax != erwartet:
            raise ERechnungError(
                f"Format {fmt} verlangt eine {erwartet.upper()}-Wurzel, das XML hat "
                f"{'eine ' + syntax.upper() + '-Wurzel' if syntax else 'eine fremde Wurzel'}.",
                status_code=422,
            )
        return pruefung.pruefen(pruefung.kerndaten(wurzel, syntax), fmt, rechnung)

    def _vorhandene(self, tenant_id: str, invoice_id: str, sha: str) -> dict | None:
        rows = (
            self._db.table("e_invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("invoice_id", invoice_id)
            .eq("xml_sha256", sha)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _naechste_version(self, tenant_id: str, invoice_id: str) -> int:
        rows = (
            self._db.table("e_invoices")
            .select("version")
            .eq("tenant_id", tenant_id)
            .eq("invoice_id", invoice_id)
            .execute()
        ).data or []
        return max((int(r["version"]) for r in rows), default=0) + 1

    def _hochladen(self, pfad: str, daten: bytes) -> None:
        # upsert=true: derselbe Pfad heißt derselbe Hash, also derselbe Inhalt —
        # ein Retry nach abgebrochenem Insert überschreibt nur mit Identischem.
        self._db.storage.from_(BUCKET).upload(
            pfad, daten, {"content-type": _MIME_XML, "upsert": "true"}
        )

    def create_einvoice(self, ctx: AuthContext, body: EInvoiceCreate) -> EInvoiceResponse:
        tenant_id = self._tenant(ctx)
        rechnung = self._rechnung(tenant_id, body.invoice_id)
        daten = _xml_bytes(body)
        sha = hashlib.sha256(daten).hexdigest()

        vorhanden = self._vorhandene(tenant_id, body.invoice_id, sha)
        if vorhanden:
            log.info("erechnung_bereits_vorhanden", tenant_id=tenant_id,
                     e_invoice_id=vorhanden["id"], invoice_id=body.invoice_id)
            return self._anreichern(tenant_id, [vorhanden], mit_protokoll=True)[0]

        befunde = self._pruefen(daten, body.format, rechnung)
        pfad = f"{tenant_id}/{body.invoice_id}/{sha}.xml"
        self._hochladen(pfad, daten)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "invoice_id": body.invoice_id,
            "format": body.format,
            "storage_path": pfad,
            "xml_sha256": sha,
            "xml_bytes": len(daten),
            "validation_status": pruefung.status_aus(befunde),
            "validation_findings": [b.model_dump(by_alias=False) for b in befunde],
            "validated_at": self._jetzt().isoformat(),
            "version": self._naechste_version(tenant_id, body.invoice_id),
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("e_invoices").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) != "23505":
                raise
            # Doppelklick/Retry zwischen Prüfung und Insert: die Zeile liegt
            # inzwischen — sie zurückgeben, nicht 500 (Wurzel 2).
            nochmal = self._vorhandene(tenant_id, body.invoice_id, sha)
            if nochmal:
                return self._anreichern(tenant_id, [nochmal], mit_protokoll=True)[0]
            raise ERechnungError(
                "Gleichzeitige Erzeugung — bitte erneut versuchen.", status_code=409
            ) from exc
        neu = (res.data or [None])[0]
        if not neu:
            raise ERechnungError("E-Rechnung konnte nicht gespeichert werden.", status_code=500)
        log.info("erechnung_angelegt", tenant_id=tenant_id, e_invoice_id=neu["id"],
                 invoice_id=body.invoice_id, format=body.format,
                 status=zeile["validation_status"], befunde=len(befunde), bytes=len(daten))
        return self._anreichern(tenant_id, [neu], mit_protokoll=True)[0]

    # ------------------------------------------------------ Validieren
    def _xml_laden(self, row: dict) -> bytes:
        try:
            daten = self._db.storage.from_(BUCKET).download(row["storage_path"])
        except Exception as exc:  # noqa: BLE001 — Storage-Fehlerklassen sind nicht typisiert
            log.warning("erechnung_download_fehlgeschlagen", e_invoice_id=row["id"],
                        error=str(exc)[:200])
            raise ERechnungError("XML-Datei nicht abrufbar.", status_code=502) from exc
        if not isinstance(daten, bytes | bytearray) or not daten:
            raise ERechnungError("XML-Datei ist leer.", status_code=502)
        if hashlib.sha256(daten).hexdigest() != row["xml_sha256"]:
            log.error("erechnung_hash_abweichend", e_invoice_id=row["id"])
            raise ERechnungError(
                "XML-Datei stimmt nicht mit dem gespeicherten Hash überein.", status_code=500
            )
        return bytes(daten)

    def validate_einvoice(self, ctx: AuthContext, e_invoice_id: str) -> EInvoiceResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, e_invoice_id)
        rechnung = self._rechnung(tenant_id, str(row["invoice_id"]))
        befunde = self._pruefen(self._xml_laden(row), row["format"], rechnung)
        status = pruefung.status_aus(befunde)
        self._db.table("e_invoices").update(
            {
                "validation_status": status,
                "validation_findings": [b.model_dump(by_alias=False) for b in befunde],
                "validated_at": self._jetzt().isoformat(),
            }
        ).eq("id", e_invoice_id).eq("tenant_id", tenant_id).execute()
        log.info("erechnung_validiert", tenant_id=tenant_id, e_invoice_id=e_invoice_id,
                 status=status, befunde=len(befunde))
        return self.get_einvoice(ctx, e_invoice_id)

    # -------------------------------------------------------- Download
    def download_xml(self, ctx: AuthContext, e_invoice_id: str) -> tuple[bytes, str]:
        """(Bytes, Dateiname). Protokolliert den Abruf als `download`."""
        tenant_id = self._tenant(ctx)
        row = self._eigene(tenant_id, e_invoice_id)
        daten = self._xml_laden(row)
        rechnung = self._rechnungen(tenant_id, [str(row["invoice_id"])]).get(str(row["invoice_id"]))
        try:
            self._protokoll_schreiben(
                tenant_id, e_invoice_id, ctx.user_id,
                TransmissionCreate(channel="download", status="downloaded", recipient=ctx.user_id),
            )
        except APIError as exc:  # Protokoll ist Nachweis, aber kippt den Download nicht
            log.warning("erechnung_download_protokoll_fehlgeschlagen",
                        e_invoice_id=e_invoice_id, error=str(exc)[:200])
        log.info("erechnung_heruntergeladen", tenant_id=tenant_id, e_invoice_id=e_invoice_id,
                 user_id=ctx.user_id)
        return daten, _dateiname(rechnung, row["format"])

    # -------------------------------------------------------- Protokoll
    def _protokoll_schreiben(
        self, tenant_id: str, e_invoice_id: str, user_id: str | None, body: TransmissionCreate
    ) -> dict:
        zeile = {
            "tenant_id": tenant_id,
            "e_invoice_id": e_invoice_id,
            "channel": body.channel,
            "recipient": (body.recipient or "").strip() or None,
            "status": body.status,
            "transmitted_at": (body.transmitted_at or self._jetzt()).isoformat(),
            "message_id": body.message_id,
            "error": body.error,
            "created_by": user_id,
        }
        res = self._db.table("e_invoice_transmissions").insert(zeile).execute()
        neu = (res.data or [None])[0]
        if not neu:
            raise ERechnungError(
                "Protokolleintrag konnte nicht gespeichert werden.", status_code=500
            )
        return neu

    def add_transmission(
        self, ctx: AuthContext, e_invoice_id: str, body: TransmissionCreate
    ) -> TransmissionResponse:
        tenant_id = self._tenant(ctx)
        self._eigene(tenant_id, e_invoice_id)
        if body.status == "failed" and not body.error:
            raise ERechnungError(
                "Ein fehlgeschlagener Versand braucht einen Fehlertext.", status_code=422
            )
        neu = self._protokoll_schreiben(tenant_id, e_invoice_id, ctx.user_id, body)
        log.info("erechnung_uebertragung", tenant_id=tenant_id, e_invoice_id=e_invoice_id,
                 channel=body.channel, status=body.status)
        return self._transmission_antwort(neu)

    # ------------------------------------------------------- Compliance
    @staticmethod
    def _zeitraum(von: date | None, bis: date | None) -> tuple[date, date]:
        heute = datetime.now(UTC).date()
        bis = bis or heute
        von = von or (bis - timedelta(days=ZEITRAUM_MAX_TAGE - 1))
        if von > bis:
            raise ERechnungError("from liegt nach to.", status_code=422)
        if (bis - von).days + 1 > ZEITRAUM_MAX_TAGE:
            raise ERechnungError("Zeitraum größer als 366 Tage.", status_code=422)
        return von, bis

    def _ausgestellte(self, tenant_id: str, von: date, bis: date) -> list[dict]:
        rows = (
            self._db.table("invoices")
            .select(_RECHNUNGS_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("status", sorted(AUSGESTELLT))
            .gte("issue_date", von.isoformat())
            .lte("issue_date", bis.isoformat())
            .is_("deleted_at", "null")
            .order("issue_date", desc=True)
            .limit(LIMIT_MAX)
            .execute()
        ).data or []
        return [r for r in rows if (r.get("invoice_type") or "invoice") == "invoice"]

    def _status_je_rechnung(self, tenant_id: str, ids: list[str]) -> dict[str, str]:
        """Bester Status je Rechnung: valid schlägt invalid schlägt unchecked."""
        if not ids:
            return {}
        rows = (
            self._db.table("e_invoices")
            .select("invoice_id, validation_status")
            .eq("tenant_id", tenant_id)
            .in_("invoice_id", ids)
            .execute()
        ).data or []
        rang = {"valid": 2, "invalid": 1, "unchecked": 0}
        best: dict[str, str] = {}
        for r in rows:
            iid = str(r["invoice_id"])
            if rang[r["validation_status"]] > rang.get(best.get(iid, ""), -1):
                best[iid] = r["validation_status"]
        return best

    @staticmethod
    def _kundenluecken(rechnungen: list[dict], kunden: dict[str, dict]) -> list[CustomerGap]:
        je_kunde: dict[str, dict[str, Any]] = {}
        for r in rechnungen:
            kid = str(r.get("customer_id") or "")
            if not kid:
                continue
            eintrag = je_kunde.setdefault(kid, {"anzahl": 0, "leitweg": False})
            eintrag["anzahl"] += 1
            eintrag["leitweg"] = eintrag["leitweg"] or bool(r.get("leitweg_id"))
        raus: list[CustomerGap] = []
        for kid, e in je_kunde.items():
            kunde = kunden.get(kid, {})
            ohne_mail = not (kunde.get("email") or "").strip()
            if ohne_mail or not e["leitweg"]:
                raus.append(
                    CustomerGap(
                        customer_id=kid,
                        customer_name=kunde.get("name") or "—",
                        missing_email=ohne_mail,
                        missing_leitweg_id=not e["leitweg"],
                        invoice_count=e["anzahl"],
                    )
                )
        raus.sort(key=lambda g: (-g.invoice_count, g.customer_name))
        return raus

    def compliance(
        self, ctx: AuthContext, *, von: date | None = None, bis: date | None = None
    ) -> ComplianceResponse:
        tenant_id = self._tenant(ctx)
        von, bis = self._zeitraum(von, bis)
        rechnungen = self._ausgestellte(tenant_id, von, bis)
        status = self._status_je_rechnung(tenant_id, [str(r["id"]) for r in rechnungen])
        gueltig = sum(1 for r in rechnungen if status.get(str(r["id"])) == "valid")
        ungueltig = sum(
            1 for r in rechnungen if status.get(str(r["id"])) in ("invalid", "unchecked")
        )
        kunden = self._kunden(tenant_id, [str(r.get("customer_id") or "") for r in rechnungen])
        einstellungen = self._settings_row(tenant_id) or {}
        gesamt = len(rechnungen)
        return ComplianceResponse(
            from_date=von,
            to_date=bis,
            invoices_total=gesamt,
            with_valid_einvoice=gueltig,
            with_invalid_einvoice=ungueltig,
            without_einvoice=gesamt - gueltig - ungueltig,
            valid_share_percent=round(gueltig * 100 / gesamt, 2) if gesamt else None,
            customer_gaps=self._kundenluecken(rechnungen, kunden),
            mandatory_from=einstellungen.get("mandatory_from"),
        )

    # ------------------------------------------------------ Einstellungen
    def _settings_row(self, tenant_id: str) -> dict | None:
        rows = (
            self._db.table("e_invoice_settings")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _land(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenants").select("country").eq("id", tenant_id).limit(1).execute()
        ).data or []
        return (rows[0].get("country") if rows else None) or None

    def _settings_antwort(self, tenant_id: str, row: dict | None) -> EInvoiceSettingsResponse:
        land = self._land(tenant_id)
        if not row:
            return EInvoiceSettingsResponse(configured=False, country=land)
        return EInvoiceSettingsResponse(
            default_format=row.get("default_format"),
            leitweg_id=row.get("leitweg_id"),
            mandatory_from=row.get("mandatory_from"),
            country=land,
            configured=bool(row.get("default_format")),
            updated_at=row.get("updated_at"),
        )

    def get_settings(self, ctx: AuthContext) -> EInvoiceSettingsResponse:
        tenant_id = self._tenant(ctx)
        return self._settings_antwort(tenant_id, self._settings_row(tenant_id))

    def put_settings(
        self, ctx: AuthContext, body: EInvoiceSettingsUpdate
    ) -> EInvoiceSettingsResponse:
        tenant_id = self._tenant(ctx)
        zeile = {
            "tenant_id": tenant_id,
            "default_format": body.default_format,
            "leitweg_id": (body.leitweg_id or "").strip() or None,
            "mandatory_from": body.mandatory_from.isoformat() if body.mandatory_from else None,
        }
        self._db.table("e_invoice_settings").upsert(zeile, on_conflict="tenant_id").execute()
        log.info("erechnung_einstellungen_gespeichert", tenant_id=tenant_id,
                 default_format=body.default_format, leitweg=bool(zeile["leitweg_id"]),
                 mandatory_from=zeile["mandatory_from"])
        return self._settings_antwort(tenant_id, self._settings_row(tenant_id))
