"""Geteilte Modul-Helfer des channel_manager-Slices.

Logger, Wochentags-/Zeitzonen-/Property-Type-Konstanten und die
Slice-Exception. Patch-Ziel für Tests, die Modul-Helfer ersetzen wollen
(NICHT channel_manager.service — die Mixins binden die Namen von hier).
"""
from __future__ import annotations

import json
import re
from typing import Any, Final

from src.core.logging import get_logger

log = get_logger("nextdays.channel_manager")

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
_CHANNEX_ROOM_FACILITY: dict[str, str] = {
    # --- in_room (104) ------------------------------------------------
    "accessible_by_lift": "91387c6b-ac21-46f1-ab1b-1147550d8fe1",  # Accessible by Lift
    "adapter": "8634a6bd-c39a-4605-9086-00f557d00976",  # Adapter
    "air_purifiers_available": "09233650-f44a-479a-8d8b-ba8efbf1f4bd",  # Air purifiers available
    "airconditioning": "9f5726e2-f979-4b6b-a69e-cbca387bc7ea",  # Airconditioning
    "alarm_clock": "d178a656-7a19-4746-b4dc-51cee4dc972f",  # Alarm Clock
    "allergy_free": "8f3a1651-61b8-4a59-b784-d705a82c5942",  # Allergy-Free
    "blu_ray_player": "f051a21f-3502-42fe-8b3e-4cbbe3d4284f",  # Blu-ray player
    "board_games_puzzles": "60fd8f18-6f70-4f31-9c8a-ea97ef7f1044",  # Board games/puzzles
    "book_dvd_music_library_for_children": "d93edfee-5982-4383-8894-dba0ce19fa4c",  # Book/DVD/Music
    "bottle_of_water": "9f24a2a3-f9ae-4148-86c4-e98d30595bd0",  # Bottle of water
    "cable_channels": "5df87db0-20dd-4b61-aa5d-fc747f1fd131",  # Cable channels
    "carpeted_floor": "76f91345-8533-4229-af7c-e02a16d58326",  # Carpeted Floor
    "cd_player": "fe401975-d69f-492b-9235-05d988591f5a",  # CD-Player
    "children_crib_cots": "8800f0e8-ab2f-44da-b03e-18f10634094f",  # Children crib/cots
    "chocolate_cookies": "45f637e0-1603-4d2e-a40a-6bff922d0b67",  # Chocolate/cookies
    "clothes_drying_rack": "dd5a9eee-10b0-49a0-90b5-60834b2449b8",  # Clothes drying rack
    "clothes_rack": "68189e53-293b-4451-b5ce-289de9dffd78",  # Clothes Rack
    "clothing_iron": "2432ffaa-c4a1-4ef1-a567-551bb506d01a",  # Clothing Iron
    "coffee_machine": "25b7cd4a-ce28-4806-a198-8d00e55b3ef8",  # Coffee Machine
    "coffee_tea_maker": "1ef9743d-1c68-4655-b09d-22486655d317",  # Coffee/Tea maker
    "computer": "57e1258a-811a-4e4f-abf4-8865fb7c1c2c",  # Computer
    "desk": "3eb5450a-df8b-4d3e-9262-b57fc3e6b8f8",  # Desk
    "detached": "1b881f9e-185a-4f8d-a7c1-942bb8e40b4e",  # Detached
    "dining_area": "34295a62-f21e-4d10-b68f-1acdc890e1ae",  # Dining Area
    "dining_table": "fb5c935f-aeb5-47f7-8a47-6ca6a9482f34",  # Dining table
    "dressing_room": "1fb5e30b-60ed-46be-be56-48516b9b9751",  # Dressing room
    "dvd_player": "f54eaa9b-e4ce-464d-b11b-8321b12425cd",  # DVD-Player
    "earplugs": "edb07472-eb22-4dfe-adc7-989b13567a3b",  # Earplugs
    "electric_blankets": "80ff0812-967b-4d9b-973e-4abeaed1f203",  # Electric blankets
    "electric_kettle": "dc2f15c1-2f6a-4985-80a9-6228acd0ae18",  # Electric Kettle
    "entire_property_on_ground_floor": "a2a0746e-7848-4869-8bc6-cb29cd3e4a65",  # Entire property on
    "entire_unit_wheelchair_accessible": "1f39462f-0cdd-489f-854a-db06485271c6",  # Entire unit whee
    "executive_lounge_access": "ee5bd5e0-0c4b-45c0-8051-f66e2e5cc849",  # Executive Lounge Access
    "fan": "1a5e21d0-6682-44c0-875c-90a5d933e9e8",  # Fan
    "fax": "5d0f6cd3-05a5-446e-9d29-a10a6767aeb9",  # Fax
    "feather_pillow": "b3e1b973-e8ee-48b2-b6d4-ffe1c7f40b91",  # Feather pillow
    "fireplace": "feffe2ff-67eb-4162-bcd8-01907c5500c6",  # Fireplace
    "flat_screen_tv": "adcc9a15-1aaf-4e02-836a-829ae41f2585",  # Flat-screen TV
    "fruits": "adb7b6f5-d128-4bba-af55-d60c214386e8",  # Fruits
    "game_console": "2bbd0abf-582f-4bdb-803f-28dff73d4347",  # Game Console
    "game_console_nintendo_wii": "7c2b3edf-8c84-4650-a4e8-6fa395b4fd80",  # Game Console - Nintendo
    "game_console_ps2": "33361884-d382-474e-9490-5078955ee840",  # Game Console - PS2
    "game_console_ps3": "cf65a800-96ce-4279-95c7-8a9f69916d12",  # Game Console - PS3
    "game_console_ps4": "706025e2-7287-4c6f-b813-9da1ec2b2cd4",  # Game console - PS4
    "game_console_wii_u": "2c60d416-4f89-44bd-a130-a2ba37e93f14",  # Game console - Wii U
    "game_console_xbox_360": "e87b74f3-0c7e-447e-adaa-37115199c5f5",  # Game Console - Xbox 360
    "game_console_xbox_one": "68defca6-26ea-4bf3-b014-1478eab8ea2c",  # Game console - Xbox One
    "hair_dryer": "36a4bcae-e011-4552-9088-7ebb9905ead1",  # Hair Dryer
    "hand_sanitiser": "049b2bd9-1df1-4a98-bda2-b064b8dacd81",  # Hand sanitiser
    "heating": "85dd90ff-d582-45a2-b6f9-b86155709deb",  # Heating
    "hypoallergenic_pillow": "a461c536-8b45-4495-b0be-3684a962fe19",  # Hypoallergenic pillow
    "interconnecting_room_s_available": "149cab67-c1d1-4941-b293-ada358266088",  # Interconnecting R
    "internet_facilities": "5e359056-5a69-4876-9aef-7a961db18d79",  # Internet facilities
    "ipad": "fa1d3fb6-9dc1-487e-aa54-3ff80dd7deb8",  # iPad
    "ipod_docking_station": "da57d6ff-f6e4-4e61-a0e2-2a99c7b7b389",  # iPod Docking Station
    "ironing_facilities": "734d5dfe-808e-43ef-82bd-54e7899da670",  # Ironing facilities
    "kitchen_2": "ed24b421-9355-49e7-9a07-624c3c14b2d2",  # Kitchen
    "kitchenware": "95999f89-538b-487c-b483-bcb4512f7d89",  # Kitchenware
    "laptop": "59facc8c-3c35-4850-b2b2-09d3486e366e",  # Laptop
    "linen": "0b23cbf0-146c-4946-9010-33461db44b05",  # Linen
    "mini_bar": "6d03ddf6-2bed-4a39-bae2-55f5f5a87d1e",  # Mini-bar
    "mosquito_net": "767c0199-ed22-427d-a881-4d47fdb5604e",  # Mosquito Net
    "non_feather_pillow": "7580470f-aae3-4b0a-9bb3-69fe5020f2a5",  # Non-feather pillow
    "outdoor_dining_area": "2d6a0bee-c2e2-4218-a1f4-4fc6d0b93e99",  # Outdoor dining area
    "outdoor_furniture": "7eac1383-5c6b-438f-b478-4bad6740bb3a",  # Outdoor furniture
    "pajamas": "01780dda-5833-40b5-8525-287a756d2523",  # Pajamas
    "patio": "e80dcf2d-c9c5-4619-89da-c628d260e841",  # Patio
    "pay_per_view_channels": "0a2f07c4-e448-4b7e-b9af-aca76ec09b2a",  # Pay-per-view Channels
    "portable_wifi": "c3bff477-2af5-4c39-b248-ff0f66f931ce",  # Portable Wifi
    "private_curtain": "3d2243ce-5482-491a-99fd-d25d2c2c3427",  # Private curtain
    "private_entrance": "fbae965b-e7f6-4233-8d06-4281be9b8de6",  # Private Entrance
    "private_flat_in_block_of_flats": "3843e479-7c37-4620-86d1-cba820259d3b",  # Private flat in blo
    "radio": "d7a28169-c126-4c47-81c7-31929cb9200e",  # Radio
    "reading_light": "896ed74e-6171-4271-a7b8-289345d6b48d",  # Reading light
    "rollaway_bed": "5b9d9717-6c9d-4c2e-84ed-1af3ed2dc583",  # Rollaway bed
    "satellite_channels": "35083174-001d-4994-a668-c09e0e4936e1",  # Satellite Channels
    "seating_area": "66be0b40-6e0f-4335-84a8-08073947d52b",  # Seating area
    "semi_detached": "2bd661ad-3383-4407-b8dd-371c9c8a3d67",  # Semi-detached
    "single_room_air_conditioning_for_guest_accommodation": "b8957812-40db-4739-b456-8798464d7f6f",
    "slippers": "e779da1e-e497-4e41-9c39-0f7590b123b0",  # Slippers
    "smartphone": "8d30f1a3-4ba7-4535-a4ea-40a8d0d41170",  # Smartphone
    "socket_near_the_bed": "d5cca542-3e66-4b6a-9495-7724ac4ed2e2",  # Socket near the bed
    "sofa": "b57f3bc2-a1c5-4e2c-8b20-07fdd2eab0ed",  # Sofa
    "sofa_bed": "96be8ba8-d046-4720-91b8-0b4078cb2a30",  # Sofa bed
    "soundproofing": "5c2db353-cb7b-4f74-82a2-b965dc97b2b0",  # Soundproofing
    "streaming_service_such_as_netflix": "68102d87-507b-40c8-bdae-a0689c33b3d3",  # Streaming servic
    "telephone": "3a5ef7dd-2915-4be5-b4b0-e13d15574321",  # Telephone
    "terrace": "692964cb-c34d-40c2-bc9a-57704995cbb2",  # Terrace
    "tiled_marble_floor": "84377e63-ee27-469e-9a2d-c45eeb6bf098",  # Tiled / Marble floor
    "towels_linens_at_surcharge": "5d6bdfaa-ec91-4916-b6fc-6e95ba1349da",  # Towels/Linens at surcha
    "trash_cans": "53c2ee74-3fa4-40e8-9323-7a3323d28c4d",  # Trash cans
    "trouser_press": "e238d254-3127-48ae-af9f-3ddc3cee0f95",  # Trouser Press
    "tv": "724b54ce-57d3-4751-9c10-76844a6fa2ed",  # TV
    "upper_floor_reachable_by_lift": "79293955-571f-441c-8f78-3e06de6ca2fe",  # Upper floor reachabl
    "upper_floor_reachable_by_stairs_only": "9a52fb40-af99-4446-b7d6-f2c33eb1420a",  # Upper floor r
    "video": "aa5ef885-76b5-4a25-a418-48a496178272",  # Video
    "video_games": "fd7d9a39-c94f-4226-9146-328ad99f833c",  # Video Games
    "wake_up_service": "a28b42c9-b6af-4b03-a559-017ab0dab443",  # Wake Up Service
    "wake_up_service_alarm_clock": "de2300fd-b800-428d-8ca4-82413d0c1e0b",  # Wake Up Service/Alarm-
    "wardrobe_closet": "c8f2272d-412b-455f-b38a-b7c99ddf96c0",  # Wardrobe/Closet
    "wine_champagne": "0bb8cfc9-da4e-49df-952c-065e5a3b3637",  # Wine/champagne
    "wireless_internet": "6556b81d-62e2-454b-bdb7-b9b11f6bf57c",  # Wireless internet
    "wooden_parquet_floor": "6881538d-f9bf-48b4-9db8-f5ceb13439ec",  # Wooden / Parquet floor
    "yukata": "c3bb9a7c-89a1-4a5a-ba0d-c0b33a339447",  # Yukata
    # --- bathroom (29) ------------------------------------------------
    "adapted_bath": "4e4d755c-53b4-454f-a7ed-7d3219990a8d",  # Adapted bath
    "additional_bathroom": "d6ba30e9-f1af-46c9-8280-26c2713c8887",  # Additional Bathroom
    "additional_toilet": "2a0b62db-a859-4b8e-9258-f26bb0496368",  # Additional Toilet
    "bath": "b90c4165-fd52-4136-a822-3b7365530272",  # Bath
    "bath_or_shower": "93d62abc-cafb-4976-9ee0-b825b826fe91",  # Bath or Shower
    "bath_robe": "05ecc6c3-a84b-4f2f-97f0-f91444d6928b",  # Bath-robe
    "bathroom": "cd7b1937-8405-45a5-9800-28c91235f528",  # Bathroom
    "bidet": "dced3634-738b-4c97-ba87-97b0c54c788e",  # Bidet
    "body_soap": "015971a8-f7ac-4c49-8830-bc1c2a04235e",  # Body soap
    "conditioner": "09db5951-b023-44a6-8b39-e6772605b9ab",  # Conditioner
    "free_toiletries": "dc403823-544e-4f17-8a35-541ddb639b15",  # Free Toiletries
    "guest_toilet": "a5f3b37f-fa7d-4fc5-8525-ea4f9f775f06",  # Guest toilet
    "higher_level_toilet": "000df3c4-9b1f-481f-b9b4-366ae3259020",  # Higher level toilet
    "hot_tub": "2b85eb67-c28a-45a9-a7d6-147f0e2391db",  # Hot Tub
    "kitchen": "50460002-dfb9-48c1-89bb-39cd817886e3",  # Kitchen
    "low_bathroom_sink": "0ac1b55e-316f-40d7-88b5-32deece6cd21",  # Low bathroom sink
    "roll_in_shower": "0a79bbec-98f4-4158-9b5a-4439b627bc8a",  # Roll in shower
    "sauna": "2a0ccd2b-d60f-4867-9f0c-0efd64458e21",  # Sauna
    "shampoo": "bfada419-fc0e-45ca-a165-1e786d8b9827",  # Shampoo
    "shower": "179c91be-836f-497f-9329-3acb333c85b1",  # Shower
    "shower_cap": "5a4b53af-7528-4968-8840-e048d65c4156",  # Shower cap
    "shower_chair": "f31c84b7-9ef5-409e-97c8-1bc24d481a7d",  # Shower chair
    "spa_bath": "d3a8da55-c2b8-472d-9837-899c992ed2db",  # Spa Bath
    "toilet": "eaae277c-1319-4f06-8431-d80fccd56d9b",  # Toilet
    "toilet_paper": "a59ddfed-93eb-4bcf-b52e-efc1c3119298",  # Toilet paper
    "toilet_with_grab_rails": "06121f37-605b-409d-a532-75f1d8a55837",  # Toilet with grab rails
    "toothbrush": "89502560-0080-4ca5-8169-ef4dc8e7bd64",  # Toothbrush
    "towels": "bb81debf-dbe5-43ab-912d-33e20c09e856",  # Towels
    "walk_in_shower": "f4bdd30f-16ca-4a65-adbb-75ba8eff33c0",  # Walk in shower
    # --- kitchen (14) -------------------------------------------------
    "barbecue": "2b9c558b-929c-46cc-9fc8-f7ce00fadd74",  # Barbecue
    "children_highchair": "22fc45ad-d19f-403a-93d0-4bc8d376c72a",  # Children highchair
    "cleaning_products": "287ad07a-6bcd-43eb-b67a-2e05a12ca565",  # Cleaning products
    "dishwasher": "3efbafc4-8452-4550-a09e-fe11158323e3",  # Dishwasher
    "kitchenette": "ee13f1e7-3cd6-43a1-91de-d94bad4761fe",  # Kitchenette
    "microwave": "a78e66d0-627e-4137-b23a-0c5ffcb4bc00",  # Microwave
    "oven": "dd69d2c1-4db1-47f1-8972-1ada843cf71f",  # Oven
    "refrigerator": "ea4cb7eb-44b0-439f-94ff-ddf23ae201c0",  # Refrigerator
    "shared_bathroom": "ddeaa4d8-4326-44bb-8bd4-622082167bcb",  # Shared Bathroom
    "stove": "048c0626-42fb-459c-bf3e-4364f516a1c1",  # Stove
    "toaster": "229ee913-a5a4-4a43-a317-18c28943c632",  # Toaster
    "tumble_dryer_machine": "59243f96-a974-41b0-a9ee-ca474b42b288",  # Tumble dryer (machine)
    "washing_machine": "e6e819a8-004e-498e-a578-c400a7171702",  # Washing machine
    "wine_glasses": "2b2c3104-af84-4c11-bcaf-1d621c1e5735",  # Wine glasses
    # --- view (12) ----------------------------------------------------
    "city_view": "65b3dc4b-2aac-4d42-b58e-1086b858919d",  # City View
    "extra_long_beds_2_meter": "32458d03-ae85-4de4-96ee-2578733d7332",  # Extra long beds (> 2 meter
    "garden_view": "8111bbfc-1894-45bd-bd90-bf5bc9b0b464",  # Garden View
    "inner_courtyard_view": "d55f1956-d789-4808-b0fa-adeeefe018fd",  # Inner courtyard view
    "lake_view": "d1aa2806-0228-4ed0-b482-1da9d8c9b5c2",  # Lake View
    "landmark_view": "15ed9ede-0c7f-4999-9041-d34ee776b8c5",  # Landmark View
    "mountain_view": "217a3ec9-9950-4063-9252-af2df78f36d0",  # Mountain View
    "pool_view": "be8d5cde-f04a-415d-9183-13f5373c40bb",  # Pool View
    "quiet_street_view": "abe5192f-3d79-4c59-84de-9e6909c2e1db",  # Quiet street view
    "river_view": "36217e86-01c2-424c-8d81-b7573cf192c0",  # River View
    "sea_view": "e1d990b0-683c-4d1f-9151-c46c21aa6801",  # Sea View
    "view": "368b09d5-0216-4e56-a059-773aee692293",  # View
    # --- outside (11) -------------------------------------------------
    "balcony": "363c2057-2cdf-4cbc-af98-069c2d573952",  # Balcony
    "heated_pool": "c8326e3f-a604-4005-9d88-d1ed73d55b51",  # Heated pool
    "infinity_pool": "59a07ade-8295-4986-aed9-77061f98bd86",  # Infinity pool
    "plunge_pool": "68aa269b-e6d6-4c81-984b-a90cf06eed05",  # Plunge pool
    "pool_cover": "80a22363-42da-444d-9320-99d29f2a435c",  # Pool cover
    "pool_towels": "77d508fa-b24a-4cc3-b652-fa4db6bcbf4a",  # Pool towels
    "pool_with_view": "4be6a43b-a2ec-49d3-8360-dcb35a89503b",  # Pool with view
    "private_pool": "0f209b31-10cf-43cc-84b9-711de0af3de4",  # Private Pool
    "rooftop_pool": "42c5fe02-42c7-4010-a1a2-a1b93dc8db5a",  # Rooftop pool
    "salt_water_pool": "a1ad93b4-9bc8-4b29-9d44-159ba5560fa1",  # Salt-water pool
    "shallow_end": "828e1b0d-9332-460c-9ce3-5d36da51667d",  # Shallow end
    # --- general (9) --------------------------------------------------
    "100_amps": "24a71bda-9f95-4615-b1b4-ba168df9d0bb",  # 100 Amps
    "20_amps": "bd554c55-65b8-4276-acc7-47ca59cebe51",  # 20 Amps
    "30_amps": "ef79dabf-ad63-496b-be2e-3fc9afb04059",  # 30 Amps
    "50_amps": "52ce6b74-98e3-4921-b4eb-9df84940e1bb",  # 50 Amps
    "big_rig_friendly": "fd73b4af-5ab9-496c-b8e2-8c89670753e1",  # Big Rig Friendly
    "dump_station": "e1af325c-df9d-46aa-99d8-c50460483017",  # Dump Station
    "sewer_hookups": "247a0561-f8d6-43b9-a8a1-4744504afbc3",  # Sewer Hookups
    "slide_outs": "c938c7f9-89a1-4b99-8d1c-b03edad030b4",  # Slide Outs
    "water_hookups": "93ac2f6a-e4ec-4835-9718-f9b148a0c857",  # Water Hookups
    # --- security (12) ------------------------------------------------
    "baby_safety_gates": "4d7cc1cd-d79f-407b-9be4-eb0af95e1bd5",  # Baby safety gates
    "bathroom_emergency_pull_cord": "1c3938ff-69f5-45cd-82ab-73f3f3c415a4",  # Bathroom emergency pu
    "carbon_monoxide_detector": "cbcc34e6-e55e-4490-a8e3-366d241a622d",  # Carbon monoxide detector
    "carbon_monoxide_source": "153222e6-8979-4471-85f7-542d9b7e2028",  # Carbon monoxide source
    "child_safety_socket_covers": "d7c42a62-a657-4bc8-99f1-abc23b473dbc",  # Child safety socket cov
    "electronic_key_card_access": "65ba915e-675c-462b-95b3-4fa91640a7a4",  # Electronic key card acc
    "fire_alarms_or_smoke_detectors": "f611ff99-75d8-4f47-8533-9c120f6af02a",  # Fire alarms or smok
    "fire_extinguishers": "553eb001-7395-4b20-82fa-912ede48fd81",  # Fire extinguishers
    "laptop_safe_box": "a1de83fe-e26c-494c-afb4-5dab9f003d56",  # Laptop Safe Box
    "lockers": "b7e1e7f9-58e7-462e-8d3a-b037bee370e9",  # Lockers
    "metal_keys_access": "a277b76c-d5e4-46d3-ba3e-5aa68a3a2664",  # Metal keys access
    "safe_deposit_box": "6e174877-c6e7-4ee7-a7af-abaaf07d72be",  # Safe Deposit Box
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
