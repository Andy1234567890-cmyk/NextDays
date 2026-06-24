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

        rows: list[dict] = []
        cur = rng_start
        while cur < rng_end:
            signals = DaySignals(
                day=cur,
                season_pct=season_pct.get(cur.isoformat(), 0.0),
                event_pct=event_pct.get(cur.isoformat(), 0.0),
                occupancy=self._occupancy_signal(cur, booked),
                days_before=(cur - today).days,
                is_orphan_gap=self._is_orphan_gap(cur, booked),
            )
            res = compute_day(base, settings, signals)
            rows.append(
                {
                    "property_id": property_id,
                    "date": cur.isoformat(),
                    "price": res.price,
                    "min_stay": res.min_stay,
                    "computed_at": datetime.now(UTC).isoformat(),
                }
            )
            cur += timedelta(days=1)

        if rows:
            self._db().table("dynamic_prices").upsert(
                rows, on_conflict="property_id,date"
            ).execute()
            self._push_to_channex(tenant_id, property_id, rows)
        log.info(
            "dynamic_pricing_recompute_property",
            property_id=property_id,
            days=len(rows),
        )
        return len(rows)

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
        return DpSettings.from_row(res[0] if res else None)

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
                cm.push_rate_for_property(
                    tenant_id,
                    property_id,
                    _as_date(first["date"]),
                    _as_date(last["date"]),  # inklusiv
                    round(float(first["price"]) * 100),
                    min_stay=first.get("min_stay"),
                )
                seg_start = i
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "dynamic_pricing_channex_push_failed",
                property_id=property_id,
                error=str(exc),
            )
