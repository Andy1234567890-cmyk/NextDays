"""Bundesland/Region aus den Koordinaten bestimmen — weil sie NIRGENDS geliefert wird.

WARUM DIESES MODUL EXISTIERT (gemessen 05.08.2026, Konto AirSmil):
Das Standort-Formular verlangt „Bundesland / Region" als Pflichtfeld, aber keine
unserer Quellen liefert es:

    Airbnb  `GET v2/listings/{id}`             200, 35 Felder — KEIN state/region.
            Vier Formate geprüft (`v1_legacy_long`, `host_summary`,
            `for_mobile_host`, `v1_legacy_for_p3`): identisch 35 Felder, kein
            Regionsfeld. `v2/listing_addresses` → 404.
            `v2/listing_descriptions/{id}/de` → 200, 11578 B, kein Regionswort.
    Channex `GET /properties` → `state: None`. Das FELD existiert dort, ist aber
            leer, weil niemand es füllt.

Kontrolltest: `v2/erfundene_kontrolle_zzz` → 404 `route_not_found`. Die 200er
oben sind also echte Antworten und keine Attrappe.

Lodgify zeigt für dasselbe Objekt „North Denmark Region". Das kommt NICHT von
Airbnb — es ist rückwärts geokodiert. Live gegengeprüft:

    GET maps.googleapis.com/maps/api/geocode/json
        ?latlng=57.44,10.05&result_type=administrative_area_level_1&language=en
    → 200 `status: OK`, „North Denmark Region, Denmark"

Genau derselbe Wert. Deshalb ist Geokodierung hier die Quelle, nicht ein
Ersatzwert: die Koordinaten kommen echt von Airbnb (`lat`/`lng` im Listing), die
Region ist daraus abgeleitet — kein Rateweg, kein Fantasie-Default (Wurzel 4).
Ohne Schlüssel oder ohne Treffer bleibt das Feld LEER, statt irgendetwas
Plausibles hineinzuschreiben.
"""
from __future__ import annotations

import httpx

from src.core.config import get_settings

from .common import log

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Pflicht laut Messung: ohne `result_type` liefert Google die ganze Kette vom
# Haus bis zum Land, und die Region müsste man aus `address_components`
# heraussuchen. Mit dem Filter kommt genau die Verwaltungsebene 1.
_ADMIN_EBENE = "administrative_area_level_1"

_TIMEOUT = httpx.Timeout(15.0)


def _abfragen(
    schluessel: str, lat: float, lng: float, sprache: str
) -> dict | None:
    """Der eine HTTP-Aufruf. None = keine verwertbare Antwort."""
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.get(
                GEOCODE_URL,
                params={
                    "latlng": f"{lat},{lng}",
                    "result_type": _ADMIN_EBENE,
                    "language": sprache,
                    "key": schluessel,
                },
            )
    except httpx.HTTPError as exc:
        log.warning("region_geokodierung_netzfehler", error=str(exc)[:200])
        return None
    if antwort.status_code != 200:
        log.info("region_geokodierung_kein_200", status=antwort.status_code)
        return None
    try:
        return antwort.json()
    except ValueError:
        log.warning("region_geokodierung_kein_json")
        return None


def region_aus_koordinaten(
    lat: float | None, lng: float | None, sprache: str = "en"
) -> str | None:
    """„North Denmark Region" aus 57.44/10.05. None = nicht bestimmbar.

    Best effort: ohne Schlüssel, ohne Netz oder ohne Treffer gibt es kein
    Ergebnis — und dann bleibt das Feld leer. Ein falsches Bundesland wäre
    schlimmer als ein leeres (Wurzel 4).

    Die Sprache steht auf Englisch, weil dieselbe Region sonst je nach
    Oberflächensprache anders heißt („Region Nordjylland" / „North Denmark
    Region") und die Portale einen stabilen Wert brauchen.
    """
    schluessel = get_settings().google_maps_api_key.get_secret_value()
    if not schluessel or lat is None or lng is None:
        return None
    daten = _abfragen(schluessel, lat, lng, sprache)
    if daten is None:
        return None

    # `ZERO_RESULTS` ist kein Fehler, sondern „hier gibt es keine
    # Verwaltungsebene 1" (kommt bei Stadtstaaten vor). Alles andere ist eins
    # und wird protokolliert, damit ein abgelaufener Schlüssel auffällt.
    status = daten.get("status")
    if status != "OK":
        if status != "ZERO_RESULTS":
            log.warning(
                "region_geokodierung_status",
                status=status, meldung=str(daten.get("error_message") or "")[:200],
            )
        return None

    for treffer in daten.get("results") or []:
        for teil in treffer.get("address_components") or []:
            if _ADMIN_EBENE in (teil.get("types") or []):
                name = (teil.get("long_name") or "").strip()
                if name:
                    return name
    return None
