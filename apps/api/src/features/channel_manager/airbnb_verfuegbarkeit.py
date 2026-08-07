"""Verfügbarkeits-Formular → Airbnb-Listing-Settings (die Gegenrichtung).

Drei Einstellungen des Formulars haben bei Channex KEIN ARI-Restriktionsfeld
und gehen deshalb über Airbnbs eigenen Endpunkt
`channels/{id}/mappings/{id}/availability_settings` (live verifiziert
06.08.2026, `type: airbnb_listing_availability_settings`):

    preparationDays    → turnover_days      (Tage Puffer, nur 0|1|2)
    bookingWindowDays  → max_days_notice    (Tage im Voraus, feste Stufen)
    advanceNotice      → booking_lead_time  (STUNDEN Vorlauf, feste Stufen)

Dazu kommen Mindest-/Maximalaufenthalt, die zusätzlich hier landen — Airbnb
führt sie am Listing, nicht nur als ARI-Restriktion.

Die Umkehrung von `airbnb_listing_import.verfuegbarkeit_uebernehmen` /
`airbnb_objekt_abruf._availability_spiegeln`, die dieselben Felder von Airbnb
zu uns holen. Beide Richtungen benutzen dieselben Wertetabellen, damit ein
Hin- und Rückweg denselben Wert ergibt.

KEIN erfundener Zwischenwert (Wurzel 4): Airbnb akzeptiert nur die
aufgezählten Stufen. Passt ein Formularwert auf keine, wird das Feld NICHT
gesendet — lieber der alte Stand bei Airbnb als ein stillschweigend
verbogener.

Wochentage (`unavailableCheckIn`/`-CheckOut` → `day_of_week_check_in`/`_out`)
sind bewusst NICHT dabei. Die beiden Quellen im Repo widersprechen sich in der
Indexbasis: `Availability Settings.pdf` sagt „starting from Sunday", das
Schema `Airbnb.ListingSettings.AvailabilitySettings.yaml` sagt „starting with
Monday" — dasselbe Feld. Alle 18 verbundenen Listings stehen live auf
`[true]*7`, womit sich der Widerspruch nicht durch Lesen auflösen lässt, und
ein Schreibtest gegen das Konto des Beta-Betriebs ist ein Eingriff in den
Verkauf. Ein um einen Tag verschobener Sperrtag wäre ein Fehler, den niemand
als solchen erkennt (er sieht ja plausibel aus). Die Wochentagssperren gehen
deshalb über den ARI-Weg (`closed_to_arrival`/`closed_to_departure` mit
Channex' `days`-Feld, dessen Mo=0-Basis im Code belegt ist).
"""

from __future__ import annotations

from typing import Any, Final

# Airbnbs erlaubte Stufen. Bewusst aus dem LESE-Modul übernommen statt hier
# ein zweites Mal hingeschrieben: zwei Allowlists desselben Enums driften
# auseinander, und dann nimmt der Import einen Wert an, den der Export wieder
# verwirft (oder umgekehrt).
from .airbnb_listing_import import (
    VORAUSBUCHUNG_TAGE,
    VORLAUF_STUNDEN,
    WECHSELTAGE,
)

NAECHTE_MAX: Final[int] = 1125

# `advanceNotice` des Formulars (ADVANCE_NOTICE_OPTIONS in
# web/lib/availability-meta.ts) → Airbnb-Vorlauf in STUNDEN. Exakt die
# Umkehrung der Tabelle in airbnb_objekt_abruf._availability_spiegeln.
_VORLAUF_AUS_OPTION: Final[dict[str, int]] = {
    "00:00": 0,
    "12:00": 12,
    "18:00": 18,
    "24h": 24,
    "48h": 48,
    "72h": 72,
    "168h": 168,
}

# Die Gegenrichtung (Airbnb → Maske). Getrennt gehalten und im Test gegen
# `_VORLAUF_AUS_OPTION` gespiegelt: eine Tabelle, die nur in eine Richtung
# stimmt, verschiebt bei jedem Import-Export-Rundlauf die Einstellung des
# Betriebs — ein Fehler, den niemand als solchen erkennt.
VORLAUF_ZU_OPTION: Final[dict[int, str]] = {
    stunden: option for option, stunden in _VORLAUF_AUS_OPTION.items()
}


def _je_kanal_wert(feld: object, kanal: str = "airbnb") -> object:
    """Aus einem `PerChannel`-Feld den für Airbnb geltenden Wert ziehen.

    Das Formular führt Vorbereitungszeit/Buchungsfenster/Vorlaufzeit entweder
    global oder je Kanal (`{custom, global, channels}`). Ist `custom` gesetzt,
    zählt der Airbnb-Wert, sonst der globale. Ein blanker Skalar (Altbestand
    vor der PerChannel-Umstellung) wird unverändert durchgereicht.
    """
    if not isinstance(feld, dict):
        return feld
    if feld.get("custom"):
        kanaele = feld.get("channels")
        if isinstance(kanaele, dict) and kanal in kanaele:
            return kanaele[kanal]
    return feld.get("global")


def _ganzzahl(wert: object) -> int | None:
    """Einen Wert als int lesen; None wenn nicht ganzzahlig. `bool` ist in
    Python ein `int` und wird ausgeschlossen."""
    if isinstance(wert, bool) or not isinstance(wert, (int, float)):
        return None
    try:
        return int(wert)
    except (TypeError, ValueError):
        return None


def airbnb_settings_aus_formular(av: dict[str, Any]) -> dict[str, Any]:
    """Die Airbnb-Felder aus `type_attributes.availability` bauen.

    Rückgabe enthält NUR Felder, deren Formularwert auf eine von Airbnb
    erlaubte Stufe fällt. Leeres dict = nichts zu schreiben.
    """
    out: dict[str, Any] = {}

    wechsel = _ganzzahl(_je_kanal_wert(av.get("preparationDays")))
    if wechsel in WECHSELTAGE:
        out["turnover_days"] = wechsel

    voraus = _ganzzahl(_je_kanal_wert(av.get("bookingWindowDays")))
    if voraus in VORAUSBUCHUNG_TAGE:
        out["max_days_notice"] = voraus

    vorlauf_option = _je_kanal_wert(av.get("advanceNotice"))
    if isinstance(vorlauf_option, str):
        stunden = _VORLAUF_AUS_OPTION.get(vorlauf_option)
        if stunden in VORLAUF_STUNDEN:
            out["booking_lead_time"] = stunden

    min_naechte = _ganzzahl(av.get("minStay"))
    if min_naechte is not None and 1 <= min_naechte <= NAECHTE_MAX:
        out["default_min_nights"] = min_naechte

    max_naechte = _ganzzahl(av.get("maxStay"))
    if max_naechte is not None and 1 <= max_naechte <= NAECHTE_MAX:
        out["default_max_nights"] = max_naechte

    return out


def zusammenfuehren(
    bestand: dict[str, Any], neu: dict[str, Any]
) -> dict[str, Any] | None:
    """Den gelesenen Airbnb-Stand mit unseren Feldern überschreiben.

    Der PUT ersetzt das ganze Objekt, deshalb ist der GET-Stand die Grundlage
    und nur unsere Felder werden getauscht (Wurzel 1) — sonst fielen
    `day_of_week_*`, `allow_rtb_*` und `seasonal_min_nights` auf Airbnbs
    Vorgabe zurück.

    Rückgabe None, wenn sich nichts ändert: dann gar nicht erst schreiben (kein
    Aufruf gegen ein Live-Konto ohne Anlass).
    """
    if not neu:
        return None
    zusammen = {**bestand, **neu}
    # Nur Felder senden, die der Endpunkt kennt — Fremdfelder aus der
    # GET-Antwort (`id`, `type`) haben im Payload nichts verloren.
    zusammen.pop("id", None)
    zusammen.pop("type", None)
    if zusammen == bestand:
        return None
    return zusammen
