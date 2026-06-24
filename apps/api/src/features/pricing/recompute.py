"""Dynamic-Pricing Recompute-Service.

Lädt je Objekt die Quellen (Basispreis, dp_settings, Saison-/Event-Perioden,
eigene Reservierungen/Verfügbarkeit), leitet pro Tag die Engine-Signale ab, ruft
die reine Engine (engine.py) und schreibt das Ergebnis nach dynamic_prices.
Anschließend wird der vorhandene Channex-ARI-Push (Preis + Min-Stay) für den
geänderten Bereich ausgelöst.

DP schreibt NUR in dynamic_prices — niemals in price_overrides (das bleibt die
manuelle Host-Überschreibung und gewinnt im Resolver). Nur Objekte mit
dp_settings.enabled werden berechnet.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from .engine import DaySignals, DpSettings, compute_day
from .market import MarketDay, MarketSignalProvider, get_market_provider

log = get_logger("nextdays.pricing.recompute")

# Standard-Planungshorizont (Tage ab heute), wie im Channex-state_length-Init.
DEFAULT_HORIZON_DAYS = 540
# Fenster (Tage) für das Auslastungssignal um einen Tag herum.
_OCCUPANCY_WINDOW = 30


def _as_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


class DynamicPricingRecompute:
    """Berechnet dynamische Preise und verteilt sie (Channex-Push)."""

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client
        # Rohzeile der zuletzt geladenen dp_settings (für market_key/comp_refs,
        # die nicht in der Rechen-Dataclass DpSettings liegen).
        self._settings_row: dict | None = None

    def _db(self) -> Client:
        if self._client is None:
            raise RuntimeError("Pricing-Recompute-DB nicht verfügbar.")
        return self._client

    # -- Öffentliche Einstiegspunkte -----------------------------------------
    def recompute_all(self, *, horizon_days: int = DEFAULT_HORIZON_DAYS) -> dict:
        """Alle Objekte mit aktiviertem Dynamic Pricing neu berechnen (Cron)."""
        rows = (
            self._db()
            .table("dp_settings")
            .select("property_id")
            .eq("enabled", True)
            .execute()
        ).data or []
        total_days = 0
        for r in rows:
            total_days += self.recompute_property(
                r["property_id"], horizon_days=horizon_days
            )
        result = {"properties": len(rows), "days": total_days}
        log.info("dynamic_pricing_recompute_all", **result)
        return result

    def recompute_property(
        self,
        property_id: str,
        *,
        start: date | None = None,
        end: date | None = None,
        horizon_days: int = DEFAULT_HORIZON_DAYS,
    ) -> int:
        """Ein Objekt für [start, end) (Default: heute .. +horizon) neu rechnen.

        No-op (0), wenn DP für das Objekt aus ist oder kein Basispreis existiert
        (kein erfundener Preis). Gibt die Anzahl geschriebener Tage zurück."""
        today = datetime.now(UTC).date()
        rng_start = start or today
        rng_end = end or (today + timedelta(days=horizon_days))
        if rng_end <= rng_start:
            return 0

        settings = self._load_settings(property_id)
        if not settings.enabled:
            return 0
        base = self._load_base_price(property_id)
        if base is None:
            log.info("dynamic_pricing_skip_no_base", property_id=property_id)
            return 0

        tenant_id = self._tenant_for_property(property_id)
        season_pct = self._season_pct_by_date(property_id, rng_start, rng_end)
        event_pct = self._event_pct_by_date(tenant_id, rng_start, rng_end)
        booked = self._booked_dates(property_id, rng_start, rng_end)
        market = self._market_by_date(settings, tenant_id, rng_start, rng_end)

        # Pickup: heutigen Belegungs-Snapshot je Aufenthaltstag persistieren
        # (Lern-Fundament + Velocity-Quelle). Best-effort — fehlt die Tabelle/
        # Historie, bleibt das Velocity-Signal None (neutral).
        self._write_pickup_snapshots(property_id, today, rng_start, rng_end, booked)
        # Velocity-Quelle: primär die gelernte KI-Forecast-Kurve (Phase 4), wo sie
        # trägt; wo die Kurve eine Zelle nicht gelernt hat (Cold-Start), greift das
        # einfache Lookback-Signal (Phase 2). Keine Fallbacks: liefert keine der
        # beiden Quellen einen Wert, bleibt der Tag ohne Pickup-Signal (neutral).
        velocity = self._pickup_velocity_by_date(property_id, today, rng_start, rng_end)
        velocity.update(
            self._forecast_velocity_by_date(property_id, today, rng_start, rng_end)
        )

        # Wetter (RateBoard-Baustein): nur wenn aktiviert. Tages-Score aus DWD/
        # Bright Sky für Tage im Forecast-Horizont; ferne Tage → kein Score (neutral).
        weather = self._weather_by_date(property_id, settings, today, rng_start, rng_end)

        rows: list[dict] = []
        cur = rng_start
        while cur < rng_end:
            md = market.get(cur.isoformat())
            signals = DaySignals(
                day=cur,
                season_pct=season_pct.get(cur.isoformat(), 0.0),
                event_pct=event_pct.get(cur.isoformat(), 0.0),
                occupancy=self._occupancy_signal(cur, booked),
                days_before=(cur - today).days,
                is_orphan_gap=self._is_orphan_gap(cur, booked),
                comp_price=md.comp_price if md else None,
                demand_index=md.demand_index if md else None,
                market_event_pct=md.event_uplift_pct if md else None,
                pickup_velocity=velocity.get(cur.isoformat()),
                weather_score=weather.get(cur.isoformat()),
            )
            res = compute_day(base, settings, signals)
            rows.append(
                {
                    "property_id": property_id,
                    "date": cur.isoformat(),
                    "price": res.price,
                    "min_stay": res.min_stay,
                    # Faktor-Aufschlüsselung persistieren („Warum dieser Preis?").
                    "factors": {k: round(v, 4) for k, v in res.factors.items()},
                    "computed_at": datetime.now(UTC).isoformat(),
                }
            )
            cur += timedelta(days=1)

        if rows:
            # In dynamic_prices schreiben → Kalender, Quote UND die eigene
            # Plattform (booking_engine) lesen den Preis automatisch über den
            # Resolver (Pull, Priorität override > dynamic > weekday > base).
            # KEIN Push dorthin nötig. Nur externe OTAs (Channex) müssen den
            # Preis aktiv geschickt bekommen — das macht _push_to_channex.
            self._db().table("dynamic_prices").upsert(
                rows, on_conflict="property_id,date"
            ).execute()
            # Autopilot-Gate (RateBoard): nur bei aktivem Autopilot gehen die
            # Preise automatisch an die OTAs (Channex). Ohne Autopilot bleiben sie
            # reine Empfehlung — in dynamic_prices/Vorschau/Kalender sichtbar, aber
            # nicht extern veröffentlicht (der Vermieter entscheidet manuell).
            if settings.autopilot_enabled:
                self._push_to_channex(tenant_id, property_id, rows)
            else:
                log.info(
                    "dynamic_pricing_recommend_only_no_push",
                    property_id=property_id,
                    days=len(rows),
                )
        log.info(
            "dynamic_pricing_recompute_property",
            property_id=property_id,
            days=len(rows),
        )
        return len(rows)

    def _market_by_date(
        self, settings: DpSettings, tenant_id: str | None, start: date, end: date
    ) -> dict[str, MarketDay]:
        """Markt-Signal je Tag über den konfigurierten Provider — NUR wenn der
        Vermieter Marktdaten aktiviert hat (market_enabled). Ohne Aktivierung oder
        ohne Provider-Signal leer → der Markt-Faktor bleibt neutral (Phase-1-Parität).

        market_key/comp_refs liegen in dp_settings; sie kommen NICHT aus der
        Engine-DpSettings (die hält nur Rechenparameter), daher hier direkt aus
        der Zeile gelesen."""
        if not settings.market_enabled:
            return {}
        row = self._settings_row
        market_key = (row or {}).get("market_key")
        comp_refs = [str(r) for r in ((row or {}).get("comp_refs") or [])]
        days: list[date] = []
        cur = start
        while cur < end:
            days.append(cur)
            cur += timedelta(days=1)
        try:
            provider = self._market_provider(comp_refs, tenant_id)
            return provider.market_signal(market_key, comp_refs, days)
        except Exception as exc:  # noqa: BLE001 — Markt-Signal ist best-effort
            log.warning("market_signal_failed", error=str(exc))
            return {}

    def _market_provider(
        self, comp_refs: list[str], tenant_id: str | None
    ) -> MarketSignalProvider:
        """Markt-Provider wählen (Roadmap-Phase 3). Ist ein Comp-Set gesetzt UND
        kein expliziter externer Provider konfiguriert, nutzt die Plattform-Quelle
        (eigene Daten, SiteMinder-Prinzip). Sonst der env-konfigurierte Provider
        (AirDNA/Null). Späterer Booking-Insights-Provider dockt hier an."""
        from src.core.config import get_settings

        env_choice = (get_settings().market_data_provider or "").strip().lower()
        if comp_refs and env_choice in ("", "null", "platform") and self._client is not None:
            from .market.platform import PlatformProvider

            return PlatformProvider(self._client, tenant_id)
        return get_market_provider()

    # -- Pickup (Roadmap-Phase 2) -------------------------------------------
    # Fenster (Tage), über das die Pickup-Geschwindigkeit gemessen wird: Stand
    # heute vs. Stand vor PICKUP_LOOKBACK_DAYS für denselben Aufenthaltstag.
    _PICKUP_LOOKBACK_DAYS = 7

    def _write_pickup_snapshots(
        self,
        property_id: str,
        today: date,
        start: date,
        end: date,
        booked: set[str],
    ) -> None:
        """Heutigen Belegungs-Snapshot je Aufenthaltstag schreiben (idempotent
        per Unique-Key). Das ist das Lern-Fundament + die Velocity-Quelle. Best-
        effort: fehlt die Tabelle (Migration 0060 nicht angewendet), wird nur
        geloggt — der Recompute läuft normal weiter."""
        snaps: list[dict] = []
        cur = start
        while cur < end:
            iso = cur.isoformat()
            snaps.append(
                {
                    "property_id": property_id,
                    "stay_date": iso,
                    "snapshot_date": today.isoformat(),
                    "days_before": (cur - today).days,
                    "booked": iso in booked,
                }
            )
            cur += timedelta(days=1)
        if not snaps:
            return
        try:
            self._db().table("dp_pickup_snapshots").upsert(
                snaps, on_conflict="property_id,stay_date,snapshot_date"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Pickup-Erfassung ist best-effort
            log.warning("pickup_snapshot_write_failed", error=str(exc))

    def _pickup_velocity_by_date(
        self, property_id: str, today: date, start: date, end: date
    ) -> dict[str, float]:
        """Pickup-Geschwindigkeit je Aufenthaltstag aus der Snapshot-Historie.

        Vergleicht den heutigen Belegungsstand mit dem Stand vor ~LOOKBACK Tagen
        für denselben Aufenthaltstag. Wurde der Tag seither belegt (0→1), ist das
        ein schneller Pickup → positives Signal; war er schon belegt, neutral.
        Ohne Vergleichs-Snapshot (frische DB) → kein Eintrag → Engine neutral.

        Rückgabe: ISO-Aufenthaltsdatum → velocity in grob [-1, +1]. Die
        eigentliche Reaktion deckelt die Engine über die Auslastungs-Caps."""
        ref_day = today - timedelta(days=self._PICKUP_LOOKBACK_DAYS)
        try:
            rows = (
                self._db()
                .table("dp_pickup_snapshots")
                .select("stay_date, booked")
                .eq("property_id", property_id)
                .eq("snapshot_date", ref_day.isoformat())
                .gte("stay_date", start.isoformat())
                .lt("stay_date", end.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("pickup_velocity_read_failed", error=str(exc))
            return {}
        # Belegt-Stand des Referenztags je Aufenthaltsdatum.
        was_booked = {r["stay_date"]: bool(r.get("booked")) for r in rows}
        out: dict[str, float] = {}
        # Aktuellen Stand laden (heute), um die Veränderung zu messen.
        booked_now = self._booked_dates(property_id, start, end)
        for iso, prev in was_booked.items():
            now = iso in booked_now
            if now and not prev:
                out[iso] = 1.0   # seit dem Referenztag neu gebucht → schneller Pickup
            elif not now and not prev:
                out[iso] = -0.25  # weiterhin frei → leicht langsamer als „normal"
            # bereits zuvor belegt → kein Velocity-Signal (neutral, nicht gesetzt)
        return out

    # -- KI-Forecast (Roadmap-Phase 4) --------------------------------------
    # Wie weit zurück Snapshots fürs Kurven-Lernen geladen werden (Tage). Mehr
    # Historie = stabilere Kurve; gedeckelt, um die Abfrage klein zu halten.
    _FORECAST_TRAIN_DAYS = 365

    def _forecast_velocity_by_date(
        self, property_id: str, today: date, start: date, end: date
    ) -> dict[str, float]:
        """KI-Forecast-Velocity je Aufenthaltstag aus der gelernten Pickup-Kurve.

        Trainiert das PickupCurveModel aus der Snapshot-Historie des Objekts und
        vergleicht den heutigen Belegungs-Ist je Aufenthaltstag mit der erwarteten
        Belegung bei diesem Vorlauf. Über Erwartung → positives Signal (Aufschlag),
        darunter → negatives. Ungelernte Zellen (Cold-Start) liefern KEIN Signal
        (kein Eintrag) — die Engine bleibt dort neutral (keine Fallbacks).

        Ersetzt das grobe Lookback-Velocity-Signal (Phase 2), wo die Kurve trägt;
        wo nicht, greift weiter das Lookback-Signal."""
        from .forecast import PickupCurveModel, PickupObservation

        train_from = today - timedelta(days=self._FORECAST_TRAIN_DAYS)
        try:
            rows = (
                self._db()
                .table("dp_pickup_snapshots")
                .select("stay_date, days_before, booked")
                .eq("property_id", property_id)
                .gte("snapshot_date", train_from.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Forecast ist best-effort
            log.warning("forecast_train_read_failed", error=str(exc))
            return {}
        observations = [
            PickupObservation(
                stay_date=_as_date(r["stay_date"]),
                days_before=int(r.get("days_before") or 0),
                booked=bool(r.get("booked")),
            )
            for r in rows
            if r.get("stay_date") is not None
        ]
        if not observations:
            return {}
        model = PickupCurveModel().train(observations)
        if not model.is_trained:
            return {}
        booked_now = self._booked_dates(property_id, start, end)
        out: dict[str, float] = {}
        cur = start
        while cur < end:
            iso = cur.isoformat()
            v = model.forecast_velocity(
                stay=cur,
                days_before=(cur - today).days,
                occupied_now=iso in booked_now,
            )
            if v is not None:
                out[iso] = v
            cur += timedelta(days=1)
        return out

    # -- Wetter (RateBoard-Baustein) ----------------------------------------
    def _weather_by_date(
        self,
        property_id: str,
        settings: DpSettings,
        today: date,
        start: date,
        end: date,
    ) -> dict[str, float]:
        """Wetter-Score je Anreisetag aus DWD/Bright Sky — nur wenn der Vermieter
        Wetter aktiviert hat (weather_enabled) UND das Objekt Koordinaten hat.
        Ferne Tage (außerhalb Forecast-Horizont) bleiben ohne Score → neutral."""
        if not settings.weather_enabled:
            return {}
        lat, lng = self._coords_for_property(property_id)
        if lat is None or lng is None:
            return {}
        from .weather import WeatherProvider

        days: list[date] = []
        cur = start
        while cur < end:
            days.append(cur)
            cur += timedelta(days=1)
        try:
            return WeatherProvider().weather_scores(lat, lng, days, today)
        except Exception as exc:  # noqa: BLE001 — Wetter ist best-effort
            log.warning("weather_signal_failed", error=str(exc))
            return {}

    def _coords_for_property(
        self, property_id: str
    ) -> tuple[float | None, float | None]:
        res = (
            self._db()
            .table("properties")
            .select("lat, lng")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not res:
            return None, None
        row = res[0]
        lat = row.get("lat")
        lng = row.get("lng")
        return (
            float(lat) if lat is not None else None,
            float(lng) if lng is not None else None,
        )

    # -- Quellen laden -------------------------------------------------------
    def _load_settings(self, property_id: str) -> DpSettings:
        res = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        self._settings_row = res[0] if res else None
        return DpSettings.from_row(self._settings_row)

    def _load_base_price(self, property_id: str) -> float | None:
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not res or res[0].get("base_price") is None:
            return None
        try:
            return float(res[0]["base_price"])
        except (TypeError, ValueError):
            return None

    def _tenant_for_property(self, property_id: str) -> str | None:
        res = (
            self._db()
            .table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return res[0].get("tenant_id") if res else None

    def _season_pct_by_date(
        self, property_id: str, start: date, end: date
    ) -> dict[str, float]:
        """Saison-Aufschlag je Tag aus den dem Objekt zugewiesenen Templates.
        season_assignments(property) → seasons(template) → season_periods."""
        assigns = (
            self._db()
            .table("season_assignments")
            .select("template_id")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        template_ids = [a["template_id"] for a in assigns if a.get("template_id")]
        if not template_ids:
            return {}
        seasons = (
            self._db()
            .table("seasons")
            .select("id, percent")
            .in_("template_id", template_ids)
            .execute()
        ).data or []
        pct_by_season = {s["id"]: float(s.get("percent") or 0) for s in seasons}
        if not pct_by_season:
            return {}
        periods = (
            self._db()
            .table("season_periods")
            .select("season_id, start_date, end_date")
            .in_("season_id", list(pct_by_season.keys()))
            .execute()
        ).data or []
        return self._spread_periods(
            periods, pct_by_season, "season_id", start, end
        )

    def _event_pct_by_date(
        self, tenant_id: str | None, start: date, end: date
    ) -> dict[str, float]:
        """Event-Aufschlag je Tag (tenant-weit). events(tenant) → event_periods."""
        if not tenant_id:
            return {}
        events = (
            self._db()
            .table("events")
            .select("id, percent")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        pct_by_event = {e["id"]: float(e.get("percent") or 0) for e in events}
        if not pct_by_event:
            return {}
        periods = (
            self._db()
            .table("event_periods")
            .select("event_id, start_date, end_date")
            .in_("event_id", list(pct_by_event.keys()))
            .execute()
        ).data or []
        return self._spread_periods(periods, pct_by_event, "event_id", start, end)

    @staticmethod
    def _spread_periods(
        periods: list[dict],
        pct_by_id: dict[str, float],
        id_key: str,
        start: date,
        end: date,
    ) -> dict[str, float]:
        """Perioden auf Tage verteilen; überlappende Perioden → höchster Aufschlag."""
        out: dict[str, float] = {}
        for p in periods:
            pct = pct_by_id.get(p.get(id_key))
            if pct is None:
                continue
            p_start = max(start, _as_date(p["start_date"]))
            p_end = min(end - timedelta(days=1), _as_date(p["end_date"]))
            cur = p_start
            while cur <= p_end:
                key = cur.isoformat()
                out[key] = max(out.get(key, 0.0), pct)
                cur += timedelta(days=1)
        return out

    def _booked_dates(self, property_id: str, start: date, end: date) -> set[str]:
        """Belegte/gesperrte Tage (availability.status != open) als ISO-Set."""
        rows = (
            self._db()
            .table("availability")
            .select("date, status")
            .eq("property_id", property_id)
            .gte("date", start.isoformat())
            .lt("date", end.isoformat())
            .execute()
        ).data or []
        return {r["date"] for r in rows if r.get("status") and r["status"] != "open"}

    # -- Signal-Ableitung ----------------------------------------------------
    @staticmethod
    def _occupancy_signal(day: date, booked: set[str]) -> float:
        """Auslastung im ±Fenster um den Tag (Anteil belegter Tage, 0..1)."""
        half = _OCCUPANCY_WINDOW // 2
        total = 0
        taken = 0
        cur = day - timedelta(days=half)
        last = day + timedelta(days=half)
        while cur <= last:
            total += 1
            if cur.isoformat() in booked:
                taken += 1
            cur += timedelta(days=1)
        return taken / total if total else 0.0

    @staticmethod
    def _is_orphan_gap(day: date, booked: set[str]) -> bool:
        """True, wenn dieser freie Tag in einer 1–2-Nächte-Lücke zwischen zwei
        Belegungen liegt (schwer einzeln zu füllen → Rabatt)."""
        if day.isoformat() in booked:
            return False
        prev1 = (day - timedelta(days=1)).isoformat() in booked
        next1 = (day + timedelta(days=1)).isoformat() in booked
        # 1-Nacht-Lücke: beide Nachbarn belegt.
        if prev1 and next1:
            return True
        # 2-Nächte-Lücke: ein Nachbar belegt, der übernächste auf der anderen
        # Seite ebenfalls (day ist Teil einer genau-2-Tage-Lücke).
        next2 = (day + timedelta(days=2)).isoformat() in booked
        prev2 = (day - timedelta(days=2)).isoformat() in booked
        free_next = (day + timedelta(days=1)).isoformat() not in booked
        free_prev = (day - timedelta(days=1)).isoformat() not in booked
        if prev1 and free_next and next2:
            return True
        return bool(next1 and free_prev and prev2)

    # -- Verteilung ----------------------------------------------------------
    def _push_to_channex(
        self, tenant_id: str | None, property_id: str, rows: list[dict]
    ) -> None:
        """Geänderte Tage als Restrictions (Preis in Cent + Min-Stay) an Channex
        pushen. Run-Length-Encoding: aufeinanderfolgende Tage mit gleichem
        (price, min_stay) werden zu einem Intervall gebündelt. Best-effort —
        Fehler dürfen das Schreiben nicht kippen (reconcile-Cron gleicht ab)."""
        if not tenant_id or self._client is None or not rows:
            return
        try:
            from src.features.channel_manager.service import ChannelManagerService

            cm = ChannelManagerService(service_client=self._client)
            ordered = sorted(rows, key=lambda r: r["date"])
            # RLE: aufeinanderfolgende Tage mit gleichem (price, min_stay) zu
            # einem Intervall bündeln, dann ALLE Intervalle in EINEM gebatchten
            # Channex-Push schicken (statt pro Intervall ein Request → 429-Flut).
            segments: list[dict] = []
            seg_start = 0
            for i in range(1, len(ordered) + 1):
                same = (
                    i < len(ordered)
                    and ordered[i]["price"] == ordered[seg_start]["price"]
                    and ordered[i]["min_stay"] == ordered[seg_start]["min_stay"]
                    and _as_date(ordered[i]["date"])
                    == _as_date(ordered[i - 1]["date"]) + timedelta(days=1)
                )
                if same:
                    continue
                first = ordered[seg_start]
                last = ordered[i - 1]
                segments.append(
                    {
                        "date_from": _as_date(first["date"]),
                        "date_to": _as_date(last["date"]),  # inklusiv
                        "rate_cents": round(float(first["price"]) * 100),
                        "min_stay": first.get("min_stay"),
                    }
                )
                seg_start = i
            cm.push_rates_batch(tenant_id, property_id, segments)
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "dynamic_pricing_channex_push_failed",
                property_id=property_id,
                error=str(exc),
            )
