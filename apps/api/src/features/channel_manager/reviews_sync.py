"""Inbound: Portal-Bewertungen in den eigenen Bestand (channex_review).

Mixin des ChannelManagerService (Fassade in service.py). State (_db/_channex)
und Basis-Helper kommen von der Fassade.

Warum Persistenz statt Live-Durchreichung: ohne eigenen Bestand gibt es kein
„unbeantwortet"-Filter, keine Kennzahl über Kanäle hinweg, kein Realtime — und
jeder Seitenaufruf kostet Portal-Requests. Der Webhook (`review`/`updated_review`)
ist nur der AUSLÖSER; den Stand ziehen wir nach (Channex garantiert keine
Reihenfolge, Payload-Daten werden nie direkt angewendet).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import log, nur_uuids
from .ota_extras import _attrs, _related_property_id, _rows


def _note(attrs: dict) -> float | None:
    """Die Gesamtnote — oder None, wenn es noch keine gibt.

    Channex schickt bei einer VERDECKTEN Bewertung `overall_score: 0`. Das ist
    keine Null-Bewertung, sondern „steht noch nicht fest": Airbnb hält die Note
    zurück, bis beide Seiten abgegeben haben. Ungeprüft übernommen landete die
    0 in der Liste als fünf leere Sterne und „0 / 10" — eine Behauptung über
    einen Gast, der nichts dergleichen gesagt hat, und im Durchschnitt zog sie
    die Zahl des ganzen Objekts nach unten (Wurzel 4: lieber keine Angabe als
    ein plausibler Ersatzwert).

    Nur bei `is_hidden` verworfen, nicht generell: eine sichtbare 0 gäbe es bei
    keinem Portal, aber wenn eines sie je schickte, wäre sie eine echte Aussage
    und gehörte gezeigt.
    """
    wert = _as_float(attrs.get("overall_score"))
    if wert == 0 and bool(attrs.get("is_hidden")):
        return None
    return wert


def _as_float(value: object) -> float | None:
    """Zahl aus einem Channex-Feld — None statt Ersatzwert (Wurzel 4)."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _reply_text(value: object) -> str | None:
    """Channex liefert die Antwort als Objekt ``{"reply": "…"}`` (so auch im
    eigenen POST-Body), älter als nackter String. Beides lesen — vorher fiel
    das Objekt durch ``isinstance(str)`` still auf None, und jede Antwort
    galt beim nächsten Abgleich als nicht vorhanden."""
    if isinstance(value, dict):
        value = value.get("reply")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _frist_verstrichen(value: object, jetzt: datetime | None = None) -> bool:
    """Liegt Channex' `expired_at` in der Vergangenheit? Unbekannt = nein."""
    iso = _as_utc(value)
    if iso is None:
        return False
    return datetime.fromisoformat(iso) < (jetzt or datetime.now(UTC))


def _as_utc(value: object) -> str | None:
    """Channex-Zeitstempel → ISO-8601 mit UTC-Zone. Channex liefert die
    Zeitstempel ohne Zonen-Suffix (`2022-06-06T05:45:23.000000`), sie sind
    laut Doku UTC — ohne das explizite `+00:00` würde Postgres sie als
    Serverzeit lesen und die Bewertung um Stunden verschieben."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat()


def _booking_ref(row: dict[str, Any], attrs: dict[str, Any]) -> str | None:
    """Channex-Booking-ID einer Bewertung — mal als Attribut, mal als
    Relationship. Beide Formen prüfen, sonst hängt die Bewertung an keiner
    Buchung und der Bezug zur Reservierung geht verloren."""
    direct = attrs.get("booking_id")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    rel = (row.get("relationships") or {}).get("booking") or {}
    data = rel.get("data") or {}
    ref = data.get("id")
    return str(ref) if ref else None


class ReviewsSyncMixin:
    """Portal-Bewertungen abholen und in channex_review spiegeln."""

    # Kontoweite Liste: Channex filtert `filter[property_id]` für diesen
    # Endpunkt nicht garantiert, also blättern und HIER tenant-filtern. Deckel
    # wie bei den anderen kontoweiten Listen — Erreichen wird geloggt, nichts
    # wird still abgeschnitten.
    _REVIEW_SYNC_MAX_PAGES = 20
    _REVIEW_SYNC_PAGE_SIZE = 100

    # -- Mapping ---------------------------------------------------------------
    def _channex_property_index(self, db: Client) -> dict[str, dict[str, Any]]:
        """channex_property_id → {tenant_id, property_id, map_id} über ALLE
        Mandanten. Nur für die kontoweite Zuordnung beim Backstop-Pull und im
        Webhook — die Zeile bekommt dadurch ihren Tenant, der Aufrufer scopet
        danach."""
        rows = (
            db.table("channex_property_map")
            .select("id, tenant_id, property_id, channex_property_id")
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        return {
            str(r["channex_property_id"]): {
                "tenant_id": r.get("tenant_id"),
                "property_id": r.get("property_id"),
                "map_id": r.get("id"),
            }
            for r in rows
            if r.get("channex_property_id")
        }

    @staticmethod
    def _review_record(
        row: dict[str, Any], mapping: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Channex-Review-Zeile → channex_review-Datensatz. None, wenn die
        Bewertung keine ID hat (dann fehlt der Idempotenz-Schlüssel und ein
        Upsert würde Dubletten erzeugen)."""
        attrs = _attrs(row)
        review_id = row.get("id") or attrs.get("id")
        if not review_id:
            return None
        scores = attrs.get("scores")
        tags = attrs.get("tags")
        reply = _reply_text(attrs.get("reply"))
        record = {
            "tenant_id": mapping["tenant_id"],
            "property_id": mapping.get("property_id"),
            "property_map_id": mapping.get("map_id"),
            "channex_review_id": str(review_id),
            "ota": attrs.get("ota"),
            "ota_reservation_id": attrs.get("ota_reservation_id"),
            "channex_booking_id": _booking_ref(row, attrs),
            "guest_name": attrs.get("guest_name"),
            "content": attrs.get("content"),
            "overall_score": _note(attrs),
            "scores": scores if isinstance(scores, list) else [],
            "tags": tags if isinstance(tags, list) else [],
            "is_hidden": bool(attrs.get("is_hidden")),
            # Channex' `is_expired` hinkt: eine Airbnb-Bewertung vom 25.07. trug
            # am 05.09. noch `is_expired=false` bei `expired_at` 24.08. — und
            # stand als „offen" in der Liste. Die Frist ist die verbindlichere
            # Aussage desselben Portals; ist sie verstrichen, ist es verfallen.
            "is_expired": bool(attrs.get("is_expired"))
            or _frist_verstrichen(attrs.get("expired_at")),
            # Antwortfrist des Portals (0567). Channex nennt sie `expired_at`,
            # auch solange sie in der Zukunft liegt.
            "reply_expires_at": _as_utc(attrs.get("expired_at")),
            "received_at": _as_utc(attrs.get("received_at")),
            "ota_updated_at": _as_utc(attrs.get("updated_at")),
            "raw": attrs,
        }
        # Antwort NUR setzen, wenn Channex eine kennt. Nach unserem eigenen
        # Reply (200, lokal per `_mark_review_replied` gespiegelt) meldet Channex
        # die Antwort erst verzögert; ein Abgleich dazwischen setzte sie sonst
        # auf NULL/„unbeantwortet" zurück — live 05.09.2026: vier eben
        # beantwortete Bewertungen standen wieder als „Offen" da, und eine
        # zweite Antwort wäre möglich gewesen (Wurzel 1/2). Ohne die Schlüssel
        # lässt der Upsert die Spalten unangetastet; neue Zeilen bekommen den
        # Spalten-Default false.
        if reply or attrs.get("is_replied"):
            record["is_replied"] = True
            if reply:
                record["reply"] = reply
        return record

    def _upsert_reviews(
        self, db: Client, records: list[dict[str, Any]]
    ) -> int:
        """Datensätze auf channex_review_id upserten (Wurzel 2: Webhook-
        Redelivery, Backstop-Pull und manueller Sync treffen dieselbe Zeile).

        `is_read`/`is_archived`/`assigned_user_id` stehen bewusst NICHT im
        Datensatz — das sind unsere eigenen Arbeitsfelder, ein erneuter Sync
        darf sie nicht auf den Default zurücksetzen (Wurzel 1)."""
        if not records:
            return 0
        # default_to_null=False (Prefer: missing=default): `is_replied`/`reply`
        # stehen nur in MANCHEN Datensätzen (s. `_review_record`). PostgREST
        # füllt bei einem Bulk-Upsert fehlende Schlüssel sonst mit NULL —
        # live 05.09.2026: `null value in column "is_replied" violates
        # not-null constraint`, der ganze Abgleich antwortete 500.
        db.table("channex_review").upsert(
            records, on_conflict="channex_review_id", default_to_null=False
        ).execute()
        return len(records)

    # -- Kontoweiter Pull (Backstop + manueller Sync) ---------------------------
    def _pull_reviews(
        self, db: Client, *, only_tenant: str | None = None
    ) -> int:
        """Bewertungen aus dem Channex-Konto holen und spiegeln.

        FAIL-CLOSED (Wurzel 5): Zeilen ohne belegbare Objekt-Zuordnung werden
        verworfen — der Channex-Account ist kontoweit (white-label), eine
        Bewertung ohne Mapping darf bei keinem Mandanten landen.
        """
        index = self._channex_property_index(db)
        if not index:
            return 0
        roh = (
            index
            if not only_tenant
            else [cx for cx, m in index.items() if m["tenant_id"] == only_tenant]
        )
        wanted = nur_uuids(roh)
        if not wanted:
            # Nur synthetische Demo-Zuordnungen (oder gar keine) → kein Portal-
            # Call. Sichtbar machen, statt in ein 422 zu laufen.
            log.info("channex_review_sync_ohne_gueltige_property", tenant_id=only_tenant)
            return 0

        gespiegelt = 0
        for page in range(1, self._REVIEW_SYNC_MAX_PAGES + 1):
            try:
                res = self._channex.list_reviews(
                    property_ids=wanted,
                    page=page,
                    limit=self._REVIEW_SYNC_PAGE_SIZE,
                )
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            rows = _rows(res)
            records: list[dict[str, Any]] = []
            for row in rows:
                cx_property = _related_property_id(row)
                mapping = index.get(cx_property) if cx_property else None
                if not mapping or not mapping.get("tenant_id"):
                    continue
                if only_tenant and mapping["tenant_id"] != only_tenant:
                    continue
                record = self._review_record(row, mapping)
                if record:
                    records.append(record)
            gespiegelt += self._upsert_reviews(db, records)
            if len(rows) < self._REVIEW_SYNC_PAGE_SIZE:
                break
        else:
            log.warning(
                "channex_review_sync_cap_reached",
                max_pages=self._REVIEW_SYNC_MAX_PAGES, mirrored=gespiegelt,
            )
        log.info("channex_review_sync", mirrored=gespiegelt, tenant_id=only_tenant)
        return gespiegelt

    def sync_reviews(self, ctx: AuthContext) -> int:
        """Manueller Sync im UI — nur die Objekte DIESES Mandanten."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        return self._pull_reviews(db, only_tenant=tenant_id)

    def sync_reviews_all(self) -> int:
        """Backstop im Worker: kontoweit spiegeln (jede Zeile bekommt ihren
        Tenant über das Property-Mapping). Fängt ab, was ein verlorener
        Webhook nicht gebracht hat."""
        db = self._require_db()
        return self._pull_reviews(db)

    # -- Einzelne Bewertung (Webhook-Auslöser) ---------------------------------
    def sync_single_review(self, channex_review_id: str) -> bool:
        """EINE Bewertung frisch ziehen und spiegeln. Rückgabe: ob gespiegelt.

        Best effort — der Webhook-Ingest darf daran nicht kippen (der Backstop
        holt es sonst nach), deshalb fängt der Aufrufer breit. Hier wird nur
        das erwartete Channex-Problem behandelt."""
        db = self._require_db()
        try:
            res = self._channex.get_review(channex_review_id)
        except ChannexError as exc:
            log.warning(
                "channex_review_pull_failed",
                review_id=channex_review_id, error=exc.message[:200],
            )
            return False
        row = res.get("data") or {}
        cx_property = _related_property_id(row)
        mapping = self._channex_property_index(db).get(cx_property or "")
        if not mapping or not mapping.get("tenant_id"):
            # Kein aktives Mapping (Objekt getrennt) → nicht zuordenbar.
            log.warning(
                "channex_review_unmapped",
                review_id=channex_review_id, channex_property_id=cx_property,
            )
            return False
        record = self._review_record(row, mapping)
        if not record:
            return False
        return self._upsert_reviews(db, [record]) == 1

    # -- Gegenzustand nach eigener Aktion (Wurzel 1) ---------------------------
    def _mark_review_replied(self, review_id: str, reply: str) -> None:
        """Nach erfolgreicher Antwort beim Portal den eigenen Bestand
        nachziehen. Ohne das zeigt das Cockpit die Bewertung bis zum nächsten
        Sync weiter als unbeantwortet (Wurzel 1)."""
        if self._db is None:
            return
        try:
            self._db.table("channex_review").update(
                {
                    "reply": reply,
                    "reply_at": datetime.now(UTC).isoformat(),
                    "is_replied": True,
                }
            ).eq("channex_review_id", review_id).execute()
        except Exception as exc:  # noqa: BLE001 — Antwort ist raus, Spiegel best effort
            log.warning("channex_review_reply_mirror_failed", error=str(exc)[:200])

    def _mark_guest_review_sent(self, review_id: str) -> None:
        """Host→Gast-Bewertung abgeschickt (nur Airbnb) — Zeitstempel setzen,
        damit die Automatik sie nicht ein zweites Mal schickt."""
        if self._db is None:
            return
        try:
            self._db.table("channex_review").update(
                {"guest_review_sent_at": datetime.now(UTC).isoformat()}
            ).eq("channex_review_id", review_id).execute()
        except Exception as exc:  # noqa: BLE001 — Bewertung ist raus, Spiegel best effort
            log.warning("channex_guest_review_mirror_failed", error=str(exc)[:200])
