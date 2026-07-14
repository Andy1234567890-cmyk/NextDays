"""Nächtlicher Full-Sync-Push DB→Channex (eigenes Mixin).

Aus ari_push.py ausgelagert (Modulgröße). State (_db/_channex) und Helfer
(_resolve_channex_room_type, _is_channex_managed, _room_type_occupancy,
_trace_step, import_bookings_for_property) kommen von der Service-Fassade;
Modul-Helfer (_iso_days) aus ari_push.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from .ari_push import _iso_days
from .common import log


class FullSyncMixin:
    """Nächtlicher Voll-Push DB→Channex je Property + Recovery-Import."""

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
        # Lesezeitpunkt VOR dem Snapshot merken: Delta-Pushes, die während des
        # Full-Syncs entstehen (neue Buchung → avail=0), dürfen von unseren bei
        # T0 gelesenen (dann veralteten) Werten nicht überschrieben werden —
        # sonst wäre ein frisch gebuchter Tag bei den OTAs wieder verkaufbar.
        read_started_at = datetime.now(UTC).isoformat()

        # Basis-Verfügbarkeit = 1 EINHEIT. Unser lokales Kalender-Modell ist
        # strikt 1 Einheit je Objekt (Tabelle availability: unique property+date,
        # Status open/blocked — binär). SÄMTLICHE Delta-Pfade (Buchung→0,
        # Freigabe→1, Kalender-Unblock→1, Horizont-Init→1) pushen 0/1. Der
        # Full-Sync MUSS dieselbe Wahrheit pushen — count_of_rooms (>1 bei
        # „Anzahl Zimmer") würde offene Tage bei den OTAs mehrfach verkaufbar
        # machen (Überbuchung), während jeder Delta-Push sie auf 1 zurückzieht.
        # count_of_rooms bleibt am Room-Type (Kapazität/Billing), ist aber NICHT
        # die verkaufbare Menge dieses 1-Unit-Modells.
        base = 1

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

        # Superseding gegen die Delta-Welt (Wurzel 1/Nebenläufigkeit): Tage, für
        # die seit T0 eine ari_outbox-Zeile entstanden ist (pending ODER schon
        # done), aus dem Voll-Push ausschließen — die jüngere Delta-Absicht
        # gewinnt; der Outbox-/Reconcile-Pfad hält diese Tage konsistent.
        fresh_rows = (
            db.table("ari_outbox")
            .select("date_from, date_to")
            .eq("property_id", property_id)
            .gte("created_at", read_started_at)
            .execute()
        ).data or []
        superseded: set[str] = set()
        for r in fresh_rows:
            if r.get("date_from") and r.get("date_to"):
                superseded.update(_iso_days(r["date_from"], r["date_to"]))

        # RLE über den Horizont: zusammenhängende Tage mit gleichem Wert werden
        # EIN values-Eintrag mit date_from/date_to (Availability-Endpoint
        # unterstützt Ranges). Superseded-Tage unterbrechen den Run und werden
        # NICHT gepusht.
        values: list[dict[str, Any]] = []
        run_start: date | None = None
        run_value: int | None = None

        def _close_run(last_day: date) -> None:
            if run_start is None or run_value is None:
                return
            values.append(
                {
                    "property_id": mapping["channex_property_id"],
                    "room_type_id": mapping["channex_room_type_id"],
                    "date_from": run_start.isoformat(),
                    "date_to": last_day.isoformat(),
                    "availability": run_value,
                }
            )

        cur = start
        while cur <= end:
            iso = cur.isoformat()
            if iso in superseded:
                _close_run(cur - timedelta(days=1))
                run_start = run_value = None
            else:
                val = 0 if iso in closed else base
                if run_value is None:
                    run_start, run_value = cur, val
                elif val != run_value:
                    _close_run(cur - timedelta(days=1))
                    run_start, run_value = cur, val
            cur += timedelta(days=1)
        _close_run(end)

        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="full_sync"
        )
        # Availability-Push in Chunks (weit unter 10 MB; ein Call im Regelfall).
        for i in range(0, len(values), 500):
            self._channex.update_availability(values[i:i + 500])

        # TOCTOU-Nachpush: eine Buchung, die zwischen dem Superseding-Read (T0)
        # und JETZT eintraf, hat ihren avail=0-Delta schon gesendet (Outbox
        # done) — unser bei T0 gelesener base-Wert hätte ihn aber gerade wieder
        # auf 1 gesetzt. Deshalb nach dem Push die ari_outbox seit T0 erneut
        # lesen und die neu betroffenen Tage aus dem AKTUELLEN Kalender
        # nachziehen (jüngste Wahrheit gewinnt).
        late_days: set[str] = set()
        for r in (
            db.table("ari_outbox")
            .select("date_from, date_to")
            .eq("property_id", property_id)
            .gte("created_at", read_started_at)
            .execute()
        ).data or []:
            if r.get("date_from") and r.get("date_to"):
                late_days.update(_iso_days(r["date_from"], r["date_to"]))
        late_in_horizon = {
            d for d in late_days
            if start.isoformat() <= d <= end.isoformat() and d not in superseded
        }
        if late_in_horizon:
            fresh_closed = {
                row["date"]
                for row in (
                    db.table("availability")
                    .select("date, status")
                    .eq("property_id", property_id)
                    .in_("date", sorted(late_in_horizon))
                    .neq("status", "open")
                    .execute()
                ).data or []
            }
            catch_up = [
                {
                    "property_id": mapping["channex_property_id"],
                    "room_type_id": mapping["channex_room_type_id"],
                    "date": d,
                    "availability": 0 if d in fresh_closed else base,
                }
                for d in sorted(late_in_horizon)
            ]
            for i in range(0, len(catch_up), 500):
                self._channex.update_availability(catch_up[i:i + 500])
            log.info(
                "channex_full_sync_catch_up",
                property_id=property_id, late_days=len(catch_up),
            )

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

        # Recovery-Import (Feed-Lücken-Schutz): un-geackte Booking-Revisionen
        # fallen bei Channex nach ~30 Min PERMANENT aus dem Feed (Retention-Doku).
        # Fiel der Worker/Redis länger aus oder wurde ein Mapping erst spät aktiv,
        # wären die Buchungen dieses Fensters sonst verloren (Kalender bliebe
        # offen → Überbuchung). Der nächtliche GET /bookings holt sie nach —
        # idempotent über channex_booking_id (kein Doppel-Insert), pro Buchung
        # isoliert. Fenster großzügig: letzte 3 Tage.
        try:
            recovery_from = (
                datetime.now(UTC) - timedelta(days=3)
            ).strftime("%Y-%m-%dT%H:%M:%S")
            rec = self.import_bookings_for_property(
                tenant_id, mapping["channex_property_id"],
                inserted_after=recovery_from,
            )
            if rec.get("saved"):
                log.info(
                    "channex_full_sync_recovery",
                    tenant_id=tenant_id, property_id=property_id,
                    recovered=rec["saved"],
                )
        except Exception as exc:  # noqa: BLE001 — Recovery nie den Full-Sync kippen
            log.warning(
                "channex_full_sync_recovery_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        log.info(
            "channex_full_sync_pushed",
            tenant_id=tenant_id, property_id=property_id,
            values=len(values), days=self._FULL_SYNC_DAYS,
        )
        return {"availability_values": len(values), "days": self._FULL_SYNC_DAYS}
