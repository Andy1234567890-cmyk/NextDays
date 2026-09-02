"""USt-IdNr. gegen das VIES der EU-Kommission prüfen.

Endpunkt (öffentlich, ohne Schlüssel):
    GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{nummer}
Antwort: `{"isValid": true|false, "userError": "VALID"|"INVALID"|…, "name", …}`.

Drei Ausgänge, bewusst getrennt (Wurzel 5): gültig, ungültig, NICHT PRÜFBAR.
VIES ist regelmäßig nicht erreichbar (nationale Backends fallen aus). Ein
Ausfall ist keine Ablehnung — er wird als `None` zurückgegeben; der Aufrufer
speichert die Nummer dann ohne Bestätigung und die Auszahlung bleibt so lange
gesperrt (fail-closed), bis eine spätere Prüfung sie bestätigt.
"""

from __future__ import annotations

import httpx

from src.core.logging import get_logger

log = get_logger("nextdays.affiliates.vies")

BASIS = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms"
_TIMEOUT = 8.0


def pruefen(vat_id: str) -> bool | None:
    """True = gültig, False = ungültig, None = VIES nicht erreichbar/auswertbar."""
    nummer = "".join(ch for ch in vat_id.upper() if ch.isalnum())
    if len(nummer) < 4 or not nummer[:2].isalpha():
        return False
    land, rest = nummer[:2], nummer[2:]
    # Griechenland führt im VIES „EL", nicht „GR".
    if land == "GR":
        land = "EL"
    daten = _abfragen(f"{BASIS}/{land}/vat/{rest}")
    if daten is None:
        return None
    return _auswerten(daten)


def _abfragen(url: str) -> dict | None:
    try:
        antwort = httpx.get(url, timeout=_TIMEOUT, headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        log.warning("vies_nicht_erreichbar", error=str(exc)[:200])
        return None
    if antwort.status_code != 200:
        log.warning("vies_antwort_unerwartet", status=antwort.status_code)
        return None
    try:
        daten = antwort.json()
    except ValueError:
        log.warning("vies_antwort_kein_json")
        return None
    return daten if isinstance(daten, dict) else None


def _auswerten(daten: dict) -> bool | None:
    gueltig = daten.get("isValid")
    if isinstance(gueltig, bool):
        return gueltig
    fehler = str(daten.get("userError") or "")
    if fehler in ("VALID", "INVALID"):
        return fehler == "VALID"
    # MS_UNAVAILABLE, TIMEOUT, GLOBAL_MAX_CONCURRENT_REQ … → nicht prüfbar.
    log.warning("vies_nicht_auswertbar", user_error=fehler[:60])
    return None
