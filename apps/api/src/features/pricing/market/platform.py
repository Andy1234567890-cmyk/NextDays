"""Plattform-Markt-Provider (Roadmap-Phase 3) — Markt aus EIGENEN Daten.

SiteMinder-Prinzip: solange NextDays kein eigener Booking-Connectivity-Partner
mit Market-Insights-Zugang ist, bildet der Markt sich aus den Objekten, die schon
auf der eigenen Plattform sind. Der Vermieter wählt ein Comp-Set (5–10
vergleichbare Plattform-Objekte, deren IDs in dp_settings.comp_refs); deren echte
effektive Tagespreise (Resolver) ergeben den Markt-Median (comp_price) je Tag.

Damit greift der vorhandene MPI-Mechanismus der Engine (eigener Preis vs. Markt-
Median → Auf-/Abschlag) ab Tag 1, ohne externen Datenanbieter. Später kann ein
BookingInsightsProvider dieselbe MarketDay-Schnittstelle füllen — die Engine
bleibt unverändert.

comp_refs müssen property_ids des eigenen Tenants sein; fremde/ungültige werden
ignoriert (kein Fremddatenzugriff). Ohne Comp-Set oder ohne Preise → leeres
Signal → Markt-Faktor neutral.
"""
from __future__ import annotations

from datetime import date
from statistics import median

from supabase import Client

from src.core.logging import get_logger

from .base import MarketDay, MarketSignalProvider

log = get_logger("nextdays.pricing.market.platform")


class PlatformProvider(MarketSignalProvider):
    """Markt-Median aus den effektiven Tagespreisen des Comp-Sets (eigene Plattform)."""

    name = "platform"

    def __init__(self, service_client: Client, tenant_id: str | None) -> None:
        self._db = service_client
        self._tenant_id = tenant_id

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        if not comp_refs or not days or not self._tenant_id:
            return {}
        # Nur eigene Tenant-Objekte als Comp-Set zulassen (kein Fremdzugriff).
        own = self._own_property_ids(comp_refs)
        if not own:
            return {}
        start, end = min(days), max(days)
        # Effektive Tagespreise der Comp-Objekte über den Resolver (Override >
        # dynamic > weekday > base). Import lokal, um Zyklen zu vermeiden.
        from src.features.pricing.resolver import PricingResolver

        resolver = PricingResolver(service_client=self._db)
        prices_by_date: dict[str, list[float]] = {}
        for pid in own:
            try:
                from datetime import timedelta

                rows = resolver.effective_prices(pid, start, end + timedelta(days=1))
            except Exception as exc:  # noqa: BLE001 — best-effort je Objekt
                log.warning("platform_comp_price_failed", property_id=pid, error=str(exc))
                continue
            for d in rows:
                if d.price is None:
                    continue
                iso = d.date.isoformat() if hasattr(d.date, "isoformat") else str(d.date)
                prices_by_date.setdefault(iso, []).append(float(d.price))
        out: dict[str, MarketDay] = {}
        for iso, vals in prices_by_date.items():
            if vals:
                out[iso] = MarketDay(comp_price=round(median(vals), 2))
        return out

    def _own_property_ids(self, comp_refs: list[str]) -> list[str]:
        try:
            rows = (
                self._db.table("properties")
                .select("id")
                .eq("tenant_id", self._tenant_id)
                .in_("id", comp_refs)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("platform_comp_set_resolve_failed", error=str(exc))
            return []
        return [r["id"] for r in rows]
