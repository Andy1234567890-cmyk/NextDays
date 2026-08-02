"""Geteilte Modul-Helfer des channel_manager-Slices.

Logger, Wochentags-/Zeitzonen-/Property-Type-Konstanten und die
Slice-Exception. Patch-Ziel für Tests, die Modul-Helfer ersetzen wollen
(NICHT channel_manager.service — die Mixins binden die Namen von hier).
"""
from __future__ import annotations

import re
from typing import Any

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
    """IANA-Zeitzone für ein Land — None, wenn unbekannt (kein Fallback erfinden)."""
    return _TIMEZONE_BY_COUNTRY.get(code.upper())


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
_CHANNEX_FACILITY: dict[str, str] = {
    "24_hour_front_desk": "864d91a6-3a40-4098-a880-84b841e11adb",
    "24_hour_security": "5647179f-f62d-4560-a36c-1a44b6c36927",
    "accessible_parking": "cfd17530-e04f-423a-9851-2981a225ab14",
    "access_to_health_care_professionals": "69172f92-de58-4820-967d-043c4975cf60",
    "ada_accessible": "dbd55138-eafb-4c3b-a959-a5d813115558",
    "adult_only": "a6a4fe55-7f60-4e67-aa91-cd4323279ed2",
    "aerobics": "bacd5c8b-e9a9-46dd-ab2b-deb3c98fe870",
    "air_conditioning": "cc402cc0-696b-4bd6-a5d7-4adb060bc056",
    "airport_shuttle_free": "2713845c-2ec3-4674-846b-a45103134919",
    "airport_shuttle_srv_surcharge": "90a86233-88e1-448c-ad63-d705e13b28cb",
    "airport_shuttle_surcharge": "0ef03369-5cdd-49aa-b75c-0b353a3b9ea5",
    "tableware_sanitised": "1dcf703e-a5c0-4892-9dde-526441e13b99",
    "all_non_smoking": "9ebac99b-40f1-4e9d-ba36-d186868165e1",
    "archery": "d7f359de-1d8e-465d-9113-ff2fb411e962",
    "atm_on_site": "be00a2c1-58bc-4e71-a788-08853f892fb9",
    "auditory_guidance": "cd2fe4e5-7423-4db3-bf6c-d2ab648211f2",
    "baby_safety_gates": "e127e93c-8956-4608-bc35-753a0c652d7a",
    "baby_sitting": "66b95066-172e-47a5-8ede-21c52d8efcda",
    "back_in_rv_sites": "258f3e0c-b386-4538-a2a1-fbfba935b2f1",
    "back_massage": "c853057c-dd62-4331-88fe-b859006cac1a",
    "badminton_equipment": "55918185-c477-48b1-af9d-40847b13ade0",
    "baggage_storage": "24f98ce0-5717-47e1-bd95-c792bc9f6250",
    "bar": "f47cd66c-6074-440b-8a70-bc97e7178512",
    "bathroom_emergency_pull_cord": "43fff034-61ff-4743-95c7-75a8b7a9a24d",
    "bbq_picnic_area": "3226463a-5468-4886-b16f-3a7738e5679f",
    "beach": "c08ecda3-44e0-4ff7-8a71-2b7ee900d18f",
    "beachfront": "6e01a0aa-ad6d-4e16-be08-72b8dad77a34",
    "beauty_services": "a692efdc-3e1e-49a6-89eb-04e681410fa2",
    "bicycle_rentals": "a03977d0-efef-4e1e-ae93-3476819e4a33",
    "bike_parking": "40c6485b-000a-43b1-aea9-6525eaed2ad4",
    "bike_rental": "be217262-689c-4e67-94b1-a0ebf4cb5dde",
    "bikes_available_free": "698c0acc-02a1-4b92-bd7a-38b0ae83c5b1",
    "bike_tours": "dbfe2a79-3c83-4d38-9faf-0364ea1412b3",
    "billiard": "1e68dbd1-17f0-4047-821a-2899221f9e67",
    "bingo": "f31300fb-d6db-442a-943e-ff8129eefdb1",
    "board_games_puzzles": "362f98ee-fd43-4031-8fc3-1c4ab5adeeec",
    "body_scrub": "cc957036-aae8-4ba4-8328-ca4ce96ede59",
    "body_treatments": "551e15e8-8a6f-4e79-97fe-befc262345c0",
    "body_wrap": "f2e3892e-72d9-4aa3-a557-03719fb8e8e5",
    "book_dvd_music_library_for_children": "7f772ed8-c00e-4b48-a9df-e51a20e56044",
    "bottle_of_water": "151ccdd3-e7f9-4874-9bca-8a02ba871c32",
    "bowling": "8ed39a68-564c-4fc0-8861-0cbe74bea562",
    "breakfast": "3835ea28-7544-46b7-bbce-53b9d0e2fa3e",
    "breakfast_in_the_room": "0af3c819-1652-4b4b-a1ce-2d0a6d54e0fe",
    "breakfast_takeaway_containers": "53bbd5c3-27b8-49f0-a141-ff87f7b6eecc",
    "bridal_suite": "e84752fc-ba2f-406d-93be-6d9fe65dc867",
    "business_center": "fc1123be-3ad9-4634-a862-cc785197c86a",
    "cable_hookups": "79dd0213-2910-40ee-a2bc-fe9fa1843cbc",
    "canoeing": "66706e71-f403-404e-834a-d9bf1b5ce8bf",
    "carbon_monoxide_detector": "f7556d30-de6d-4d85-b3e3-0d998bbb852b",
    "carbon_monoxide_source": "07b4689e-ca6f-45e5-812b-eb6761724090",
    "car_rental": "50581878-7f63-4c29-8906-ff2b090e7c30",
    "cashless_payment_available": "5e53be27-f699-44ce-9411-887babf2d381",
    "casino": "120b9045-79b0-4fe1-ad59-12b690fff1bf",
    "cctv_in_common_areas": "985fb017-efcb-4677-b635-40304d21e43a",
    "cctv_outside_property": "f63da231-cb79-4389-a415-8abab6e5781f",
    "chapel_shrine": "73c55dbd-0cb9-4dde-9dee-ffa41f0f5f87",
    "children_television_networks": "2e8a5930-2e3e-48b6-bb96-d36cfe6a94be",
    "chocolate_cookies": "e1c547ca-3dee-430b-a80e-d18861ae2f51",
    "clubhouse": "305dc741-7d04-4286-a2d5-6185d60d75d4",
    "community_bbq_grill": "3b891bc0-527d-4127-bba9-5562273a40f1",
    "community_fire_pit": "ba5331f3-b26e-4050-a7b9-d87a996efd97",
    "community_restrooms": "62a9722e-24c4-4dee-8a9e-1f9bf08ecc5d",
    "community_showers": "27cd577f-02d2-4584-a840-654cc5de3969",
    "community_water_fountain": "544d41da-13f6-45b6-9c6d-d4e18e9804e0",
    "concierge_desk": "6411173c-9ec6-415b-89f8-46aaf6d4e7e3",
    "contactless_check_in_out": "c9c3078a-60c9-444d-bca6-bb40aae7b998",
    "cooking_class": "8c1cc8ab-e4ee-45d4-b1ad-0369fa1ccd1b",
    "couples_massage": "789d32a8-fdc8-4993-abae-54e716ad1a49",
    "currency_exchange": "7b5d53ad-5f2e-4167-be9f-5a1e42907d5e",
    "cycling": "7c699972-5ea9-4ad2-987d-f4d86ccf9c0c",
    "darts": "73d27967-0f00-402b-b66d-255d84839949",
    "food_securely_covered": "7e4d5375-6dc6-41c3-934b-5f334270a6f4",
    "designated_smoking_area": "c219b022-7123-4305-82bc-cd37d0127be1",
    "dinner": "17600689-ac7c-42d9-939b-0d6b591d5799",
    "dirt_roads": "1b2922aa-83fb-4236-b4e5-1b4ae7138026",
    "diving": "7b9bb814-a9e1-46cc-b82b-2b72ba0115d8",
    "drinking_water": "028eeb7a-9db5-4b54-94af-1a012a1838a1",
    "dry_cleaning": "f42a5ce2-088c-45e4-85df-a6362f3234d9",
    "electric_vehicle_charging_station": "9030aa2f-62b1-45b3-a452-41a8982e50bc",
    "elevators": "62c62700-89fb-4493-9069-ce79cc8c7ada",
    "entertainment_staff": "8152e3ba-166e-421e-bdf7-07b1fb21cb60",
    "evening_entertainment": "91b67db9-574a-4ad0-8996-9244c38f75de",
    "events_ticket_service": "a63d7d45-5e7f-4c78-a9af-823ba0188d44",
    "express_check_in_check_out": "0f9c160c-b3e9-43e1-b097-ecec2eb3ab75",
    "face_masks_for_guests_available": "6835bb86-56dc-48cb-9cff-6e8794ca8a24",
    "facial_treatments": "a2ab656a-004f-44f5-b88d-fbb8cb4e599b",
    "family_rooms": "fb53bfdd-7b16-4985-94a1-37325a023ec7",
    "fence_around_pool": "416265d0-cfa3-4084-a861-3fdc013bac35",
    "fire_extinguishers": "182d38d2-38bf-41de-a258-e5219a9c4bbb",
    "fire_pit": "ab6c6ea3-997e-48b3-a1d7-86a030191b8f",
    "fire_ring_grill": "d7773502-6270-40b0-8274-94eb9d2f1e5e",
    "first_aid_kit_available": "124edccf-939d-4b91-a96f-9dcac12abe2b",
    "fishing": "85802ed4-5153-4932-b729-793754ec4cf1",
    "fitness": "b2a61929-2c97-4a71-8292-8e4f5d2d75cf",
    "fitness_center": "9f3ae468-b3e1-4df0-aea8-3f85b7f9e6cf",
    "fitness_classes": "3d0d70f2-e312-42fb-b3cc-9712b040b190",
    "fitness_spa_locker_rooms": "adf49584-8b6c-4264-909a-ed5b7612666c",
    "foot_bath": "6e35c78c-8c18-49ee-89ef-68923caf05f4",
    "foot_massage": "a2c80834-b572-4d19-bd8e-433b5cf159df",
    "fruits": "05ae5e8c-3ac6-4ae3-9996-941b928d5f67",
    "full_body_massage": "6d8ee35b-2a52-43c2-9d66-f52a5266f17f",
    "game_room": "d703d8b3-612d-407c-aead-86a6de6923f7",
    "garden": "7fda90a7-90fb-4abe-a180-dfc1e9160af3",
    "gasoline_nearby": "ed1f91d7-e2f1-4349-ae3c-4031a3768613",
    "general_store": "efdbb9cd-9d48-4004-ad09-04ed24e52446",
    "golf_course_within_2_miles": "319ba06a-9593-4b79-ab0e-be48cf251986",
    "gravel_roads": "a9a580f1-63fc-4e2c-903a-ef144eedc5cb",
    "grocery_service": "a7e8a36e-b147-4bf6-ac86-73b22505bbb7",
    "disinfected_between_stays": "1601fd95-b6a1-47df-9602-c9c18071b18a",
    "sealed_after_cleaning": "161b2ab9-dda5-46f0-b79c-72f28715822c",
    "cleaning_optional": "fac58081-6e83-44c9-a8b8-a54c32dcc1bf",
    "hair_colouring": "45d4bb90-7328-4453-9a68-fd51d62e2afe",
    "hair_cut": "3c71779f-5509-49f2-8b29-81902a0a546c",
    "hair_dresser_beautician": "2dbc9241-2793-489d-9a14-5333d6828efa",
    "hair_styling": "cd8cb776-0128-42c2-87a8-d36de0f4fbc4",
    "hair_treatments": "02f9c6ca-3c44-4b88-b63a-49c4f8997aab",
    "hand_massage": "7e37569f-7ab7-4fc0-8ce9-e6156a80a99f",
    "hand_sanitiser": "adb51d29-3c84-4076-9bbd-70b40995bf16",
    "happy_hour": "bbbe2c8b-15cc-40b0-8207-794aa82f0cbd",
    "head_massage": "d8be8cef-7991-46e1-b913-282719d23a45",
    "heated_pool": "7b4c4429-29f4-4888-9437-f63dfbf85eb1",
    "heating": "47f8720e-1211-4f41-b47f-aca6166c6371",
    "higher_level_toilet": "58dd91ef-8b96-4d5c-b588-3379f5ac8206",
    "hike_bike_campsites": "5f833c11-9ed9-480b-bc87-f6979e631b89",
    "hiking": "9d6004e4-d627-4cc1-bebb-a3c5a1f6b95b",
    "horseback_riding": "72706ee2-a985-420a-af67-af390a7db518",
    "hot_spring_bath": "5681847a-35f2-4dca-b4c5-8f3006290285",
    "housekeeping_daily": "ac513017-ac8d-4adb-8d91-b77ac5288d4f",
    "hypoallergenic_room_available": "3bf22217-b491-416b-9efd-bc85a4ec6cd1",
    "indoor_parking": "07bb6fc3-2583-4c08-9ada-eaa8f5d87abd",
    "indoor_play_area": "5b73951a-2cd2-4434-a604-cc6f26619f7f",
    "indoor_pool": "b4ccd0d3-587f-4e50-8416-9448f70ebcca",
    "indoor_swimming_pool_all_year": "f6211fdb-325f-4e27-ab8b-fa92cdee895e",
    "indoor_swimming_pool_seasonal": "1548b756-8acb-4b64-bd8b-0546754fd22e",
    "infinity_pool": "01679d16-7d5b-478e-98df-fc0024b33917",
    "in_room_dining_options_available": "32ac9394-33a6-4a1b-9b6a-378a72850a3d",
    "invoices_provided": "47d95097-ac74-42ca-8555-d1df32ed85bf",
    "ironing_service": "5fdf9566-6fe0-4377-a469-cd2e4a12a950",
    "jacuzzi_hot_tub": "fb27532a-cad5-410e-aee8-f0cb05a39480",
    "karaoke": "8d9cd946-dd47-4ac8-bfe1-e65f4b7c99d3",
    "key_access": "448c5ba3-091a-428c-b9eb-338fdb53f17c",
    "key_card_access": "41c21c55-57b4-43a4-a642-19f1b4d2df76",
    "keycard_for_room_electricity": "8385dcb6-7c0e-4b47-8946-3e720d59b2cc",
    "kid_friendly_buffet": "d2dc4c64-2b3a-4c6c-9aa6-21d140a98b75",
    "kid_meals": "21b2426b-1a0e-4871-9796-e357ed74a850",
    "kids_club": "ccb09f00-f18a-4526-b2c0-691b303a38e3",
    "kids_outdoor_play_equipment": "5384a7e3-5829-4d48-910b-456c97fd28b3",
    "kids_pool": "a7962d26-df3f-45eb-a425-d2e9f4e15702",
    "laundry": "e313e9b9-dc1b-40ac-a100-ac5ea02dacac",
    "laundry_facilities": "6e1c2582-1520-429e-9ae5-45871418b229",
    "library": "9a419966-4ceb-40b3-9424-3583bc62ca30",
    "light_therapy": "f67dbfd7-502c-47f4-a2cc-233c7a09ab9f",
    "linens_washed_guidelines": "dc7e7c20-683b-49ef-a065-e447c26e7939",
    "live_music_performance": "1498643e-9c2f-4f77-9df9-ac8e70d51176",
    "live_sports_events_broadcast": "52a2d9a7-ff39-4168-9537-06dc58fda420",
    "lockers": "1e2526ff-bd9e-4025-823f-9a72e097a61c",
    "low_bathroom_sink": "c648e247-5fb5-4c7d-bb37-e7ded5acb7a2",
    "lunch": "a63807ff-8d87-4380-8b27-cef0b227969a",
    "make_up_services": "effcdff1-af36-4570-ae26-4465721fd32f",
    "manicure": "4780025d-b817-4899-96db-4b9bca93a728",
    "massage": "cf7a6fc9-4501-4015-9c11-d06b617bcbbc",
    "massage_chair": "e9d4a356-36fd-47c1-9829-be3c08d0ea66",
    "meeting_banquet_facilities": "962316cf-544c-4693-9dc8-56e70c15a3ed",
    "minigolf": "18fae0f6-abbf-4716-a9f8-d14b4713d16a",
    "minimarket_on_site": "b0b2967c-ea72-4db7-9921-68dd2b35b753",
    "mobile_app_for_room_service": "dd904ffb-6da4-4808-a5fc-4fa69a1c004c",
    "movie_nights": "ad49eeb4-da0d-4386-a036-2a431fb2c761",
    "neck_massage": "de873c64-b2ef-4bf5-a302-5f91abbcef08",
    "newspaper": "b1ec5953-e419-49af-a265-625055da168d",
    "nightclub_dj": "74690ab2-5880-40e4-8922-dbc27e015b60",
    "non_smoking_rooms": "bf382902-2be1-486c-a2b5-44d09efb7def",
    "on_site_coffee_house": "d9f0eb5f-2b97-4561-b836-402c99f27d85",
    "open_air_bath": "98f05e20-1fc5-4322-8e6d-da49332821ac",
    "opt_out_from_daily_room_cleaning": "ab097c4a-e857-49c2-91f1-ef9dc18d0c93",
    "outdoor_fireplace": "90bd3d22-3ee3-460a-b3ea-b733939791a0",
    "outdoor_furniture": "a8d8aafd-de58-4450-8f10-a4eac3f097f4",
    "outdoor_pool": "424dd5ab-a53d-4c7e-bf6c-25d0c028a4d1",
    "outdoor_swimming_pool_all_year": "2ff175ae-4245-43ef-b43b-159bc163b302",
    "outdoor_swimming_pool_seasonal": "b7843a89-c410-45c3-ac36-ebd1c93b9e24",
    "packed_lunches": "0bf47f4d-630c-4a96-bbbe-a6d81d4f90e9",
    "paved_roads": "52a50d2d-c76d-45bf-8d84-c8b12a4ba2b5",
    "pedicure": "7b238cb7-65d6-404b-a720-d9a2f12001c7",
    "personal_trainer": "7967551d-2653-4ece-a412-dcd3b7bc7960",
    "pet_basket": "81d5ee31-c65b-4b82-97df-7e73c80dda6e",
    "pet_bowls": "7255858d-470b-479a-b927-76018c1bb3dc",
    "pet_friendly": "4610a953-20ba-4c82-bb0a-2210bbdf8557",
    "pets_allowed": "41083f9e-4538-490d-8fce-1be18c00fcf1",
    "physical_distancing_guidelines": "1d9d45de-c019-43a4-a1f1-041ac1419754",
    "physical_distancing_in_dining_areas": "dd7c4d90-1141-4888-8eec-4799f16e6e6d",
    "picnic_area": "1111bcc4-d5c3-4892-af31-476648501fe9",
    "picnic_table": "dcdddfab-73ec-46c7-9b95-0a96bfd4abec",
    "playground": "2d5d66ab-6183-40a2-8e96-9d1a6cd2a740",
    "plunge_pool": "cb9448ff-acc0-4c87-a427-a3c3348815dc",
    "pool_bar": "bb725505-dc6d-47ec-babf-3439b7ae4180",
    "pool_cover": "0f5688fa-82cb-4892-8ebe-56c803417a02",
    "pool_towels": "234fe568-94b3-4341-b9f4-2eaeadd5633b",
    "pool_with_view": "cfe87d7d-b6ef-4dcf-b5c7-57d14a938b39",
    "private_beach_area": "4c1f130a-097d-4dbd-8f68-80ae8afd817f",
    "private_check_in_check_out": "994657bd-0f3b-4604-8b55-3b2dab39bf98",
    "guest_health_check": "bc229e64-9f22-46e2-9aa4-882a260aa15c",
    "propane_refilling_station": "4c20fa86-b539-4901-964f-e75ceb60df48",
    "professional_cleaning": "338883aa-b3e1-4b80-87d3-8b8595f9d4d2",
    "property_is_wheel_chair_accessible": "d7ab0d30-1658-4355-b1f3-063cb67fc94b",
    "no_plastic_drink_bottles": "b54a50e5-fce2-406b-8044-9b3d95e72aac",
    "no_plastic_cups": "0eaae870-a6be-4de5-850b-7cd3504d34ee",
    "no_plastic_cutlery": "3e9f3e63-a861-4470-952a-8797ea1c0651",
    "no_plastic_stirrers": "c355b4b6-5bcc-47d0-98c3-ebf29d97ae10",
    "no_plastic_straws": "1d144491-425d-4e39-ae01-d454f0a2e1bb",
    "no_plastic_water_bottles": "2933aa56-6129-4dc2-8836-dd67e9e1bcca",
    "no_plastic_toiletries": "a068d477-051f-44a3-b601-bfde41923188",
    "pub_crawls": "cefd9064-5b1f-4a2f-b355-b480722c712b",
    "public_bath": "b18ebf6a-861e-4a2f-8461-95926d02611f",
    "public_transport_tickets": "860e5be3-96d6-4b26-bb00-e772bc00b60d",
    "pull_thru_rv_sites": "4fedc189-d623-4a88-8229-422a7392bc50",
    "refillable_water_stations": "c7cd6bc2-05ef-4b17-bfdd-8a8d398c4d3d",
    "restaurant": "893cae56-0348-4e27-844f-df092b47c2e5",
    "rooftop_pool": "2a87b7a6-e038-4c06-922e-de87ec967743",
    "room_service": "ce1977fd-d323-48f9-a89d-74de2f27f37f",
    "rooms_facilities_for_disabled": "3592d041-7012-4364-843c-aab04783a13e",
    "rv_hookup": "b6db75c9-d22b-4bcf-9b8c-5a857baffda6",
    "rv_sanitation": "56d9ecd1-23d4-4d5a-aee8-fefa3ba6d1e1",
    "safe": "9b03de01-6f46-4e97-b87a-2342ed28c4b3",
    "salt_water_pool": "5e3ada8d-7961-4636-9c6e-cdb95972bf7f",
    "sauna": "38e4dac8-0938-4805-9aad-c682fd0b4582",
    "staff_guest_barriers": "40568025-26eb-4b37-ac75-d5159692c2c2",
    "secured_parking": "65fba6e9-cac9-4e96-aab8-a785c13e503e",
    "security_alarm": "d9ce4d37-687a-425f-b547-f77eacbcf745",
    "shallow_end_pool": "522e9338-3271-4800-be97-8ed25576be7a",
    "shared_kitchen": "f53cf9a8-9e6c-4d40-a7f9-34b8c383d4c9",
    "shared_lounge_tv_area": "f8c33a08-b531-45e7-9b67-d6fc52b6ba57",
    "shared_stationery_removed": "b849d072-fc10-4e7b-a53a-7b7e7bd568cd",
    "shoeshine": "4a47b0de-4b28-452b-9d1f-c951172817ef",
    "shops_on_site": "30a6d4be-c694-465c-84e1-0111108e5db4",
    "shower": "fc5a8f7b-ec67-4003-b9ee-e70bbb73e51f",
    "shuttle_service": "d5b2c8a1-088f-469b-9098-df916bb31f6d",
    "shuttle_service_free": "810832b7-1379-49f9-ba34-20cb12684c8e",
    "shuttle_service_surcharge": "25aee42c-0dd0-48c6-a711-f4ae03f785be",
    "ski_equipment_hire_on_site": "ec4b179c-750d-44be-ae87-8328c31afd4f",
    "skiing": "5adcd003-740e-49ca-b1c2-d21eb1ae931f",
    "ski_pass_vendor": "613b7322-552f-43d1-8070-44547adebbf5",
    "ski_school": "3c0d5568-0942-42d3-8ad1-2daffa4b50a8",
    "ski_shuttle": "af168436-a0d0-4cd9-ba25-9f8d259b410e",
    "ski_storage": "8f2d5f12-0a6a-4519-a405-44bc47938726",
    "ski_to_door_access": "f5b8ecd5-f007-4283-8e85-f1a0edda356f",
    "smoke_alarms": "aff1fa7c-46f5-4c42-9fa6-8cc584cc0611",
    "snack_bar": "841951f1-f4e8-4543-8efa-6e31c845efaa",
    "snorkeling": "5020e261-2416-4e58-8a4b-a37cf8a57938",
    "solarium": "de5c2a44-ab05-4934-ac30-11c826ea6ece",
    "soundproof_rooms": "23754ca4-d8c9-4a29-9782-aa33a7cd65fc",
    "souvenir_gift_shop": "ee38c28d-64d2-4982-b7d3-912d39c7de85",
    "spa_facilities": "d0d645ee-a795-468f-aad1-cdfe3dd4be5d",
    "spa_lounge_relaxation_area": "af9726b5-537b-42c3-8020-65a9926d4727",
    "spa_wellness_centre": "8190b8f8-54ac-429b-9d9b-f0d62718c2d3",
    "spa_wellness_packages": "a41901a1-bbd4-4ca6-9a4a-79fe0e22e750",
    "special_diet_menus_on_request": "839922b5-51f4-42c3-9b3b-524d93c4916b",
    "squash": "557b84da-41bb-4b6f-ae48-ae76434fc067",
    "staff_safety_protocols": "baaf91f4-de29-4c6f-a4e7-3d1ff10cbd86",
    "stand_up_comedy": "754e5e48-ca8e-4ce0-b108-af054043ef06",
    "steam_room": "bacc0836-b06d-4937-9f2a-ec28984f8d7e",
    "street_parking": "6fe8d0f3-1f34-49e0-ae60-5a7e4cc28fc0",
    "strollers": "6838326a-9df2-4ad6-9219-799679196940",
    "sun_loungers_or_beach_chairs": "9e384fab-7727-4ae7-9a8e-e11324b94886",
    "sun_terrace": "8a4109f0-3952-4a33-98fa-4787008f8cfc",
    "sun_umbrellas": "d8ad7782-9ee2-456e-bcf5-b61621848f7f",
    "swimming_pool": "b8956092-5d84-472e-8536-4d9c8a48759d",
    "swimming_pool_toys": "0bdab171-55e0-496e-a7fc-f7acdac29f8e",
    "table_tennis": "5bb52b3e-e24e-456c-b304-4f153f06c3c5",
    "temporary_art_galleries": "8ed316a2-8014-4a43-8456-70fe7dbc3301",
    "tennis_court": "e03595b8-17ea-4071-aac1-204656cb5866",
    "tennis_equipment": "e499ec0e-7384-4960-884f-045012c7eded",
    "terrace": "750dfd2e-b14a-4e9f-9d94-0951f9e83a0f",
    "themed_dinner_nights": "25873176-8040-4b30-87cc-8cfb53c5648c",
    "thermometers_provided": "f4a8e426-17a0-44bc-90fb-8e9fe09583cf",
    "ticket_service": "b52834ee-7405-4e56-af7c-8abcde5da8c5",
    "toilet": "b2a5d032-538b-4326-be39-94ef81c1b585",
    "toilet_with_grab_rails": "ebff1d20-222e-4364-a0fd-6863c7cbc7a3",
    "tour_desk": "a1a43289-ec9d-4409-9fdf-70139779ab4b",
    "tour_or_class_about_local_culture": "811a4c12-9f7d-4a05-bbaa-c989fcf65ffd",
    "towels_changed_upon_request": "88899d49-8989-4f86-a4f5-c6d2c77d6368",
    "trash_service": "8c1c7436-d449-4bca-b2e6-6950ee04b1e0",
    "trek_in_1_5m": "b08e316f-4ebd-483d-a142-77055e2ad84e",
    "trouser_press": "38d7822d-9fe7-48c9-9b5e-53e2ed6b10cd",
    "turkish_steam_bath": "a03436b3-39c7-4509-b7a0-2d9c975ae7f8",
    "anti_covid_cleaning": "e418c2e0-a582-4e86-aa86-bf7286a589b2",
    "valet_parking": "d101c76d-1f0e-476b-8a1f-e1152e0757c7",
    "vending_machine_drinks": "cc1064c8-e0e5-48ee-9720-11cdb271d1c0",
    "vending_machine_snacks": "ddbb1d11-eb11-4527-9617-6f9798943b30",
    "viproom_facilities": "c3a740ab-095f-4974-a6e7-c582be134d66",
    "visual_aids_braille": "f212342c-dac9-4abe-97cc-9df1ad5f27ac",
    "visual_aids_tactile_signs": "5e257d0a-8114-480c-8834-028bb23cf395",
    "walking_tours": "b7fa7330-bb7f-46f7-a5a1-3bc08dff27f6",
    "waterfront": "71a3bbe2-529a-48e2-8c0a-8fbdb50e18f5",
    "water_park": "594afede-f63b-4c32-ab0a-053efa6cd5a0",
    "water_slide": "674c3fae-5267-4798-8395-6574d7fb6ca0",
    "water_sport_facilities_on_site": "dba61c2d-53e2-40c6-9ac6-ce21f887f783",
    "waxing_services": "0d0732f7-3d47-47a2-bf52-6fcc1eb56c2a",
    "wifi": "ed553333-7f1f-434a-8c43-eb8fe96c5f54",
    "windsurfing": "eb556bb8-f603-462f-add3-2491d6596e78",
    "wine_champagne": "e4325b9f-b6c1-4b97-8ac7-800ab4324f7a",
    "yoga_classes": "8caeeb52-9feb-4730-9d33-272ddb219b87",
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


def ota_zeitstempel_utc(wert: object) -> str | None:
    """Channex-Zeitstempel → ISO-Zeichenkette MIT Zone. Leer/kein Text → None
    (kein erfundener Ersatzwert, Wurzel 4)."""
    text = str(wert).strip() if wert is not None else ""
    if not text:
        return None
    return text if _HAT_ZONE.search(text) else text + "Z"


class ChannelManagerError(Exception):
    """Fehler im channel_manager-Slice (an die API weitergereicht)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
