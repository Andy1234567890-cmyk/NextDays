"""Outbound-ARI: Verfügbarkeit/Preise/Restriktionen/Stop-Sell + Outbox.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import log
from .schemas import (
    AriPushRequest,
    AriPushResponse,
)


class _PendingRatePlanMapping(Exception):
    """Signal: das Objekt ist bei Channex gemanaged, hat aber (noch) KEINE
    Rate-Plans gemappt (Rate-Plan-Import noch nicht/teilweise gelaufen). Ein
    Restriktions-Push darf in diesem Fenster NICHT still als Erfolg gelten
    (BUG 9) — die Outbox-Zeile bleibt 'pending' und der Cron zieht sie nach,
    sobald das Mapping existiert. Interner Sentinel (nicht Teil des Channex-
    Fehlerpfads, deshalb KEIN ChannexError)."""

    def __init__(self, property_id: str) -> None:
        super().__init__(f"Rate-Plan-Mapping fehlt noch für {property_id}")
        self.property_id = property_id


def _as_date(value: date | str) -> date:
    """Ein Datum robust zu `date` normalisieren — akzeptiert `date` (Request-Pfad)
    ODER ISO-String (aus dem persistierten Outbox-payload)."""
    return value if isinstance(value, date) else date.fromisoformat(value[:10])


def _as_iso(value: date | str) -> str:
    """Ein Datum (date ODER ISO-String) zu einem ISO-Datumsstring normalisieren."""
    return _as_date(value).isoformat()


def _segment_to_payload(seg: dict[str, Any]) -> dict[str, Any]:
    """Ein push_rates_batch-Segment JSON-serialisierbar machen (date → ISO), damit
    es im Outbox-payload liegen und der Cron es unverändert neu aufbauen kann."""
    out: dict[str, Any] = {
        "date_from": _as_iso(seg["date_from"]),
        "date_to": _as_iso(seg["date_to"]),
    }
    if seg.get("rate_cents") is not None:
        out["rate_cents"] = seg["rate_cents"]
    if seg.get("min_stay") is not None:
        out["min_stay"] = seg["min_stay"]
    return out


def _rate_fields(rate_cents: int | None, min_stay: int | None) -> dict[str, Any]:
    """Preis/Min-Stay zu Channex-restriction-Feldern. Leer, wenn beide None."""
    fields: dict[str, Any] = {}
    if rate_cents is not None:
        fields["rate"] = rate_cents
    if min_stay is not None:
        fields["min_stay_arrival"] = min_stay
        fields["min_stay_through"] = min_stay
    return fields


def _restriction_fields_from_payload(
    kind: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Aus dem persistierten Outbox-payload die Channex-restriction-Felder für
    rate/min_stay/max_stay/cta_ctd rekonstruieren (kind-spezifisch). stop_sell und
    der batch-rate-Fall (segments) werden vom Aufrufer separat behandelt."""
    if kind in ("rate", "min_stay"):
        return _rate_fields(payload.get("rate_cents"), payload.get("min_stay"))
    if kind == "max_stay":
        return {"max_stay": max(0, int(payload["max_stay"]))}
    if kind == "cta_ctd":
        fields: dict[str, Any] = {}
        if payload.get("closed_to_arrival") is not None:
            fields["closed_to_arrival"] = payload["closed_to_arrival"]
        if payload.get("closed_to_departure") is not None:
            fields["closed_to_departure"] = payload["closed_to_departure"]
        return fields
    return {}


def _restriction_values(
    plans: list[dict[str, str]],
    fields: dict[str, Any],
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    """`fields` für ALLE Rate-Plans pro Datum expandieren (Channex ignoriert
    date_from/date_to still — ein value je Tag). Leer, wenn keine fields."""
    if not fields:
        return []
    values: list[dict[str, Any]] = []
    for mapping in plans:
        base = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            **fields,
        }
        values.extend(_expand_restriction_values(base, date_from, date_to))
    return values


def _iso_days(date_from: str, date_to: str) -> list[str]:
    """Alle ISO-Tage [date_from … date_to] inklusiv."""
    lo = date.fromisoformat(date_from[:10])
    hi = date.fromisoformat(date_to[:10])
    out: list[str] = []
    cur = lo
    while cur <= hi:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def _group_iso_days_to_ranges(days: set[str]) -> list[tuple[str, str]]:
    """Sortierte ISO-Tage zu zusammenhängenden [von, bis]-Intervallen bündeln
    (inklusiv), damit der Availability-Push wenige Ranges statt vieler Einzeltage
    sendet. Leere Menge → keine Ranges."""
    if not days:
        return []
    ordered = sorted(date.fromisoformat(d) for d in days)
    ranges: list[tuple[str, str]] = []
    start = prev = ordered[0]
    for cur in ordered[1:]:
        if (cur - prev).days == 1:
            prev = cur
            continue
        ranges.append((start.isoformat(), prev.isoformat()))
        start = prev = cur
    ranges.append((start.isoformat(), prev.isoformat()))
    return ranges


def _expand_restriction_values(
    base: dict[str, Any], date_from: date, date_to: date
) -> list[dict[str, Any]]:
    """Einen Restriction-Wert mit Datumsbereich in per-DATUM-Werte expandieren.

    KRITISCH (live verifiziert): der Channex-`restrictions`-Endpoint erwartet PRO
    Wert ein einzelnes `date`-Feld. `date_from`/`date_to` (bzw. ein `dates`-Array)
    wird zwar mit HTTP 200 angenommen, aber STILL IGNORIERT — die Werte
    persistieren nicht (das ist der Grund, warum min_stay/rate/CTA im Channex-
    Kalender auf dem Default blieben, obwohl der Push „erfolgreich" war). Also:
    ein value je Tag [date_from … date_to] inklusiv. Der Availability-Endpoint
    ist NICHT betroffen (der akzeptiert Bereiche) — nur `restrictions`.

    `base` enthält property_id/rate_plan_id + die Restriction-Felder (rate,
    min_stay_*, stop_sell, closed_to_*, max_stay, days). date_from/date_to werden
    NICHT aus base gelesen — der Aufrufer übergibt sie explizit.
    """
    out: list[dict[str, Any]] = []
    day = date_from
    while day <= date_to:
        out.append({**base, "date": day.isoformat()})
        day += timedelta(days=1)
    return out


class AriPushMixin:
    """Outbound-ARI: Verfügbarkeit/Preise/Restriktionen/Stop-Sell + Outbox."""


    # -- ARI-Push --------------------------------------------------------------
    def push_ari(self, ctx: AuthContext, req: AriPushRequest) -> AriPushResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        warnings: list[str] = []

        # Verfügbarkeit: room_type_map_id → (channex_property_id, channex_room_type_id)
        avail_values: list[dict[str, Any]] = []
        for upd in req.availability:
            mapping = self._room_type_mapping(db, tenant_id, upd.room_type_map_id)
            if mapping is None:
                warnings.append(f"Room-Type-Mapping {upd.room_type_map_id} unbekannt.")
                continue
            if not self._map_is_channex_managed(
                db, tenant_id, mapping["property_map_id"]
            ):
                warnings.append(
                    f"Room-Type-Mapping {upd.room_type_map_id} übersprungen "
                    "(nicht bei Channex angelegt)."
                )
                continue
            avail_values.append(
                {
                    "property_id": mapping["channex_property_id"],
                    "room_type_id": mapping["channex_room_type_id"],
                    "date_from": upd.date_from.isoformat(),
                    "date_to": upd.date_to.isoformat(),
                    "availability": upd.availability,
                }
            )

        # Preise/Restriktionen: rate_plan_map_id → (channex_property_id, channex_rate_plan_id)
        rate_values: list[dict[str, Any]] = []
        for upd in req.rates:
            mapping = self._rate_plan_mapping(db, tenant_id, upd.rate_plan_map_id)
            if mapping is None:
                warnings.append(f"Rate-Plan-Mapping {upd.rate_plan_map_id} unbekannt.")
                continue
            if not self._map_is_channex_managed(
                db, tenant_id, mapping["property_map_id"]
            ):
                warnings.append(
                    f"Rate-Plan-Mapping {upd.rate_plan_map_id} übersprungen "
                    "(nicht bei Channex angelegt)."
                )
                continue
            base: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
            }
            if upd.rate_cents is not None:
                base["rate"] = upd.rate_cents  # Cent-Integer
            if upd.min_stay_arrival is not None:
                base["min_stay_arrival"] = upd.min_stay_arrival
            if upd.stop_sell is not None:
                base["stop_sell"] = 1 if upd.stop_sell else 0
            # restrictions erfordert ein value je Datum — date_from/date_to wird
            # von Channex still ignoriert (live verifiziert).
            rate_values.extend(
                _expand_restriction_values(base, upd.date_from, upd.date_to)
            )

        avail_tasks = rate_tasks = 0
        try:
            # Availability getrennt senden (Channex-Priorität), dann Preise.
            if avail_values:
                res_a = self._channex.update_availability(avail_values)
                avail_tasks = len(res_a.get("data") or [])
                warnings += list((res_a.get("meta") or {}).get("warnings") or [])
            if rate_values:
                res_r = self._channex.update_restrictions(rate_values)
                rate_tasks = len(res_r.get("data") or [])
                warnings += list((res_r.get("meta") or {}).get("warnings") or [])
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        return AriPushResponse(
            availability_tasks=avail_tasks,
            rate_tasks=rate_tasks,
            warnings=[str(w) for w in warnings],
        )

    # -- Realtime-Verfügbarkeits-Push (Doppelbuchungsschutz) -------------------
    # Der Buchungskalender (availability) ist die oberste Wahrheit. Jede lokale
    # Änderung pusht SOFORT die Channex-Verfügbarkeit, damit OTAs den Tag nicht
    # mehr/wieder verkaufen. Persistiert in ari_outbox (Retry bei Ausfall).
    def _resolve_channex_room_type(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_room_type_id). Synthetisch
        1 Room-Type je Property (local_unit_ref = property_id). None, wenn nicht
        mit Channex verbunden."""
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rt:
            return None
        return {
            "channex_property_id": pm[0]["channex_property_id"],
            "channex_room_type_id": rt[0]["channex_room_type_id"],
        }

    def _is_channex_managed(
        self, db: Client, tenant_id: str, property_id: str
    ) -> bool:
        """True, wenn das Objekt bei Channex angelegt ist (aktives property_map,
        deleted_at IS NULL).

        Eine Quelle der Wahrheit für „darf für dieses Objekt Inventar an Channex":
        ein gemanagtes Objekt ist verkaufsbereit — Verfügbarkeit/Preise gehen an
        Channex, UNABHÄNGIG davon, ob schon ein OTA-Kanal verbunden ist. Welche
        OTA das Kontingent zeigt, steuert Channex selbst über den (de)aktivierten
        Channel (set_connection_active → deactivate_channel). Das frühere Gate
        „mindestens ein aktiver Kanal" war ein Deadlock: ohne OTA kein Push →
        Channex meldet availability=0 → Objekt überall „gesperrt". Tenant-Scope
        explizit, da der Service-Role-Key die RLS umgeht. `sync_enabled` wird stets
        gemeinsam mit `deleted_at` gesetzt → `deleted_at IS NULL` genügt."""
        res = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        return bool(res)

    def _property_id_for_map(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> str | None:
        """property_map_id → lokale property_id (für das Gate in push_ari)."""
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("id", property_map_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return pm[0]["property_id"] if pm else None

    def _map_is_channex_managed(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> bool:
        """Gate über die property_map_id (push_ari arbeitet auf Mapping-Ebene)."""
        property_id = self._property_id_for_map(db, tenant_id, property_map_id)
        if property_id is None:
            return False
        return self._is_channex_managed(db, tenant_id, property_id)

    def _newer_covered_days(
        self, db: Client, property_id: str, created_at: str, outbox_id: str | None
    ) -> set[str]:
        """ISO-Tage, die von einer NEUEREN ari_outbox-Zeile desselben Objekts
        abgedeckt sind (created_at strikt später). Diese Tage trägt die aktuelle
        Zeile NICHT mehr an Channex — die jüngste Absicht je Tag gewinnt.

        Deckt beide Superseding-Lücken ab: (1) der schnelle Job-Pfad nutzt es
        (nicht nur der Cron), (2) es arbeitet TAG-GENAU (eine ältere Zeile wird
        nur für die überlappenden Tage übersprungen, ihre übrigen Tage gehen
        weiterhin raus). `created_at` kann fehlen (frisch angelegte Zeile ohne
        DB-Roundtrip) → dann konservativ leer (nichts überspringen).

        NUR 'pending'/'done'-Zeilen zählen als Supersessor: eine 'failed'-Zeile hat
        ihren Wert NIE zuverlässig an Channex übertragen — sie darf eine ältere,
        echte Sperre (avail=0) nicht dauerhaft unterdrücken (sonst erreicht weder
        der alte noch der neue Wert Channex, und die gebuchten Nächte bleiben auf
        OTAs verkaufbar). 'pending' zählt weiter, weil diese neuere Zeile selbst
        noch gepusht wird (jüngste Absicht) — kippt sie später auf 'failed', gibt
        sie die Tage beim nächsten Retry der älteren Zeile automatisch frei."""
        if not created_at:
            return set()
        q = (
            db.table("ari_outbox")
            .select("date_from,date_to,created_at")
            .eq("property_id", property_id)
            .gt("created_at", created_at)
            .in_("status", ["pending", "done"])
        )
        if outbox_id is not None:
            q = q.neq("id", outbox_id)
        rows = q.execute().data or []
        covered: set[str] = set()
        for r in rows:
            covered.update(_iso_days(str(r["date_from"]), str(r["date_to"])))
        return covered

    def push_availability_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        availability: int,
        outbox_id: str | None = None,
    ) -> bool:
        """Verfügbarkeit (absolute Menge je Tag) für einen Zeitraum an Channex
        pushen. date_to inklusiv. Persistiert in ari_outbox und versucht den
        Sofort-Push; bei Fehler bleibt die Zeile 'pending' (Cron-Retry). No-op,
        wenn Channex nicht konfiguriert oder die Property nicht verbunden ist.

        Rückgabe: True, wenn der Channex-Call fehlschlug (der Worker-Handler
        wirft dann → schneller Job-Backoff); False bei Erfolg/No-op.

        `outbox_id`: bereits vom Aufrufer persistierte ari_outbox-Zeile (z. B.
        atomar mit der Buchung über die RPC 0104). Dann wird DIESE Zeile
        abgearbeitet statt eine zweite anzulegen; ist sie nicht mehr 'pending'
        (Cron war schneller), ist nichts zu tun."""
        if not self._channex.is_configured or self._db is None:
            return False
        db = self._db
        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None:
            return False  # nicht mit Channex verbunden → nichts zu pushen
        if not self._is_channex_managed(db, tenant_id, property_id):
            return False  # alle Kanäle des Objekts auf Aus → kein Push

        prior_attempts = 0
        created_at = ""
        if outbox_id is not None:
            existing = (
                db.table("ari_outbox")
                .select("id,status,attempts,created_at")
                .eq("id", outbox_id)
                .limit(1)
                .execute()
            ).data
            if not existing or existing[0]["status"] != "pending":
                return False  # bereits abgearbeitet (Cron/Doppel) → fertig
            prior_attempts = existing[0]["attempts"] or 0
            created_at = str(existing[0].get("created_at") or "")
        else:
            outbox = (
                db.table("ari_outbox")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "date_from": date_from.isoformat(),
                        "date_to": date_to.isoformat(),
                        "availability": availability,
                        "status": "pending",
                    }
                )
                .execute()
            ).data
            outbox_id = outbox[0]["id"] if outbox else None
            created_at = str(outbox[0].get("created_at") or "") if outbox else ""

        # Superseding TAG-GENAU + im schnellen Pfad: nur die Tage pushen, für die
        # KEINE neuere Outbox-Zeile desselben Objekts existiert (jüngste Absicht
        # je Tag gewinnt). Verhindert, dass ein älterer avail-Wert (z. B. Storno-
        # Freigabe) einen inzwischen live gegangenen neueren Wert (neue Buchung)
        # überschreibt — auch wenn die Jobs nebenläufig/umsortiert laufen.
        superseded = self._newer_covered_days(
            db, property_id, created_at, outbox_id
        )
        push_ranges = _group_iso_days_to_ranges(
            set(_iso_days(date_from.isoformat(), date_to.isoformat())) - superseded
        )

        try:
            for r_from, r_to in push_ranges:
                self._channex.update_availability(
                    [
                        {
                            "property_id": mapping["channex_property_id"],
                            "room_type_id": mapping["channex_room_type_id"],
                            "date_from": r_from,
                            "date_to": r_to,
                            "availability": availability,
                        }
                    ]
                )
            if outbox_id:
                # Guard status='pending': falls ein paralleler process_ari_outbox-
                # Tick dieselbe Zeile schon abgehakt hat, kein zweiter Übergang.
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": prior_attempts + 1}
                ).eq("id", outbox_id).eq("status", "pending").execute()
            log.info(
                "ari_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                availability=availability,
                pushed_ranges=len(push_ranges),
                superseded_days=len(superseded),
            )
            return False
        except ChannexError as exc:
            if outbox_id:
                # Guard status='pending' (wie Erfolgspfad + process_ari_outbox):
                # hat ein paralleler Cron-Tick die Zeile bereits erfolgreich auf
                # 'done' gesetzt, darf der leicht verzögerte Fehler dieses Job-
                # Pfads nicht einen veralteten last_error/attempts blind auf die
                # erledigte Zeile schreiben.
                db.table("ari_outbox").update(
                    {"attempts": prior_attempts + 1, "last_error": exc.message}
                ).eq("id", outbox_id).eq("status", "pending").execute()
            log.warning(
                "ari_push_failed_queued",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )
            # Fehler signalisieren: der Worker-Handler wirft → schneller
            # Job-Backoff (1/5/15 min) statt erst der 15-min-Reconcile-Tick.
            # Die ari_outbox bleibt der zusätzliche Backstop.
            return True

    def _resolve_channex_rate_plan(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_rate_plan_id) über die
        synthetische Room-Type/Rate-Plan-Kette. None, wenn nicht verbunden.

        Liefert den ERSTEN Rate-Plan (deterministisch: ältestes Mapping). Für
        Restriktionen/Stop-Sell/Preise, die pro Rate-Plan wirken, IMMER
        _resolve_channex_rate_plans (Plural) nutzen — sonst bleibt ein zweiter
        Rate-Plan (z. B. Non-Refundable → Expedia) ungesperrt."""
        plans = self._resolve_channex_rate_plans(db, tenant_id, property_id)
        return plans[0] if plans else None

    def _resolve_channex_rate_plans(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, str]]:
        """property_id → ALLE (channex_property_id, channex_rate_plan_id) der
        Property über die Room-Type/Rate-Plan-Kette. Leere Liste, wenn nicht
        verbunden. Channex-Restrictions (stop_sell/CTA/CTD/min_stay/rate) wirken
        PRO Rate-Plan — hat ein Objekt mehrere (je OTA-Zimmer/Raten-Kombination),
        muss jeder Plan bespielt werden, sonst verkauft ein OTA weiter."""
        rt = self._resolve_channex_room_type(db, tenant_id, property_id)
        if rt is None:
            return []
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return []
        rtm = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rtm:
            return []
        rps = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("room_type_map_id", rtm[0]["id"])
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        return [
            {
                "channex_property_id": rt["channex_property_id"],
                "channex_rate_plan_id": rp["channex_rate_plan_id"],
            }
            for rp in rps
            if rp.get("channex_rate_plan_id")
        ]

    # -- Restriktions-Outbox (dauerhafter Backstop) ----------------------------
    # Wie ari_outbox (0033) für Availability, aber für Stop-Sell/Rate/Min-Stay/
    # Max-Stay/CTA-CTD/restrictions: jede Push-Absicht wird VOR dem Channex-Call
    # persistiert und nach Erfolg 'done' markiert. Bei Channex-Ausfall bleibt sie
    # 'pending' und der Reconcile-Cron (process_restriction_outbox) zieht sie nach.
    # Persistiert werden die PARAMETER (kind + payload), nicht die aufgelösten
    # Channex-values — so löst der Retry das Rate-Plan-Mapping NEU auf und heilt
    # auch das Fenster, in dem ein channex-managtes Objekt noch KEINEN Rate-Plan
    # gemappt hat (BUG 9: sonst würde der Push still als Erfolg verworfen).
    def _enqueue_restriction_outbox(
        self,
        tenant_id: str,
        property_id: str,
        kind: str,
        payload: dict[str, Any],
        date_from: date,
        date_to: date,
    ) -> str | None:
        """Restriktions-Push-Absicht als 'pending'-Zeile persistieren. Gibt die
        Zeilen-ID zurück (oder None, wenn kein DB-Client vorhanden)."""
        if self._db is None:
            return None
        row = (
            self._db.table("ari_restriction_outbox")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "kind": kind,
                    "payload": payload,
                    "date_from": date_from.isoformat(),
                    "date_to": date_to.isoformat(),
                    "status": "pending",
                }
            )
            .execute()
        ).data
        return row[0]["id"] if row else None

    def _mark_restriction_outbox(
        self, outbox_id: str | None, status: str, *, error: str | None = None
    ) -> None:
        """Eine Restriktions-Outbox-Zeile abschließen (done) oder als fehlgeschlagen
        markieren. Guard status='pending', damit ein paralleler Cron-Tick den
        Zustand nicht doppelt umschreibt. 'pending' lässt der Cron liegen — hier
        wird nie AKTIV auf 'pending' gesetzt (die Zeile ist bereits pending)."""
        if outbox_id is None or self._db is None:
            return
        patch: dict[str, Any] = {"status": status}
        if error is not None:
            patch["last_error"] = error
        (
            self._db.table("ari_restriction_outbox")
            .update(patch)
            .eq("id", outbox_id)
            .eq("status", "pending")
            .execute()
        )

    def _push_restriction_values_all_plans(
        self,
        tenant_id: str,
        property_id: str,
        fields: dict[str, Any],
        date_from: date,
        date_to: date,
    ) -> int | None:
        """Restriction-`fields` (rate/min_stay/max_stay/CTA/CTD) für ALLE
        Rate-Plans der Property über den Zeitraum expandieren und gebündelt
        pushen. Gibt die Anzahl gesendeter values zurück, oder None bei No-op
        (nicht bei Channex gemanaged). Wirft ChannexError beim Sende-Fehler ODER
        einen _PendingRatePlanMapping-Sentinel, wenn das Objekt zwar managed ist,
        aber (noch) KEINE Rate-Plans gemappt hat — der Aufrufer lässt die
        Outbox-Zeile dann 'pending' (BUG 9: kein stilles Verwerfen als Erfolg).

        Der Kern des Rate-Plan-Fix: früher traf nur EIN (zufälliger) Rate-Plan
        die Restriction; jetzt jeder — sonst verkauft ein OTA über einen anderen
        Rate-Plan weiter."""
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return None  # nicht bei Channex angelegt → kein Push (echter No-op)
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch (Import nicht/teils
            # gelaufen). NICHT still als Erfolg abhaken — der Push muss offen bleiben
            # und der Cron ihn nachziehen, sobald das Mapping existiert.
            raise _PendingRatePlanMapping(property_id)
        values = _restriction_values(plans, fields, date_from, date_to)
        if not values:
            return 0
        for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
            self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
        return len(values)

    def _push_fields_with_outbox(
        self,
        tenant_id: str,
        property_id: str,
        kind: str,
        payload: dict[str, Any],
        fields: dict[str, Any],
        date_from: date,
        date_to: date,
        log_event: str,
    ) -> bool:
        """Gemeinsamer Pfad für rate/max_stay/cta_ctd: Absicht in die Restriktions-
        Outbox persistieren, dann für ALLE Rate-Plans pushen und die Zeile
        abschließen. Rückgabe True = Channex-Fehler ODER fehlendes Rate-Plan-Mapping
        (Worker-Handler wirft → Job-Retry); die Outbox-Zeile bleibt in beiden Fällen
        'pending' und der Cron zieht sie nach. `payload` sind die Parameter zum
        Neu-Aufbauen beim Retry (Selbstheilung); `fields` die daraus abgeleiteten
        Channex-Restriction-Felder für den Sofort-Push."""
        # Zuerst persistieren (VOR dem Channex-Call), damit ein Ausfall/Prozesstod
        # den Wert nicht verliert. Bei nicht-gemanagtem Objekt gar nicht erst
        # anlegen (echter No-op) — sonst würde der Cron endlos eine Zeile für ein
        # Objekt retryen, das gar nicht bei Channex liegt.
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return False
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, kind, payload, date_from, date_to
        )
        try:
            sent = self._push_restriction_values_all_plans(
                tenant_id, property_id, fields, date_from, date_to
            )
            self._mark_restriction_outbox(outbox_id, "done")
            if sent is not None:
                log.info(
                    log_event, tenant_id=tenant_id, property_id=property_id, days=sent,
                )
            return False
        except _PendingRatePlanMapping:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending' (nicht 'done'), der Cron zieht sie nach, sobald das Mapping
            # existiert. True → Job-Retry (Backoff), statt still Erfolg zu melden.
            log.info(
                "restriction_push_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id, kind=kind,
            )
            return True
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop); zusätzlich Job-Retry.
            log.warning(
                f"{log_event}_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

    def push_rate_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        rate_cents: int | None = None,
        *,
        min_stay: int | None = None,
    ) -> bool:
        """Preis und/oder Mindestaufenthalt für einen Zeitraum an Channex pushen
        (Restrictions, ALLE Rate-Plans). Mindestens eines von rate_cents/min_stay
        setzen. Rückgabe True = Channex-Fehler/fehlendes Mapping (Worker-Handler
        wirft → Job-Backoff); die Restriktions-Outbox bleibt der Backstop. No-op,
        wenn nicht verbunden. date_to inkl."""
        if not self._channex.is_configured or self._db is None:
            return False
        if rate_cents is None and min_stay is None:
            return False
        fields: dict[str, Any] = {}
        if rate_cents is not None:
            fields["rate"] = rate_cents
        if min_stay is not None:
            fields["min_stay_arrival"] = min_stay
            fields["min_stay_through"] = min_stay
        # kind unterscheidet Preis (rate) von reinem Min-Stay, damit der Cron beim
        # Retry dieselben Parameter neu aufbaut.
        kind = "rate" if rate_cents is not None else "min_stay"
        payload = {"rate_cents": rate_cents, "min_stay": min_stay}
        return self._push_fields_with_outbox(
            tenant_id, property_id, kind, payload, fields, date_from, date_to,
            "restriction_push_done",
        )

    def push_max_stay_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        max_stay: int,
    ) -> bool:
        """Maximalaufenthalt (max_stay-Restriction) für einen Zeitraum an Channex
        pushen (ALLE Rate-Plans). Channex-Key ist `max_stay` (NICHT
        max_stay_arrival — das nimmt Channex zwar per 200 an, persistiert es aber
        nicht; live verifiziert). 0 = keine Obergrenze. Rückgabe True =
        Channex-Fehler/fehlendes Mapping (Job-Retry); die Restriktions-Outbox bleibt
        der Backstop. No-op ohne Verbindung/Mapping. date_to inkl."""
        if not self._channex.is_configured or self._db is None:
            return False
        clamped = max(0, int(max_stay))
        return self._push_fields_with_outbox(
            tenant_id, property_id, "max_stay", {"max_stay": clamped},
            {"max_stay": clamped}, date_from, date_to, "max_stay_push_done",
        )

    def push_restrictions_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        *,
        closed_to_arrival: bool | None = None,
        closed_to_departure: bool | None = None,
    ) -> bool:
        """CTA/CTD-Restriktionen für einen Zeitraum an Channex pushen (ALLE
        Rate-Plans). Nur gesetzte Felder (None = unverändert). Rückgabe True =
        Channex-Fehler/fehlendes Mapping (Job-Retry); die Restriktions-Outbox bleibt
        der Backstop. No-op, wenn nicht verbunden. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return False
        if closed_to_arrival is None and closed_to_departure is None:
            return False
        fields: dict[str, Any] = {}
        if closed_to_arrival is not None:
            fields["closed_to_arrival"] = closed_to_arrival
        if closed_to_departure is not None:
            fields["closed_to_departure"] = closed_to_departure
        payload = {
            "closed_to_arrival": closed_to_arrival,
            "closed_to_departure": closed_to_departure,
        }
        return self._push_fields_with_outbox(
            tenant_id, property_id, "cta_ctd", payload, fields, date_from, date_to,
            "cta_ctd_push_done",
        )

    @staticmethod
    def _stop_sell_values(
        plans: list[dict[str, str]],
        spans: list[tuple[date, date]],
        stop_sell: bool,
        days: list[str] | None,
    ) -> list[dict[str, Any]]:
        """Aus Rate-Plans + Spannen die per-Datum-Stop-Sell-values bauen.
        Vergangene Tage werden auf heute geklemmt (Channex weist sie sonst ab);
        `days` filtert optional auf Wochentage (mo…su → Python-weekday, Mo=0).
        Statisch/pur, damit Direktpfad und Cron dieselbe Aufbaulogik teilen."""
        today = date.today()
        weekday_allow = None
        if days:
            names = ["mo", "tu", "we", "th", "fr", "sa", "su"]
            weekday_allow = {i for i, n in enumerate(names) if n in days}
        values: list[dict[str, Any]] = []
        for mapping in plans:
            base: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "stop_sell": stop_sell,
            }
            for span_start, span_end in spans:
                if span_end < today:
                    continue
                # Pro Datum expandieren (restrictions ignoriert Bereiche still) und
                # den optionalen Wochentag-Filter direkt hier anwenden — `days` am
                # value wirkt beim per-Datum-Format nicht mehr.
                for v in _expand_restriction_values(
                    base, max(span_start, today), span_end
                ):
                    if weekday_allow is not None:
                        wd = date.fromisoformat(v["date"]).weekday()
                        if wd not in weekday_allow:
                            continue
                    values.append(v)
        return values

    def push_stop_sell_for_property(
        self,
        tenant_id: str,
        property_id: str,
        spans: list[tuple[date, date]],
        *,
        stop_sell: bool,
        days: list[str] | None = None,
    ) -> bool:
        """Verkaufsstopp (stop_sell-Restriction, Rate-Plan-Ebene) für einen oder
        mehrere Zeiträume an Channex pushen — EIN Request mit mehreren values.
        `days` filtert optional auf Wochentage (Channex-nativ: mo…su). Vergangene
        Daten weist Channex ab → Spannen werden auf heute geklemmt. Rückgabe True
        = Channex-Fehler/fehlendes Rate-Plan-Mapping (Worker-Handler wirft →
        schneller Job-Backoff; ein gescheiterter Verkaufsstopp würde OTAs sonst
        weiter verkaufen lassen). Die Absicht wird VOR dem Push in der Restriktions-
        Outbox persistiert (Cron-Backstop). No-op ohne Verbindung/Mapping. date_to
        inklusiv."""
        if not self._channex.is_configured or self._db is None or not spans:
            return False
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return False  # nicht bei Channex angelegt → kein Push (echter No-op)
        # Absicht ZUERST persistieren (VOR dem Channex-Call): ein gescheiterter
        # Verkaufsstopp darf nicht verloren gehen. Outbox-Range = Min/Max über alle
        # Spannen; die vollständigen Spannen/Tage liegen im payload (Neu-Aufbau beim
        # Cron-Retry, inkl. Selbstheilung bei nachträglichem Rate-Plan-Mapping).
        out_from = min(s for s, _ in spans)
        out_to = max(e for _, e in spans)
        payload = {
            "spans": [[s.isoformat(), e.isoformat()] for s, e in spans],
            "stop_sell": stop_sell,
            "days": days,
        }
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, "stop_sell", payload, out_from, out_to
        )
        # ALLE Rate-Plans der Property — ein Stop-Sell wirkt pro Rate-Plan; sonst
        # bleibt ein zweiter (z. B. Non-Refundable → Expedia) buchbar.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending', der Cron zieht sie nach. True → Job-Retry statt still Erfolg.
            log.info(
                "stop_sell_push_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id,
            )
            return True
        values = self._stop_sell_values(plans, spans, stop_sell, days)
        if not values:
            # Nur Vergangenheit/leerer Wochentag-Filter → nichts zu senden; Absicht
            # ist erledigt (kein echter Wert offen).
            self._mark_restriction_outbox(outbox_id, "done")
            return False
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
            self._mark_restriction_outbox(outbox_id, "done")
            log.info(
                "stop_sell_push_done",
                tenant_id=tenant_id, property_id=property_id,
                stop_sell=stop_sell, spans=len(values),
            )
            return False
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop); zusätzlich Job-Retry.
            log.warning(
                "stop_sell_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

    # Channex akzeptiert viele Werte je Restrictions-Request; da restrictions
    # pro-DATUM gesendet werden müssen (date_from/date_to wird still ignoriert),
    # sammeln wir alle Tage in wenige Batch-Requests je ≤500 values — statt
    # hunderter Einzel-Requests (sonst 429-Flut, Channex-Skill: „batch, hundreds
    # of small requests per minute is abuse-shaped"). 365 Tage = 1 Request.
    _RESTRICTIONS_CHUNK = 500

    def push_rates_batch(
        self,
        tenant_id: str,
        property_id: str,
        segments: list[dict[str, Any]],
    ) -> None:
        """Mehrere Preis-/Min-Stay-Intervalle eines Objekts in EINEM (bzw. wenigen
        gechunkten) Channex-Restrictions-Request pushen.

        `segments` = Liste von {date_from, date_to (inkl.), rate_cents?, min_stay?}.
        Das Channex-Mapping wird nur EINMAL aufgelöst (statt pro Intervall).
        Die Absicht wird VOR dem Push in der Restriktions-Outbox persistiert; bei
        Fehler/fehlendem Rate-Plan-Mapping bleibt sie 'pending' und der Cron zieht
        sie nach. No-op, wenn nicht verbunden oder keine Segmente."""
        if not self._channex.is_configured or self._db is None or not segments:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # nicht bei Channex angelegt → kein Batch-Preis-Push (No-op)
        # Absicht ZUERST persistieren. Outbox-Range = Min/Max über alle Segmente;
        # die Segmente liegen im payload (Neu-Aufbau beim Cron-Retry). date_from/
        # date_to der Segmente können date oder ISO-String sein → normalisieren.
        seg_from = min(_as_iso(s["date_from"]) for s in segments)
        seg_to = max(_as_iso(s["date_to"]) for s in segments)
        payload = {"segments": [_segment_to_payload(s) for s in segments]}
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, "rate",
            payload, date.fromisoformat(seg_from), date.fromisoformat(seg_to),
        )
        # ALLE Rate-Plans der Property (nicht nur einer) — die Mappings werden
        # EINMAL aufgelöst und für alle Segmente wiederverwendet.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending', der Cron zieht sie nach. Best-effort-Kontrakt (kein Return).
            log.info(
                "restriction_push_batch_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id,
            )
            return
        values: list[dict[str, Any]] = []
        for seg in segments:
            rate_cents = seg.get("rate_cents")
            min_stay = seg.get("min_stay")
            if rate_cents is None and min_stay is None:
                continue
            for mapping in plans:
                base: dict[str, Any] = {
                    "property_id": mapping["channex_property_id"],
                    "rate_plan_id": mapping["channex_rate_plan_id"],
                }
                if rate_cents is not None:
                    base["rate"] = rate_cents
                if min_stay is not None:
                    base["min_stay_arrival"] = min_stay
                    base["min_stay_through"] = min_stay
                # Pro Datum expandieren — restrictions ignoriert date_from/date_to.
                values.extend(
                    _expand_restriction_values(
                        base, _as_date(seg["date_from"]), _as_date(seg["date_to"])
                    )
                )
        if not values:
            self._mark_restriction_outbox(outbox_id, "done")
            return
        pushed = 0
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                chunk = values[i : i + self._RESTRICTIONS_CHUNK]
                self._channex.update_restrictions(chunk)
                pushed += len(chunk)
            self._mark_restriction_outbox(outbox_id, "done")
            log.info(
                "restriction_push_batch_done",
                tenant_id=tenant_id,
                property_id=property_id,
                intervals=pushed,
            )
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop).
            log.warning(
                "restriction_push_batch_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    @staticmethod
    def _superseding_days_by_row(rows: list[dict]) -> dict[str, set[str]]:
        """Je pending-Zeile die Tage, die von einer NEUEREN Zeile (späterer Index
        bei created_at-Sortierung) desselben Objekts abgedeckt sind. TAG-GENAU:
        eine ältere Zeile wird nur für die überlappenden Tage übersprungen, ihre
        übrigen Tage gehen weiterhin an Channex (Teil-Überlappung verliert keine
        Tage)."""
        by_row: dict[str, set[str]] = {}
        day_lists = [
            _iso_days(str(r["date_from"]), str(r["date_to"])) for r in rows
        ]
        for i, older in enumerate(rows):
            covered: set[str] = set()
            older_days = set(day_lists[i])
            for j in range(i + 1, len(rows)):
                if rows[j]["property_id"] != older["property_id"]:
                    continue
                covered |= older_days & set(day_lists[j])
            by_row[older["id"]] = covered
        return by_row

    # -- Nächtlicher Full-Sync-Push DB→Channex ---------------------------------
    # Channex-Doku (PMS-Guide/Best Practices): "Advisable to send a daily full
    # update each night per property". Delta-Pushes bleiben der Normalfall; der
    # Full-Sync heilt Drift aus verlorenen Deltas (Webhook-/Netz-Ausfälle).
    # Horizont = 365 Tage — deckungsgleich mit dem lokalen Pricing-/Kalender-
    # Horizont (state_length). NICHT weiter pushen als lokale Wahrheit existiert
    # (Wurzel 4: für Tage ohne lokalen Preis keinen 0-€-Verkauf provozieren).
    _FULL_SYNC_DAYS = 365

    def full_sync_property(
        self, tenant_id: str, property_id: str
    ) -> dict[str, int]:
        """Voll-Abgleich EINER Property: Availability über den ganzen Horizont in
        einem gebatchten Push (RLE-Ranges), Preise/Min-Stay über einen Recompute-
        Job (der den vollen Horizont rechnet UND pusht). Stop-Sell/CTA-CTD laufen
        weiterhin event-basiert + Restriction-Outbox-Backstop (es gibt keine
        lokale Ganz-Horizont-Tabelle dafür — nichts erfinden)."""
        if not self._channex.is_configured or self._db is None:
            return {"availability_values": 0, "days": 0}
        db = self._db
        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None or not self._is_channex_managed(db, tenant_id, property_id):
            return {"availability_values": 0, "days": 0}

        start = date.today()
        end = start + timedelta(days=self._FULL_SYNC_DAYS - 1)

        # Basis-Verfügbarkeit = count_of_rooms des synthetischen Room-Types —
        # aus DENSELBEN Objektdaten wie der Content-Sync (keine zweite Wahrheit).
        prop = (
            db.table("properties")
            .select("max_guests, type_attributes")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            return {"availability_values": 0, "days": 0}
        base = self._room_type_occupancy(prop[0])["count_of_rooms"]

        # Belegte/gesperrte Tage: availability-Zeilen mit status != 'open';
        # Tage ohne Zeile sind offen (Kalender-Modell, unique je property+date).
        closed_rows = (
            db.table("availability")
            .select("date, status")
            .eq("property_id", property_id)
            .gte("date", start.isoformat())
            .lte("date", end.isoformat())
            .neq("status", "open")
            .execute()
        ).data or []
        closed = {r["date"] for r in closed_rows}

        # RLE über den Horizont: zusammenhängende Tage mit gleichem Wert werden
        # EIN values-Eintrag mit date_from/date_to (Availability-Endpoint
        # unterstützt Ranges) → der ganze Horizont passt in einen Call.
        values: list[dict[str, Any]] = []
        run_start = start
        run_value = 0 if start.isoformat() in closed else base
        cur = start + timedelta(days=1)
        while cur <= end + timedelta(days=1):
            val = (
                (0 if cur.isoformat() in closed else base)
                if cur <= end
                else None  # Sentinel: letzten Run abschließen
            )
            if val != run_value:
                values.append(
                    {
                        "property_id": mapping["channex_property_id"],
                        "room_type_id": mapping["channex_room_type_id"],
                        "date_from": run_start.isoformat(),
                        "date_to": (cur - timedelta(days=1)).isoformat(),
                        "availability": run_value,
                    }
                )
                run_start = cur
                run_value = val if val is not None else 0
            cur += timedelta(days=1)

        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="full_sync"
        )
        # Availability-Push in Chunks (weit unter 10 MB; ein Call im Regelfall).
        for i in range(0, len(values), 500):
            self._channex.update_availability(values[i:i + 500])

        # Preise/Min-Stay: Recompute-Job rechnet den vollen Horizont neu und
        # pusht ihn (gebatcht) — das ist der Rate-Teil des Full Syncs.
        try:
            from src.jobs.queue import try_enqueue_recompute

            try_enqueue_recompute(db, tenant_id, property_id)
        except Exception as exc:  # noqa: BLE001 — Rate-Teil holt der Tick nach
            log.warning(
                "full_sync_recompute_enqueue_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        log.info(
            "channex_full_sync_pushed",
            tenant_id=tenant_id, property_id=property_id,
            values=len(values), days=self._FULL_SYNC_DAYS,
        )
        return {"availability_values": len(values), "days": self._FULL_SYNC_DAYS}

    def process_ari_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_outbox-Zeilen erneut an Channex pushen (Cron-Retry).
        Idempotent (absoluter Set-Wert je Tag). Superseding TAG-GENAU: von einer
        neueren Absicht abgedeckte Tage werden übersprungen, die restlichen Tage
        der Zeile aber weiterhin gepusht (keine verlorene Freigabe)."""
        result = {"processed": 0, "done": 0, "failed": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        rows = (
            db.table("ari_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
        superseding = self._superseding_days_by_row(rows)
        for r in rows:
            result["processed"] += 1
            mapping = self._resolve_channex_room_type(
                db, r["tenant_id"], r["property_id"]
            )
            if mapping is None:
                # Kein aktives Channex-Mapping (nie angelegt oder soft-deleted) →
                # nichts zu pushen. Als done abhaken (übersprungen), damit der Cron
                # nicht endlos retryt. _resolve_channex_room_type prüft bereits
                # deleted_at IS NULL, deckt also das _is_channex_managed-Gate ab.
                db.table("ari_outbox").update(
                    {"status": "done",
                     "last_error": "nicht bei Channex angelegt (übersprungen)"}
                ).eq("id", r["id"]).execute()
                result["done"] += 1
                continue
            # Nur die Tage pushen, die keine NEUERE Zeile abdeckt. Superseding aus
            # ZWEI Quellen vereinigen: (1) die Batch-lokalen pending-Zeilen und
            # (2) neuere pending/done-Zeilen aus der DB (_newer_covered_days). Ohne
            # (2) sähe der Cron eine bereits erfolgreich gepushte NEUERE done-Zeile
            # (z. B. neue Buchung avail=0) nicht und würde eine ältere pending-Zeile
            # (z. B. Storno-Freigabe avail=1) für dieselben Tage pushen → er
            # überschreibt das jüngere avail=0 und öffnet einen gebuchten Tag wieder
            # bei den OTAs. Symmetrisch zum schnellen push_availability-Pfad.
            superseded_days = superseding.get(r["id"], set()) | self._newer_covered_days(
                db, r["property_id"], str(r.get("created_at") or ""), r["id"]
            )
            days = set(_iso_days(str(r["date_from"]), str(r["date_to"])))
            push_ranges = _group_iso_days_to_ranges(days - superseded_days)
            if not push_ranges:
                # Komplett von neueren Absichten überholt → nichts pushen, abhaken.
                db.table("ari_outbox").update(
                    {"status": "done", "last_error": "superseded (neuere Absicht)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            try:
                for r_from, r_to in push_ranges:
                    self._channex.update_availability(
                        [
                            {
                                "property_id": mapping["channex_property_id"],
                                "room_type_id": mapping["channex_room_type_id"],
                                "date_from": r_from,
                                "date_to": r_to,
                                "availability": r["availability"],
                            }
                        ]
                    )
                # Guard status='pending' wie in den übrigen Zweigen: arbeitet der
                # schnelle push_availability_for_property-Pfad dieselbe Zeile
                # nebenläufig ab, darf der Cron ihren Zustand/attempts-Zähler nicht
                # blind überschreiben (konsistenter attempts-/last_error-Verlauf).
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": (r["attempts"] or 0) + 1}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
            except ChannexError as exc:
                attempts = (r["attempts"] or 0) + 1
                # Nach 10 Versuchen aufgeben (failed), sonst weiter pending.
                new_status = "failed" if attempts >= 10 else "pending"
                # Guard status='pending' wie in den Erfolgs-Zweigen: arbeitet der
                # schnelle push_availability_for_property-Pfad dieselbe Zeile
                # nebenläufig ab und hat sie bereits erfolgreich auf 'done' gesetzt,
                # darf dieser Cron-Fehler sie NICHT auf 'failed'/'pending'
                # zurückkippen — sonst zählt _newer_covered_days sie erneut als
                # aktiven Supersessor (done→failed) bzw. der Push liefe doppelt.
                db.table("ari_outbox").update(
                    {"status": new_status, "attempts": attempts, "last_error": exc.message}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                if new_status == "failed":
                    result["failed"] += 1
        if result["processed"]:
            log.info("ari_outbox_processed", **result)
        return result

    def _restriction_values_from_row(
        self, row: dict[str, Any], plans: list[dict[str, str]]
    ) -> list[dict[str, Any]]:
        """Aus einer persistierten Restriktions-Outbox-Zeile (kind + payload) und den
        AKTUELL aufgelösten Rate-Plans die Channex-restriction-values neu aufbauen.
        Selbstheilung: das Rate-Plan-Mapping wird beim Retry frisch übergeben — eine
        Zeile, die beim Ersteinstellen noch kein Mapping hatte, wird jetzt bespielt.
        Leere Liste, wenn nichts (mehr) zu senden ist."""
        kind = row["kind"]
        payload = row.get("payload") or {}
        date_from = _as_date(row["date_from"])
        date_to = _as_date(row["date_to"])
        if kind == "stop_sell":
            spans = [
                (_as_date(a), _as_date(b)) for a, b in (payload.get("spans") or [])
            ]
            return self._stop_sell_values(
                plans, spans, bool(payload.get("stop_sell")), payload.get("days")
            )
        if kind == "rate" and payload.get("segments") is not None:
            # push_rates_batch-Ursprung: mehrere Segmente in EINER Zeile.
            values: list[dict[str, Any]] = []
            for seg in payload["segments"]:
                fields = _rate_fields(seg.get("rate_cents"), seg.get("min_stay"))
                if not fields:
                    continue
                values.extend(
                    _restriction_values(
                        plans, fields, _as_date(seg["date_from"]),
                        _as_date(seg["date_to"]),
                    )
                )
            return values
        fields = _restriction_fields_from_payload(kind, payload)
        if not fields:
            return []
        return _restriction_values(plans, fields, date_from, date_to)

    def process_restriction_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_restriction_outbox-Zeilen erneut an Channex pushen (Cron-Retry,
        dauerhafter Backstop für Stop-Sell/Rate/Min-Stay/Max-Stay/CTA-CTD). Baut die
        values je Zeile aus dem persistierten kind+payload NEU auf und löst das Rate-
        Plan-Mapping frisch auf (Selbstheilung: eine Zeile ohne Mapping beim
        Ersteinstellen wird bespielt, sobald der Rate-Plan-Import gelaufen ist).
        Nach 10 Versuchen ohne Mapping/mit Fehler → 'failed'."""
        result = {"processed": 0, "done": 0, "failed": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        rows = (
            db.table("ari_restriction_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
        for r in rows:
            result["processed"] += 1
            tenant_id, property_id = r["tenant_id"], r["property_id"]
            # Superseding TAG-GENAU: die von einer NEUEREN Zeile desselben
            # (property_id, kind) abgedeckten Tage werden übersprungen, die
            # RESTLICHEN Tage dieser Zeile gehen weiter an Channex. Sonst würde eine
            # schmale neuere Zeile (z. B. Preis 15.–16.) den weiten älteren Wert
            # (1.–31.) für dessen GESAMTEN Zeitraum unterdrücken → 29 Tage bleiben
            # stale (Falschpreis/-Sperre an OTAs). Ist die Zeile KOMPLETT überdeckt,
            # abhaken (nichts mehr zu pushen).
            superseded_days = self._superseded_restriction_days(db, r)
            own_days = self._restriction_row_days(r)
            if own_days and own_days <= superseded_days:
                db.table("ari_restriction_outbox").update(
                    {"status": "done", "last_error": "superseded (neuere Absicht)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            if not self._is_channex_managed(db, tenant_id, property_id):
                # Nicht (mehr) bei Channex angelegt → nichts zu pushen, abhaken
                # (kein Endlos-Retry). Analog zu process_ari_outbox.
                db.table("ari_restriction_outbox").update(
                    {"status": "done",
                     "last_error": "nicht bei Channex angelegt (übersprungen)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            plans = self._resolve_channex_rate_plans(db, tenant_id, property_id)
            attempts = (r.get("attempts") or 0) + 1
            if not plans:
                # BUG 9: managed, aber Rate-Plan-Mapping fehlt weiterhin → 'pending'
                # lassen (weiter warten), bis der Import es anlegt; erst nach 10
                # Versuchen aufgeben, damit eine dauerhaft kaputte Zeile nicht ewig
                # retryt.
                self._bump_restriction_attempts(
                    r, attempts, "Rate-Plan-Mapping fehlt noch", result
                )
                continue
            try:
                values = self._restriction_values_from_row(r, plans)
                # Von einer neueren Zeile abgedeckte Tage herausfiltern (tag-genau).
                if superseded_days:
                    values = [
                        v for v in values if v.get("date") not in superseded_days
                    ]
                for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                    self._channex.update_restrictions(
                        values[i : i + self._RESTRICTIONS_CHUNK]
                    )
                db.table("ari_restriction_outbox").update(
                    {"status": "done", "attempts": attempts}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
            except ChannexError as exc:
                self._bump_restriction_attempts(r, attempts, exc.message, result)
        if result["processed"]:
            log.info("ari_restriction_outbox_processed", **result)
        return result

    @staticmethod
    def _restriction_row_days(row: dict[str, Any]) -> set[str]:
        """Die von einer Restriktions-Outbox-Zeile TATSÄCHLICH abgedeckten ISO-Tage.
        stop_sell (spans) und rate (segments) tragen ihre echten Tage im payload —
        so werden Lücken zwischen disjunkten Spans/Segmenten NICHT als abgedeckt
        gezählt (sonst würde ein älterer Wert für einen Lückentag fälschlich
        superseded). Generische Zeilen decken date_from..date_to durchgehend ab."""
        payload = row.get("payload") or {}
        days: set[str] = set()
        if row["kind"] == "stop_sell" and payload.get("spans"):
            for a, b in payload["spans"]:
                days.update(_iso_days(str(a), str(b)))
            return days
        if row["kind"] == "rate" and payload.get("segments") is not None:
            for seg in payload["segments"]:
                days.update(_iso_days(str(seg["date_from"]), str(seg["date_to"])))
            return days
        return set(_iso_days(str(row["date_from"]), str(row["date_to"])))

    def _superseded_restriction_days(
        self, db: Client, row: dict[str, Any]
    ) -> set[str]:
        """ISO-Tage dieser Zeile, die von einer NEUEREN Outbox-Zeile desselben
        (property_id, kind) abgedeckt sind (created_at später). TAG-GENAU wie der
        Availability-Pfad (_newer_covered_days): nur die überlappenden Tage werden
        übersprungen, die restlichen Tage der Zeile gehen weiter an Channex — sonst
        unterdrückt eine schmale neuere Zeile (z. B. Preis für 15.–16.) den weiten
        älteren Wert (1.–31.) für dessen GESAMTEN Zeitraum (stale Falschpreis/-Sperre
        an OTAs). Nur pending/done zählen als gültiger Supersessor (failed nie)."""
        created_at = str(row.get("created_at") or "")
        if not created_at:
            return set()
        own_days = self._restriction_row_days(row)
        newer_rows = (
            db.table("ari_restriction_outbox")
            .select("kind, payload, date_from, date_to")
            .eq("property_id", row["property_id"])
            .eq("kind", row["kind"])
            .gt("created_at", created_at)
            .in_("status", ["pending", "done"])
            .lte("date_from", str(row["date_to"]))
            .gte("date_to", str(row["date_from"]))
            .neq("id", row["id"])
            .execute()
        ).data or []
        covered: set[str] = set()
        for nr in newer_rows:
            covered |= self._restriction_row_days(nr)
        return own_days & covered

    def _bump_restriction_attempts(
        self, row: dict[str, Any], attempts: int, error: str, result: dict[str, int]
    ) -> None:
        """attempts erhöhen und nach 10 Versuchen auf 'failed' schalten, sonst
        'pending' lassen (Guard status='pending'). Zählt fehlgeschlagene Zeilen."""
        new_status = "failed" if attempts >= 10 else "pending"
        self._db.table("ari_restriction_outbox").update(
            {"status": new_status, "attempts": attempts, "last_error": error}
        ).eq("id", row["id"]).eq("status", "pending").execute()
        if new_status == "failed":
            result["failed"] += 1

    # -- DB-Mapping-Lookups ----------------------------------------------------
    def _room_type_mapping(
        self, db: Client, tenant_id: str, room_type_map_id: str
    ) -> dict[str, str] | None:
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id, property_map_id")
            .eq("id", room_type_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_room_type_id": rt.data[0]["channex_room_type_id"],
            "property_map_id": rt.data[0]["property_map_id"],
        }

    def _rate_plan_mapping(
        self, db: Client, tenant_id: str, rate_plan_map_id: str
    ) -> dict[str, str] | None:
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id, room_type_map_id")
            .eq("id", rate_plan_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rp.data:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("property_map_id")
            .eq("id", rp.data[0]["room_type_map_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_rate_plan_id": rp.data[0]["channex_rate_plan_id"],
            "property_map_id": rt.data[0]["property_map_id"],
        }

    def _channex_property_id(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> str | None:
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("id", property_map_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return pm.data[0]["channex_property_id"] if pm.data else None
