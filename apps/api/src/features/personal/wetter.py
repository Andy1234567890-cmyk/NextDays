"""Wettervorhersage für den Dienstplan-Kopf (0544) — Open-Meteo mit Cache.

Warum Open-Meteo: freie Nutzung ohne Schlüssel, WMO-Codes, tägliche Aggregate.
Der Host ist FEST verdrahtet (`api.open-meteo.com`) — es gibt keine Stelle, an
der ein Nutzer eine URL vorgibt, also auch keinen SSRF-Weg (Wurzel 8).

Cache: `wetter_tage` je auf zwei Stellen gerundeter Koordinate (~1 km) und Tag.
Objekte am selben Ort teilen den Eintrag; ein Eintrag wird neu geholt, wenn
`geholt_am` älter als `CACHE_STUNDEN` ist. Vergangene Tage stehen im Cache und
werden nicht neu geholt — Open-Meteo liefert für sie ohnehin nur begrenzt.

Ausfall: `{}` und `log.warning`. Ein Wetterausfall darf den Dienstplan nicht
kippen (Wurzel 5, Nebenpfad) — aber er bleibt LAUT im Log, statt still eine
leere Zeile zu zeigen.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import httpx
from supabase import Client

from src.core.logging import get_logger

from ._base import als_dt, als_float, jetzt
from .schemas import WetterTag

log = get_logger("nextdays.personal.wetter")

HOST = "https://api.open-meteo.com"
PFAD = "/v1/forecast"
TIMEOUT_S = 5.0
CACHE_STUNDEN = 6
# Open-Meteo liefert 16 Tage Vorhersage; ein Plan-Fenster ist höchstens 42 Tage,
# der Rest bleibt ohne Wetter (kein erfundener Wert).
MAX_TAGE = 42
_TAEGLICH = "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum"


def runden(wert: float) -> float:
    """Koordinate auf zwei Stellen — der Cache-Schlüssel der Migration 0544."""
    return float(Decimal(str(wert)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _cache_lesen(
    db: Client, lat: float, lng: float, von: date, bis: date
) -> dict[date, dict[str, Any]]:
    rows = (
        db.table("wetter_tage")
        .select("datum, temp_min, temp_max, code, niederschlag_mm, geholt_am")
        .eq("lat", lat)
        .eq("lng", lng)
        .gte("datum", von.isoformat())
        .lte("datum", bis.isoformat())
        .execute()
    ).data or []
    aus: dict[date, dict[str, Any]] = {}
    for r in rows:
        tag = r.get("datum")
        schluessel = date.fromisoformat(str(tag)[:10]) if tag else None
        if schluessel is not None:
            aus[schluessel] = r
    return aus


def _frisch(row: dict[str, Any]) -> bool:
    geholt = als_dt(row.get("geholt_am"))
    if geholt is None:
        return False
    return (jetzt() - geholt) < timedelta(hours=CACHE_STUNDEN)


def _holen(lat: float, lng: float, von: date, bis: date, zeitzone: str) -> list[dict[str, Any]]:
    """Ein Aufruf gegen Open-Meteo; wirft bei Netz-/Formatfehlern."""
    antwort = httpx.get(
        f"{HOST}{PFAD}",
        params={
            "latitude": lat,
            "longitude": lng,
            "daily": _TAEGLICH,
            "timezone": zeitzone,
            "start_date": von.isoformat(),
            "end_date": bis.isoformat(),
        },
        timeout=TIMEOUT_S,
    )
    antwort.raise_for_status()
    daten = antwort.json().get("daily") or {}
    tage = daten.get("time") or []
    aus: list[dict[str, Any]] = []
    for i, tag in enumerate(tage):
        aus.append(
            {
                "datum": str(tag)[:10],
                "code": _wert(daten.get("weathercode"), i),
                "temp_max": _wert(daten.get("temperature_2m_max"), i),
                "temp_min": _wert(daten.get("temperature_2m_min"), i),
                "niederschlag_mm": _wert(daten.get("precipitation_sum"), i),
            }
        )
    return aus


def _wert(liste: object, i: int) -> float | None:
    if isinstance(liste, list) and i < len(liste):
        return als_float(liste[i])
    return None


def _schreiben(db: Client, lat: float, lng: float, rows: list[dict[str, Any]]) -> None:
    """Cache füllen — je Koordinate/Tag genau eine Zeile (UNIQUE aus 0544).

    `upsert` statt `insert`: der Lauf ist retrybar und läuft parallel für
    mehrere Betriebe am selben Ort (Wurzel 2).
    """
    if not rows:
        return
    db.table("wetter_tage").upsert(
        [
            {
                "lat": lat,
                "lng": lng,
                "datum": r["datum"],
                "temp_min": r.get("temp_min"),
                "temp_max": r.get("temp_max"),
                "code": int(r["code"]) if r.get("code") is not None else None,
                "niederschlag_mm": r.get("niederschlag_mm"),
                "quelle": "open-meteo",
                "geholt_am": jetzt().isoformat(),
            }
            for r in rows
        ],
        on_conflict="lat,lng,datum",
    ).execute()


def _als_tag(row: dict[str, Any]) -> WetterTag:
    return WetterTag(
        temp_min=als_float(row.get("temp_min")),
        temp_max=als_float(row.get("temp_max")),
        code=int(row["code"]) if row.get("code") is not None else None,
        niederschlag_mm=als_float(row.get("niederschlag_mm")),
    )


def vorhersage(
    db: Client, *, lat: float | None, lng: float | None, von: date, bis: date, zeitzone: str
) -> dict[str, WetterTag]:
    """Vorhersage je Tag im Fenster; `{}` ohne Koordinate oder bei Ausfall.

    Ohne Koordinate gibt es kein Wetter — kein „irgendein Ort" (Wurzel 4).
    """
    if lat is None or lng is None:
        return {}
    if (bis - von).days > MAX_TAGE:
        bis = von + timedelta(days=MAX_TAGE)
    lat_r, lng_r = runden(lat), runden(lng)
    try:
        cache = _cache_lesen(db, lat_r, lng_r, von, bis)
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, der Plan lebt weiter
        log.warning("personal_wetter_cache_fehler", error=str(exc)[:200])
        cache = {}
    fehlt = [
        tag
        for tag in _tage(von, bis)
        if tag not in cache or not _frisch(cache[tag])
    ]
    if fehlt:
        try:
            neu = _holen(lat_r, lng_r, min(fehlt), max(fehlt), zeitzone)
            _schreiben(db, lat_r, lng_r, neu)
            for r in neu:
                cache[date.fromisoformat(r["datum"])] = r
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            # Netz weg, Antwort unerwartet, Cache nicht schreibbar: der Plan
            # zeigt kein Wetter, sagt es aber im Log.
            log.warning(
                "personal_wetter_abruf_fehler",
                lat=lat_r,
                lng=lng_r,
                tage=len(fehlt),
                error=str(exc)[:200],
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad
            log.warning("personal_wetter_unerwartet", error=str(exc)[:200])
    return {
        tag.isoformat(): _als_tag(cache[tag])
        for tag in _tage(von, bis)
        if tag in cache
    }


def _tage(von: date, bis: date) -> list[date]:
    aus: list[date] = []
    tag = von
    while tag <= bis:
        aus.append(tag)
        tag += timedelta(days=1)
    return aus
