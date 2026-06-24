"""Interface + Datentyp + NullProvider für das Markt-Signal.

MarketDay trägt die drei Markt-Signale eines Tages (alle optional — None heißt
„kein Signal", die Engine bleibt dann an dieser Stelle neutral):
  comp_price       — Median-Preis vergleichbarer Objekte (Comp-Set).
  demand_index     — Marktnachfrage 0..1 (analog zur eigenen Auslastung).
  event_uplift_pct — Markt-Event-Aufschlag in % (ergänzt event_periods,
                     ohne Doppelzählung — siehe engine._market_factor).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass
class MarketDay:
    comp_price: float | None = None
    demand_index: float | None = None
    event_uplift_pct: float | None = None


class MarketSignalProvider:
    """Schnittstelle für Markt-Signal-Quellen (AirDNA, später PriceLabs, …)."""

    name = "base"

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        """Markt-Signal je Tag (ISO-Datum → MarketDay) für den Zeitraum `days`.

        market_key = Markt/Region (providerspezifisch), comp_refs = vergleichbare
        Listing-Referenzen (Comp-Set). Rückgabe darf Tage auslassen (dann gilt für
        sie kein Signal → neutral)."""
        raise NotImplementedError


class NullProvider(MarketSignalProvider):
    """Default: kein externes Signal. Liefert für jeden Tag einen leeren MarketDay
    → der Markt-Faktor der Engine bleibt neutral (1.0). DP läuft wie Phase 1."""

    name = "null"

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        return {}
