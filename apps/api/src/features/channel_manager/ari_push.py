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
                db.table("ari_outbox").update(
                    {"attempts": prior_attempts + 1, "last_error": exc.message}
                ).eq("id", outbox_id).execute()
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
        (nicht verbunden / alle Kanäle aus). Wirft ChannexError beim Sende-Fehler
        (der Aufrufer entscheidet über Logging/Retry).

        Der Kern des Rate-Plan-Fix: früher traf nur EIN (zufälliger) Rate-Plan
        die Restriction; jetzt jeder — sonst verkauft ein OTA über einen anderen
        Rate-Plan weiter."""
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            return None
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return None  # alle Kanäle des Objekts auf Aus → kein Push
        values: list[dict[str, Any]] = []
        for mapping in plans:
            base = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                **fields,
            }
            values.extend(_expand_restriction_values(base, date_from, date_to))
        if not values:
            return 0
        for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
            self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
        return len(values)

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
        setzen. Rückgabe True = Channex-Fehler (Worker-Handler wirft → schneller
        Job-Backoff statt Verlust). No-op, wenn nicht verbunden. date_to inkl."""
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
        try:
            sent = self._push_restriction_values_all_plans(
                tenant_id, property_id, fields, date_from, date_to
            )
            if sent is not None:
                log.info(
                    "restriction_push_done",
                    tenant_id=tenant_id,
                    property_id=property_id,
                    rate_cents=rate_cents,
                    min_stay=min_stay,
                    days=sent,
                )
            return False
        except ChannexError as exc:
            log.warning(
                "restriction_push_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )
            return True

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
        Channex-Fehler (Job-Retry). No-op ohne Verbindung/Mapping. date_to inkl."""
        if not self._channex.is_configured or self._db is None:
            return False
        try:
            sent = self._push_restriction_values_all_plans(
                tenant_id, property_id,
                {"max_stay": max(0, int(max_stay))}, date_from, date_to,
            )
            if sent is not None:
                log.info(
                    "max_stay_push_done",
                    tenant_id=tenant_id, property_id=property_id, max_stay=max_stay,
                    days=sent,
                )
            return False
        except ChannexError as exc:
            log.warning(
                "max_stay_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

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
        Channex-Fehler (Job-Retry). No-op, wenn nicht verbunden oder alle Kanäle
        aus. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return False
        if closed_to_arrival is None and closed_to_departure is None:
            return False
        fields: dict[str, Any] = {}
        if closed_to_arrival is not None:
            fields["closed_to_arrival"] = closed_to_arrival
        if closed_to_departure is not None:
            fields["closed_to_departure"] = closed_to_departure
        try:
            sent = self._push_restriction_values_all_plans(
                tenant_id, property_id, fields, date_from, date_to
            )
            if sent is not None:
                log.info(
                    "cta_ctd_push_done",
                    tenant_id=tenant_id, property_id=property_id,
                    cta=closed_to_arrival, ctd=closed_to_departure,
                    days=sent,
                )
            return False
        except ChannexError as exc:
            log.warning(
                "cta_ctd_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

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
        = Channex-Fehler (Worker-Handler wirft → schneller Job-Backoff; ein
        gescheiterter Verkaufsstopp würde OTAs sonst weiter verkaufen lassen).
        No-op ohne Verbindung/Mapping. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None or not spans:
            return False
        # ALLE Rate-Plans der Property — ein Stop-Sell wirkt pro Rate-Plan; sonst
        # bleibt ein zweiter (z. B. Non-Refundable → Expedia) buchbar.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            return False
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return False  # alle Kanäle des Objekts auf Aus → kein Push
        today = date.today()
        # Wochentag-Filter (mo…su) auf Python-weekday (Mo=0) abbilden.
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
        if not values:
            return False
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
            log.info(
                "stop_sell_push_done",
                tenant_id=tenant_id, property_id=property_id,
                stop_sell=stop_sell, spans=len(values),
            )
            return False
        except ChannexError as exc:
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
        Best-effort: bei Fehler loggen — der reconcile-Cron gleicht ab.
        No-op, wenn nicht verbunden oder keine Segmente."""
        if not self._channex.is_configured or self._db is None or not segments:
            return
        # ALLE Rate-Plans der Property (nicht nur einer) — die Mappings werden
        # EINMAL aufgelöst und für alle Segmente wiederverwendet.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Batch-Preis-Push
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
                    _expand_restriction_values(base, seg["date_from"], seg["date_to"])
                )
        if not values:
            return
        pushed = 0
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                chunk = values[i : i + self._RESTRICTIONS_CHUNK]
                self._channex.update_restrictions(chunk)
                pushed += len(chunk)
            log.info(
                "restriction_push_batch_done",
                tenant_id=tenant_id,
                property_id=property_id,
                intervals=pushed,
            )
        except ChannexError as exc:
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
            # Nur die Tage pushen, die keine NEUERE Zeile abdeckt.
            days = set(_iso_days(str(r["date_from"]), str(r["date_to"])))
            push_ranges = _group_iso_days_to_ranges(days - superseding.get(r["id"], set()))
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
                db.table("ari_outbox").update(
                    {"status": new_status, "attempts": attempts, "last_error": exc.message}
                ).eq("id", r["id"]).execute()
                if new_status == "failed":
                    result["failed"] += 1
        if result["processed"]:
            log.info("ari_outbox_processed", **result)
        return result

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
