"""Outbound-ARI: Verfügbarkeit/Preise/Restriktionen/Stop-Sell + Outbox.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import log
from .schemas import (
    AriPushRequest,
    AriPushResponse,
)


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
            value: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "date_from": upd.date_from.isoformat(),
                "date_to": upd.date_to.isoformat(),
            }
            if upd.rate_cents is not None:
                value["rate"] = upd.rate_cents  # Cent-Integer
            if upd.min_stay_arrival is not None:
                value["min_stay_arrival"] = upd.min_stay_arrival
            if upd.stop_sell is not None:
                value["stop_sell"] = 1 if upd.stop_sell else 0
            rate_values.append(value)

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

    def push_availability_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        availability: int,
    ) -> None:
        """Verfügbarkeit (absolute Menge je Tag) für einen Zeitraum an Channex
        pushen. date_to inklusiv. Persistiert in ari_outbox und versucht den
        Sofort-Push; bei Fehler bleibt die Zeile 'pending' (Cron-Retry). No-op,
        wenn Channex nicht konfiguriert oder die Property nicht verbunden ist."""
        if not self._channex.is_configured or self._db is None:
            return
        db = self._db
        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None:
            return  # nicht mit Channex verbunden → nichts zu pushen
        if not self._is_channex_managed(db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Verkauf, kein Push

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

        try:
            self._channex.update_availability(
                [
                    {
                        "property_id": mapping["channex_property_id"],
                        "room_type_id": mapping["channex_room_type_id"],
                        "date_from": date_from.isoformat(),
                        "date_to": date_to.isoformat(),
                        "availability": availability,
                    }
                ]
            )
            if outbox_id:
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": 1}
                ).eq("id", outbox_id).execute()
            log.info(
                "ari_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                availability=availability,
            )
        except ChannexError as exc:
            if outbox_id:
                db.table("ari_outbox").update(
                    {"attempts": 1, "last_error": exc.message}
                ).eq("id", outbox_id).execute()
            log.warning(
                "ari_push_failed_queued",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    def _resolve_channex_rate_plan(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_rate_plan_id) über die
        synthetische Room-Type/Rate-Plan-Kette. None, wenn nicht verbunden."""
        rt = self._resolve_channex_room_type(db, tenant_id, property_id)
        if rt is None:
            return None
        # Rate-Plan-Map über die Room-Type-Map dieser Property.
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
            return None
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
            return None
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("room_type_map_id", rtm[0]["id"])
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rp:
            return None
        return {
            "channex_property_id": rt["channex_property_id"],
            "channex_rate_plan_id": rp[0]["channex_rate_plan_id"],
        }

    def push_rate_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        rate_cents: int | None = None,
        *,
        min_stay: int | None = None,
    ) -> None:
        """Preis und/oder Mindestaufenthalt für einen Zeitraum an Channex pushen
        (Restrictions). Mindestens eines von rate_cents/min_stay setzen.
        Best-effort: bei Fehler loggen — der reconcile-Cron gleicht ohnehin ab.
        No-op, wenn nicht mit Channex verbunden. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return
        if rate_cents is None and min_stay is None:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Preis-Push
        value: dict[str, Any] = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        }
        if rate_cents is not None:
            value["rate"] = rate_cents
        if min_stay is not None:
            value["min_stay_arrival"] = min_stay
            value["min_stay_through"] = min_stay
        try:
            self._channex.update_restrictions([value])
            log.info(
                "restriction_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                rate_cents=rate_cents,
                min_stay=min_stay,
            )
        except ChannexError as exc:
            log.warning(
                "restriction_push_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    def push_max_stay_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        max_stay: int,
    ) -> None:
        """Maximalaufenthalt (max_stay-Restriction) für einen Zeitraum an Channex
        pushen. Channex-Key ist `max_stay` (NICHT max_stay_arrival — das nimmt
        Channex zwar per 200 an, persistiert es aber nicht; live verifiziert).
        0 = keine Obergrenze. Best-effort wie push_rate_for_property; No-op ohne
        Verbindung/Mapping. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Push
        value: dict[str, Any] = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "max_stay": max(0, int(max_stay)),
        }
        try:
            self._channex.update_restrictions([value])
            log.info(
                "max_stay_push_done",
                tenant_id=tenant_id, property_id=property_id, max_stay=max_stay,
            )
        except ChannexError as exc:
            log.warning(
                "max_stay_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
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
    ) -> None:
        """CTA/CTD-Restriktionen für einen Zeitraum an Channex pushen. Nur gesetzte
        Felder (None = unverändert). Best-effort wie push_rate_for_property; No-op,
        wenn nicht verbunden oder alle Kanäle aus. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return
        if closed_to_arrival is None and closed_to_departure is None:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Push
        value: dict[str, Any] = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        }
        if closed_to_arrival is not None:
            value["closed_to_arrival"] = closed_to_arrival
        if closed_to_departure is not None:
            value["closed_to_departure"] = closed_to_departure
        try:
            self._channex.update_restrictions([value])
            log.info(
                "cta_ctd_push_done",
                tenant_id=tenant_id, property_id=property_id,
                cta=closed_to_arrival, ctd=closed_to_departure,
            )
        except ChannexError as exc:
            log.warning(
                "cta_ctd_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )

    def push_stop_sell_for_property(
        self,
        tenant_id: str,
        property_id: str,
        spans: list[tuple[date, date]],
        *,
        stop_sell: bool,
        days: list[str] | None = None,
    ) -> None:
        """Verkaufsstopp (stop_sell-Restriction, Rate-Plan-Ebene) für einen oder
        mehrere Zeiträume an Channex pushen — EIN Request mit mehreren values.
        `days` filtert optional auf Wochentage (Channex-nativ: mo…su). Vergangene
        Daten weist Channex ab → Spannen werden auf heute geklemmt. Best-effort
        wie push_restrictions_for_property; No-op ohne Verbindung/Mapping.
        date_to inklusiv."""
        if not self._channex.is_configured or self._db is None or not spans:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Push
        today = date.today()
        values: list[dict[str, Any]] = []
        for span_start, span_end in spans:
            if span_end < today:
                continue
            value: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "date_from": max(span_start, today).isoformat(),
                "date_to": span_end.isoformat(),
                "stop_sell": stop_sell,
            }
            if days:
                value["days"] = days
            values.append(value)
        if not values:
            return
        try:
            self._channex.update_restrictions(values)
            log.info(
                "stop_sell_push_done",
                tenant_id=tenant_id, property_id=property_id,
                stop_sell=stop_sell, spans=len(values),
            )
        except ChannexError as exc:
            log.warning(
                "stop_sell_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )

    # Channex akzeptiert viele Werte je Restrictions-Request; wir chunken
    # defensiv, damit ein Push über den vollen Horizont 1–wenige Requests ist
    # statt hunderter Einzel-Requests (sonst 429-Flut, siehe Channex-Skill:
    # „batch via ranges, hundreds of small requests per minute is abuse-shaped").
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
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # alle Kanäle des Objekts auf Aus → kein Batch-Preis-Push
        values: list[dict[str, Any]] = []
        for seg in segments:
            rate_cents = seg.get("rate_cents")
            min_stay = seg.get("min_stay")
            if rate_cents is None and min_stay is None:
                continue
            value: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "date_from": seg["date_from"].isoformat(),
                "date_to": seg["date_to"].isoformat(),
            }
            if rate_cents is not None:
                value["rate"] = rate_cents
            if min_stay is not None:
                value["min_stay_arrival"] = min_stay
                value["min_stay_through"] = min_stay
            values.append(value)
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

    def process_ari_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_outbox-Zeilen erneut an Channex pushen (Cron-Retry).
        Idempotent (absoluter Set-Wert je Tag)."""
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
            try:
                self._channex.update_availability(
                    [
                        {
                            "property_id": mapping["channex_property_id"],
                            "room_type_id": mapping["channex_room_type_id"],
                            "date_from": r["date_from"],
                            "date_to": r["date_to"],
                            "availability": r["availability"],
                        }
                    ]
                )
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": (r["attempts"] or 0) + 1}
                ).eq("id", r["id"]).execute()
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
