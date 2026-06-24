"""Wetter-Provider (RateBoard-Baustein) — Wetter als externer Nachfrage-Faktor.

Quelle: Bright Sky (https://brightsky.dev) — freie JSON-API auf Basis der amtlichen
DWD-Open-Data (Deutscher Wetterdienst). Kein API-Key, kommerziell nutzbar, beste
Abdeckung für DACH. Für Objekte mit Geokoordinaten liefert sie den Tages-Forecast.

Der Provider übersetzt das Roh-Wetter in einen Score in grob [-1, +1]:
  +1 = ideales Reisewetter (warm, sonnig, trocken), -1 = schlecht (kalt/nass).
Liegt ein Anreisedatum außerhalb des Forecast-Horizonts (typisch ~10 Tage), gibt es
KEINEN Score (kein Eintrag) — die Engine bleibt dort neutral (keine Fallbacks; wir
erfinden kein Wetter für ferne Tage). Ohne Koordinaten → kein Signal.
"""
from __future__ import annotations

from datetime import date

import httpx

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.weather")

_BRIGHTSKY_URL = "https://api.brightsky.dev/weather"
# Wetter-Forecast ist nur kurzfristig belastbar — darüber kein Signal.
_FORECAST_HORIZON_DAYS = 10


def _score_day(temp_c: float | None, precipitation_mm: float | None,
               cloud_pct: float | None) -> float | None:
    """Tages-Wetter → Score [-1, +1]. Warm+trocken+sonnig = hoch. None-Werte
    werden ausgelassen; fehlt alles, gibt es keinen Score (None)."""
    parts: list[float] = []
    if temp_c is not None:
        # 22 °C ideal → +1; 0 °C → -1; linear, gedeckelt.
        parts.append(max(-1.0, min(1.0, (temp_c - 11.0) / 11.0)))
    if precipitation_mm is not None:
        # 0 mm → +1, ab 5 mm → -1.
        parts.append(max(-1.0, min(1.0, 1.0 - precipitation_mm / 2.5)))
    if cloud_pct is not None:
        # 0 % Wolken → +1, 100 % → -1.
        parts.append(max(-1.0, min(1.0, 1.0 - cloud_pct / 50.0)))
    if not parts:
        return None
    return round(sum(parts) / len(parts), 3)


class WeatherProvider:
    """Tages-Wetter-Score je Anreisedatum aus DWD/Bright Sky."""

    def __init__(self, timeout_s: float = 8.0) -> None:
        self._timeout = timeout_s

    def weather_scores(
        self, lat: float | None, lon: float | None, days: list[date], today: date
    ) -> dict[str, float]:
        """ISO-Datum → Wetter-Score, nur für Tage im Forecast-Horizont. Ohne
        Koordinaten oder bei API-Fehler leer (best-effort → neutral)."""
        if lat is None or lon is None or not days:
            return {}
        in_horizon = [
            d for d in days if 0 <= (d - today).days <= _FORECAST_HORIZON_DAYS
        ]
        if not in_horizon:
            return {}
        start, end = min(in_horizon), max(in_horizon)
        try:
            resp = httpx.get(
                _BRIGHTSKY_URL,
                params={
                    "lat": lat,
                    "lon": lon,
                    "date": start.isoformat(),
                    "last_date": end.isoformat(),
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # noqa: BLE001 — Wetter ist best-effort
            log.warning("weather_fetch_failed", error=str(exc))
            return {}
        # Stündliche Werte je Tag mitteln → ein Score pro Anreisedatum.
        by_day: dict[str, list[dict]] = {}
        for w in payload.get("weather") or []:
            ts = str(w.get("timestamp") or "")[:10]
            if ts:
                by_day.setdefault(ts, []).append(w)
        wanted = {d.isoformat() for d in in_horizon}
        out: dict[str, float] = {}
        for iso, hours in by_day.items():
            if iso not in wanted:
                continue
            temps = [h["temperature"] for h in hours if h.get("temperature") is not None]
            precs = [h["precipitation"] for h in hours if h.get("precipitation") is not None]
            clouds = [h["cloud_cover"] for h in hours if h.get("cloud_cover") is not None]
            score = _score_day(
                sum(temps) / len(temps) if temps else None,
                sum(precs) if precs else None,
                sum(clouds) / len(clouds) if clouds else None,
            )
            if score is not None:
                out[iso] = score
        return out
