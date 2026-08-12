"""Airbnb-Zugangsdaten (WLAN, Anfahrt, Check-in-Art) in ihre Zielfelder.

Aus `airbnb_objekt_abruf.py` herausgelöst: die Datei stand an der
pylint-Grenze (`too-many-lines`, 1500). Der Block ist in sich geschlossen —
eine Listing-Antwort herein, Werte in ihre jeweilige Heimat hinaus.

Die Leitregel steht in `zugang_uebernehmen`: JEDER Wert geht dorthin, wo sein
Leser ihn sucht. Ein Import, der irgendwohin schreibt, ist eine Attrappe — die
Daten sind da, und die Oberfläche bleibt leer.
"""
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from . import airbnb_listing_import as ali

log = get_logger("nextdays.channel_manager")

# Klartext-Felder der Listing-Antwort → Zielfeld in `type_attributes.messaging`.
# Beide Ziele sind JE SPRACHE gepflegt (`{de: …, en: …}`).
_TEXTFELDER: tuple[tuple[str, str], ...] = (
    ("anfahrt", "directions"),
    ("checkInHinweis", "checkIn"),
)

# Werte ohne Sprachbezug, die direkt in `type_attributes` gehören.
_EINFACHE_FELDER: tuple[tuple[str, str], ...] = (
    ("checkInArt", "checkInArt"),
    ("wohnungszusatz", "apt"),
)


def zugang_uebernehmen(
    db: Client, property_id: str, listing: dict[str, Any],
    alt: dict[str, Any], neu: dict[str, Any], gesetzt: list[str],
) -> None:
    """WLAN, Anfahrt, Check-in-Art — die Anreise-Infos für den Gast.

    Zwei Fehler waren hier live nachweisbar (Objekt „Fewo-Mosbjerg-Sindal",
    11.08.2026):

    * WLAN landete als `messaging.wifiName`/`messaging.wifiPassword` in
      `type_attributes`. Diese Schlüssel kennt NIEMAND: der Vorlagen-Leser liest
      `property_guest_portal.wifi_ssid/wifi_password` (0296), die Maske kennt nur
      die acht `MESSAGING_FIELDS`. Der Netzname stand also in der DB, und
      `{{wifi_ssid}}` blieb leer — die Anreise-Automail scheiterte an einem Wert,
      den Airbnb längst geliefert hatte. Deshalb gehen die beiden Werte jetzt in
      ihre echte Heimat, die strukturierten Spalten.
    * Anfahrt und Check-in-Hinweis wurden als NACKTER String unter
      `messaging.directions`/`messaging.checkIn` abgelegt — diese Felder sind
      aber je Sprache gepflegt. Beide Leser überspringen einen String
      (`isinstance(werte, dict)`), die Maske zeigte den Text also nicht, und ihr
      nächstes Speichern hätte ihn gelöscht (sie schreibt den ganzen Block neu).
      Die Sprache kommt aus `descriptions.locale` derselben Antwort; fehlt sie,
      wird NICHT geschrieben statt eine Sprache zu erfinden (Wurzel 4).
    """
    zugang = ali.zugangsdaten_uebernehmen(listing)
    if not zugang:
        return
    _wlan_in_gastportal(db, property_id, zugang)

    messaging = {
        k: (dict(v) if isinstance(v, dict) else v)
        for k, v in (alt.get("messaging") or {}).items()
    }
    vorher = {
        k: (dict(v) if isinstance(v, dict) else v) for k, v in messaging.items()
    }
    sprache = _sprache_der_antwort(listing)
    if sprache:
        for quelle, ziel in _TEXTFELDER:
            wert = zugang.get(quelle)
            if not wert:
                continue
            feld = messaging.get(ziel)
            feld = dict(feld) if isinstance(feld, dict) else {}
            # Nur eine LEERE Sprache füllen (Wurzel 1): was der Betrieb selbst
            # geschrieben hat, gehört ihm.
            if not str(feld.get(sprache) or "").strip():
                feld[sprache] = wert
                messaging[ziel] = feld
    if messaging != vorher:
        neu["messaging"] = messaging
        gesetzt.append("messaging")

    for quelle, ziel in _EINFACHE_FELDER:
        wert = zugang.get(quelle)
        if wert and not alt.get(ziel):
            neu[ziel] = wert
            gesetzt.append(ziel)


def _sprache_der_antwort(listing: dict[str, Any]) -> str:
    """Sprache der Klartext-Felder dieser Listing-Antwort (`descriptions.locale`).

    Leerer String, wenn Airbnb sie nicht mitschickt — dann bleibt der Text
    ungeschrieben, statt in einer geratenen Sprache zu landen."""
    beschreibungen = listing.get("descriptions")
    if not isinstance(beschreibungen, dict):
        return ""
    return str(beschreibungen.get("locale") or "").strip().lower()


def _wlan_in_gastportal(
    db: Client, property_id: str, zugang: dict[str, Any]
) -> None:
    """Netz und Passwort in `property_guest_portal` (0296) — die Heimat von
    `{{wifi_ssid}}`/`{{wifi_password}}` und des WLAN-QR-Codes im Gastportal.

    Nur was dort LEER ist, wird gesetzt (Wurzel 1): ein vom Betrieb gepflegter
    Zugang ist der gültige, der Airbnb-Stand kann älter sein.
    """
    netz = zugang.get("wlanName")
    passwort = zugang.get("wlanPasswort")
    if not (netz or passwort):
        return
    rows = (
        db.table("property_guest_portal")
        .select("id, wifi_ssid, wifi_password")
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    stand = rows[0] if rows else {}
    patch: dict[str, Any] = {}
    if netz and not str(stand.get("wifi_ssid") or "").strip():
        patch["wifi_ssid"] = netz
    if passwort and not str(stand.get("wifi_password") or "").strip():
        patch["wifi_password"] = passwort
    if not patch:
        return
    db.table("property_guest_portal").upsert(
        {"property_id": property_id, **patch}, on_conflict="property_id"
    ).execute()
    log.info(
        "airbnb_wlan_uebernommen", property_id=property_id, felder=sorted(patch)
    )
