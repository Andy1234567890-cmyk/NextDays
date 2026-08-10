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
from .channex_client import ChannexBudgetExhausted
from .common import log
from .verfuegbarkeit_regeln import Wochentagsregel


class FullSyncMixin:
    """Nächtlicher Voll-Push DB→Channex je Channex-Property + Recovery-Import."""

    # -- Nächtlicher Full-Sync-Push DB→Channex ---------------------------------
    # Channex-Doku (PMS-Guide/Best Practices): "Advisable to send a daily full
    # update each night per property". Delta-Pushes bleiben der Normalfall; der
    # Full-Sync heilt Drift aus verlorenen Deltas (Webhook-/Netz-Ausfälle).
    # Horizont = 500 Tage (Channex-Zertifizierung Test 1 verlangt 500;
    # state_length wird im Content-Sync ebenfalls auf 500 gesetzt). Lokale
    # Preis-Wahrheit existiert darüber hinaus: der Resolver liefert
    # override > dynamic > weekday > base, der DP-Recompute rechnet 540 Tage.
    _FULL_SYNC_DAYS = 500

    def full_sync_property(
        self, tenant_id: str, property_id: str, *, vollstaendig: bool = False
    ) -> dict[str, int]:
        """Voll-Abgleich der Channex-Property, zu der das Objekt gehört.

        Geteilte Channex-Property (Hotel, 0158): ALLE Zimmer, die sich die
        Channex-Property teilen, werden GEMEINSAM gesynct — ein gebatchter
        Availability-Push über alle Room-Types (RLE-Ranges) plus ein gebündelter
        Restriktions-Push über alle Rate-Plans (alle deklarierten Restrictions
        je Wert). Das entspricht der Zertifizierung Test 1: „2 API calls —
        500 days availability (all rooms), 500 days rates & restrictions (all
        rates)". Nicht-geteilte Objekte (Ferienobjekt) verhalten sich wie
        bisher (Scope = genau ein Objekt).

        ``vollstaendig`` unterscheidet die zwei Anlässe, die vorher denselben
        engen Rückholpfad benutzten:

        * ``False`` (nächtlicher Lauf): der Rückhol-Teil dient allein der
          Feed-Retention (~30 Min) und schaut deshalb nur 3 Tage zurück. Jede
          Nacht die ganze Historie zu ziehen wäre eine Dauerlast ohne Ertrag.
        * ``True`` (Knopf „Voll-Abgleich"): der Betrieb erwartet dort ALLE
          Buchungen und die Gespräche — nicht die letzten drei Tage. Genau das
          fehlte: der Knopf hieß „Voll-Abgleich" und holte ein 3-Tage-Fenster,
          Nachrichten überhaupt nicht."""
        if not self._channex.is_configured or self._db is None:
            return {"availability_values": 0, "days": 0}
        db = self._db
        if not self._is_channex_managed(db, tenant_id, property_id):
            return {"availability_values": 0, "days": 0}

        siblings = self._full_sync_scope(db, tenant_id, property_id)
        start = date.today()
        end = start + timedelta(days=self._FULL_SYNC_DAYS - 1)

        # Je Zimmer: Verfügbarkeits-Werte (RLE) + Superseding-Zustand einsammeln.
        states: list[dict[str, Any]] = []
        all_values: list[dict[str, Any]] = []
        for pid in siblings:
            mapping = self._resolve_channex_room_type(db, tenant_id, pid)
            if mapping is None:
                continue  # (noch) kein Room-Type-Mapping → dieses Zimmer später
            values, superseded, read_started_at = self._availability_full_values(
                db, pid, mapping, start, end
            )
            all_values.extend(values)
            states.append({
                "property_id": pid,
                "mapping": mapping,
                "superseded": superseded,
                "read_started_at": read_started_at,
            })
        if not states:
            return {"availability_values": 0, "days": 0}

        # Trace-Kontext: jeder availability/restrictions-Push dieses Full-Syncs
        # schreibt seine Channex-Task-ID in channex_debug_log (sichtbarer Verlauf
        # + Zertifizierung braucht die Task-ID).
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="full_sync"
        )
        # Availability-Push in Chunks (weit unter 10 MB; EIN Call im Regelfall —
        # alle Room-Types derselben Channex-Property in einem Request).
        for i in range(0, len(all_values), 500):
            self._channex.update_availability(all_values[i:i + 500])

        # TOCTOU-Nachpush je Zimmer: Buchungen, die zwischen Snapshot-Read und
        # jetzt eintrafen, mit der AKTUELLEN Kalender-Wahrheit nachziehen.
        for state in states:
            self._availability_catch_up(db, state, start, end)

        # Restriktions-Teil: Preis UND alle deklarierten Restriktionen
        # (min_stay/max_stay/CTA/CTD/stop_sell) je Rate-Plan über den Horizont,
        # RLE-gebündelt, über ALLE Zimmer der Channex-Property in EINEM
        # POST /restrictions (push_restriction_rows_multi gruppiert je
        # channex_property_id; Outbox-persistiert). Ein reiner rate-Push reichte
        # NICHT: die Zertifizierung prüft den Full Sync darauf, dass JEDER Wert
        # alle deklarierten Restriktionen trägt.
        try:
            rows_by_property = {
                state["property_id"]: self._full_sync_restriction_rows(
                    db, state["property_id"], start, end
                )
                for state in states
            }
            rows_by_property = {k: v for k, v in rows_by_property.items() if v}
            if rows_by_property:
                self.push_restriction_rows_multi(tenant_id, rows_by_property)
        except ChannexBudgetExhausted:
            # Kontroll-Signal, NICHT verschlucken (Wurzel 5): Die Ausnahme ist
            # bewusst keine ChannexError-Unterklasse, damit sie bis zum Worker
            # durchschlägt und der Job verzögert wiederholt wird. Wurde sie hier
            # gefangen, fiel der GESAMTE Restriktions-Teil (alle Preise,
            # min_stay, stop_sell über 500 Tage) still aus und der Full-Sync
            # meldete Erfolg — der nächtliche Heilungsmechanismus war tot, ohne
            # dass es irgendwo sichtbar wurde.
            raise
        except Exception as exc:  # noqa: BLE001 — Rate-Teil kippt nie den Avail-Teil
            log.warning(
                "full_sync_rates_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        # Recovery-Import (Feed-Lücken-Schutz): un-geackte Booking-Revisionen
        # fallen bei Channex nach ~30 Min PERMANENT aus dem Feed (Retention-Doku).
        # Fiel der Worker/Redis länger aus oder wurde ein Mapping erst spät aktiv,
        # wären die Buchungen dieses Fensters sonst verloren (Kalender bliebe
        # offen → Überbuchung). Der GET /bookings holt sie nach — idempotent über
        # channex_booking_id (kein Doppel-Insert), EINMAL je Channex-Property
        # (deckt alle Zimmer ab).
        #
        # Nachts reichen 3 Tage (nur die Retention-Lücke heilen). Beim manuellen
        # Voll-Abgleich wird KEIN Fenster gesetzt: dort ist die Erwartung „hole
        # alles", auch die Buchung von vor einem halben Jahr.
        #
        # EHRLICHE GRENZE (Channex-Doku, belegt in import_existing_bookings):
        # Channex liefert nur, was es selbst als Revision gesehen hat. Buchungen
        # von VOR dem Connect sind darüber nicht rückholbar — der Knopf holt den
        # vollen Channex-Bestand, nicht die volle Portal-Historie.
        channex_property_id = states[0]["mapping"]["channex_property_id"]
        try:
            recovery_from = (
                None if vollstaendig
                else (datetime.now(UTC) - timedelta(days=3)).strftime(
                    "%Y-%m-%dT%H:%M:%S"
                )
            )
            rec = self.import_bookings_for_property(
                tenant_id, channex_property_id, inserted_after=recovery_from,
            )
            if rec.get("saved"):
                log.info(
                    "channex_full_sync_recovery",
                    tenant_id=tenant_id, property_id=property_id,
                    recovered=rec["saved"], vollstaendig=vollstaendig,
                )
        except ChannexBudgetExhausted:
            raise  # Kontroll-Signal (Wurzel 5) — Job verzögern statt still „done"
        except Exception as exc:  # noqa: BLE001 — Recovery nie den Full-Sync kippen
            log.warning(
                "channex_full_sync_recovery_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        # Posteingang nachholen — nur beim manuellen Voll-Abgleich. Der Betrieb
        # drückt den Knopf, WEIL etwas fehlt; Nachrichten hatten bis hierher
        # keinen Nachhol-Weg (nur Webhook + Journal, und das Journal vergisst
        # nach einem Monat). Nachts läuft das absichtlich nicht: es wären zwei
        # Requests je Thread je Objekt je Nacht, ohne dass jemand etwas vermisst.
        if vollstaendig:
            try:
                self.nachrichten_nachholen(tenant_id, channex_property_id)
            except ChannexBudgetExhausted:
                raise  # Kontroll-Signal (Wurzel 5)
            except Exception as exc:  # noqa: BLE001 — Nachtrag kippt den Lauf nicht
                log.warning(
                    "channex_full_sync_nachrichten_failed",
                    property_id=property_id, error=str(exc)[:200],
                )

        log.info(
            "channex_full_sync_pushed",
            tenant_id=tenant_id, property_id=property_id,
            properties=len(states), values=len(all_values),
            days=self._FULL_SYNC_DAYS,
        )
        return {"availability_values": len(all_values), "days": self._FULL_SYNC_DAYS}

    def _full_sync_scope(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[str]:
        """Alle lokalen Objekte (property_ids), die sich die Channex-Property des
        Objekts teilen — inkl. des Objekts selbst, stabil nach Map-created_at
        sortiert. Nicht geteilt → genau [property_id]."""
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return [property_id]
        rows = (
            db.table("channex_property_map")
            .select("property_id, created_at")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", pm[0]["channex_property_id"])
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        return [r["property_id"] for r in rows] or [property_id]

    def _availability_full_values(
        self, db: Client, property_id: str, mapping: dict[str, str],
        start: date, end: date,
    ) -> tuple[list[dict[str, Any]], set[str], str]:
        """Verfügbarkeits-values (RLE-Ranges) EINES Zimmers über den Horizont.
        Gibt (values, superseded_days, read_started_at) zurück — der Aufrufer
        pusht gebündelt und zieht danach den TOCTOU-Nachpush je Zimmer nach.

        1 Objekt = 1 Einheit: Basis-Verfügbarkeit 1, belegte/gesperrte Tage 0
        (Tabelle availability, Tage ohne Zeile sind offen)."""
        # Lesezeitpunkt VOR dem Snapshot merken: Delta-Pushes, die während des
        # Full-Syncs entstehen (neue Buchung → avail=0), dürfen von unseren bei
        # T0 gelesenen (dann veralteten) Werten nicht überschrieben werden —
        # sonst wäre ein frisch gebuchter Tag bei den OTAs wieder verkaufbar.
        read_started_at = datetime.now(UTC).isoformat()
        base = 1

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
        # EIN values-Eintrag mit date_from/date_to. Superseded-Tage unterbrechen
        # den Run und werden NICHT gepusht.
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
        return values, superseded, read_started_at

    def _availability_catch_up(
        self, db: Client, state: dict[str, Any], start: date, end: date
    ) -> None:
        """TOCTOU-Nachpush EINES Zimmers: eine Buchung, die zwischen dem
        Superseding-Read (T0) und jetzt eintraf, hat ihren avail=0-Delta schon
        gesendet (Outbox done) — der bei T0 gelesene base-Wert hätte ihn aber
        gerade wieder auf 1 gesetzt. Deshalb die ari_outbox seit T0 erneut lesen
        und die neu betroffenen Tage aus dem AKTUELLEN Kalender nachziehen
        (jüngste Wahrheit gewinnt)."""
        property_id = state["property_id"]
        mapping = state["mapping"]
        late_days: set[str] = set()
        for r in (
            db.table("ari_outbox")
            .select("date_from, date_to")
            .eq("property_id", property_id)
            .gte("created_at", state["read_started_at"])
            .execute()
        ).data or []:
            if r.get("date_from") and r.get("date_to"):
                late_days.update(_iso_days(r["date_from"], r["date_to"]))
        late_in_horizon = {
            d for d in late_days
            if start.isoformat() <= d <= end.isoformat()
            and d not in state["superseded"]
        }
        if not late_in_horizon:
            return
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
                "availability": 0 if d in fresh_closed else 1,
            }
            for d in sorted(late_in_horizon)
        ]
        for i in range(0, len(catch_up), 500):
            self._channex.update_availability(catch_up[i:i + 500])
        log.info(
            "channex_full_sync_catch_up",
            property_id=property_id, late_days=len(catch_up),
        )

    def _full_sync_restriction_rows(
        self, db: Client, property_id: str, start: date, end: date
    ) -> list[dict[str, Any]]:
        """Vollständige Restriktions-Zeilen des Horizonts PRO Rate-Plan: JEDER
        Wert trägt ALLE deklarierten Restriktionen (rate, min_stay, max_stay,
        CTA, CTD, stop_sell) — die Zertifizierung prüft den Full Sync genau
        darauf. Quellen (echte Wahrheit, Wurzel 4 — nichts erfinden):
        - rate: zentraler PricingResolver (Datumspreis > Override > Dynamic >
          Wochentag > Plan-Basis). Tage ohne auflösbaren Preis senden KEIN
          rate-Feld (Channex-Partial-Update lässt den Preis unberührt), die
          übrigen Restriktionen gehen trotzdem raus.
        - min_stay: rate_plans.min_stay als Basis, datumsgenau überschrieben
          durch rate_plan_min_stay_overrides (0150).
        - max_stay/CTA/CTD: rate_plan_restriction_overrides (0153, plan-genau);
          CTA/CTD fällt sonst auf die Objekt-Flags in availability zurück, und
          zuletzt auf die WOCHENTAGS-Regel aus dem Verfügbarkeits-Formular
          (unavailableCheckIn/-CheckOut). max_stay fällt ohne Override auf den
          Formularwert (`availability.maxStay`) zurück — vorher stand hier
          stur 0, wodurch der nächtliche Full-Sync jeden im Formular gesetzten
          Maximalaufenthalt wieder aufhob (Wurzel 1: der Gegenzustand wurde
          nicht mitgepflegt). 0 bleibt „keine Obergrenze" (Channex-Semantik).
        - stop_sell: stop_sell-Zeilen (rate_plan_id null = Objekt-Ebene → alle
          Pläne, sonst plan-genau). Kanal-gescopte Stops (scope != 'all') sind
          KEIN globaler ARI-Stop und bleiben draußen.
        Gleiche Tages-Vektoren werden per RLE zu EINEM date_from/date_to-Range
        gebündelt (Zertifizierungsvorgabe: merged date_range statt Einzeltagen)
        → im Regelfall EIN POST /restrictions für den ganzen Horizont."""
        from src.features.pricing.resolver import PricingResolver

        plans = (
            db.table("rate_plans")
            .select("id, min_stay")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        if not plans:
            return []
        plan_ids = [p["id"] for p in plans]
        s_iso, e_iso = start.isoformat(), end.isoformat()

        # Grundregeln aus dem Verfügbarkeits-Formular (type_attributes.
        # availability): Mindest-/Maximalaufenthalt und die gesperrten
        # Check-in/-out-Wochentage. Sie sind der Unterbau; ein tagesgenauer
        # Override sticht sie weiter unten aus.
        prop = (
            db.table("properties")
            .select("type_attributes")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        regel = Wochentagsregel.aus_zeile(prop[0] if prop else {})

        min_over: dict[tuple[str, str], int] = {}
        for r in (
            db.table("rate_plan_min_stay_overrides")
            .select("rate_plan_id, date, min_stay")
            .in_("rate_plan_id", plan_ids)
            .gte("date", s_iso).lte("date", e_iso)
            .not_.is_("min_stay", "null")
            .execute()
        ).data or []:
            min_over[(r["rate_plan_id"], r["date"])] = int(r["min_stay"])

        restr_over: dict[tuple[str, str], dict[str, Any]] = {}
        for r in (
            db.table("rate_plan_restriction_overrides")
            .select("rate_plan_id, date, closed_to_arrival, closed_to_departure,"
                    " max_stay")
            .in_("rate_plan_id", plan_ids)
            .gte("date", s_iso).lte("date", e_iso)
            .execute()
        ).data or []:
            restr_over[(r["rate_plan_id"], r["date"])] = r

        # Objekt-weite CTA/CTD-Flags (Ferienobjekt-Pfad speichert in availability).
        obj_flags: dict[str, dict[str, Any]] = {
            r["date"]: r
            for r in (
                db.table("availability")
                .select("date, closed_to_arrival, closed_to_departure")
                .eq("property_id", property_id)
                .gte("date", s_iso).lte("date", e_iso)
                .execute()
            ).data or []
        }

        stop_all: set[str] = set()
        stop_plan: set[tuple[str, str]] = set()
        for r in (
            db.table("stop_sell")
            .select("date, rate_plan_id, scope")
            .eq("property_id", property_id)
            .gte("date", s_iso).lte("date", e_iso)
            .execute()
        ).data or []:
            if (r.get("scope") or "all") != "all":
                continue  # kanal-gescopter Stop ≠ globaler ARI-Stop
            if r.get("rate_plan_id"):
                stop_plan.add((r["rate_plan_id"], r["date"]))
            else:
                stop_all.add(r["date"])

        resolver = PricingResolver(service_client=db)
        rows: list[dict[str, Any]] = []
        for plan in plans:
            rp_id = plan["id"]
            # Plan-Mindestaufenthalt schlägt den Objekt-Grundwert aus dem
            # Formular; ohne Plan-Wert gilt das Formular, sonst 1 Nacht.
            base_min = int(plan.get("min_stay") or regel.min_stay or 1)
            prices: dict[str, int] = {}
            for entry in resolver.effective_prices(
                property_id, start, end + timedelta(days=1), rate_plan_id=rp_id
            ):
                cents = (
                    round(float(entry.price) * 100)
                    if entry.price is not None else None
                )
                if cents is not None and cents > 0:
                    prices[entry.date.isoformat()] = cents

            run_start: date | None = None
            run_vec: tuple | None = None
            cur = start
            while cur <= end:
                iso = cur.isoformat()
                over = restr_over.get((rp_id, iso)) or {}
                flags = obj_flags.get(iso) or {}
                # Vorrang: Plan-Override sticht alles (er ist tagesgenau und
                # bewusst gesetzt). Ohne ihn gilt gesperrt, wenn ENTWEDER das
                # Objekt-Tagesflag ODER die Wochentagsregel des Formulars
                # sperrt.
                #
                # Das ODER ist kein Zufall: `availability.closed_to_arrival` ist
                # NOT NULL DEFAULT false (live geprüft, 6567 Zeilen — alle
                # false). Die Spalte kann „nicht gesetzt" gar nicht ausdrücken,
                # taugt also nicht zum Übersteuern. Läse man sie als Vorrang,
                # schaltete jede existierende Kalenderzeile die Wochentagsregel
                # stumm — der Betrieb sperrt samstags die Anreise, und bei den
                # Portalen bliebe der Samstag offen.
                cta = over.get("closed_to_arrival")
                if cta is None:
                    cta = bool(flags.get("closed_to_arrival")) or regel.cta(cur)
                ctd = over.get("closed_to_departure")
                if ctd is None:
                    ctd = bool(flags.get("closed_to_departure")) or regel.ctd(cur)
                # Ohne tagesgenauen Override gilt der Formularwert (0 = offen).
                roh_max = over.get("max_stay")
                max_stay = (
                    max(0, int(roh_max)) if roh_max is not None else regel.max_stay
                )
                vec = (
                    prices.get(iso),
                    min_over.get((rp_id, iso), base_min),
                    max_stay,
                    bool(cta),
                    bool(ctd),
                    iso in stop_all or (rp_id, iso) in stop_plan,
                )
                if run_vec is None:
                    run_start, run_vec = cur, vec
                elif vec != run_vec:
                    rows.append(self._restriction_row(
                        rp_id, run_start, cur - timedelta(days=1), run_vec
                    ))
                    run_start, run_vec = cur, vec
                cur += timedelta(days=1)
            if run_start is not None and run_vec is not None:
                rows.append(self._restriction_row(rp_id, run_start, end, run_vec))
        return rows

    @staticmethod
    def _restriction_row(
        rate_plan_id: str, date_from: date, date_to: date, vec: tuple
    ) -> dict[str, Any]:
        """Einen RLE-Run (Tages-Vektor) als push_restriction_rows-Zeile ausgeben.
        Ohne auflösbaren Preis fehlt das rate-Feld (Partial-Update)."""
        rate_cents, min_stay, max_stay, cta, ctd, stop = vec
        row: dict[str, Any] = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "rate_plan_id": rate_plan_id,
            "min_stay": min_stay,
            "max_stay": max_stay,
            "closed_to_arrival": cta,
            "closed_to_departure": ctd,
            "stop_sell": stop,
        }
        if rate_cents is not None:
            row["rate_cents"] = rate_cents
        return row
