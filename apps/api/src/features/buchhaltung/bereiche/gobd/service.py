"""Fachlogik des Bereichs »gobd«: Festschreibung, Prüfprotokoll, Datenträgerüberlassung.

Was vom alten Werkzeug übrig blieb, ist die FORM (Einstellungen mit
`autoLockOnSend`/`lockDeadlineDays`, „Dokument festschreiben", Compliance-
Zahlen). Die REGELN sind neu und stehen ausschließlich hier:

  * Festgeschrieben wird nur ein AUSGESTELLTER Beleg (Status ≠ draft UND
    Nummer vergeben). Ein Entwurf ist kein Beleg → 422. Ein zweiter Aufruf auf
    denselben Beleg ist kein Fehler, sondern `alreadyLocked` (Wurzel 2).
  * Die Festschreibung ist UNUMKEHRBAR. `POST /gobd/unlock` gibt es nur, damit
    die Anfrage protokolliert wird (`unlock_denied`) — die Antwort ist immer 403.
    Korrektur = Stornorechnung (Bestand `create_storno_invoice`).
  * Jeder Protokolleintrag trägt den Hash seines Vorgängers (Kette je Mandant);
    `verify()` rechnet die Kette nach und nennt den ERSTEN Bruch. Die Tabelle
    ist per Trigger append-only (0692) — der Service kennt kein Update darauf.
  * Die Datenträgerüberlassung (`export_zip`) ist ein ZIP mit CSVs nach dem
    GDPdU/GoBD-Beschreibungsstandard (`index.xml`), Zeitraum ≤ 366 Tage,
    Belegzahl und Bytes gecappt (Wurzel 8). Der Lauf wird selbst protokolliert
    (Aktion `export`, mit SHA-256 des ZIPs).
  * Die Aufbewahrungsfrist hat KEINEN Default (Wurzel 4) — sie ist je Land
    verschieden und wird vom Betrieb gesetzt; bis dahin `configured=false`.

Jede per-ID-Ladung filtert auf `tenant_id` (Wurzel 3); der Service bekommt den
Service-Role-Client, RLS greift hier nicht.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from postgrest import SyncSelectRequestBuilder
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    AUDIT_ACTIONS,
    AUDIT_OBJECT_TYPES,
    EXPORT_BELEGE_MAX,
    EXPORT_ZIP_MAX_BYTES,
    LIMIT_MAX,
    MAX_ZEITRAUM_TAGE,
    AuditEntry,
    AutoLockRunResult,
    GobdSettingsResponse,
    GobdSettingsUpdate,
    GobdStatus,
    KettenBruch,
    LockRequest,
    LockResult,
    OffeneRechnung,
    UnlockRequest,
    VerifyResult,
)

log = get_logger("nextdays.buchhaltung.gobd")

# Erster Eintrag einer Kette hängt am Genesis-Wert (0692: prev_hash not null).
GENESIS_HASH = "0" * 64
# Wie oft ein Protokolleintrag bei einer Ketten-Kollision (23505 auf
# (tenant_id, prev_hash)) neu an den aktuellen Kopf gehängt wird.
_KETTE_VERSUCHE = 3
# Verify liest die Kette seitenweise.
_VERIFY_SEITE = 1000
_VERIFY_MAX = 200_000
# Status, in denen ein Beleg als „versendet/zugestellt" gilt (Modus on_send).
STATUS_VERSENDET: frozenset[str] = frozenset({"sent", "paid", "overdue"})
STATUS_ENTWURF = "draft"
_EXPORT_CHUNK = 200
_EXPORT_AUDIT_MAX = 50_000
_EXPORT_KODIERUNG = "utf-8"
_BINAER_JSON = {"sort_keys": True, "separators": (",", ":"), "ensure_ascii": False}


class GobdError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# ------------------------------------------------------------------ Hilfen


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


def _zeit(wert: object) -> datetime | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    text = str(wert).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _sekunde(zeit: datetime) -> str:
    """Zeit sekundengenau als UTC-Text — Postgres kürzt Nachkomma-Nullen der
    Mikrosekunden, Python nicht; nur die Sekunde ist auf beiden Seiten gleich."""
    return zeit.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def audit_hash(
    *,
    prev_hash: str,
    tenant_id: str,
    object_type: str,
    object_id: str,
    action: str,
    user_id: str | None,
    created_at: datetime,
    diff: dict,
) -> str:
    """SHA-256 über den kanonischen Eintrag. `diff` läuft durch einen JSON-
    Roundtrip, damit Python-Werte und jsonb-Rückgabe dieselbe Form haben
    (Diff-Werte sind deshalb Strings/ints/bools/None, nie floats/Decimal)."""
    diff_kanonisch = json.loads(json.dumps(diff, default=str, **_BINAER_JSON))
    payload = {
        "prev": prev_hash,
        "tenant": tenant_id,
        "type": object_type,
        "id": object_id,
        "action": action,
        "user": user_id,
        "at": _sekunde(created_at),
        "diff": diff_kanonisch,
    }
    return hashlib.sha256(json.dumps(payload, **_BINAER_JSON).encode("utf-8")).hexdigest()


def _zeitraum_pruefen(von: date, bis: date) -> None:
    if bis < von:
        raise GobdError("Zeitraum: 'bis' liegt vor 'von'.", status_code=422)
    if (bis - von).days > MAX_ZEITRAUM_TAGE:
        raise GobdError(
            f"Zeitraum höchstens {MAX_ZEITRAUM_TAGE} Tage.", status_code=422
        )


def _ist_ausgestellt(row: dict) -> bool:
    return row.get("status") != STATUS_ENTWURF and bool(row.get("invoice_number"))


class GobdService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet; `company_id` aus dem
    Pfad (Bestand) ist Altlast und wird ignoriert."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise GobdError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _jetzt() -> datetime:
        return datetime.now(UTC)

    # ------------------------------------------------------- Einstellungen
    def _settings_row(self, tenant_id: str) -> dict | None:
        rows = (
            self._db.table("gobd_settings")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    @staticmethod
    def _settings_antwort(tenant_id: str, row: dict | None) -> GobdSettingsResponse:
        r = row or {}
        modus = str(r.get("auto_lock_mode") or "manual")
        tage = r.get("lock_after_days")
        frist = r.get("retention_years")
        return GobdSettingsResponse(
            company_id=tenant_id,
            auto_lock_mode=modus,  # type: ignore[arg-type]
            lock_after_days=int(tage) if tage is not None else None,
            retention_years=int(frist) if frist is not None else None,
            audit_log_enabled=bool(r.get("audit_log_enabled", True)),
            auto_lock_on_export=bool(r.get("auto_lock_on_export", False)),
            allow_storno_after_lock=bool(r.get("allow_storno_after_lock", True)),
            require_approval_for_unlock=bool(r.get("require_approval_for_unlock", True)),
            notification_settings=dict(r.get("notification_settings") or {}),
            auto_lock_on_send=modus == "on_send",
            lock_deadline_days=int(tage) if tage is not None else None,
            configured=bool(row) and frist is not None,
            updated_at=r.get("updated_at"),
        )

    def get_settings(self, ctx: AuthContext) -> GobdSettingsResponse:
        tenant_id = self._tenant(ctx)
        return self._settings_antwort(tenant_id, self._settings_row(tenant_id))

    def put_settings(self, ctx: AuthContext, body: GobdSettingsUpdate) -> GobdSettingsResponse:
        tenant_id = self._tenant(ctx)
        alt = dict(self._settings_row(tenant_id) or {})
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        gesetzt.pop("auto_lock_on_send", None)
        gesetzt.pop("lock_deadline_days", None)
        zeile: dict[str, Any] = {k: v for k, v in gesetzt.items() if v is not None or k in (
            "lock_after_days", "retention_years")}
        modus = zeile.get("auto_lock_mode", alt.get("auto_lock_mode") or "manual")
        tage = zeile.get("lock_after_days", alt.get("lock_after_days"))
        if modus == "after_days" and tage is None:
            raise GobdError(
                "Modus 'nach N Tagen' braucht die Anzahl Tage (lockAfterDays).",
                status_code=422,
            )
        zeile["tenant_id"] = tenant_id
        zeile["updated_by"] = ctx.user_id
        self._db.table("gobd_settings").upsert(zeile, on_conflict="tenant_id").execute()
        neu = self._settings_row(tenant_id) or zeile
        geaendert = {
            k: {"vorher": _json_sicher(alt.get(k)), "nachher": _json_sicher(neu.get(k))}
            for k in zeile
            if k not in ("tenant_id", "updated_by")
            and _json_sicher(alt.get(k)) != _json_sicher(neu.get(k))
        }
        log.info("gobd_einstellungen_gespeichert", tenant_id=tenant_id, user_id=ctx.user_id,
                 auto_lock_mode=modus, felder=sorted(geaendert))
        if geaendert:
            self.protokollieren(
                tenant_id,
                object_type="settings",
                object_id=tenant_id,
                action="change",
                user_id=ctx.user_id,
                diff=geaendert,
                pflicht=False,
                audit_an=bool(neu.get("audit_log_enabled", True)),
            )
        return self._settings_antwort(tenant_id, neu)

    def _audit_an(self, tenant_id: str) -> bool:
        row = self._settings_row(tenant_id)
        return bool((row or {}).get("audit_log_enabled", True))

    # ------------------------------------------------------ Prüfprotokoll
    def _kopf_hash(self, tenant_id: str) -> str:
        rows = (
            self._db.table("gobd_audit_log")
            .select("hash")
            .eq("tenant_id", tenant_id)
            .order("seq", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["hash"]) if rows else GENESIS_HASH

    def protokollieren(  # noqa: PLR0913 — jeder Parameter ist ein Hash-Bestandteil
        self,
        tenant_id: str,
        *,
        object_type: str,
        object_id: str,
        action: str,
        user_id: str | None,
        diff: dict,
        pflicht: bool = True,
        audit_an: bool | None = None,
    ) -> dict | None:
        """Einen Eintrag an die Kette des Mandanten hängen.

        `pflicht=True` (lock/unlock_denied/storno) schreibt immer; `pflicht=False`
        (change/export) nur, wenn `audit_log_enabled` steht. Bei Kollision am
        Kopf (23505 auf (tenant_id, prev_hash)) wird der Kopf neu gelesen und der
        Eintrag erneut angehängt — höchstens dreimal, dann 409 (Wurzel 2/5).
        """
        if object_type not in AUDIT_OBJECT_TYPES or action not in AUDIT_ACTIONS:
            raise GobdError("Unbekannte Protokoll-Aktion.", status_code=500)
        if not pflicht:
            an = audit_an if audit_an is not None else self._audit_an(tenant_id)
            if not an:
                return None
        letzter_fehler: APIError | None = None
        for _ in range(_KETTE_VERSUCHE):
            prev = self._kopf_hash(tenant_id)
            jetzt = self._jetzt()
            digest = audit_hash(
                prev_hash=prev, tenant_id=tenant_id, object_type=object_type,
                object_id=object_id, action=action, user_id=user_id,
                created_at=jetzt, diff=diff,
            )
            zeile = {
                "tenant_id": tenant_id,
                "object_type": object_type,
                "object_id": object_id,
                "action": action,
                "user_id": user_id,
                "created_at": jetzt.isoformat(),
                "diff": json.loads(json.dumps(diff, default=str, **_BINAER_JSON)),
                "prev_hash": prev,
                "hash": digest,
            }
            try:
                res = self._db.table("gobd_audit_log").insert(zeile).execute()
            except APIError as exc:
                if getattr(exc, "code", None) == "23505":
                    letzter_fehler = exc
                    log.info("gobd_kette_kollision", tenant_id=tenant_id, action=action)
                    continue
                raise
            eintrag = (res.data or [None])[0]
            if not eintrag:
                raise GobdError(
                    "Protokolleintrag konnte nicht gespeichert werden.", status_code=500
                )
            log.info("gobd_protokolliert", tenant_id=tenant_id, action=action,
                     object_type=object_type, object_id=object_id, seq=eintrag.get("seq"))
            return eintrag
        raise GobdError(
            "Prüfprotokoll: Kette ist gerade in Bewegung, bitte erneut versuchen.",
            status_code=409,
        ) from letzter_fehler

    @staticmethod
    def _eintrag(row: dict) -> AuditEntry:
        return AuditEntry(
            id=str(row["id"]),
            seq=int(row["seq"]),
            object_type=row["object_type"],
            object_id=str(row["object_id"]),
            action=row["action"],
            user_id=str(row["user_id"]) if row.get("user_id") else None,
            created_at=_zeit(row["created_at"]) or datetime.now(UTC),
            diff=row.get("diff") or {},
            prev_hash=row["prev_hash"],
            hash=row["hash"],
        )

    def list_audit(  # noqa: PLR0913 — Filter der Liste
        self,
        ctx: AuthContext,
        *,
        object_type: str | None = None,
        object_id: str | None = None,
        action: str | None = None,
        von: date | None = None,
        bis: date | None = None,
        limit: int = 100,
    ) -> list[AuditEntry]:
        tenant_id = self._tenant(ctx)
        if object_type is not None and object_type not in AUDIT_OBJECT_TYPES:
            raise GobdError("Unbekannte Objektart.", status_code=422)
        if action is not None and action not in AUDIT_ACTIONS:
            raise GobdError("Unbekannte Aktion.", status_code=422)
        if von and bis:
            _zeitraum_pruefen(von, bis)
        limit = max(1, min(limit, LIMIT_MAX))
        query = (
            self._db.table("gobd_audit_log")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("seq", desc=True)
            .limit(limit)
        )
        if object_type:
            query = query.eq("object_type", object_type)
        if object_id:
            query = query.eq("object_id", object_id)
        if action:
            query = query.eq("action", action)
        if von:
            start = datetime.combine(von, datetime.min.time(), UTC)
            query = query.gte("created_at", start.isoformat())
        if bis:
            ende = datetime.combine(bis + timedelta(days=1), datetime.min.time(), UTC)
            query = query.lt("created_at", ende.isoformat())
        return [self._eintrag(r) for r in (query.execute().data or [])]

    def verify(self, ctx: AuthContext) -> VerifyResult:
        """Die ganze Kette des Mandanten nachrechnen; Ergebnis nennt den ERSTEN Bruch."""
        tenant_id = self._tenant(ctx)
        erwartet_prev = GENESIS_HASH
        geprueft = 0
        letzter: str | None = None
        bruch: KettenBruch | None = None
        offset = 0
        while offset < _VERIFY_MAX and bruch is None:
            seite = (
                self._db.table("gobd_audit_log")
                .select("*")
                .eq("tenant_id", tenant_id)
                .order("seq")
                .range(offset, offset + _VERIFY_SEITE - 1)
                .execute()
            ).data or []
            if not seite:
                break
            for row in seite:
                geprueft += 1
                erstellt = _zeit(row["created_at"])
                if row["prev_hash"] != erwartet_prev:
                    bruch = KettenBruch(seq=int(row["seq"]), id=str(row["id"]),
                                        reason="prev_hash_mismatch")
                    break
                soll = audit_hash(
                    prev_hash=row["prev_hash"], tenant_id=tenant_id,
                    object_type=row["object_type"], object_id=str(row["object_id"]),
                    action=row["action"],
                    user_id=str(row["user_id"]) if row.get("user_id") else None,
                    created_at=erstellt or datetime.now(UTC), diff=row.get("diff") or {},
                )
                if soll != row["hash"]:
                    bruch = KettenBruch(seq=int(row["seq"]), id=str(row["id"]),
                                        reason="hash_mismatch")
                    break
                erwartet_prev = letzter = str(row["hash"])
            if len(seite) < _VERIFY_SEITE:
                break
            offset += _VERIFY_SEITE
        log.info("gobd_kette_geprueft", tenant_id=tenant_id, geprueft=geprueft,
                 ok=bruch is None, bruch_seq=bruch.seq if bruch else None)
        return VerifyResult(ok=bruch is None, checked=geprueft, first_break=bruch,
                            last_hash=letzter, verified_at=self._jetzt())

    # -------------------------------------------------------- Festschreiben
    def _rechnungen(self, tenant_id: str, ids: Iterable[str]) -> dict[str, dict]:
        ids = sorted(set(ids))
        if not ids:
            return {}
        rows = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, invoice_type, status, issue_date, gross_amount, "
                "currency, customer_id, is_locked, locked_at, deleted_at"
            )
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _sperren(  # noqa: PLR0913 — Modus, Grund und Nutzer sind Protokollbestandteile
        self,
        tenant_id: str,
        rows: list[dict],
        *,
        user_id: str | None,
        modus: str,
        reason: str | None = None,
    ) -> tuple[list[str], datetime | None]:
        """Kern der Festschreibung — für Hand, Auto-Lauf und Versand derselbe Weg."""
        zu_sperren = [str(r["id"]) for r in rows if not r.get("is_locked")]
        if not zu_sperren:
            return [], None
        jetzt = self._jetzt()
        aenderung: dict[str, Any] = {
            "is_locked": True,
            "gobd_status": "locked",
            "locked_at": jetzt.isoformat(),
        }
        if user_id:
            aenderung["locked_by"] = user_id
        (
            self._db.table("invoices")
            .update(aenderung)
            .eq("tenant_id", tenant_id)
            .in_("id", zu_sperren)
            .eq("is_locked", False)
            .execute()
        )
        for r in rows:
            if str(r["id"]) not in zu_sperren:
                continue
            self.protokollieren(
                tenant_id,
                object_type="invoice",
                object_id=str(r["id"]),
                action="lock",
                user_id=user_id,
                diff={
                    "invoiceNumber": r.get("invoice_number"),
                    "invoiceType": r.get("invoice_type"),
                    "status": r.get("status"),
                    "issueDate": str(r.get("issue_date") or ""),
                    "grossAmount": str(_dec(r.get("gross_amount"))),
                    "currency": r.get("currency"),
                    "mode": modus,
                    "reason": (reason or "").strip() or None,
                },
            )
        log.info("gobd_festgeschrieben", tenant_id=tenant_id, user_id=user_id, modus=modus,
                 anzahl=len(zu_sperren), invoice_ids=zu_sperren[:20])
        return zu_sperren, jetzt

    def lock_invoices(
        self, ctx: AuthContext, body: LockRequest, *, modus: str = "manual"
    ) -> LockResult:
        tenant_id = self._tenant(ctx)
        rows = self._rechnungen(tenant_id, body.invoice_ids)
        fehlend = [i for i in body.invoice_ids if i not in rows or rows[i].get("deleted_at")]
        if fehlend:
            raise GobdError(
                f"Rechnung nicht gefunden: {', '.join(fehlend[:5])}", status_code=404
            )
        entwuerfe = [i for i in body.invoice_ids if not _ist_ausgestellt(rows[i])]
        if entwuerfe:
            raise GobdError(
                "Entwürfe sind keine Belege und können nicht festgeschrieben werden "
                f"({len(entwuerfe)} von {len(body.invoice_ids)}). Zuerst ausstellen.",
                status_code=422,
            )
        bereits = [i for i in body.invoice_ids if rows[i].get("is_locked")]
        gesperrt, zeit = self._sperren(
            tenant_id, [rows[i] for i in body.invoice_ids], user_id=ctx.user_id,
            modus=modus, reason=body.reason,
        )
        return LockResult(
            locked=gesperrt,
            already_locked=bereits,
            locked_at=zeit,
            success=True,
            message=None if gesperrt else "Bereits festgeschrieben.",
        )

    def deny_unlock(self, ctx: AuthContext, body: UnlockRequest) -> None:
        """Entsperren gibt es nicht — aber die Anfrage wird protokolliert (403)."""
        tenant_id = self._tenant(ctx)
        rows = self._rechnungen(tenant_id, body.invoice_ids)
        for rid in body.invoice_ids:
            r = rows.get(rid)
            if not r or not r.get("is_locked"):
                continue
            self.protokollieren(
                tenant_id,
                object_type="invoice",
                object_id=rid,
                action="unlock_denied",
                user_id=ctx.user_id,
                diff={"invoiceNumber": r.get("invoice_number"),
                      "reason": (body.reason or "").strip() or None},
            )
        log.warning("gobd_entsperren_verweigert", tenant_id=tenant_id, user_id=ctx.user_id,
                    anzahl=len(body.invoice_ids))
        raise GobdError(
            "Die Festschreibung ist unumkehrbar (GoBD). Korrektur nur per Stornorechnung.",
            status_code=403,
        )

    def list_open_invoices(self, ctx: AuthContext, *, limit: int = 200) -> list[OffeneRechnung]:
        tenant_id = self._tenant(ctx)
        limit = max(1, min(limit, LIMIT_MAX))
        rows = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, invoice_type, status, issue_date, gross_amount, "
                "currency, customer_id, is_locked, deleted_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("is_locked", False)
            .neq("status", STATUS_ENTWURF)
            .is_("deleted_at", "null")
            .order("issue_date", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        rows = [r for r in rows if _ist_ausgestellt(r)]
        kunden = self._kunden(
            tenant_id, (str(r["customer_id"]) for r in rows if r.get("customer_id"))
        )
        return [
            OffeneRechnung(
                id=str(r["id"]),
                invoice_number=r.get("invoice_number"),
                invoice_type=str(r.get("invoice_type") or "invoice"),
                status=str(r.get("status")),
                issue_date=_datum(r.get("issue_date")),
                gross_amount=_dec(r.get("gross_amount")),
                currency=str(r.get("currency") or ""),
                customer_name=kunden.get(str(r.get("customer_id") or ""), {}).get("name"),
            )
            for r in rows
        ]

    def _kunden(self, tenant_id: str, ids: Iterable[str]) -> dict[str, dict]:
        ids = sorted({i for i in ids if i})
        if not ids:
            return {}
        rows = (
            self._db.table("customers")
            .select("id, name, customer_number, vat_id")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _faellige(self, tenant_id: str, settings: GobdSettingsResponse) -> list[dict]:
        """Belege, die nach den Einstellungen JETZT festzuschreiben sind."""
        if settings.auto_lock_mode == "manual":
            return []
        query = (
            self._db.table("invoices")
            .select(
                "id, invoice_number, invoice_type, status, issue_date, gross_amount, "
                "currency, is_locked, deleted_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("is_locked", False)
            .neq("status", STATUS_ENTWURF)
            .is_("deleted_at", "null")
            .order("issue_date")
            .limit(LIMIT_MAX)
        )
        if settings.auto_lock_mode == "on_send":
            query = query.in_("status", sorted(STATUS_VERSENDET))
        else:
            if settings.lock_after_days is None:
                raise GobdError("Modus 'nach N Tagen' ohne Tage - Einstellungen pruefen.",
                                status_code=422)
            grenze = self._jetzt().date() - timedelta(days=settings.lock_after_days)
            query = query.lte("issue_date", grenze.isoformat())
        return [r for r in (query.execute().data or []) if _ist_ausgestellt(r)]

    def run_auto_lock(self, ctx: AuthContext) -> AutoLockRunResult:
        tenant_id = self._tenant(ctx)
        return self.auto_lock_fuer_tenant(tenant_id, user_id=ctx.user_id)

    def auto_lock_fuer_tenant(self, tenant_id: str, *, user_id: str | None) -> AutoLockRunResult:
        """Ein Lauf für EINEN Mandanten — Route und Worker teilen ihn."""
        settings = self._settings_antwort(tenant_id, self._settings_row(tenant_id))
        faellig = self._faellige(tenant_id, settings)
        gesperrt, zeit = self._sperren(tenant_id, faellig, user_id=user_id, modus="auto")
        log.info("gobd_auto_lock_lauf", tenant_id=tenant_id, modus=settings.auto_lock_mode,
                 faellig=len(faellig), festgeschrieben=len(gesperrt))
        return AutoLockRunResult(mode=settings.auto_lock_mode, candidates=len(faellig),
                                 locked=gesperrt, locked_at=zeit)

    def auto_lock_alle_tenants(self) -> dict[str, int]:
        """Worker-Einstieg: alle Mandanten mit Auto-Modus. Ein Fehler bei einem
        Mandanten stoppt die anderen nicht, wird aber LAUT geloggt (Wurzel 5)."""
        rows = (
            self._db.table("gobd_settings")
            .select("tenant_id, auto_lock_mode")
            .neq("auto_lock_mode", "manual")
            .limit(LIMIT_MAX)
            .execute()
        ).data or []
        ergebnis: dict[str, int] = {}
        for r in rows:
            tid = str(r["tenant_id"])
            try:
                ergebnis[tid] = len(self.auto_lock_fuer_tenant(tid, user_id=None).locked)
            except (GobdError, APIError) as exc:
                log.error("gobd_auto_lock_tenant_fehlgeschlagen", tenant_id=tid,
                          error=str(getattr(exc, "message", exc))[:200])
                ergebnis[tid] = -1
        return ergebnis

    def lock_nach_versand(self, tenant_id: str, *, user_id: str | None, invoice_id: str) -> bool:
        """Einhängepunkt für den Bereich »versand«: nur im Modus on_send, nur
        ausgestellte Belege; ein Entwurf wird still übersprungen (kein 422 im
        Versandpfad — der Versand ist die Hauptsache, die Sperre folgt)."""
        settings = self._settings_antwort(tenant_id, self._settings_row(tenant_id))
        if settings.auto_lock_mode != "on_send":
            return False
        row = self._rechnungen(tenant_id, [invoice_id]).get(invoice_id)
        if not row or row.get("deleted_at") or not _ist_ausgestellt(row) or row.get("is_locked"):
            return False
        gesperrt, _ = self._sperren(tenant_id, [row], user_id=user_id, modus="on_send")
        return bool(gesperrt)

    def protokolliere_storno(  # noqa: PLR0913 — Original und Storno sind getrennte Belege
        self,
        tenant_id: str,
        *,
        user_id: str | None,
        original: dict,
        storno: dict,
        reason: str,
    ) -> None:
        """Einhängepunkt für den Bestand (`storno.create_storno_invoice`)."""
        self.protokollieren(
            tenant_id,
            object_type="invoice",
            object_id=str(original["id"]),
            action="storno",
            user_id=user_id,
            diff={
                "originalNumber": original.get("invoice_number"),
                "stornoId": str(storno.get("id") or ""),
                "stornoNumber": storno.get("invoice_number"),
                "grossAmount": str(_dec(original.get("gross_amount"))),
                "currency": original.get("currency"),
                "wasLocked": bool(original.get("is_locked")),
                "reason": reason.strip() or None,
            },
        )

    # --------------------------------------------------------------- Status
    def _zaehlen(self, query: SyncSelectRequestBuilder) -> int:
        res = query.execute()
        anzahl = getattr(res, "count", None)
        return int(anzahl) if anzahl is not None else len(res.data or [])

    def status(self, ctx: AuthContext) -> GobdStatus:
        tenant_id = self._tenant(ctx)
        settings = self._settings_antwort(tenant_id, self._settings_row(tenant_id))

        def basis() -> SyncSelectRequestBuilder:
            return (
                self._db.table("invoices")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
            )

        drafts = self._zaehlen(basis().eq("status", STATUS_ENTWURF))
        locked = self._zaehlen(basis().eq("is_locked", True))
        offen = self._zaehlen(basis().eq("is_locked", False).neq("status", STATUS_ENTWURF))
        storno = self._zaehlen(basis().eq("invoice_type", "storno"))
        eintraege = self._zaehlen(
            self._db.table("gobd_audit_log").select("id", count="exact").eq("tenant_id", tenant_id)
        )
        letzte = (
            self._db.table("invoices")
            .select("locked_at")
            .eq("tenant_id", tenant_id)
            .eq("is_locked", True)
            .order("locked_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return GobdStatus(
            drafts=drafts, open=offen, locked=locked, storno=storno,
            last_locked_at=_zeit(letzte[0].get("locked_at")) if letzte else None,
            auto_lock_mode=settings.auto_lock_mode, retention_years=settings.retention_years,
            configured=settings.configured, audit_entries=eintraege,
        )

    # --------------------------------------------------------------- Export
    def export_zip(self, ctx: AuthContext, von: date, bis: date) -> tuple[bytes, str]:
        """Datenträgerüberlassung (GoBD Rz. 178, Z3): CSVs + index.xml nach dem
        GDPdU-Beschreibungsstandard, als ZIP. Nur AUSGESTELLTE Belege im Zeitraum
        (Ausstellungsdatum) — Entwürfe sind keine Belege."""
        tenant_id = self._tenant(ctx)
        _zeitraum_pruefen(von, bis)
        rechnungen = (
            self._db.table("invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .neq("status", STATUS_ENTWURF)
            .gte("issue_date", von.isoformat())
            .lte("issue_date", bis.isoformat())
            .order("issue_date")
            .order("invoice_number")
            .limit(EXPORT_BELEGE_MAX + 1)
            .execute()
        ).data or []
        rechnungen = [r for r in rechnungen if _ist_ausgestellt(r)]
        if len(rechnungen) > EXPORT_BELEGE_MAX:
            raise GobdError(
                f"Mehr als {EXPORT_BELEGE_MAX} Belege im Zeitraum — bitte Zeitraum verkleinern.",
                status_code=422,
            )
        kunden = self._kunden(
            tenant_id, (str(r["customer_id"]) for r in rechnungen if r.get("customer_id"))
        )
        positionen = self._positionen([str(r["id"]) for r in rechnungen])
        protokoll = self.list_audit(ctx, von=von, bis=bis, limit=LIMIT_MAX)
        if len(protokoll) >= LIMIT_MAX:
            protokoll_rows = self._protokoll_roh(tenant_id, von, bis)
        else:
            protokoll_rows = [p.model_dump(by_alias=False) for p in protokoll]
        lieferant = self._datenlieferant(tenant_id)

        nummern = {str(r["id"]): r.get("invoice_number") for r in rechnungen}
        dateien = {
            "invoices.csv": _csv(_INVOICE_SPALTEN, (_invoice_zeile(r, kunden) for r in rechnungen)),
            "invoice_line_items.csv": _csv(
                _POSITION_SPALTEN, (_position_zeile(p, nummern) for p in positionen)
            ),
            "gobd_audit_log.csv": _csv(_AUDIT_SPALTEN, (_audit_zeile(p) for p in protokoll_rows)),
        }
        dateien["index.xml"] = _index_xml(lieferant, von, bis, dateien).encode(_EXPORT_KODIERUNG)

        puffer = io.BytesIO()
        with zipfile.ZipFile(puffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for name, inhalt in dateien.items():
                zf.writestr(name, inhalt)
        daten = puffer.getvalue()
        if len(daten) > EXPORT_ZIP_MAX_BYTES:
            raise GobdError(
                "Export größer als 50 MB — bitte Zeitraum verkleinern.", status_code=413
            )
        digest = hashlib.sha256(daten).hexdigest()
        dateiname = f"gobd-export_{von.isoformat()}_{bis.isoformat()}.zip"
        log.info("gobd_export", tenant_id=tenant_id, user_id=ctx.user_id, von=von.isoformat(),
                 bis=bis.isoformat(), belege=len(rechnungen), positionen=len(positionen),
                 bytes=len(daten), sha256=digest)
        self.protokollieren(
            tenant_id,
            object_type="export",
            object_id=f"{von.isoformat()}..{bis.isoformat()}",
            action="export",
            user_id=ctx.user_id,
            diff={"from": von.isoformat(), "to": bis.isoformat(), "invoices": len(rechnungen),
                  "lineItems": len(positionen), "auditEntries": len(protokoll_rows),
                  "bytes": len(daten), "sha256": digest, "filename": dateiname},
            pflicht=False,
        )
        return daten, dateiname

    def _positionen(self, invoice_ids: list[str]) -> list[dict]:
        ergebnis: list[dict] = []
        for i in range(0, len(invoice_ids), _EXPORT_CHUNK):
            chunk = invoice_ids[i : i + _EXPORT_CHUNK]
            ergebnis.extend(
                (
                    self._db.table("invoice_line_items")
                    .select("*")
                    .in_("invoice_id", chunk)
                    .order("invoice_id")
                    .order("position")
                    .execute()
                ).data or []
            )
        return ergebnis

    def _protokoll_roh(self, tenant_id: str, von: date, bis: date) -> list[dict]:
        start = datetime.combine(von, datetime.min.time(), UTC).isoformat()
        ende = datetime.combine(bis + timedelta(days=1), datetime.min.time(), UTC).isoformat()
        return (
            self._db.table("gobd_audit_log")
            .select("*")
            .eq("tenant_id", tenant_id)
            .gte("created_at", start)
            .lt("created_at", ende)
            .order("seq")
            .limit(_EXPORT_AUDIT_MAX)
            .execute()
        ).data or []

    def _datenlieferant(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("legal_name, company_city, company_country")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        p = rows[0] if rows else {}
        ort = " ".join(
            str(p.get(k) or "").strip() for k in ("company_city", "company_country")
        ).strip()
        return {"name": str(p.get("legal_name") or ""), "location": ort}


# --------------------------------------------------------- Export-Bausteine
# Spalten je Datei: (Name, Typ) — Typ steuert CSV-Format UND index.xml
# (`AlphaNumeric` / `Numeric` mit Genauigkeit / `Date`).
_INVOICE_SPALTEN: tuple[tuple[str, str], ...] = (
    ("id", "alnum"), ("invoice_number", "alnum"), ("invoice_type", "alnum"),
    ("status", "alnum"), ("issue_date", "date"), ("due_date", "date"),
    ("customer_number", "alnum"), ("customer_name", "alnum"), ("customer_vat_id", "alnum"),
    ("currency", "alnum"), ("net_amount", "num2"), ("tax_amount", "num2"),
    ("gross_amount", "num2"), ("paid_amount", "num2"), ("tax_rate", "num2"),
    ("tax_rule", "alnum"), ("is_locked", "alnum"), ("locked_at", "alnum"),
    ("original_invoice_id", "alnum"), ("storno_reason", "alnum"), ("created_at", "alnum"),
)
_POSITION_SPALTEN: tuple[tuple[str, str], ...] = (
    ("id", "alnum"), ("invoice_id", "alnum"), ("invoice_number", "alnum"),
    ("position", "num0"), ("description", "alnum"), ("quantity", "num3"), ("unit", "alnum"),
    ("unit_price", "num2"), ("tax_rate", "num2"), ("discount_percent", "num2"),
    ("net_amount", "num2"), ("tax_amount", "num2"), ("gross_amount", "num2"),
)
_AUDIT_SPALTEN: tuple[tuple[str, str], ...] = (
    ("seq", "num0"), ("id", "alnum"), ("object_type", "alnum"), ("object_id", "alnum"),
    ("action", "alnum"), ("user_id", "alnum"), ("created_at", "alnum"),
    ("prev_hash", "alnum"), ("hash", "alnum"), ("diff", "alnum"),
)


def _json_sicher(wert: object) -> object:
    return json.loads(json.dumps(wert, default=str, **_BINAER_JSON))


def _text(wert: object) -> str:
    if wert is None:
        return ""
    if isinstance(wert, bool):
        return "1" if wert else "0"
    if isinstance(wert, (dict, list)):
        return json.dumps(wert, default=str, **_BINAER_JSON)
    return str(wert)


def _zahl(wert: object, stellen: int) -> str:
    if wert is None or wert == "":
        return ""
    return f"{_dec(wert):.{stellen}f}"


def _feld(wert: object, typ: str) -> str:
    if typ == "num2":
        return _zahl(wert, 2)
    if typ == "num3":
        return _zahl(wert, 3)
    if typ == "num0":
        return _zahl(wert, 0)
    if typ == "date":
        d = _datum(wert)
        return d.isoformat() if d else ""
    return _text(wert)


def _invoice_zeile(r: dict, kunden: dict[str, dict]) -> dict:
    k = kunden.get(str(r.get("customer_id") or ""), {})
    return {**r, "customer_number": k.get("customer_number"), "customer_name": k.get("name"),
            "customer_vat_id": k.get("vat_id")}


def _position_zeile(p: dict, nummern: dict[str, str | None]) -> dict:
    return {**p, "invoice_number": nummern.get(str(p.get("invoice_id")))}


def _audit_zeile(p: dict) -> dict:
    return {**p, "diff": p.get("diff") or {}}


def _csv(spalten: tuple[tuple[str, str], ...], zeilen: Iterable[dict]) -> bytes:
    puffer = io.StringIO()
    writer = csv.writer(puffer, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL,
                        lineterminator="\r\n")
    writer.writerow([name for name, _ in spalten])
    for z in zeilen:
        writer.writerow([_feld(z.get(name), typ) for name, typ in spalten])
    return puffer.getvalue().encode(_EXPORT_KODIERUNG)


def _xml_spalte(name: str, typ: str, *, schluessel: bool = False) -> str:
    tag = "VariablePrimaryKey" if schluessel else "VariableColumn"
    if typ in ("num0", "num2", "num3"):
        genauigkeit = {"num0": 0, "num2": 2, "num3": 3}[typ]
        art = f"<Numeric><Accuracy>{genauigkeit}</Accuracy></Numeric>"
    elif typ == "date":
        art = "<Date><Format>YYYY-MM-DD</Format></Date>"
    else:
        art = "<AlphaNumeric/>"
    return f"<{tag}><Name>{xml_escape(name)}</Name>{art}</{tag}>"


def _xml_tabelle(url: str, spalten: tuple[tuple[str, str], ...], von: date, bis: date,
                 beschreibung: str) -> str:
    erste, rest = spalten[0], spalten[1:]
    return (
        f"<Table><URL>{xml_escape(url)}</URL><Name>{xml_escape(url.removesuffix('.csv'))}</Name>"
        f"<Description>{xml_escape(beschreibung)}</Description>"
        f"<Validity><Range><From>{von.isoformat()}</From>"
        f"<To>{bis.isoformat()}</To></Range></Validity>"
        "<UTF8/><DecimalSymbol>.</DecimalSymbol><DigitGroupingSymbol></DigitGroupingSymbol>"
        "<Range><From>2</From></Range>"
        "<VariableLength><ColumnDelimiter>;</ColumnDelimiter>"
        "<RecordDelimiter>&#13;&#10;</RecordDelimiter><TextEncapsulator>\"</TextEncapsulator>"
        + _xml_spalte(erste[0], erste[1], schluessel=True)
        + "".join(_xml_spalte(n, t) for n, t in rest)
        + "</VariableLength></Table>"
    )


def _index_xml(lieferant: dict[str, str], von: date, bis: date, dateien: dict[str, bytes]) -> str:
    """index.xml nach GDPdU-Beschreibungsstandard (DTD gdpdu-01-09-2004)."""
    tabellen = "".join(
        _xml_tabelle(url, spalten, von, bis, beschreibung)
        for url, spalten, beschreibung in (
            ("invoices.csv", _INVOICE_SPALTEN, "Ausgangsrechnungen, Storno- und Gutschriftbelege"),
            ("invoice_line_items.csv", _POSITION_SPALTEN, "Belegpositionen"),
            ("gobd_audit_log.csv", _AUDIT_SPALTEN,
             "Prüfprotokoll: Festschreibung, Storno, Export (Hash-Kette)"),
        )
        if url in dateien
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">'
        "<DataSet><Version>1.0</Version>"
        f"<DataSupplier><Name>{xml_escape(lieferant['name'])}</Name>"
        f"<Location>{xml_escape(lieferant['location'])}</Location>"
        f"<Comment>Datenträgerüberlassung {von.isoformat()} bis {bis.isoformat()}, "
        "erzeugt von myNextDays Buchhaltung</Comment></DataSupplier>"
        f"<Media><Name>Export {von.isoformat()}..{bis.isoformat()}</Name>{tabellen}</Media>"
        "</DataSet>"
    )
