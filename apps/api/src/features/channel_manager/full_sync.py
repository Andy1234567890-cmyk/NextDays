"""Nächtlicher Full-Sync-Push DB→Channex (eigenes Mixin).

Aus ari_push.py ausgelagert (Modulgröße). State (_db/_channex) und Helfer
(_resolve_channex_room_type, _is_channex_managed, _room_type_occupancy,
_trace_step, import_bookings_for_property) kommen von der Service-Fassade;
Modul-Helfer (_iso_days) aus ari_push.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from .ari_push import _iso_days
from .common import log


class FullSyncMixin:
    """Nächtlicher Voll-Push DB→Channex je Property + Recovery-Import."""

    # -- Nächtlicher Full-Sync-Push DB→Channex ---------------------------------
    # Channex-Doku (PMS-Guide/Best Practices): "Advisable to send a daily full
    # update each night per property". Delta-Pushes bleiben der Normalfall; der
    # Full-Sync heilt Drift aus verlorenen Deltas (Webhook-/Netz-Ausfälle).
    # Horizont = 500 Tage (Channex-Zertifizierung Test 1 verlangt 500;
    # state_length wird im Content-Sync ebenfalls auf 500 gesetzt). Lokale
    # Preis-Wahrheit existiert darüber hinaus: der Resolver liefert
    # override > dynamic > weekday > base, der DP-Recompute rechnet 540 Tage.
    # Tage OHNE auflösbaren Preis werden im Rate-Teil übersprungen (Wurzel 4:
    # kein 0-€-Verkauf).
    _FULL_SYNC_DAYS = 500

    def full_sync_property(
        self, tenant_id: str, property_id: str
    ) -> dict[str, int]:
        """Voll-Abgleich EINER Property: Availability über den ganzen Horizont in
        einem gebatchten Push (RLE-Ranges) + Preise über den zentralen Preis-
        Resolver (override > dynamic > weekday > base) via push_rates_batch —
        damit heilt der Full-Sync Preis-Drift für JEDES Objekt, nicht nur für
        Dynamic-Pricing-Objekte. Stop-Sell/CTA-CTD laufen weiterhin event-
        basiert + Restriction-Outbox-Backstop (es gibt keine lokale Ganz-
        Horizont-Tabelle dafür — nichts erfinden)."""
        if not self._channex.is_configured or self._db is None:
            return {"availability_values": 0, "days": 0}
        db = self._db
        if not self._is_channex_managed(db, tenant_id, property_id):
            return {"availability_values": 0, "days": 0}

        # 1 Objekt = 1 Einheit: binärer Single-Unit-Voll-Push (synthetischer
        # Room-Type je Objekt).
        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None:
            return {"availability_values": 0, "days": 0}

        # Trace-Kontext: jeder availability/restrictions-Push dieses Full-Syncs
        # schreibt seine Channex-Task-ID in channex_debug_log (sichtbarer Verlauf
        # + Zertifizierung braucht die Task-ID).
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="full_sync"
        )

        start = date.today()
        end = start + timedelta(days=self._FULL_SYNC_DAYS - 1)
        # Lesezeitpunkt VOR dem Snapshot merken: Delta-Pushes, die während des
        # Full-Syncs entstehen (neue Buchung → avail=0), dürfen von unseren bei
        # T0 gelesenen (dann veralteten) Werten nicht überschrieben werden —
        # sonst wäre ein frisch gebuchter Tag bei den OTAs wieder verkaufbar.
        read_started_at = datetime.now(UTC).isoformat()

        # Basis-Verfügbarkeit = 1 EINHEIT. 1 Objekt = 1 buchbare Einheit
        # (Zimmer ODER Ferienobjekt), Tabelle availability binär, alle Delta-Pfade
        # pushen 0/1. Die synthetische Room-Type-Map löst je Objekt genau eine
        # Einheit auf.
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

        # Rate-Teil des Full Syncs: die EINE Preis-Wahrheit (PricingResolver:
        # override > dynamic > weekday > base) über den Horizont rechnen und als
        # RLE-Segmente über push_rates_batch pushen (Outbox-persistiert, alle
        # Rate-Plans der Property, gechunkt). Ein Recompute-Enqueue reichte NICHT:
        # ohne Dynamic Pricing ist recompute ein No-op und ohne Autopilot pusht
        # er nicht — Preis-Drift wurde für normale Objekte nie geheilt.
        try:
            rate_segments = self._full_sync_rate_segments(db, property_id, start, end)
            if rate_segments:
                self.push_rates_batch(tenant_id, property_id, rate_segments)
        except Exception as exc:  # noqa: BLE001 — Rate-Teil kippt nie den Avail-Teil
            log.warning(
                "full_sync_rates_failed",
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

    def _full_sync_rate_segments(
        self, db: Client, property_id: str, start: date, end: date
    ) -> list[dict[str, Any]]:
        """Effektivpreise des Horizonts (zentraler Resolver) → RLE-Segmente für
        push_rates_batch, PRO Rate-Plan. Jeder Plan hat seine eigene Kurve
        (Datumspreis > Objekt-Override > Dynamic > Wochentag > Plan-Basispreis);
        ein Segment ohne rate_plan_id ginge in push_rates_batch an ALLE Pläne
        und würde B&B/BAR flächig mit derselben (falschen) Kurve überschreiben.
        Tage ohne auflösbaren Preis werden übersprungen (Wurzel 4: kein
        erfundener Preis, kein 0-€-Verkauf) und unterbrechen den Run. min_stay
        bleibt hier None — Mindestaufenthalt läuft über die rates-Events."""
        from src.features.pricing.resolver import PricingResolver

        plans = (
            db.table("rate_plans")
            .select("id")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        resolver = PricingResolver(service_client=db)
        segments: list[dict[str, Any]] = []
        for plan in plans:
            days = resolver.effective_prices(
                property_id, start, end + timedelta(days=1),
                rate_plan_id=plan["id"],
            )
            segments.extend(self._rle_rate_segments(days, plan["id"]))
        return segments

    @staticmethod
    def _rle_rate_segments(
        days: list[Any], rate_plan_id: str
    ) -> list[dict[str, Any]]:
        """Tagespreise eines Plans zu RLE-Segmenten (gleicher Preis → 1 Intervall)."""
        segments: list[dict[str, Any]] = []
        run_start: date | None = None
        run_price_cents: int | None = None
        prev_day: date | None = None

        def _close(last_day: date | None) -> None:
            if run_start is not None and run_price_cents is not None and last_day:
                segments.append(
                    {
                        "date_from": run_start,
                        "date_to": last_day,
                        "rate_cents": run_price_cents,
                        "rate_plan_id": rate_plan_id,
                    }
                )

        for entry in days:
            day = entry.date
            price = entry.price
            cents = round(float(price) * 100) if price is not None else None
            if cents is None or cents <= 0:
                _close(prev_day)
                run_start = run_price_cents = None
            elif run_price_cents is None:
                run_start, run_price_cents = day, cents
            elif cents != run_price_cents:
                _close(prev_day)
                run_start, run_price_cents = day, cents
            prev_day = day
        _close(prev_day)
        return segments
