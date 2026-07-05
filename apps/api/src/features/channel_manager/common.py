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
    for local_key, cx_key in (
        ("autoUpdateOnConfirmation", "allow_availability_autoupdate_on_confirmation"),
        ("autoUpdateOnModification", "allow_availability_autoupdate_on_modification"),
        ("autoUpdateOnCancellation", "allow_availability_autoupdate_on_cancellation"),
    ):
        val = av.get(local_key)
        if isinstance(val, bool):
            out[cx_key] = val
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


class ChannelManagerError(Exception):
    """Fehler im channel_manager-Slice (an die API weitergereicht)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
