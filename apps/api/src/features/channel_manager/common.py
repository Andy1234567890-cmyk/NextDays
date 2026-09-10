"""Geteilte Modul-Helfer des channel_manager-Slices.

Logger, Wochentags-/Zeitzonen-/Property-Type-Konstanten und die
Slice-Exception. Patch-Ziel für Tests, die Modul-Helfer ersetzen wollen
(NICHT channel_manager.service — die Mixins binden die Namen von hier).
"""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from src.core.logging import get_logger

log = get_logger("nextdays.channel_manager")

# Der EINE Wortlaut fuer „kein Preisplan". Er steht an zwei Stellen im Server
# (content_sync beim Registrieren, prepare_channel VOR dem Zuordnen) und der
# Verbinden-Assistent erkennt ihn am Text (`istPreisFehler` prueft den Kern
# „kein preisplan vorhanden"), um statt einer Sackgasse das Preisfeld zu
# zeigen. Zwei Kopien des Satzes waeren zwei Wahrheiten: eine umformulierte
# Kopie faellt im Assistenten still in die generische Fehlermeldung zurueck.
KEIN_PREISPLAN_MELDUNG = (
    "Kein Preisplan vorhanden — die Unterkunft kann ohne Preis nicht "
    "an die Buchungsportale übermittelt werden."
)

_UUID_MUSTER = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def nur_uuids(ids: object) -> list[str]:
    """Nur echte UUIDs behalten — sortiert.

    Der Demo-Seed legt Portal-Zuordnungen mit synthetischen IDs an
    (``demo-0bca947c-…``). Channex prüft `filter[property_id]` strikt und lehnt
    bei EINEM ungültigen Wert den GANZEN Request mit 422 `filter is_invalid` ab —
    dann kommt keine einzige Zeile mehr durch (live beobachtet). Also
    aussortieren, statt Müll zu senden; die Tenant-Zuordnung passiert ohnehin
    lokal.
    """
    if not isinstance(ids, list | set | tuple | dict):
        return []
    return sorted(
        str(i) for i in ids if _UUID_MUSTER.fullmatch(str(i or "")) is not None
    )

_WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"]

# Länder mit MEHR ALS EINER Zeitzone in ihrem eigenen Ländercode. Für sie darf die
# Zone NIE aus dem Land abgeleitet und GESPEICHERT werden — ein Objekt auf
# Teneriffa liegt in Atlantic/Canary, nicht in Europe/Madrid, und eine still
# falsch gespeicherte Zone verschiebt jede Automation um eine Stunde (Migration
# 0258 nennt genau das als Grund, die Spalte NULL zu lassen).
#   ES: Europe/Madrid + Atlantic/Canary (Kanaren)
#   PT: Europe/Lisbon + Atlantic/Madeira + Atlantic/Azores
#   FR: Europe/Paris + Überseegebiete unter FR (Guadeloupe, Réunion, …)
#   NL: Europe/Amsterdam + America/Curacao (Karibische Niederlande)
# NICHT dabei ist DK: Grönland und die Färöer haben eigene Ländercodes (GL, FO),
# das dänische Festland hat genau eine Zone.
_MEHRZONIGE_LAENDER = frozenset({"ES", "PT", "FR", "NL", "US", "CA", "RU", "AU", "BR"})

# Haupt-IANA-Zeitzone je Land (DACH+EU+CH). Channex verlangt eine Zeitzone an der
# Property; spiegelt das Frontend-Mapping in apps/web/lib/laender.ts.
_TIMEZONE_BY_COUNTRY: dict[str, str] = {
    "DE": "Europe/Berlin", "AT": "Europe/Vienna", "CH": "Europe/Zurich",
    "BE": "Europe/Brussels", "BG": "Europe/Sofia", "HR": "Europe/Zagreb",
    "CY": "Asia/Nicosia", "CZ": "Europe/Prague", "DK": "Europe/Copenhagen",
    "EE": "Europe/Tallinn", "FI": "Europe/Helsinki", "FR": "Europe/Paris",
    "GR": "Europe/Athens", "HU": "Europe/Budapest", "IE": "Europe/Dublin",
    "IT": "Europe/Rome", "LV": "Europe/Riga", "LT": "Europe/Vilnius",
    "LU": "Europe/Luxembourg", "MT": "Europe/Malta", "NL": "Europe/Amsterdam",
    "PL": "Europe/Warsaw", "PT": "Europe/Lisbon", "RO": "Europe/Bucharest",
    "SK": "Europe/Bratislava", "SI": "Europe/Ljubljana", "ES": "Europe/Madrid",
    "SE": "Europe/Stockholm",
}


def _timezone_for_country(code: str) -> str | None:
    """IANA-Zeitzone für ein Land — None, wenn unbekannt (kein Fallback erfinden).

    Für den PUSH an Channex: Channex verlangt eine Zone, sonst verweigert es die
    Aktivierung. Die Hauptzone des Landes ist dort die beste verfügbare Angabe.
    Zum SPEICHERN in `properties.timezone` ist das zu grob — dafür
    `_timezone_speicherbar`, das mehrzonige Länder ablehnt.
    """
    return _TIMEZONE_BY_COUNTRY.get(code.upper())


def _timezone_speicherbar(code: str | None) -> str | None:
    """Zeitzone, die sich aus dem Land WIRKLICH ableiten lässt — sonst None.

    Unterschied zu `_timezone_for_country`: hier wird der Wert dauerhaft an das
    Objekt geschrieben, also darf er nicht bloß plausibel sein. Bei mehrzonigen
    Ländern (Spanien mit den Kanaren, Portugal mit Madeira/Azoren) bleibt die
    Spalte NULL und der Kunde setzt sie selbst — genau wie Migration 0258 es
    vorschreibt. Für Dänemark, Deutschland, Italien & Co. ist die Zone eindeutig
    und wird gesetzt.
    """
    if not code:
        return None
    land = code.upper()
    if land in _MEHRZONIGE_LAENDER:
        return None
    return _TIMEZONE_BY_COUNTRY.get(land)


# Landeswährung je Land (ISO 4217). Für die Airbnb-Übernahme: das Listing liefert
# `country_code`, aber keine Währung — und ohne Währung lässt sich kein Preisplan
# anlegen (`rate_plans.currency` NOT NULL). Das ist KEIN erfundener Ersatzwert im
# Sinne von Wurzel 4: die gesetzliche Landeswährung ist eine Tatsache, kein
# geratener Default (Dänemark rechnet in DKK, nicht in Euro). Unbekanntes Land →
# None → der Aufrufer muss fehlschlagen, statt „EUR" zu unterstellen.
# Die sieben EU-Länder ohne Euro sind der eigentliche Grund für diese Karte.
_CURRENCY_BY_COUNTRY: dict[str, str] = {
    # Nicht-Euro-Länder — hier ist ein €-Fallback schlicht falsch.
    "DK": "DKK", "SE": "SEK", "PL": "PLN", "CZ": "CZK", "HU": "HUF",
    "RO": "RON", "BG": "BGN", "CH": "CHF", "NO": "NOK", "GB": "GBP",
    "IS": "ISK",
    # Eurozone.
    "DE": "EUR", "AT": "EUR", "BE": "EUR", "CY": "EUR", "EE": "EUR",
    "ES": "EUR", "FI": "EUR", "FR": "EUR", "GR": "EUR", "HR": "EUR",
    "IE": "EUR", "IT": "EUR", "LT": "EUR", "LU": "EUR", "LV": "EUR",
    "MT": "EUR", "NL": "EUR", "PT": "EUR", "SI": "EUR", "SK": "EUR",
}


def _currency_for_country(code: str | None) -> str | None:
    """Landeswährung (ISO 4217) für ein Land — None, wenn unbekannt.

    None ist Absicht: der Aufrufer muss dann klar fehlschlagen (422), statt eine
    plausible Währung zu erfinden. Ein falsches „EUR" auf einem dänischen Objekt
    verkauft eine 1200-DKK-Nacht für 1200 € (Wurzel 4)."""
    if not code:
        return None
    return _CURRENCY_BY_COUNTRY.get(code.upper())


# Lokaler property_type-Enum (public.property_type, Migration 0009) → gültiger
# Channex-Code. Channex akzeptiert NUR seine 23 festen Codes; unser deutscher
# Wert (z. B. "appartement") führt sonst zu 422 "property_type is invalid" und
# blockiert das Veröffentlichen. Mapping verifiziert gegen die Channex-Doku.
_CHANNEX_PROPERTY_TYPE: dict[str, str] = {
    "ferienhaus": "holiday_home",
    "appartement": "apartment",
    "glamping": "tent",
    "tiny_house": "chalet",
    "stellplatz": "camping",
    "hausboot": "boat",
    # Hotel-Zimmertypen (0098): das Objekt ist ein Zimmer eines Hotels →
    # Channex-Property-Typ "hotel" (Room-Types entstehen ohnehin synthetisch
    # pro Objekt, siehe PMS-Mapping).
    "einzelzimmer": "hotel",
    "doppelzimmer": "hotel",
    "zweibettzimmer": "hotel",
    "familienzimmer": "hotel",
    "junior_suite": "hotel",
    "suite": "hotel",
}


def _channex_property_type(local: str | None) -> str | None:
    """Lokalen property_type auf einen gültigen Channex-Code abbilden. Unbekannt
    → None (Feld weglassen statt einen ungültigen Wert senden — property_type ist
    für ARI/Buchung nicht erforderlich, ein 422 darf das Sync nicht kippen)."""
    if not local:
        return None
    return _CHANNEX_PROPERTY_TYPE.get(local.lower())


# Lokaler property_type-Enum → Booking.com BCRT-Zimmertyp (Code + Kürzel).
# Das obige _CHANNEX_PROPERTY_TYPE bildet die UNTERKUNFTSART ab (Channex-property-
# type: holiday_home/apartment/hotel/…). Der ZIMMERTYP (BCRT) ist eine andere
# Ebene: welche buchbare Einheit das Objekt bei Booking IST (Single/Double/Twin/
# Suite/…). Recherche-belegt (developers.booking.com/connectivity/docs/codes-bcrt,
# 3-fach verifiziert). Werte OHNE sinnvollen Zimmertyp (Stellplatz/Hausboot sind
# Unterkunftsarten, kein Zimmertyp) → None (kein Raten, [[keine-fallbacks]]).
_BOOKING_ROOM_TYPE: dict[str, tuple[int, str]] = {
    # Hotel-Zimmertypen
    "einzelzimmer": (10, "Single"),
    "doppelzimmer": (9, "Double"),
    "zweibettzimmer": (8, "Twin"),
    "familienzimmer": (13, "Family"),
    "junior_suite": (5, "Suite"),
    "suite": (5, "Suite"),
    # Ganze Einheiten (FeWo)
    "ferienhaus": (29, "Holiday home"),
    "appartement": (1, "Apartment"),
    "glamping": (33, "Tent"),
    "tiny_house": (28, "Chalet"),
    # hausboot/stellplatz: Unterkunftsart, KEIN BCRT-Zimmertyp → bewusst None.
}


def _booking_room_type(local: str | None) -> tuple[int, str] | None:
    """Lokalen property_type auf den Booking-BCRT-Zimmertyp (Code, Name) abbilden.
    Unbekannt/ohne Entsprechung → None (kein erfundener Zimmertyp)."""
    if not local:
        return None
    return _BOOKING_ROOM_TYPE.get(local.lower())


# Booking.com Unterkunftsart (PCT-Code) → gültiger Channex-property_type-Code.
# Booking hat 26 aktive PCT-Codes (developers.booking.com/…/codes-pct), Channex
# 22 property_type-Codes (docs.channex.io/…/hotels-collection). Die meisten
# entsprechen 1:1; wo Channex keinen eigenen Code hat, auf den nächstpassenden
# abbilden (belegt gegengeprüft). Kein Code ohne sinnvolle Entsprechung → None
# (Feld weglassen, kein 422; Wurzel 4/5). Channex-Codes 3-fach verifiziert.
_PCT_TO_CHANNEX: dict[int, str] = {
    20: "hotel",            # Hotel
    19: "hostel",           # Hostel
    3: "apartment",         # Apartment
    4: "guest_house",       # Bed and Breakfast → guest_house (kein B&B-Code)
    40: "guest_house",      # Pension/Guest House
    6: "camping",           # Campground/Camping
    7: "chalet",            # Chalet
    12: "boat",             # Cruise/Boat
    15: "farm_stay",        # Guest farm/Farm stay
    21: "inn",              # Inn
    22: "lodge",            # Lodge
    27: "motel",            # Motel
    30: "resort",           # Resort
    33: "tent",             # Tent/Tented
    35: "villa",            # Villa
    5000: "apart_hotel",    # ApartHotel
    5001: "riad",           # Riad
    5002: "ryokan",         # Ryokan
    5003: "hotel",          # Love Hotel → hotel (kein eigener Channex-Code)
    5004: "homestay",       # Homestay
    5005: "hotel",          # Japanese-style Business Hotel → hotel
    5006: "holiday_home",   # Holiday Home
    5007: "country_house",  # Country house
    5008: "capsule_hotel",  # Capsule Hotel
    5009: "holiday_park",   # Holiday Park
    5010: "boat",           # Cruise Ship → boat
    # 5011 Student Accommodation: kein sinnvoller Channex-Typ → bewusst None.
}


def _channex_type_from_pct(pct_code: int | None) -> str | None:
    """Booking-PCT-Code auf einen gültigen Channex-property_type abbilden.
    Unbekannt/ohne Entsprechung → None (kein ungültiger Wert an Channex)."""
    if pct_code is None:
        return None
    return _PCT_TO_CHANNEX.get(int(pct_code))


# Die 22 gültigen Channex-property_type-Codes (docs.channex.io, 3-fach verifiziert).
# Der aus dem Immobilientyp (property_subtypes) gelesene Code wird hiergegen
# geprüft, damit ein Katalog-Fehler NIE einen ungültigen Wert an Channex schickt
# (422 „property_type is invalid" würde den Content-Sync kippen, Wurzel 5).
_VALID_CHANNEX_PROPERTY_TYPES: frozenset[str] = frozenset({
    "apart_hotel", "apartment", "boat", "camping", "capsule_hotel", "chalet",
    "country_house", "farm_stay", "guest_house", "holiday_home", "holiday_park",
    "homestay", "hostel", "hotel", "inn", "lodge", "motel", "resort", "riad",
    "ryokan", "tent", "villa",
})


def _channex_type_from_subtype(subtype: dict[str, Any] | None) -> str | None:
    """Channex-property_type aus dem eingebetteten Immobilientyp (property_subtypes)
    lesen (0198). Nur einen der 22 gültigen Codes durchlassen — sonst None (Feld
    weglassen statt 422). subtype kommt aus dem PostgREST-Embed (dict oder None)."""
    if not isinstance(subtype, dict):
        return None
    code = subtype.get("channex_property_type")
    if isinstance(code, str) and code in _VALID_CHANNEX_PROPERTY_TYPES:
        return code
    return None


# Gültige Werte für den Mindestaufenthalt-Typ (Channex-settings.min_stay_type,
# live verifiziert): "both" (Standard), "arrival" (nur bei Anreise) oder
# "through" (durchgehend). Alles andere wird ignoriert (kein 422 riskieren).
_MIN_STAY_TYPES = frozenset({"both", "arrival", "through"})
# HH:MM (optional :SS) 00:00–23:59 — Channex-cut_off_time; das Feld kommt aus
# unserem Select als "HH:MM", Channex gibt es mit Sekunden zurück ("18:00:00"),
# beide Formen dürfen durch (idempotent bei einem eventuellen Round-Trip).
_CUT_OFF_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")


def _availability_settings(av: dict[str, Any]) -> dict[str, Any]:
    """Verfügbarkeits-/Verkaufssteuerung aus type_attributes.availability in die
    Channex-property-`settings` übersetzen. Alle Keys 1:1 wie live in /properties
    gegengelesen. NUR gesetzte Werte übernehmen (keine erfundenen Defaults —
    [[keine-fallbacks]]); ungültige Eingaben stillschweigend weglassen, damit ein
    422 den Content-Sync nicht kippt.

    - cutOffTime  "HH:MM"  → cut_off_time   (Same-Day-Verkaufsstopp ab Uhrzeit)
    - cutOffDays  int ≥ 0  → cut_off_days    (Verkaufsstopp N Tage vor Anreise)
    - maxDayAdvance int ≥ 1 → max_day_advance (ferne Zukunft schließen)
    - minStayType "both|arrival|through" → min_stay_type
    - autoUpdateOnConfirmation/Modification/Cancellation bool →
      allow_availability_autoupdate_on_{confirmation,modification,cancellation}
    """
    out: dict[str, Any] = {}
    cut_time = av.get("cutOffTime")
    if isinstance(cut_time, str) and _CUT_OFF_TIME.match(cut_time.strip()):
        out["cut_off_time"] = cut_time.strip()
    cut_days = av.get("cutOffDays")
    if isinstance(cut_days, int) and not isinstance(cut_days, bool) and cut_days >= 0:
        out["cut_off_days"] = cut_days
    max_adv = av.get("maxDayAdvance")
    if isinstance(max_adv, int) and not isinstance(max_adv, bool) and max_adv >= 1:
        out["max_day_advance"] = max_adv
    mst = av.get("minStayType")
    if isinstance(mst, str) and mst in _MIN_STAY_TYPES:
        out["min_stay_type"] = mst
    # Availability-Autoupdate bei Channex FEST AUS (wir sind PMS = Availability-
    # Master): unser Kalender pusht nach jeder Buchung/Storno den ABSOLUTEN Wert
    # (0/1) an Channex. Ließe man Channex zusätzlich relativ nachziehen
    # (+1 bei Storno / −1 bei Bestätigung), entstünde reihenfolgeabhängig ein
    # Doppel-Dekrement (Einheit doppelt verkaufbar / phantom-belegt), weil
    # Channex ARI asynchron verarbeitet. on_confirmation ist bei Channex
    # read-only true; modification/cancellation pinnen wir hart auf false und
    # ignorieren die alten UI-Toggles bewusst (sie waren die Overbooking-Quelle).
    out["allow_availability_autoupdate_on_modification"] = False
    out["allow_availability_autoupdate_on_cancellation"] = False
    return out


# Channex-Facility-Katalog: lokaler Ausstattungs-Slug → Channex-Facility-UUID.
# Vollständiger Channex-property_facilities-Katalog (301, live abgerufen). Die
# Ausstattung im Objekt-Editor ist genau dieser Katalog; alle Einträge gehen
# über die Property.facilities an Channex → die OTAs. Unbekannt → weglassen.
#
# UUIDs am 13.08.2026 vollständig ERNEUERT (GET /property_facilities, paginiert):
# die bis dahin hinterlegten IDs waren ausnahmslos veraltet — 0 von 301 kamen im
# Live-Katalog noch vor. Channex quittiert unbekannte Facility-IDs mit HTTP 200
# und verwirft sie STILL: kein Objekt hatte dort Ausstattung, kein Log zeigte je
# einen Fehler. Aufgefallen erst beim Zurücklesen der Antwort
# (`relationships.facilities.data == []` trotz gesendeter Liste).
#
# Deshalb: Diese Tabelle ist ein Abzug eines FREMDEN Katalogs, kein stabiler
# Standard. Bei Zweifeln gegen `GET /property_facilities` gegenprüfen, statt dem
# 200 zu glauben — ein 200 ist kein Beweis, dass etwas ankam. Zugeordnet wird
# über den TITEL (nicht über die Position): 275 Slugs sind der normalisierte
# Titel, 26 (Covid-/Plastik-Merkmale von Booking.com) tragen im Katalog einen
# ganzen Satz und wurden einzeln geprüft.
_CHANNEX_FACILITY: dict[str, str] = {
    "24_hour_front_desk": "0cde9d7a-eb6d-447b-88e9-2114f073212e",
    "24_hour_security": "f4be53ab-0256-407e-a2c4-7b322a989874",
    "accessible_parking": "1e7200b9-8383-4f09-8f68-eefc755db21c",
    "access_to_health_care_professionals": "449130e5-1c23-458e-8097-77b31dc678f8",
    "ada_accessible": "445d08ee-4542-45bf-a1be-197c2dc354a1",
    "adult_only": "a3eacf0b-0603-470f-b6e6-76b5027cd916",
    "aerobics": "a8bb3337-d2bd-4922-aee1-24a9d9158b7f",
    "air_conditioning": "dbba65bd-b729-4a76-90a9-8d70fda1bb93",
    "airport_shuttle_free": "6eb2c097-4cf9-4951-ae93-9b559cc4f1b3",
    "airport_shuttle_srv_surcharge": "30d6e564-20c3-4c34-9241-cd9182b8fb0b",
    "airport_shuttle_surcharge": "c1875109-f1ee-475d-a56e-a8b88e823c4b",
    "tableware_sanitised": "72c9ff0c-7b24-4d85-83b0-b2ccaeef62c3",
    "all_non_smoking": "1e4db8cb-0755-47ff-a072-b62e41fe7196",
    "archery": "3c3ebd40-8e59-4473-b601-621568370982",
    "atm_on_site": "689fa519-3d6f-4525-a0cc-f2b6f0d030d5",
    "auditory_guidance": "42b0967d-a3c9-416d-8c40-ec73c07b5170",
    "baby_safety_gates": "0da3bde3-9d57-4342-b3ef-81230f580df1",
    "baby_sitting": "330d27f3-c912-434f-8422-2ccc24e134d0",
    "back_in_rv_sites": "df1f0731-c427-49ff-b8a2-607b19aa8546",
    "back_massage": "43634fb1-daab-45ff-b1bd-f91cca6d6936",
    "badminton_equipment": "5ea68da7-06de-40fb-8de3-b13d1012cc96",
    "baggage_storage": "150fb18b-952c-41e4-8430-5765ee759800",
    "bar": "6e241237-ed19-4323-9d7a-a0704ed7c78a",
    "bathroom_emergency_pull_cord": "2a429029-8c60-49fe-b709-d664746cb617",
    "bbq_picnic_area": "e01ae62b-dac6-4e88-b05c-e67a2dfd7192",
    "beach": "bb417bd8-e0e7-4219-8ada-196a05101b39",
    "beachfront": "42d41470-1f3e-44f5-a261-488f53d03b0a",
    "beauty_services": "1eda4ec5-81c6-412a-bfe4-a7b111c2aff1",
    "bicycle_rentals": "d0690c61-0a89-486c-a05b-f55a13641dc8",
    "bike_parking": "7e6db6bb-45b2-45a6-897e-5fc56c237d97",
    "bike_rental": "313c6c27-3c56-4c4e-9a9f-77a3f7f8016a",
    "bikes_available_free": "0ccdd15a-a7d2-490a-821f-d71383ff8064",
    "bike_tours": "5ac5a36b-7ad4-4d9a-b81b-3021837b42dc",
    "billiard": "1d965331-9752-4410-b191-17dcf3d8c869",
    "bingo": "2df6692c-90ef-465e-a7ae-628565f472b4",
    "board_games_puzzles": "f861bcb9-5c98-40cf-91cf-8f8063477c75",
    "body_scrub": "ed69084b-d064-4ceb-9482-932856596e85",
    "body_treatments": "33bc06bb-07b3-436f-a46a-25d65420654f",
    "body_wrap": "bd3b0f2c-1fb3-460e-9c89-e63741c4c81b",
    "book_dvd_music_library_for_children": "b6f2fc26-ca08-4e7c-8452-31db56246b3f",
    "bottle_of_water": "97f4d014-151a-45b7-8cef-d45c8fc13873",
    "bowling": "69147895-b1d2-4be6-94c3-aee9bb76551d",
    "breakfast": "0c46e905-ab12-4ce7-9a3f-659b21d30239",
    "breakfast_in_the_room": "48bc42e6-7dd9-4224-9391-5acd51c61a16",
    "breakfast_takeaway_containers": "e9483f77-a522-42ae-b70e-34410c145e52",
    "bridal_suite": "ff9f4ffd-ae50-496c-a4ce-30ca30c70cb7",
    "business_center": "456d4967-547a-4b44-8072-36b9c6ab5d9b",
    "cable_hookups": "2e78bbaf-4ee7-4b46-a2e0-4fdd0162f335",
    "canoeing": "fd9456cc-009f-46a6-9502-c9401e209b85",
    "carbon_monoxide_detector": "7741da5d-7b0f-4697-b3b2-41ae2fa3d8e1",
    "carbon_monoxide_source": "6e8444f3-20fe-40f7-b219-645023474c16",
    "car_rental": "aba5cf6b-b677-4de5-8f86-49349795d294",
    "cashless_payment_available": "7a6685f6-5c09-4cf0-9677-b1e6c6283ac8",
    "casino": "53be86d7-4bb0-4de6-88ab-2dc08e2c8f9d",
    "cctv_in_common_areas": "97e81e1b-b7e6-49f5-97a8-d741b0a0fcd5",
    "cctv_outside_property": "f40d6aa7-a300-4583-a44c-0348df29e3fd",
    "chapel_shrine": "d7b600c9-3e09-4b40-acef-375d40a261cb",
    "children_television_networks": "d1b680e9-83a6-43c8-b976-2493ab900c56",
    "chocolate_cookies": "fe011525-b446-4e0a-b23f-677e7758b45b",
    "clubhouse": "daac2d28-0ba6-4c1b-b05a-6b9d3e448a7f",
    "community_bbq_grill": "2943bc92-bb88-4dcb-8bdc-209826bb36c3",
    "community_fire_pit": "d9816722-0bd0-4bc7-9b11-139f858b55f5",
    "community_restrooms": "a1c5bf83-43e4-4b0d-91c0-d441a8f7a106",
    "community_showers": "533b280a-cbf3-4e0f-bf85-a3d0476dfe7d",
    "community_water_fountain": "33258c43-12cf-431a-b25d-7488026e8d3e",
    "concierge_desk": "b80e97f6-2a54-4fd1-b181-7f50d7a670da",
    "contactless_check_in_out": "25e83682-b26b-4341-9553-292415ce3378",
    "cooking_class": "3a2dcfaf-90c2-4d2b-b190-3b61b3a9f924",
    "couples_massage": "d8a33570-08f9-486b-af78-6dd08c8354cc",
    "currency_exchange": "e8c6397e-d38f-4c85-a0b8-10f0ecd9d0ed",
    "cycling": "f81afa83-c355-4414-bc0d-3da9e3055960",
    "darts": "572d3323-fb23-4687-9350-2301c2bf9c61",
    "food_securely_covered": "5dd298a5-d18c-4418-a402-aad5e6e290d7",
    "designated_smoking_area": "8bfab389-6487-4eca-bbaf-62e52b052734",
    "dinner": "b4cd21c5-0271-442d-81a5-0b8764b5e929",
    "dirt_roads": "dc4810ef-4df8-4449-b7e4-c219b15ece35",
    "diving": "e19752ef-2f1f-4575-afa6-51c8b26d1b2d",
    "drinking_water": "452bb9a8-67d2-494d-b082-b776b0bfc0bf",
    "dry_cleaning": "3094850d-8bda-422c-900d-4aef2de97c22",
    "electric_vehicle_charging_station": "c147fbea-3a75-46b8-b38b-616f8c1e23ab",
    "elevators": "7880b90c-22f8-46e4-99ab-b34757d73ddb",
    "entertainment_staff": "2639a652-6831-498a-9c9a-eb7b23cea78f",
    "evening_entertainment": "24ee3566-7ba7-4e42-af99-bc06ebbd6624",
    "events_ticket_service": "2b157b52-6ade-40f0-8f05-b3e403e40c73",
    "express_check_in_check_out": "298e8a0c-3b85-4ab4-b8de-30d0dd954662",
    "face_masks_for_guests_available": "e808c311-bb35-4d8d-85cb-1d76a8945800",
    "facial_treatments": "f5892a34-898c-4b5c-b45c-3c3acc6342a0",
    "family_rooms": "95c4ef9e-8fbd-4ad7-8672-109e2c56d922",
    "fence_around_pool": "e53ea9e4-40c5-403f-8334-c09e0fc8b1e3",
    "fire_extinguishers": "1a348761-54d7-4db1-9f42-6b5681aec416",
    "fire_pit": "9cec52da-7a71-46f7-8052-6d533389b333",
    "fire_ring_grill": "aac4a2ce-f6f4-4e54-95c6-5f5417239863",
    "first_aid_kit_available": "7ebfce9f-a978-426c-afa4-28e665d7ba8d",
    "fishing": "d5bed42d-2fba-40b0-9c83-7dc6799c8264",
    "fitness": "f1bd8883-8efb-4e32-a118-a0c310987480",
    "fitness_center": "615fc6f0-ec67-4d68-bbef-d2b73367da13",
    "fitness_classes": "b3cbd32c-c551-4cc3-ae56-fcdb4d402d74",
    "fitness_spa_locker_rooms": "62c45667-5c3d-4fbf-8d01-6724a5233114",
    "foot_bath": "f2a7770c-9f1b-49ef-a925-833c97de02ee",
    "foot_massage": "2e2963a0-211e-4294-b814-6d2812f4678a",
    "fruits": "160d832a-fb74-4f7d-9f77-0f2eebc0ecb3",
    "full_body_massage": "b5a51d0b-1306-4da1-b509-4fd7291dee8c",
    "game_room": "2826f0aa-72c2-4e28-b1e6-3bedf309cda7",
    "garden": "b34f19ae-b812-44e4-8441-f03af3882c8e",
    "gasoline_nearby": "72119069-9e29-48bc-b4cb-95cb4dc53376",
    "general_store": "55bab5af-ebf0-4e42-ba61-f655a4a09be6",
    "golf_course_within_2_miles": "d34488a2-ccb4-4874-8003-835101e38f4d",
    "gravel_roads": "b79c43bd-a394-4fe9-ac51-3756254de1c6",
    "grocery_service": "854ba2b9-4f94-4caf-83fa-d7da2be17e3c",
    "disinfected_between_stays": "f338a6e5-5093-49c9-ab98-5dbc03089efc",
    "sealed_after_cleaning": "0641242a-1723-48a2-b30f-ed9d5145ae22",
    "cleaning_optional": "0e7f0b2d-ccd1-4663-9e0e-dae3a7aa1d6f",
    "hair_colouring": "b7afa74d-8fcc-4dd1-8c0a-edae416c9d93",
    "hair_cut": "fae197a9-74e3-45d9-87ab-b95590eaae4f",
    "hair_dresser_beautician": "a1b86815-52bb-4b8d-bac8-ac892ab0c61b",
    "hair_styling": "574fa1cb-33a1-4ec9-9547-6790c4cb5a05",
    "hair_treatments": "3f5feb7b-6112-4362-b7a0-f6f4fa144ac2",
    "hand_massage": "89afd31a-5c4b-4c7d-a421-2974c3465f42",
    "hand_sanitiser": "a78f5f3d-36aa-4585-856e-b312adbb1b2b",
    "happy_hour": "4697157c-d6ff-4b30-beee-dd377c797737",
    "head_massage": "4038a721-a4a6-4b47-8121-3e2e3ef557bf",
    "heated_pool": "3e86a842-15d9-406e-84eb-b4fc9622325c",
    "heating": "15fabe8f-5853-4af3-84e2-6b08ee795cda",
    "higher_level_toilet": "3ee66094-93be-40a6-a8a2-c97c7ba2657a",
    "hike_bike_campsites": "54fecd4a-3ecf-4e43-a1a0-8d9607ccb410",
    "hiking": "80c7d4c6-98d0-4835-920b-68e45a72e581",
    "horseback_riding": "7ae6351d-c25b-4f33-92bd-2127e7a97e6c",
    "hot_spring_bath": "f56c442c-a765-4a9d-8fc8-605265280e18",
    "housekeeping_daily": "1af3a973-f056-4219-8230-58746e017094",
    "hypoallergenic_room_available": "74e4fa1c-0375-41f0-9772-417d0325368d",
    "indoor_parking": "02a00229-5e13-45eb-a08f-67a99fc5ca54",
    "indoor_play_area": "1ef7df19-e5c5-44d0-af88-20ac1ed887af",
    "indoor_pool": "6c1ef1fc-198b-4684-aa8a-acd5b67a42eb",
    "indoor_swimming_pool_all_year": "2735839f-10c2-47c9-a3ac-2e0c67a23337",
    "indoor_swimming_pool_seasonal": "3ede071e-eaee-4a4a-a4ac-9acb6daa4667",
    "infinity_pool": "5ffc4298-95d5-4c41-a1fd-0edfd0da547a",
    "in_room_dining_options_available": "7e7fb34c-432d-4441-b83c-de5cd9ae256d",
    "invoices_provided": "2af0171b-a64c-48c5-9c61-c58f44b6f325",
    "ironing_service": "b809fa11-d32d-40e3-97d4-e1bdcaddc6d2",
    "jacuzzi_hot_tub": "4177d49c-aafd-4c82-a74a-470e14a3a03a",
    "karaoke": "b6627e5c-9666-44cc-994c-0d6298f7cae0",
    "key_access": "0a48f5ba-1a78-4937-9f2b-301e1c5f8e3c",
    "key_card_access": "a3f280b7-cd01-402d-b806-397c8ab8fe80",
    "keycard_for_room_electricity": "8581f826-c044-4c02-befe-8ed7fb173cb3",
    "kid_friendly_buffet": "a6594c2e-8292-45d4-9f33-3e58a348e73a",
    "kid_meals": "79ecc400-8390-4771-b983-673e254219f3",
    "kids_club": "c41515f8-0de1-46ad-87e6-90ee729b1ed0",
    "kids_outdoor_play_equipment": "ab27d0fd-48e7-4a1e-9417-cfb2c367e071",
    "kids_pool": "29af276d-a16d-4d92-b1ca-92d553dd0e9b",
    "laundry": "c088be43-f48c-46d0-bfaa-6b29965e2f31",
    "laundry_facilities": "4b3e65be-f4ad-485f-bc68-6145099abbbc",
    "library": "7605a94b-4335-47c5-bebd-eddff6a69868",
    "light_therapy": "b0a8dad8-d6f1-4cff-bada-f1872ebc0dd7",
    "linens_washed_guidelines": "4943363c-1eb5-49fd-b22a-0a23b4c0fdc8",
    "live_music_performance": "fd4c26c3-dc0b-42c6-914a-1cf82e038cc5",
    "live_sports_events_broadcast": "19221aea-c54a-4bd2-9b52-5fe4c621b39a",
    "lockers": "5edbf35d-42ea-491a-a785-46ca059ae7b3",
    "low_bathroom_sink": "0d15fae5-6b1e-4b6e-9662-a9b40a618666",
    "lunch": "8c960ef4-a629-4719-8c46-0b748a8d1311",
    "make_up_services": "7040af43-9842-4afa-ae89-5754f70c0f41",
    "manicure": "62a98754-e876-4ec9-a595-dc0d99cab196",
    "massage": "a7ab528e-579d-4235-b964-286a31bd75eb",
    "massage_chair": "337d2b79-cbe4-454b-bd16-57c1cf30d0be",
    "meeting_banquet_facilities": "d8e49556-e6e5-4a60-93ea-4baa18f20ec9",
    "minigolf": "85e7fdd6-33e9-45ab-a886-7c98c05005d3",
    "minimarket_on_site": "f5d73adc-dc3f-4434-ac46-a261279cfec6",
    "mobile_app_for_room_service": "1a9282cc-92ca-4bd6-ba0e-01f2031ed06c",
    "movie_nights": "a6a68a25-1629-48ba-aa65-0bd49a41cffc",
    "neck_massage": "dbf32af2-dc8f-41d0-bd79-592fb45fdc91",
    "newspaper": "64982821-4176-4fc9-a86a-69d858420f7a",
    "nightclub_dj": "1e6b8b45-21db-48b1-bc5d-c60b2407458e",
    "non_smoking_rooms": "cf2b0e79-b42e-488e-b41c-20b9f9c16428",
    "on_site_coffee_house": "d95d64db-e7d3-4b1b-a74f-361d03f18f5e",
    "open_air_bath": "cf484a0c-8271-4390-996c-6b33016c19e7",
    "opt_out_from_daily_room_cleaning": "c3d62d60-dd75-4056-b42b-ce6c830bd36f",
    "outdoor_fireplace": "aac0d616-b0a4-49b2-8d6b-734d7e38f663",
    "outdoor_furniture": "eb84200d-c9c6-4bb4-a87f-173aa8d26c87",
    "outdoor_pool": "c76a0ae7-cb5a-46b7-b1d4-d639a472d7ac",
    "outdoor_swimming_pool_all_year": "d16baeeb-58ef-464f-a66e-365de978036f",
    "outdoor_swimming_pool_seasonal": "35fd890c-7d16-4126-9673-0f432f0a07c0",
    "packed_lunches": "00214af6-b7b3-4d72-9ef4-1c4b905e83fc",
    "paved_roads": "f77ad0c8-687b-46c8-9884-55d405de72e5",
    "pedicure": "afd3d4ac-bd09-4b85-9ba3-3a1d95c2d8d8",
    "personal_trainer": "fa3392b9-41aa-449f-b545-e7d815c42e93",
    "pet_basket": "5134c385-7e3c-4171-b073-ea561e509724",
    "pet_bowls": "1791dfd4-5f90-481d-85d2-57584f0e8863",
    "pet_friendly": "a7e75cb5-1478-48f4-962f-4a2b469831ea",
    "pets_allowed": "d9b4a5be-e4cf-452f-9fac-b27e3926e070",
    "physical_distancing_guidelines": "65d265ee-661a-4260-ab4c-f5285d88570a",
    "physical_distancing_in_dining_areas": "1195024c-96b8-4366-b771-b6b2da7a04e9",
    "picnic_area": "c1542ee3-5eeb-4865-ac5e-b879faa72681",
    "picnic_table": "d610be83-491a-4abc-a73b-7ddc7a42db49",
    "playground": "e491e650-2733-4395-823c-2889f8b53e75",
    "plunge_pool": "7ac8b501-5600-45f1-8e53-058fb6ce48fd",
    "pool_bar": "3510d9d4-b927-43b7-9bcc-f8c15d57cead",
    "pool_cover": "5111fbc1-f345-4a23-ac37-a6ffb73252b4",
    "pool_towels": "6e28959d-4883-4afb-b939-01c6a3e3032e",
    "pool_with_view": "cc8548d7-f301-4270-b6ed-644b77c42bca",
    "private_beach_area": "a8871217-8c79-4b94-9729-4af4c25909d2",
    "private_check_in_check_out": "660a6719-084a-4c41-a498-70a8d7eaf931",
    "guest_health_check": "95bc9519-2171-4e09-8c11-a7ff00f71c0c",
    "propane_refilling_station": "572688e9-140a-495c-ba06-cf5fe7dbb1e8",
    "professional_cleaning": "acd0cf97-727a-4f99-8db9-d00f53b28c50",
    "property_is_wheel_chair_accessible": "f9809279-edd7-4f23-81cc-72b6f0cac8c4",
    "no_plastic_drink_bottles": "af790146-f493-44bc-8300-9c3a5c8e2864",
    "no_plastic_cups": "3d6056da-f2fc-4f40-92ec-e61edbb2120f",
    "no_plastic_cutlery": "a0f3904d-d64a-46ea-bed3-2af65b67acad",
    "no_plastic_stirrers": "bb7e8962-9804-4390-bbc5-7169c3f44db0",
    "no_plastic_straws": "7b4701bd-991e-413d-b15d-7dce61bc2018",
    "no_plastic_water_bottles": "d98eab7c-3f5f-4ff7-acf1-6ff29873f442",
    "no_plastic_toiletries": "9162b316-bcf6-4322-9508-e9e208e6028c",
    "pub_crawls": "aaa12595-f240-4cf1-9da0-0f3cfa0db0f5",
    "public_bath": "174374f2-7541-4274-aeaa-4444914d6e0e",
    "public_transport_tickets": "dec40992-a622-45db-b335-3cd459c26d13",
    "pull_thru_rv_sites": "3866917c-b19b-4ff8-b8e2-0b35f501e3f1",
    "refillable_water_stations": "ea144b27-032a-41e9-8722-478cbc4765db",
    "restaurant": "71abd8f1-7007-41ad-a5a5-6b59fe4f8445",
    "rooftop_pool": "c8936fce-ea3a-47db-b38a-17e5e5f0c841",
    "room_service": "11f4e66d-967e-4284-b415-f2e5abb87966",
    "rooms_facilities_for_disabled": "f7bb259b-57d9-4d04-8dfb-df1b5c8d6f1f",
    "rv_hookup": "a4943763-8419-4a2a-aaac-42bed2a41f25",
    "rv_sanitation": "8adadef1-b576-4db7-8dda-acc65d59a652",
    "safe": "a2b12f8a-8cca-4e7d-93bd-174551699b49",
    "salt_water_pool": "bba4642b-7749-4037-93c3-25e4fe91e959",
    "sauna": "a07427e8-835a-43cd-87b1-d01926a18ea5",
    "staff_guest_barriers": "7e49cae8-ef9b-4251-912f-3dfdf10c6595",
    "secured_parking": "16b64a86-4da5-46e9-be76-111e97c43017",
    "security_alarm": "1c70fb2f-d398-4a59-9ce5-3383a4f5bddc",
    "shallow_end_pool": "28ddbb9b-b91d-4962-8267-1c159db0e278",
    "shared_kitchen": "be2cad4c-9e50-445e-b83f-917e6dcd7414",
    "shared_lounge_tv_area": "b56abcde-de2b-4f42-8141-19c04e523e5c",
    "shared_stationery_removed": "7e5ad27a-f72e-4f2c-8946-70205e6efaef",
    "shoeshine": "ae2146a9-5ddf-4d79-b8fa-2645a168e253",
    "shops_on_site": "97baedd7-2943-44e1-b6fc-9069c6c1f8e8",
    "shower": "70e0139e-27b8-4570-b6c8-1da8e3174f01",
    "shuttle_service": "19356b2a-d442-48b2-aaca-160cd4fe7eda",
    "shuttle_service_free": "de1d4f7b-d2b1-4064-8d58-7032469656e2",
    "shuttle_service_surcharge": "5ff9f916-92ea-4a87-8828-56cb87bc6a3c",
    "ski_equipment_hire_on_site": "76a01477-cd7c-4010-94a1-e8c1096badb5",
    "skiing": "28956c9f-64ea-4955-90ea-24bbf5269731",
    "ski_pass_vendor": "b1059e3c-1484-4718-a2b1-bee5212c134f",
    "ski_school": "2c38df76-889c-4f70-9130-f1f77bad971f",
    "ski_shuttle": "d7aa4b04-7195-4eb2-8d25-63bed75858be",
    "ski_storage": "2e2ef061-3320-446e-b725-97bbae515500",
    "ski_to_door_access": "f4332466-847b-4881-b7c2-29bd6acf060d",
    "smoke_alarms": "32060686-59c6-4955-82bd-1d26d8171213",
    "snack_bar": "a52b8814-f7cd-45aa-9e36-6ba62e0e2ed8",
    "snorkeling": "4b8ec0d0-464f-4d20-b660-19bb70e94e25",
    "solarium": "49b0cb78-9e87-4d25-be7d-0c2575a8d648",
    "soundproof_rooms": "b5a500e7-a3de-4059-8f99-62fdf7426a28",
    "souvenir_gift_shop": "8725811d-feba-407b-8b87-c67f22dd28d3",
    "spa_facilities": "8740a0e0-70fd-4e01-904f-fbfa12c12fcc",
    "spa_lounge_relaxation_area": "a07b70f3-6d78-4efc-8610-5b272e9fd722",
    "spa_wellness_centre": "edc88f74-a6ec-406a-a41a-1f0b22a28edb",
    "spa_wellness_packages": "6a616e26-0767-4adc-9b9c-948c29485a67",
    "special_diet_menus_on_request": "2a91bbfb-214c-4c6d-a5b5-053f1636751a",
    "squash": "5bec63ed-1fb2-4ad6-bb33-ea9f45d7e08d",
    "staff_safety_protocols": "61570f68-61cb-4028-bdde-fb68cb7d4222",
    "stand_up_comedy": "0d22bbbe-54f6-46da-a074-e1ed204f55c6",
    "steam_room": "15532c9f-c9ee-44b3-9f3e-e662ab415aaa",
    "street_parking": "984a79b9-76d9-4e31-83c0-d65e3c31284a",
    "strollers": "d3634cf8-338a-492e-bd35-6f8999726faa",
    "sun_loungers_or_beach_chairs": "83338722-fcc5-4f32-ab30-6367156ae4ca",
    "sun_terrace": "06f8ccb4-12c2-4363-afa5-0a010d69c0f0",
    "sun_umbrellas": "287d3911-1cb9-468b-a9b2-a52765dbc578",
    "swimming_pool": "299bd3d1-e61b-471c-9115-bfbc9d158fdf",
    "swimming_pool_toys": "aa9ddaef-9ab5-40f1-97c9-e7b0e6cab798",
    "table_tennis": "0d683532-2b90-45ed-bcf5-8d6e5c1a47de",
    "temporary_art_galleries": "67468faf-6a1e-4f1f-a3f1-8ee856121c55",
    "tennis_court": "c559eb84-4910-4c93-9949-ba4d2c339491",
    "tennis_equipment": "9f008d8f-adb6-4633-99ac-07ed9b40b1c5",
    "terrace": "21f851fb-a3a2-441d-ad67-e39ea8f97801",
    "themed_dinner_nights": "1abd531b-3b6b-49f8-94f0-77182ad2dcc5",
    "thermometers_provided": "8d518c0d-8abb-408a-be73-7c76faa926dc",
    "ticket_service": "43b4a0ef-17a4-43b0-939e-481f1d4b1f44",
    "toilet": "9465f8ae-12de-42bc-99de-245594bbc2f4",
    "toilet_with_grab_rails": "c8e5d33c-1fe0-4192-8b4e-71732185147a",
    "tour_desk": "d888c540-6208-403d-acf3-56eb35b467d9",
    "tour_or_class_about_local_culture": "cfeaacb6-6cc3-487b-a182-90cfe21dc225",
    "towels_changed_upon_request": "75419eff-7ebb-40b8-b97a-80f32ab617ac",
    "trash_service": "11115900-e08a-4585-a884-433118d1147d",
    "trek_in_1_5m": "95331adb-0c24-4267-832d-9a76eafd9890",
    "trouser_press": "9ad74faa-f072-4e7d-9fce-e2cd095151ef",
    "turkish_steam_bath": "8ec23f0f-f337-4d67-8bbf-5106eff12db0",
    "anti_covid_cleaning": "f730a699-0de0-4684-8cd8-3e58ff06b059",
    "valet_parking": "e21119c9-33f9-46d6-9492-6ce43977a479",
    "vending_machine_drinks": "2a288424-af87-46df-a519-cf2b7365824a",
    "vending_machine_snacks": "9906d14e-1a14-40d2-9445-262e8791e720",
    "viproom_facilities": "979c53d0-4e83-4de4-80b6-f15f50e046dc",
    "visual_aids_braille": "56c02a6e-dba4-44e6-863b-0c8bb91ac62f",
    "visual_aids_tactile_signs": "656f8aea-9e82-4636-a09c-1b0bf96cc5eb",
    "walking_tours": "e0209938-2ec5-4c30-8772-efe17ae83cbc",
    "waterfront": "12b3beba-fc01-4e5b-9334-604dabda598f",
    "water_park": "f062f63a-ebd9-48af-9fe4-ec43ae0527a3",
    "water_slide": "2cbc9e4b-a3ca-442c-a1f7-653348ecca65",
    "water_sport_facilities_on_site": "fc150ed1-1335-4551-9a83-01164e689342",
    "waxing_services": "be93d82e-3176-4907-8dc7-8f0b742c1d2a",
    "wifi": "57272452-6455-437d-90df-97d3c8762014",
    "windsurfing": "2de20e8d-a06d-4e14-8cc3-7ca5a2bb6d79",
    "wine_champagne": "ba3a516d-b2de-40e2-a889-65830e6e767b",
    "yoga_classes": "5ebeee9a-73af-453a-aaa9-ffcdfc6a85db",
}


# Channex-ZIMMER-Facility-Katalog: lokaler Slug → Channex-room_facility-UUID.
# Vollständiger /room_facilities-Katalog (191, live abgerufen). BEWUSST getrennt
# vom Objekt-Katalog oben: Channex führt zwei Kataloge mit EIGENEN UUIDs, und sie
# überschneiden sich nur zu einem Bruchteil (30 gleichlautende Titel — alle mit
# unterschiedlicher UUID). Die Zimmer-Merkmale, nach denen Gäste auf Booking und
# Airbnb filtern (Klimaanlage, Balkon, Küche, Aussicht, Bad), gibt es AUSSCHLIESS-
# LICH hier. Die Objekt-UUID an einem Room-Type wäre ungültig — nie mischen.
# "Kitchen" führt Channex doppelt (zwei UUIDs); der zweite trägt das Suffix _2.
#
# STAND 06.09.2026, aus /room_facilities/options neu erzeugt: die vorherigen 191
# UUIDs waren ALLE ungültig (0 von 191 im Live-Katalog) — Channex quittiert
# unbekannte IDs mit 200 und legt NICHTS ab (Antwort: `facilities: []`). Jeder
# Room-Type stand deshalb bei allen Portalen ohne Zimmer-Ausstattung, obwohl der
# Sync 39 Facilities „erfolgreich" sendete. Prüfen, nicht glauben:
# `uv run python scripts/diagnose/channex_facilities_pruefen.py` vergleicht beide
# Kataloge live mit diesen Maps.
_CHANNEX_ROOM_FACILITY: dict[str, str] = {
    # --- general (9) ----------------------------------------------------------
    "100_amps": "99037843-48aa-4b34-a8a2-3ad8c912dc31",  # 100 Amps
    "20_amps": "8873d98f-f079-4829-8ac7-36a091496cc5",  # 20 Amps
    "30_amps": "02cff387-c914-4a79-b56b-6d85e23dabea",  # 30 Amps
    "50_amps": "20490d64-34cb-451f-b21e-4145896436fa",  # 50 Amps
    "big_rig_friendly": "6505a9e5-619e-4a38-9643-ba6291a109af",  # Big Rig Friendly
    "dump_station": "caf5980c-ce1c-4080-82e2-183727d467a7",  # Dump Station
    "sewer_hookups": "e23766fa-eae4-43f8-acbd-2253918d7689",  # Sewer Hookups
    "slide_outs": "cd687436-e4df-473d-8dcc-3963765b579e",  # Slide Outs
    "water_hookups": "1b635b2d-bee1-404d-b01b-711cec7d640a",  # Water Hookups
    # --- in_room (104) --------------------------------------------------------
    "accessible_by_lift": "a924101f-c8e2-4df6-b780-783fe63c07ef",  # Accessible by Lift
    "adapter": "706f255b-c191-466b-b961-9d39732eedd1",  # Adapter
    "air_purifiers_available": "22548993-e565-4160-9b73-308777a72418",  # Air purifiers available
    "airconditioning": "da28a45b-fb1f-4dd3-82c3-5890d13e4d49",  # Airconditioning
    "alarm_clock": "8d0208c5-705b-49d8-baa2-2815675698d1",  # Alarm Clock
    "allergy_free": "cd39b182-fe0f-475f-b4b7-64747de7c540",  # Allergy-Free
    "blu_ray_player": "a80d3b3d-2b74-46d3-be1d-d7c05686b064",  # Blu-ray player
    "board_games_puzzles": "cbe58a92-7afd-4efe-a421-a5fc6440f29d",  # Board games/puzzles
    # Book/DVD/Music library for children
    "book_dvd_music_library_for_children": "e15cc261-d323-4839-86cf-4f188c5da175",
    "bottle_of_water": "2a045930-582a-4060-85ac-07dcf3000a0f",  # Bottle of water
    "cable_channels": "da81d5cd-146f-4750-9c2e-97eb8e1ec880",  # Cable channels
    "carpeted_floor": "0db0bab3-d073-405a-91bd-1e8ac6c7af5c",  # Carpeted Floor
    "cd_player": "393731ae-fa85-4317-8e8e-974b2d391bc7",  # CD-Player
    "children_crib_cots": "defe6c5e-d116-4931-8530-34fd54205927",  # Children crib/cots
    "chocolate_cookies": "382c8072-a165-4638-a41d-74c30214d8a6",  # Chocolate/cookies
    "clothes_drying_rack": "335c0a26-e01e-44b6-b30c-b934ebefafaf",  # Clothes drying rack
    "clothes_rack": "87167380-430d-4b9c-8160-4f7ace262605",  # Clothes Rack
    "clothing_iron": "cc533da1-e9c3-4d45-a03d-de8f6c8fcfda",  # Clothing Iron
    "coffee_machine": "41ceb3b4-c36a-44fe-9dae-b2917dd619aa",  # Coffee Machine
    "coffee_tea_maker": "8b9a5564-7210-437d-b97c-43c79dc55591",  # Coffee/Tea maker
    "computer": "b24a35be-f865-47c4-8b62-a63d4d7b7182",  # Computer
    "desk": "6f760b99-78ff-4bba-a383-04b6a78643e0",  # Desk
    "detached": "3758cbeb-0a61-4377-ac57-2b8650300cb1",  # Detached
    "dining_area": "fc5125b5-4d10-40aa-b5a8-32585fe50e7a",  # Dining Area
    "dining_table": "2cb10404-80d4-474f-baa9-c3e70b79f7a0",  # Dining table
    "dressing_room": "5b9c6c8b-8e0f-4153-9cd0-b9c4e3feeb4c",  # Dressing room
    "dvd_player": "cacfdb87-7412-4c74-8466-521ca558b670",  # DVD-Player
    "earplugs": "57c68f98-fa45-4f57-95b3-95671a35360c",  # Earplugs
    "electric_blankets": "d8af2f47-be11-44fe-a36a-edba0a6d303e",  # Electric blankets
    "electric_kettle": "a6e9d597-d271-479d-bf56-1e4be1d3b7ea",  # Electric Kettle
    # Entire property on ground floor
    "entire_property_on_ground_floor": "e820920c-ec76-49bc-89e8-5dc2495afec7",
    # Entire unit wheelchair accessible
    "entire_unit_wheelchair_accessible": "014f5f6a-6fde-4486-8f93-0e3e56e24ca4",
    "executive_lounge_access": "0efc11a5-8137-4acb-a24d-8dd4990cf962",  # Executive Lounge Access
    "fan": "f88b1a1d-d49d-47de-9b6c-2592dc608f2c",  # Fan
    "fax": "5a463be4-5da5-45e7-a1f1-b4458231eb13",  # Fax
    "feather_pillow": "c02f978b-9033-4091-85d0-d1b9275e1866",  # Feather pillow
    "fireplace": "cb17f75b-9c37-4a36-9127-bf1949f98a36",  # Fireplace
    "flat_screen_tv": "ea5753f8-8057-4d4e-be82-e1f947e8d348",  # Flat-screen TV
    "fruits": "9fb33d0e-3bce-45b5-8627-2aac5b791741",  # Fruits
    "game_console": "4cd58fda-7054-44c9-beb0-a5e0010c9644",  # Game Console
    # Game Console - Nintendo Wii
    "game_console_nintendo_wii": "00035ea7-7c72-4782-aeb8-b1acfb424785",
    "game_console_ps2": "952852c7-89f1-468c-8a31-3949a38736a4",  # Game Console - PS2
    "game_console_ps3": "a298b46a-ae19-48fe-bcd2-b912e8561683",  # Game Console - PS3
    "game_console_ps4": "72f99775-642a-40c0-a87e-05f6e0d9f6cb",  # Game console - PS4
    "game_console_wii_u": "561cc761-c26c-4d06-860f-37e00f16ffbe",  # Game console - Wii U
    "game_console_xbox_360": "0a09b487-6abd-4bed-9667-38cdba0deaae",  # Game Console - Xbox 360
    "game_console_xbox_one": "a6ae07bd-9099-41f6-8aa3-11fe71ee6e9c",  # Game console - Xbox One
    "hair_dryer": "18a56014-8f05-4dc3-aea4-22e53ec2382e",  # Hair Dryer
    "hand_sanitiser": "fc1033c1-164a-43c6-b464-964d0ed3002a",  # Hand sanitiser
    "heating": "31ba2905-8751-4a33-8ccc-4d31d477ee7d",  # Heating
    "hypoallergenic_pillow": "6ad325c4-0310-4a8c-8322-c55ca97dafb9",  # Hypoallergenic pillow
    # Interconnecting Room(s) available
    "interconnecting_room_s_available": "a32446c4-7025-4025-a8ef-10fe66bcf4c1",
    "internet_facilities": "ddcf67b6-d603-4ceb-b48c-57a6ae6a1b94",  # Internet facilities
    "ipad": "4d5d77f7-3eab-43e5-a348-3317b7d8ccf3",  # iPad
    "ipod_docking_station": "fe51ad53-3a5d-47b0-a4cc-34c8443f903b",  # iPod Docking Station
    "ironing_facilities": "ced79546-cba6-45a8-b080-612e8c9a4ae9",  # Ironing facilities
    "kitchen": "ad698f06-2e3f-4168-b2bd-0b69af9086e3",  # Kitchen
    "kitchenware": "172eb2a0-d0c5-4a18-a8af-624b0c88d53c",  # Kitchenware
    "laptop": "5088fd43-9cdb-4c23-8e4a-98da5990b767",  # Laptop
    "linen": "e5fbfd4e-b002-4e03-b44b-f21e0871e778",  # Linen
    "mini_bar": "1ff265da-d138-420c-b344-1527c6f59f9c",  # Mini-bar
    "mosquito_net": "62d58dc5-ecca-42ba-915b-ed7661f245aa",  # Mosquito Net
    "non_feather_pillow": "d9bbf138-9c49-41aa-b849-3ff0a0616400",  # Non-feather pillow
    "outdoor_dining_area": "ad867d05-2024-48d4-9264-44d0ae00c38d",  # Outdoor dining area
    "outdoor_furniture": "d70dbcc7-4552-4afb-9f20-8b8b0d460c9b",  # Outdoor furniture
    "pajamas": "9774d692-2002-4311-89f9-76f531ef7475",  # Pajamas
    "patio": "ba218653-46d3-4af7-a456-b382fb3d2e3d",  # Patio
    "pay_per_view_channels": "54fd755b-5f99-4846-9687-a974c80673c5",  # Pay-per-view Channels
    "portable_wifi": "087824ca-6634-4a61-89d4-234843b32dbc",  # Portable Wifi
    "private_curtain": "63d1acce-f834-4255-bf99-535151a49972",  # Private curtain
    "private_entrance": "92996bca-2b80-4578-93ec-49a77c5096de",  # Private Entrance
    # Private flat in block of flats
    "private_flat_in_block_of_flats": "2cdc7b49-592e-4ea5-b553-b759f2d54b49",
    "radio": "acb00d42-045a-472b-926e-299600f7df8d",  # Radio
    "reading_light": "e6ca3b4c-f650-4c2a-bd20-254b8218b401",  # Reading light
    "rollaway_bed": "3107d517-0b78-4e5a-8276-9279e5b0c91f",  # Rollaway bed
    "satellite_channels": "30d4ac87-df83-4180-8f6f-6a009617c29c",  # Satellite Channels
    "seating_area": "af728c2b-b3c9-4a8d-aeba-28cffef93389",  # Seating area
    "semi_detached": "a81fc5af-91c9-432a-bacb-f6a130924e8f",  # Semi-detached
    # Single-room air conditioning for guest accommodation
    "single_room_air_conditioning_for_guest_accommodation": "4218bbe9-4e3b-401b-9820-2b5dbe659eb9",
    "slippers": "de1d0789-27ef-44d3-8f55-3a800bbb1b89",  # Slippers
    "smartphone": "8fb12145-6255-4b3c-a8e4-f42acfec4534",  # Smartphone
    "socket_near_the_bed": "974517d5-27b8-44f7-97b9-1870eefe98c7",  # Socket near the bed
    "sofa": "483af414-7c14-40b1-89a1-e4e237d03c9c",  # Sofa
    "sofa_bed": "706827b4-f22f-4556-95f1-7d59a17159b7",  # Sofa bed
    "soundproofing": "7b6d9744-d12d-4fb6-9a94-cce8f530439b",  # Soundproofing
    # Streaming service (such as Netflix)
    "streaming_service_such_as_netflix": "04611060-300e-4879-a7b8-15f187d4521c",
    "telephone": "f8255bd7-2164-4e05-a656-83198467cd0e",  # Telephone
    "terrace": "4230ccac-67ff-4e6d-a3a0-d86cb8e65765",  # Terrace
    "tiled_marble_floor": "14edd49b-3f7b-4359-8890-c5a1563f93d4",  # Tiled / Marble floor
    # Towels/Linens at surcharge
    "towels_linens_at_surcharge": "63e2bc30-976c-4160-a839-e1be83dae057",
    "trash_cans": "708d4e41-ac26-4c8c-891b-bfabb8f73a07",  # Trash cans
    "trouser_press": "fd2650af-0bb3-4ac9-97ca-0e498bf9f319",  # Trouser Press
    "tv": "cd8e327d-fb17-495f-945b-9304578abaa0",  # TV
    # Upper floor reachable by lift
    "upper_floor_reachable_by_lift": "04cd181a-9847-4434-ba8e-39ba48fcc5ab",
    # Upper floor reachable by stairs only
    "upper_floor_reachable_by_stairs_only": "e36cd8f8-7280-4d26-bd17-e45cc651dc26",
    "video": "fc612d37-6ea5-43ee-81dd-e3a79a2dcc4c",  # Video
    "video_games": "ab717295-91de-4f0f-8288-e0f8115796b1",  # Video Games
    "wake_up_service": "d0f551cb-4d00-4b7f-a8c7-ce3a5b200943",  # Wake Up Service
    # Wake Up Service/Alarm-clock
    "wake_up_service_alarm_clock": "98a21394-1f6d-4c17-a409-64dfb72f7f97",
    "wardrobe_closet": "d7b76f3b-eb6a-4f67-bc90-73f217fe906b",  # Wardrobe/Closet
    "wine_champagne": "f5bbe6c3-461e-4477-9304-e93b0d28923a",  # Wine/champagne
    "wireless_internet": "95a7ce18-31a9-4fcd-9579-9ac35fca05d0",  # Wireless internet
    "wooden_parquet_floor": "4d77b40f-039b-49a0-b80f-ff817db9e53e",  # Wooden / Parquet floor
    "yukata": "7b5726dd-97b3-4642-ac87-e56999c80415",  # Yukata
    # --- bathroom (29) --------------------------------------------------------
    "adapted_bath": "c3af8661-14cf-4f7f-af55-6af51e493df3",  # Adapted bath
    "additional_bathroom": "970a746e-fed9-4ef0-a646-d8b3a6c6c5d5",  # Additional Bathroom
    "additional_toilet": "ce979c4b-ff61-4a14-86ed-c204ed5aad67",  # Additional Toilet
    "bath": "cc81e4dc-bbd2-45a3-8cbd-a7e3d876d4a2",  # Bath
    "bath_or_shower": "6665167a-09b1-4c75-bf95-c5999540ab7b",  # Bath or Shower
    "bath_robe": "f6ad02ca-3294-4d06-90e8-f8564b0e25f3",  # Bath-robe
    "bathroom": "915505e4-ead6-468c-b98d-ab34b4e8fcf8",  # Bathroom
    "bidet": "dc5c011f-c485-408a-b295-6ece15510912",  # Bidet
    "body_soap": "bdd37f2e-ef18-48c1-b49a-3d8e30277a14",  # Body soap
    "conditioner": "d31a6d69-33e4-47fe-9330-729e35dd6529",  # Conditioner
    "free_toiletries": "a8d66aab-1b30-4e2f-b3b1-d9d7254b2e19",  # Free Toiletries
    "guest_toilet": "94688621-74db-48ac-bb81-ba669bb2a10a",  # Guest toilet
    "higher_level_toilet": "116d2819-d933-455a-86c9-a6cd66c50576",  # Higher level toilet
    "hot_tub": "ae978fb1-63ac-486b-a7f6-6dd96f399190",  # Hot Tub
    "kitchen_2": "ba4e7b65-0499-4528-b27a-bff069228d84",  # Kitchen
    "low_bathroom_sink": "361f94fd-4013-413e-a83b-6246873fd0c7",  # Low bathroom sink
    "roll_in_shower": "03ee97a1-f041-417e-aae1-30f87d89ed34",  # Roll in shower
    "sauna": "f4955810-a944-4cd2-a8f3-dc9de85f603f",  # Sauna
    "shampoo": "abc4fe45-8edb-4cb0-9ee9-0c297e98c250",  # Shampoo
    "shower": "3f71b6d5-6b9e-4bc5-9dfc-2b1ab7be1876",  # Shower
    "shower_cap": "a65d360a-be29-4340-8434-002eb0e4121e",  # Shower cap
    "shower_chair": "ed2c5efa-7cc9-4e26-9003-dfebab75a75f",  # Shower chair
    "spa_bath": "ad664503-1bbf-4131-953b-b2c546252a67",  # Spa Bath
    "toilet": "efaa9696-1b2c-4ced-8405-054ab5ac4e7a",  # Toilet
    "toilet_paper": "0c9de08b-4ea2-4451-828b-13a014ed04c4",  # Toilet paper
    "toilet_with_grab_rails": "63348074-5308-4064-bdae-992a80b36fe3",  # Toilet with grab rails
    "toothbrush": "e01eacb3-c440-444c-a8a6-466cc75a30a7",  # Toothbrush
    "towels": "e81582c1-492e-43e2-b659-e4da8179844e",  # Towels
    "walk_in_shower": "f1df270c-4033-412c-bfd9-038b12ce4cc5",  # Walk in shower
    # --- security (12) --------------------------------------------------------
    "baby_safety_gates": "b494450e-eed5-4eb0-949b-553cad1cf331",  # Baby safety gates
    # Bathroom emergency pull cord
    "bathroom_emergency_pull_cord": "b7915a46-c9f0-47db-8ad7-7abc1f5815cf",
    "carbon_monoxide_detector": "ea6f56fc-16ac-4015-861b-5ce6f11763ff",  # Carbon monoxide detector
    "carbon_monoxide_source": "d11f25a1-350e-44f0-bb22-7f7c06b9c4fa",  # Carbon monoxide source
    # Child safety socket covers
    "child_safety_socket_covers": "1f65202c-2df7-4e8c-a6b8-548e1753b415",
    # Electronic key card access
    "electronic_key_card_access": "dff43c38-dccc-48fc-b3cb-472c31b5b3c3",
    # Fire alarms or smoke detectors
    "fire_alarms_or_smoke_detectors": "b57dd01d-74f0-4903-b93e-ad84a0844f81",
    "fire_extinguishers": "6847ed71-f035-42e6-81d4-5602ca8178dd",  # Fire extinguishers
    "laptop_safe_box": "3c5445a6-f892-4449-ac87-135aef648f19",  # Laptop Safe Box
    "lockers": "5cd8b3cc-4cfd-4c4c-8294-a4ff718af948",  # Lockers
    "metal_keys_access": "2dbe46ea-7f51-4a6a-b1ab-57cc0f661709",  # Metal keys access
    "safe_deposit_box": "7c89e6c6-98c8-49f7-a482-4fe8e0ab40e5",  # Safe Deposit Box
    # --- outside (11) ---------------------------------------------------------
    "balcony": "19cb8824-a6f1-4bf4-a949-439cca90df16",  # Balcony
    "heated_pool": "48308ef0-a7ce-49e5-9b6e-b5787c73939d",  # Heated pool
    "infinity_pool": "80336162-68cb-470d-9f39-7e471bea14a4",  # Infinity pool
    "plunge_pool": "df1f8841-f8a6-46f4-9117-dd7c4c22787e",  # Plunge pool
    "pool_cover": "281633bd-f536-4bdb-ad91-21d3a1be5d8f",  # Pool cover
    "pool_towels": "05da4662-3147-4ad5-adca-4d245c3d84f9",  # Pool towels
    "pool_with_view": "4c854061-eb92-42dc-b926-80205eda7aaf",  # Pool with view
    "private_pool": "b8e36d56-d96a-4dc8-a55c-39e598024954",  # Private Pool
    "rooftop_pool": "7306f80f-4448-4301-bd35-631def4e900e",  # Rooftop pool
    "salt_water_pool": "4b2fd31d-ac70-49bb-8868-d3f91d2c4baa",  # Salt-water pool
    "shallow_end": "089af1f6-a8b6-463e-821e-cee300155641",  # Shallow end
    # --- kitchen (14) ---------------------------------------------------------
    "barbecue": "0c91db05-6e54-426d-bf5e-b1faabc5ca59",  # Barbecue
    "children_highchair": "3845c382-9b71-40b0-921b-9fd2716c976d",  # Children highchair
    "cleaning_products": "292ddfb2-cb85-4944-918b-101e22d6620d",  # Cleaning products
    "dishwasher": "2166dec4-46cb-4b31-9805-a71cfe244152",  # Dishwasher
    "kitchenette": "1f8a4371-118e-4278-bd53-15fab71fca6e",  # Kitchenette
    "microwave": "6bdd686d-14ad-4edb-9c0b-863bcc437d18",  # Microwave
    "oven": "bc867043-81f5-41f0-a60c-701f0e0efe76",  # Oven
    "refrigerator": "c0b59378-1e0a-4c11-9e08-3a6aeb49d8ee",  # Refrigerator
    "shared_bathroom": "d3a199b1-c809-47f1-a5cb-28db090cd110",  # Shared Bathroom
    "stove": "188f42c2-4667-43fb-bf35-c9ac2a592aaf",  # Stove
    "toaster": "69f74f21-ce03-4026-90bb-9d7abfeabcd1",  # Toaster
    "tumble_dryer_machine": "45154f17-f7a3-4550-8511-2660ca7fa2bf",  # Tumble dryer (machine)
    "washing_machine": "27564e79-0d5e-47b3-a764-d145aacfc4c0",  # Washing machine
    "wine_glasses": "ec3a38f2-d80c-4e82-9f11-bbb07b1c2418",  # Wine glasses
    # --- view (12) ------------------------------------------------------------
    "city_view": "08d88ebe-ee3a-4376-8752-262fa1ae807e",  # City View
    # Extra long beds (> 2 meter)
    "extra_long_beds_2_meter": "0f2118f4-43f7-4f76-ac37-5e1307f1c118",
    "garden_view": "d858ac7b-6b94-4e1a-aa55-ae33d4eae0a0",  # Garden View
    "inner_courtyard_view": "83d3aeb5-ae75-494f-ad5c-c9c5e4d4f8b8",  # Inner courtyard view
    "lake_view": "42114dc1-581c-41e1-a4fb-36edb765ab31",  # Lake View
    "landmark_view": "8620d38f-2b80-4382-9fa2-fb47acefa640",  # Landmark View
    "mountain_view": "7027342c-e1d1-445a-9c51-07b0faffee0a",  # Mountain View
    "pool_view": "a3350b77-4b7c-4f12-9671-f502298f853d",  # Pool View
    "quiet_street_view": "729cbfb3-a018-4b79-a8ec-978018f7e340",  # Quiet street view
    "river_view": "c0cc1f51-c0a7-4712-861c-4d6b28a748d9",  # River View
    "sea_view": "e80023bd-12df-479a-8832-507fac5ac54b",  # Sea View
    "view": "32385b1c-55f9-4355-97e2-4a4c9f20cc39",  # View
}


def _channex_room_facility_ids(local: list[str] | None) -> list[str]:
    """Zimmer-Ausstattungs-Slugs auf Channex-room_facility-UUIDs abbilden.

    Gleiche Regeln wie beim Objekt-Katalog: unbekannt → weglassen (kein
    ungültiger Wert an Channex, sonst 422), Reihenfolge stabil, Duplikate weg.
    Der Room-Type-facilities-Bezug ist die eine Wahrheit; ein leeres Ergebnis
    leert die Zimmer-Facilities bei Channex/den OTAs synchron (Wurzel 1)."""
    out: dict[str, None] = {}
    for slug in local or []:
        uid = _CHANNEX_ROOM_FACILITY.get(str(slug).lower())
        if uid is not None:
            out[uid] = None
    return list(out)


def _channex_facility_ids(local: list[str] | None) -> list[str]:
    """Lokale Ausstattungs-Slugs auf gültige Channex-Facility-UUIDs abbilden.
    Unbekannt → weglassen (kein ungültiger Wert an Channex, sonst 422). Reihen-
    folge stabil, Duplikate entfernt. Property.facilities ist die eine Wahrheit;
    ein leeres Ergebnis leert die Facilities bei Channex/den OTAs synchron."""
    out: dict[str, None] = {}
    for slug in local or []:
        uid = _CHANNEX_FACILITY.get(str(slug).lower())
        if uid is not None:
            out[uid] = None
    return list(out)


# Präfix, mit dem der Demo-Seed (scripts/demo/seed_demo.py) seine Platzhalter
# markiert — z. B. ``demo-6c92f630-721b-5112``. Die Demo-Betriebe existieren nur
# für die Marketing-Screenshots und haben bei Channex KEIN Gegenstück.
_DEMO_PRAEFIX = "demo-"


def ist_demo_mapping(channex_id: str | None) -> bool:
    """Ist `channex_id` ein Platzhalter des Demo-Seeds statt einer echten
    Channex-ID?

    Ohne diese Prüfung schickt jeder Content-/ARI-Push den Platzhalter an
    Channex, kassiert „Bad Request", läuft zehnmal in den Retry und verbrennt
    dabei das kontoweite Anfrage-Budget, das sich alle ECHTEN Betriebe teilen
    (live am 01.08.2026: 20 solcher Zeilen, zwei Jobs seit Stunden im Retry).
    """
    return bool(channex_id) and str(channex_id).startswith(_DEMO_PRAEFIX)


# Channex-Zeitstempel (`inserted_at` an Buchung, Revision und Nachricht) kommen
# OHNE Zonen-Suffix: "2026-08-01T11:47:16.132286". Gemeint ist UTC — live
# gegengeprüft gegen unsere eigene Importzeile (Differenz ~1 s Laufzeit, nicht
# die 2 h, die eine Ortszeit ergäbe). Ohne explizites 'Z' würde jeder Leser die
# Zeichenkette in SEINER Zone deuten: Postgres in der Zone der Sitzung, der
# Browser in der des Nutzers — ein stiller Stundensprung an der Uhrzeit einer
# Buchung.
_HAT_ZONE = re.compile(r"(Z|[+-]\d{2}:?\d{2})$")

# Ein ISO-Zeitstempel und NICHTS SONST. Der Rückgabewert dieser Funktion landet
# nicht nur in Spalten, sondern auch in PostgREST-Filterausdrücken
# (`.or_("…last_message_at.lt.<wert>")`, 0305). `or_()` maskiert seine Filter
# NICHT — ein Wert wie `2026-01-01Z),is_read.eq.true,(tenant_id.not.is.null`
# schriebe dort eigene Bedingungen hinein. Die Quelle ist Portal-Payload, also
# angreiferkontrollierbar (Wurzel 8: Client-Input, der serverseitig expandiert
# wird, ist ein Angriff — auch aus zweiter Hand über eine OTA).
_ISO_ZEITSTEMPEL = re.compile(
    r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d{1,6})?"
    r"(Z|[+-]\d{2}:?\d{2})?$"
)

# Wie weit darf ein fremder Zeitstempel VOR unserer Uhr liegen, ohne als
# Datenfehler zu gelten? Zwei Rechenzentren driften um Sekunden, und ein Portal
# darf einen Vorgang auf die Sekunde stempeln, in der unsere Uhr noch nicht ist.
# Eine Minute deckt das ab, ohne eine echte Falschangabe (Stunden bis Tage
# Vorsprung durch falschen Offset) zu verdecken.
_UHR_KULANZ = timedelta(seconds=60)


# Platzhalter-Text einer Nachricht, die NUR aus Anhängen besteht (der Gast hat
# bloß ein Foto geschickt — Channex setzt `message: ""` und füllt
# `attachments`). `portal_messages.body` ist NOT NULL, und ein fertiger Satz
# wäre hier falsch: der Server kennt die Sprache des Betrachters nicht, die
# Worte macht die Oberfläche (`inbox.attachmentPreview`, Wurzel 4).
#
# Bewusst an EINER Stelle, weil ZWEI Pfade in dieselbe Spalte schreiben — der
# Eingang (`nachrichten_eingang`) und der Nachtrag beim Öffnen
# (`inbox.spiegel`). Zwei eigene Schreibweisen ergäben je nach Weg eine andere
# Vorschauzeile für dieselbe Nachricht.
NUR_ANHANG_TEXT: Final = "[attachment]"


def ota_zeitstempel_utc(wert: object) -> str | None:
    """Channex-Zeitstempel → ISO-Zeichenkette MIT Zone. Leer/kein Text → None
    (kein erfundener Ersatzwert, Wurzel 4).

    Was nicht wie ein ISO-Zeitstempel aussieht, kommt NICHT durch: weder als
    Spaltenwert (dort wäre es ein DB-Fehler) noch als Filterbestandteil (dort
    wäre es eine Injection). Verworfen wird zu `None` — der Aufrufer behandelt
    das bereits als „Zeitpunkt unbekannt" und datiert nie auf die eigene Uhr.
    """
    text = str(wert).strip() if wert is not None else ""
    if not text or not _ISO_ZEITSTEMPEL.match(text):
        return None
    return text if _HAT_ZONE.search(text) else text + "Z"


def ist_frisch(iso_zeitstempel: str | None, *, stunden: int) -> bool | None:
    """Liegt dieser FREMDE Zeitpunkt innerhalb der letzten `stunden`?

    `True` innerhalb des Fensters, `False` ausserhalb — und `None`, wenn es
    keinen brauchbaren Zeitpunkt gibt (fehlt, unlesbar, oder in der ZUKUNFT).

    WARUM DIESE FUNKTION EXISTIERT (09.09.2026): Dieselbe Zeit-Arithmetik stand
    dreimal im Slice — `_frisch_gebucht` (Recovery-Lauf), `_bestand`
    (Feed-Abgleich) und `_frische_nachricht` (Gastnachricht). Alle drei lasen
    einen Portal-Zeitstempel, parsten ISO, setzten bei naivem Wert `UTC` und
    verglichen gegen ein Stundenfenster. Zwei davon gaben `True` fuer
    „frisch" zurueck, eine fuer „Bestand" — mit jeweils passend INVERTIERTEM
    fail-Wert. Drei Kopien einer Ja/Nein-Frage, deren Vorzeichen sich zwischen
    den Kopien dreht, sind kein Duplikat-Geruch, sondern eine Falle: wer die
    eine liest und die andere aendert, kehrt die Bedeutung um.

    WARUM `None` UND NICHT EIN FAIL-WERT IM HELFER: Der fail-Wert ist an jeder
    der drei Stellen ein ANDERER, und zwar aus fachlichen Gruenden (der
    Recovery-Lauf meldet lieber nichts, die Nachricht laeutet lieber nicht, der
    Abgleich gilt lieber als Bestand). Ihn hier zu waehlen heisst, ihn zu
    verstecken. Deshalb gibt es ihn hier NICHT: die Aufrufstelle schreibt
    `if ist_frisch(...) is not True` bzw. `is not False` und macht damit
    sichtbar, wohin sie im Zweifel faellt. Genau das war vorher unsichtbar.
    Die drei Fenster-Konstanten bleiben ebenfalls an den Aufrufstellen — je
    Domaene eine eigene Begruendung, hier waere eine gemeinsame Zahl geraten.

    ZUKUNFTSWERTE SIND EIN DATENFEHLER, kein Normalfall (Wurzel 4/5). Alle drei
    Vorgaenger verglichen nur `jetzt - zeitpunkt <= fenster`. Fuer einen
    Zeitstempel in der Zukunft — Portal mit falsch gestellter Uhr, falsches
    Vorzeichen im Offset, vertauschtes Tag/Monat — ist das DAUERHAFT wahr: der
    Wert gilt fuer immer als frisch, und die Meldung wiederholt sich bei jedem
    Lauf, ohne dass irgendwo etwas auffaellt. Die Schranke ist deshalb
    BEIDSEITIG (`0 <= differenz <= fenster`), und ein Zukunftswert wird LAUT
    geloggt statt still hingenommen. Die Kulanz von 60 Sekunden deckt die
    normale Uhr-Drift zwischen zwei Rechenzentren ab; alles darueber ist ein
    echter Befund.
    """
    if not iso_zeitstempel:
        return None
    try:
        zeitpunkt = datetime.fromisoformat(iso_zeitstempel)
    except (TypeError, ValueError):
        return None
    if zeitpunkt.tzinfo is None:
        # Channex liefert `inserted_at` ohne Zone, gemeint ist UTC — dieselbe
        # Annahme wie in `ota_zeitstempel_utc` (Begruendung dort).
        zeitpunkt = zeitpunkt.replace(tzinfo=UTC)
    differenz = datetime.now(UTC) - zeitpunkt
    if differenz < -_UHR_KULANZ:
        log.warning(
            "ota_zeitstempel_in_der_zukunft",
            zeitstempel=iso_zeitstempel,
            vorsprung_sekunden=round(-differenz.total_seconds()),
            fenster_stunden=stunden,
        )
        return None
    return differenz <= timedelta(hours=stunden)


def ota_uhrzeit(wert: object) -> str | None:
    """Eine An-/Abreise-ZEIT aus einer Portal-Payload → „HH:MM" oder None.

    Die Portale liefern denselben Sachverhalt in zwei Formen, und beide müssen
    hier durch, sonst hat der nächste Leser wieder eine eigene Regel:

      * Channex: schon „HH:MM" (`arrival_hour`) — dann unverändert durchreichen.
      * Airbnb: ein voller Zeitstempel mit ANGEHÄNGTER Zonen-Kennung,
        `'2026-08-06T16:00+02:00[Europe/Copenhagen]'` (live gemessen an
        `v2/reservations.check_in_datetime`). Die eckige Klammer ist Javas
        `ZonedDateTime`-Schreibweise; `datetime.fromisoformat` scheitert daran.

    Zurück kommt die ORTSZEIT der Unterkunft, wie das Portal sie meint — keine
    Umrechnung nach UTC. „Check-in ab 16:00" ist eine Hausregel, keine
    Zeitpunktangabe; sie in UTC zu schieben ergäbe „14:00" und wäre falsch.

    Unlesbar oder leer → None. Kein geratener Ersatz wie „15:00" (Wurzel 4):
    lieber steht in der Vorlage „Feld ohne Wert" als eine Uhrzeit, nach der sich
    ein Gast richtet und vor verschlossener Tür steht.
    """
    text = str(wert).strip() if wert is not None else ""
    if not text:
        return None
    # Airbnbs Zonen-Anhang abschneiden: '…+02:00[Europe/Copenhagen]'.
    text = text.split("[", 1)[0]
    treffer = _UHRZEIT.search(text)
    return treffer.group(0) if treffer else None


# „HH:MM" — als 24-h-Uhrzeit am Anfang (Channex) oder nach dem T (Airbnb).
_UHRZEIT: Final = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d")

# Wo die Portale die An-/Abreisezeit ablegen — je Eintrag (Anreise, Abreise).
# NEUE KANÄLE TRAGEN SICH HIER EIN, nicht an der Lesestelle: genau daran ist es
# schon einmal gescheitert (Airbnbs Zeit fiel durch, weil jede Lesestelle ihre
# eigene Schlüsselauswahl hatte). Reihenfolge = Verlässlichkeit: Channex'
# dokumentierte Felder zuerst, die durchgereichte Rohnutzlast danach.
_ZEIT_PFADE: Final[tuple[tuple[tuple[str, ...], tuple[str, ...]], ...]] = (
    (("arrival_hour",), ("departure_hour",)),
    (("checkin_time",), ("checkout_time",)),
    # Airbnb: die Zeit steckt NUR in der durchgereichten Original-Nutzlast.
    # Live an 22 von 22 Buchungen belegt (15.08.2026): `arrival_hour` war
    # überall None, während hier '2026-10-16T16:00+02:00[Europe/Copenhagen]'
    # stand. Booking.com liefert an keiner dieser Stellen etwas — es überträgt
    # im Reservierungs-Feed gar keine Gast-ETA (belegt an 67 Buchungen und in
    # Booking.coms `ResGuest`-Referenz, die nur `@ResGuestRPH` führt).
    (
        ("raw_message", "reservation", "check_in_datetime"),
        ("raw_message", "reservation", "check_out_datetime"),
    ),
)


def _pfad_wert(attrs: dict[str, Any], pfad: tuple[str, ...]) -> object:
    """Einen verschachtelten Wert holen; jeder fehlende Zwischenschritt → None.

    `raw_message` kommt je nach Feed-Weg als dict ODER als JSON-Text an (der
    Webhook reicht das Objekt durch, die Staging-Zeile speichert es als Text).
    Beides muss hier durch, sonst hinge die Zeit davon ab, auf welchem Weg die
    Buchung hereinkam.
    """
    aktuell: object = attrs
    for schluessel in pfad:
        if isinstance(aktuell, str):
            try:
                aktuell = json.loads(aktuell)
            except (ValueError, TypeError):
                return None
        if not isinstance(aktuell, dict):
            return None
        aktuell = aktuell.get(schluessel)
    return aktuell


def ota_an_abreisezeit(attrs: dict[str, Any]) -> tuple[str | None, str | None]:
    """Erwartete An-/Abreisezeit einer Portal-Buchung → („HH:MM"|None, …).

    EINE Stelle für alle Kanäle. Vorher las jede Lesestelle ihre eigene Auswahl
    an Schlüsseln, und Airbnbs Zeit fiel überall durch: sie steht weder in
    `checkin_time` noch in `arrival_hour`, sondern in der durchgereichten
    Original-Nutzlast. Ergebnis live: Die Airbnb-Zeiten kamen nur über den
    DIREKTABRUF herein und fehlten jeder Buchung aus dem Feed.

    ACHTUNG bei der Deutung: Was hier zurückkommt, ist bei Airbnb die HAUSREGEL
    des Objekts („Check-in ab 16:00"), die das Portal in jede Buchung schreibt —
    live 21× „16:00/10:00" und 1× „15:00/10:00" über 22 Buchungen. Es ist NICHT
    die vom Gast angekündigte Ankunft. Wer den Wert anzeigt, muss ihn als
    Hausregel benennen (Wurzel 5b: fremde Angabe ≠ eigene Behauptung).

    Fehlt beides, bleibt es None — kein geratener Ersatz (Wurzel 4). Für die
    Automation greift danach der Objekt-Rückfall (`_zeiten_vom_objekt`).
    """
    an: str | None = None
    ab: str | None = None
    for pfad_an, pfad_ab in _ZEIT_PFADE:
        if an is None:
            an = ota_uhrzeit(_pfad_wert(attrs, pfad_an))
        if ab is None:
            ab = ota_uhrzeit(_pfad_wert(attrs, pfad_ab))
        if an is not None and ab is not None:
            break
    return an, ab


def kanal_plan_id(eintrag: dict[str, Any]) -> str | None:
    """Kanal-ID, falls dieser Channex-Rate-Plan ein KANALRATE ist — sonst None.

    Channex' Inventar hat drei Ebenen: Zimmertyp → Zimmerpreis → **Kanalrate**.
    Die dritte legt Channex SELBST an, je Eintrag im Kanal-Mapping, als Kind
    unseres Plans (`relationships.parent_rate_plan`) mit eigener Kanal-Bindung
    (`relationships.channel`) und `rate_mode: derived`. Sie ist kein Bestand des
    Betriebs: Channex' eigene Oberfläche blendet sie in „Rooms & Rates" aus.

    Woran das erkennbar ist, steht AUSSCHLIESSLICH in `relationships` — die
    Attribute kennen weder `channel_id` noch `parent_rate_plan_id` (live geprüft
    11.08.2026 an 19 Properties). Genau deshalb hielten Import und Titel-Suche
    diese Klone für fremden Portalbestand:
      - der Import spiegelte 32 davon als lokale `rate_plans` mit Preis 0,00
        (der Eigenwert einer abgeleiteten Rate ist immer 0 — sie erbt ja),
      - `sync_content` schrieb sie danach mit `rate_mode: manual` zurück und
        zerstörte damit die Ableitung vom echten Grundpreis-Plan,
      - in der Preise-Seite machten sie `multiPlan` wahr und nahmen dem Objekt
        die Grundpreis-Eingabe.
    Wer eine Channex-Rate-Plan-Liste verarbeitet, prüft das hier — an EINER
    Stelle, nicht je Aufrufer.
    """
    bezug = (eintrag.get("relationships") or {}).get("channel") or {}
    kennung = (bezug.get("data") or {}).get("id")
    return str(kennung) if kennung else None


# Feldnamen, unter denen die Portale den ECHTEN Buchungszeitpunkt liefern.
# Reihenfolge = Verlässlichkeit. Airbnb: `booked_at`. Booking.com liefert keins
# davon — dort steht der Zeitpunkt nur in der Originalmeldung (`raw_message`),
# siehe `_aus_rohmeldung` als letzte Stufe. Neue Kanäle tragen ihren Feldnamen
# HIER ein — nicht an der Anzeigestelle, sonst hat der nächste Leser wieder
# eine eigene Regel.
_BUCHUNGSZEIT_FELDER: Final = ("booked_at", "ota_booked_at", "created_at")


def ota_buchungszeitpunkt(attrs: dict[str, object]) -> str | None:
    """WANN der Gast beim Portal gebucht hat — nie, wann WIR es erfahren haben.

    DER FEHLER, DEN DIESE FUNKTION VERHINDERT (live 06.08.2026): Der Posteingang
    zeigte 22 Airbnb-Buchungen als „heute 10:48". Real gebucht waren sie am
    23.03., 01.06. und 26.07. — die älteste viereinhalb Monate alt. Angezeigt
    wurde der Zeitpunkt, zu dem der Feed sie in einem Rutsch abholte; alle 22
    trugen deshalb DIESELBE Sekunde, und die Sortierung „letzte Aktivität" war
    wertlos.

    DIE REGEL, die daraus folgt und die überall gilt: Ein Zeitstempel, den WIR
    setzen (`created_at`, Feed-Eingang, `inserted_at` des Aggregators), darf nie
    als Zeitpunkt eines fremden Ereignisses ausgegeben werden. Er beschreibt
    unsere Verarbeitung, nicht die Handlung des Gastes. Fehlt der echte Wert,
    ist die Antwort `None` — die Oberfläche sagt dann „Eingang bei uns" statt
    einen plausiblen falschen Zeitpunkt zu behaupten (Wurzel 4).

    Warum `created_at` trotzdem in der Liste steht: Es ist Airbnbs eigenes
    Anlagedatum der Reservierung (in deren Payload, nicht unseres) und liegt
    live wenige Sekunden vor `booked_at` — ein brauchbarer Ersatz aus DERSELBEN
    Quelle. Unser eigenes `created_at` erreicht diese Funktion nie: sie sieht
    nur die Portal-Antwort.
    """
    for feld in _BUCHUNGSZEIT_FELDER:
        wert = ota_zeitstempel_utc(attrs.get(feld))
        if wert:
            return wert
    aus_meldung = _aus_rohmeldung(attrs.get("raw_message"))
    if aus_meldung:
        return aus_meldung
    return _aus_stornostaffel(attrs)


def _aus_stornostaffel(attrs: dict[str, object]) -> str | None:
    """Buchungszeitpunkt aus der Storno-Staffel des Portals.

    Booking.com liefert bei einem Teil der Buchungen weder `booked_at` noch
    `raw_message` — aber immer `rooms[].meta.cancel_penalties`. Deren ERSTE
    Stufe beginnt im Buchungsmoment: sie ist die Regel, die „ab jetzt" gilt.
    Live geprüft an BDC-5716807885 (12.08.2026): erste Stufe
    `from = 2026-08-12T22:01:18`, Channex' eigener Eingang 22:02:39 — 81
    Sekunden später. Ohne diesen Griff blieb `booked_at` leer und die Buchung
    stand in der Liste unter unserem Eingangstag.

    Bewusst die LETZTE Stufe der Kette: Es ist eine Ableitung aus der Quelle,
    kein gemeldeter Zeitpunkt. Sie greift nur, wenn das Portal nichts Besseres
    liefert — und ist trotzdem eine Aussage der Quelle, nie unsere Uhr
    (Wurzel 5b).
    """
    rooms = attrs.get("rooms")
    if not isinstance(rooms, list):
        return None
    frueheste: str | None = None
    for room in rooms:
        if not isinstance(room, dict):
            continue
        meta = room.get("meta")
        strafen = meta.get("cancel_penalties") if isinstance(meta, dict) else None
        if not isinstance(strafen, list):
            continue
        for stufe in strafen:
            if not isinstance(stufe, dict):
                continue
            wert = ota_zeitstempel_utc(stufe.get("from"))
            # Die früheste Stufe ist der Buchungsmoment; späterer Beginn wäre
            # eine Frist, kein Zeitpunkt der Handlung.
            if wert and (frueheste is None or wert < frueheste):
                frueheste = wert
    return frueheste


def _aus_rohmeldung(roh: object) -> str | None:
    """Buchungszeitpunkt aus der Originalmeldung des Portals (`raw_message`).

    Booking.com liefert KEIN `booked_at` — der Zeitpunkt steht nur in der
    durchgereichten Meldung als `date` + `time` („2025-12-31", „10:41:55").
    Ohne diesen Griff blieb `reservations.booked_at` leer, und der Posteingang
    sortierte die Booking-Buchungen nach unserem Eingang: sechs Reservierungen
    aus Dezember bis Mai standen dort als „heute", alle mit derselben Minute
    (live 07.08.2026). Das ist derselbe Fehler, den `ota_buchungszeitpunkt` für
    Airbnb schon verhindert — nur über ein anderes Feld.

    Der Posteingang packte die beiden Felder bereits für die ANZEIGE aus
    (`_ota_buchungszeit`), der Wert kam aber nie in der Spalte an, an der die
    Sortierung hängt. Deshalb steht die Regel jetzt hier, im einen Helfer.

    Ohne `date` gibt es nichts — dann bleibt es bei `None` und die Oberfläche
    nennt „Eingang bei uns" (Wurzel 4).
    """
    if isinstance(roh, str):
        try:
            roh = json.loads(roh)
        except ValueError:
            return None
    if not isinstance(roh, dict):
        return None
    datum = str(roh.get("date") or "").strip()
    if not datum:
        return None
    zeit = str(roh.get("time") or "").strip()
    return ota_zeitstempel_utc(f"{datum}T{zeit}" if zeit else datum)


# Der `customer`-Block einer OTA-Buchung → unsere `reservations`-Spalten.
#
# Vollständig, nicht handverlesen. Vorher zählte der Buchungs-Sync vier Felder
# einzeln auf (mail/phone/language/country) — `city`, `address` und `zip`
# fielen auf den Boden, obwohl Channex sie unter genau diesen Schlüsseln führt
# (Open-Channel-Spezifikation: name, surname, country, city, address, zip,
# mail, phone, language, company) und Booking.com sie in `OTA_HotelResNotif`
# überträgt (`<CityName>`, `<AddressLine>`, `<PostalCode>`). Sichtbar wurde es
# als „Ort: —" in der Gästekarte: die Anzeige baut den Ort aus `city` +
# `country`, der Wert kam nur nie an.
#
# Mehrere Quellschlüssel je Spalte, weil die Portale sie verschieden benennen
# (`mail` bei Channex, `email` bei anderen Wegen). Der erste befüllte gewinnt.
_GAST_FELD_QUELLEN: dict[str, tuple[str, ...]] = {
    "guest_email": ("mail", "email"),
    "guest_phone": ("phone", "telephone"),
    "guest_language": ("language", "lang"),
    "guest_country": ("country", "country_code"),
    "guest_city": ("city",),
    "guest_address": ("address", "address_line"),
    "guest_zip": ("zip", "postal_code", "zip_code"),
}


def gastfelder_uebernehmen(customer: dict[str, object]) -> dict[str, object]:
    """Alle Gastfelder einer OTA-Buchung → Spalten der Reservierung.

    Nimmt, was das Portal liefert — kein Feld wird unterwegs verworfen. Was
    fehlt, bleibt `None` statt einen Ersatzwert zu bekommen (Wurzel 4): ein
    leeres Feld heißt „das Portal hat es nicht geschickt", und genau das muss
    die Oberfläche zeigen dürfen.

    Wird an EINER Stelle gepflegt, weil derselbe Block aus zwei Richtungen
    kommt (Live-Feed und Bestands-Import) und beide dieselben Spalten füllen.
    """
    werte: dict[str, object] = {}
    for spalte, schluessel in _GAST_FELD_QUELLEN.items():
        for k in schluessel:
            wert = customer.get(k)
            if isinstance(wert, str):
                wert = wert.strip()
            if wert not in (None, "", [], {}):
                werte[spalte] = wert
                break
        else:
            werte[spalte] = None
    return werte


def ist_bestandsimport(attrs: dict[str, object]) -> bool:
    """Ob diese Buchung aus einem Bestands-Import stammt (0308).

    Der Import ist ein ANDERER, ärmerer Datenpfad als der Live-Eingang, und
    genau das macht ihn zur Falle: die Gastfelder sind leer, und das sieht wie
    ein Datenverlust aus. Booking.com holt Altbuchungen über einen eigenen
    Endpunkt (`reservationssummary`) und liefert dort dokumentiert „only summary
    information … no guest details, other than the guest's name"; Channex
    schreibt dasselbe zu seinem Import-Knopf („will not include … Personal
    Details like email, address, telephone etc."). Für Airbnbs Historien-Import
    gilt es genauso.

    Zwei Merkmale, weil `meta.is_imported` in der Channex-Doku NICHT beschrieben
    ist — es ist live gemessen (07.08.2026, alle sechs Booking-Buchungen der
    FeWo *Stjerneskud*), aber nicht zugesichert. Fällt es weg, trägt die Notiz
    „Imported Booking" die Aussage weiter.

    Im Zweifel `False`: eine Buchung fälschlich als Import zu markieren würde
    echte fehlende Daten wegerklären.
    """
    meta = attrs.get("meta")
    if isinstance(meta, dict) and meta.get("is_imported") is True:
        return True
    notes = attrs.get("notes")
    return isinstance(notes, str) and "imported booking" in notes.lower()


class ChannelManagerError(Exception):
    """Fehler im channel_manager-Slice (an die API weitergereicht)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def ota_cancel_penalties(attrs: dict[str, Any]) -> list[dict[str, Any]] | None:
    """Storno-Staffel des Portals aus allen Zimmern, chronologisch.

    Bei einer Buchung mit mehreren Zimmern liefert jedes Zimmer seine eigene
    Staffel; für die Anzeige zählt der Zeitverlauf, deshalb zusammengeführt
    und nach `from` sortiert. None = keine geliefert — ausdrücklich NICHT
    „kostenfrei stornierbar" (Wurzel 4).
    """
    gesammelt: list[dict[str, Any]] = []
    for room in attrs.get("rooms") or []:
        if not isinstance(room, dict):
            continue
        meta = room.get("meta")
        strafen = meta.get("cancel_penalties") if isinstance(meta, dict) else None
        if not isinstance(strafen, list):
            continue
        for stufe in strafen:
            if isinstance(stufe, dict) and stufe.get("from"):
                gesammelt.append(
                    {
                        "from": str(stufe.get("from")),
                        "amount": stufe.get("amount"),
                        "currency": stufe.get("currency"),
                    }
                )
    if not gesammelt:
        return None
    gesammelt.sort(key=lambda s: s["from"])
    return gesammelt

def ota_notes_text(attrs: dict[str, Any]) -> str | None:
    """Notes-Block des Portals im Klartext.

    Booking.com transportiert darin Dinge, die sonst nirgends stehen:
    „** THIS RESERVATION HAS BEEN PRE-PAID **", „Payment Collect: OTA
    collect", „OTA Commission: 805.95" sowie Sonderwünsche des Gastes.
    „Imported Booking" ist der Platzhalter, den Channex bei der
    Bestandsübernahme selbst schreibt — er ist keine Information über die
    Buchung und wird deshalb verworfen (sonst stünde er in jeder der 51
    Alt-Buchungen als angeblicher Portal-Hinweis).
    """
    wert = str(attrs.get("notes") or "").strip()
    if not wert or wert.lower() == "imported booking":
        return None
    return wert

def ota_zusatzdetails(attrs: dict[str, Any]) -> dict[str, Any] | None:
    """Weitere Portal-Angaben, die den Empfang betreffen (0384).

    Alles aus der Quelle, nichts abgeleitet: Policies-Klartext, Verpflegung,
    Rauchen, Alter der Kinder, Gast-Labels („Genius Booker"), die RUID des
    Portals und die Preis-Details (Gast-/Hotel-Sicht mit Gebührenarten).
    Leeres Ergebnis → None statt eines leeren Objekts, damit die Anzeige
    „nichts geliefert" von „geliefert, aber leer" unterscheiden kann.
    """
    details: dict[str, Any] = {}
    for schluessel in ("ruid", "arrival_hour", "secondary_ota"):
        wert = attrs.get(schluessel)
        if wert:
            details[schluessel] = wert
    labels = attrs.get("guest_labels") or attrs.get("labels")
    if isinstance(labels, list) and labels:
        details["guest_labels"] = labels
    raeume: list[dict[str, Any]] = []
    for room in attrs.get("rooms") or []:
        if not isinstance(room, dict):
            continue
        meta = room.get("meta") if isinstance(room.get("meta"), dict) else {}
        eintrag = {
            k: meta.get(k)
            for k in ("policies", "meal_plan", "price_details", "room_remarks")
            if meta.get(k)
        }
        occupancy = room.get("occupancy")
        if isinstance(occupancy, dict) and occupancy.get("ages"):
            eintrag["children_ages"] = occupancy["ages"]
        if eintrag:
            raeume.append(eintrag)
    if raeume:
        details["rooms"] = raeume
    return details or None
