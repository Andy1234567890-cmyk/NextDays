// Anzeige-Metadaten für Objekte: Typ-Listen je Betriebsart + Ausstattung.
// Wird von Liste, Detailseite und Editoren gemeinsam genutzt.
//
// Die ANZEIGE-Namen kommen ab jetzt aus dem i18n-Namensraum `objects.meta`
// über `lib/use-property-labels.ts`. Grund: als deutsche Festwerte erzeugten
// sie in den 23 anderen Sprachen gemischte Oberflächen — im englischen
// Objekt-Screenshot stand neben „8 objects" ein Badge „Aktiv".
//
// Die deutschen Konstanten unten bleiben vorerst als Übergang stehen: zwei
// Dateien (property-overview, new-property-button) hängen an einer parallel
// entstehenden Kanalfeld-Erweiterung und können erst danach mitziehen.
// TODO(i18n): nach deren Merge diese vier Exporte entfernen.
import type { PropertyStatus, PropertyType } from "@/lib/properties";

export const TYPE_LABELS: Record<PropertyType, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  stellplatz: "Stellplatz",
  hausboot: "Hausboot",
  // Hotel-Zimmertypen (Migration 0098, Betriebsart 'hotel')
  einzelzimmer: "Einzelzimmer",
  doppelzimmer: "Doppelzimmer",
  zweibettzimmer: "Zweibettzimmer",
  familienzimmer: "Familienzimmer",
  junior_suite: "Junior Suite",
  suite: "Suite",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  inactive: "Inaktiv",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value: value as PropertyStatus, label }),
);

export function typeOptionsFor(
  accommodationType: "vacation_rental" | "hotel" | null | undefined,
): { value: PropertyType; label: string }[] {
  const types = accommodationType === "hotel" ? HOTEL_TYPES : VR_TYPES;
  return types.map((value) => ({ value, label: TYPE_LABELS[value] }));
}

// Typen je Betriebsart (0090): Ferienvermietung sieht Ferienobjekt-Typen,
// Hotel sieht Zimmertypen — Filter und Anlage-Dialoge zeigen NUR die passende
// Liste (usePropertyLabels().typeOptionsFor).
export const VR_TYPES: PropertyType[] = [
  "ferienhaus",
  "appartement",
  "glamping",
  "tiny_house",
  "stellplatz",
  "hausboot",
];

export const HOTEL_TYPES: PropertyType[] = [
  "einzelzimmer",
  "doppelzimmer",
  "zweibettzimmer",
  "familienzimmer",
  "junior_suite",
  "suite",
];





// Channex-Facility-Katalog (301, live abgerufen): die Ausstattungs-Auswahl im
// Objekt-Editor IST dieser Katalog — 1:1 mit Channex. Jeder Eintrag geht über
// Property.facilities an Channex → die OTAs (amenityGoesToOta = true für alle).
// Labels je Sprache via i18n-Namespace "amenities" (24 Locales).
export type AmenityCategory =
  | "general"
  | "food_and_drink"
  | "outdoors"
  | "services"
  | "activites"
  | "safety_and_security"
  | "parking"
  | "pets"
  | "sustainable_practice";

export const AMENITY_CATALOG: { category: AmenityCategory; slugs: string[] }[] = [
  { category: "general", slugs: [
    "24_hour_front_desk", "ada_accessible", "adult_only", "air_conditioning",
    "airport_shuttle_surcharge", "all_non_smoking", "atm_on_site", "back_in_rv_sites",
    "beachfront", "beauty_services", "board_games_puzzles", "book_dvd_music_library_for_children",
    "breakfast_takeaway_containers", "bridal_suite", "cable_hookups", "chapel_shrine",
    "children_television_networks", "clubhouse", "community_fire_pit", "community_restrooms",
    "community_showers", "community_water_fountain", "designated_smoking_area", "dinner",
    "dirt_roads", "elevators", "entertainment_staff", "family_rooms",
    "fire_pit", "fitness", "fitness_spa_locker_rooms", "foot_bath",
    "gasoline_nearby", "general_store", "gravel_roads", "hair_dresser_beautician",
    "heated_pool", "heating", "hike_bike_campsites", "hot_spring_bath",
    "housekeeping_daily", "hypoallergenic_room_available", "indoor_play_area", "indoor_pool",
    "invoices_provided", "jacuzzi_hot_tub", "kid_friendly_buffet", "kid_meals",
    "kids_club", "kids_pool", "laundry_facilities", "library",
    "lunch", "massage_chair", "minimarket_on_site", "newspaper",
    "non_smoking_rooms", "open_air_bath", "packed_lunches", "paved_roads",
    "pool_towels", "private_check_in_check_out", "propane_refilling_station", "property_is_wheel_chair_accessible",
    "public_bath", "rooms_facilities_for_disabled", "rv_hookup", "rv_sanitation",
    "shared_lounge_tv_area", "shower", "shuttle_service", "ski_to_door_access",
    "soundproof_rooms", "souvenir_gift_shop", "spa_facilities", "spa_lounge_relaxation_area",
    "spa_wellness_centre", "spa_wellness_packages", "special_diet_menus_on_request", "steam_room",
    "strollers", "sun_loungers_or_beach_chairs", "sun_umbrellas", "swimming_pool_toys",
    "ticket_service", "toilet", "trek_in_1_5m", "vending_machine_drinks",
    "vending_machine_snacks", "viproom_facilities", "waterfront", "water_slide",
    "wifi",
  ] },
  { category: "food_and_drink", slugs: [
    "accessible_parking", "bar", "bottle_of_water", "breakfast",
    "breakfast_in_the_room", "chocolate_cookies", "community_bbq_grill", "drinking_water",
    "fire_ring_grill", "fruits", "on_site_coffee_house", "picnic_area",
    "picnic_table", "restaurant", "room_service", "shared_kitchen",
    "snack_bar", "wine_champagne",
  ] },
  { category: "outdoors", slugs: [
    "bbq_picnic_area", "garden", "infinity_pool", "kids_outdoor_play_equipment",
    "outdoor_fireplace", "outdoor_furniture", "outdoor_pool", "playground",
    "plunge_pool", "pool_bar", "pool_with_view", "rooftop_pool",
    "salt_water_pool", "shallow_end_pool", "sun_terrace", "swimming_pool",
    "terrace",
  ] },
  { category: "services", slugs: [
    "airport_shuttle_free", "airport_shuttle_srv_surcharge", "baby_sitting", "back_massage",
    "baggage_storage", "bikes_available_free", "body_scrub", "body_treatments",
    "body_wrap", "business_center", "car_rental", "concierge_desk",
    "couples_massage", "currency_exchange", "dry_cleaning", "events_ticket_service",
    "express_check_in_check_out", "facial_treatments", "fitness_center", "foot_massage",
    "full_body_massage", "grocery_service", "hair_colouring", "hair_cut",
    "hair_styling", "hair_treatments", "hand_massage", "head_massage",
    "ironing_service", "laundry", "light_therapy", "make_up_services",
    "manicure", "massage", "meeting_banquet_facilities", "neck_massage",
    "nightclub_dj", "pedicure", "public_transport_tickets", "sauna",
    "shoeshine", "shops_on_site", "shuttle_service_free", "shuttle_service_surcharge",
    "solarium", "tour_desk", "trash_service", "trouser_press",
    "turkish_steam_bath", "valet_parking", "waxing_services",
  ] },
  { category: "activites", slugs: [
    "aerobics", "archery", "badminton_equipment", "beach",
    "bicycle_rentals", "bike_tours", "billiard", "bingo",
    "bowling", "canoeing", "casino", "cooking_class",
    "cycling", "darts", "diving", "evening_entertainment",
    "fishing", "fitness_classes", "game_room", "golf_course_within_2_miles",
    "happy_hour", "hiking", "horseback_riding", "indoor_swimming_pool_all_year",
    "indoor_swimming_pool_seasonal", "karaoke", "live_music_performance", "live_sports_events_broadcast",
    "minigolf", "movie_nights", "outdoor_swimming_pool_all_year", "outdoor_swimming_pool_seasonal",
    "personal_trainer", "private_beach_area", "pub_crawls", "ski_equipment_hire_on_site",
    "skiing", "ski_pass_vendor", "ski_school", "ski_shuttle",
    "ski_storage", "snorkeling", "squash", "stand_up_comedy",
    "table_tennis", "temporary_art_galleries", "tennis_court", "tennis_equipment",
    "themed_dinner_nights", "tour_or_class_about_local_culture", "walking_tours", "water_park",
    "water_sport_facilities_on_site", "windsurfing", "yoga_classes",
  ] },
  { category: "safety_and_security", slugs: [
    "24_hour_security", "access_to_health_care_professionals", "tableware_sanitised", "auditory_guidance",
    "baby_safety_gates", "bathroom_emergency_pull_cord", "carbon_monoxide_detector", "carbon_monoxide_source",
    "cashless_payment_available", "cctv_in_common_areas", "cctv_outside_property", "contactless_check_in_out",
    "food_securely_covered", "face_masks_for_guests_available", "fence_around_pool", "fire_extinguishers",
    "first_aid_kit_available", "disinfected_between_stays", "sealed_after_cleaning", "cleaning_optional",
    "hand_sanitiser", "higher_level_toilet", "in_room_dining_options_available", "key_access",
    "key_card_access", "linens_washed_guidelines", "lockers", "low_bathroom_sink",
    "mobile_app_for_room_service", "physical_distancing_guidelines", "physical_distancing_in_dining_areas", "pool_cover",
    "guest_health_check", "professional_cleaning", "safe", "staff_guest_barriers",
    "security_alarm", "shared_stationery_removed", "smoke_alarms", "staff_safety_protocols",
    "thermometers_provided", "toilet_with_grab_rails", "anti_covid_cleaning", "visual_aids_braille",
    "visual_aids_tactile_signs",
  ] },
  { category: "parking", slugs: [
    "indoor_parking", "pull_thru_rv_sites", "secured_parking", "street_parking",
  ] },
  { category: "pets", slugs: [
    "pet_basket", "pet_bowls", "pet_friendly", "pets_allowed",
  ] },
  { category: "sustainable_practice", slugs: [
    "bike_parking", "bike_rental", "electric_vehicle_charging_station", "keycard_for_room_electricity",
    "opt_out_from_daily_room_cleaning", "no_plastic_drink_bottles", "no_plastic_cups", "no_plastic_cutlery",
    "no_plastic_stirrers", "no_plastic_straws", "no_plastic_water_bottles", "no_plastic_toiletries",
    "refillable_water_stations", "towels_changed_upon_request",
  ] },
];

// Alle Katalog-Slugs (flach) — für Validierung/Anzeige.
export const AMENITY_SLUGS: string[] = AMENITY_CATALOG.flatMap((g) => g.slugs);

// Jede Channex-Facility wird an die OTAs ausgespielt (via Channex).
export function amenityGoesToOta(slug: string): boolean {
  return AMENITY_SLUGS.includes(slug);
}

// Zimmer-Ausstattung (Channex /room_facilities, 191). EIGENER Katalog mit
// EIGENEN UUIDs — nicht mit AMENITY_CATALOG (Objekt) mischen: 30 Titel gibt
// es in beiden, alle mit unterschiedlicher UUID. Gespeichert in
// properties.room_amenities (0243).
export type RoomAmenityCategory =
  | "in_room"
  | "bathroom"
  | "kitchen"
  | "view"
  | "outside"
  | "general"
  | "security";

export const ROOM_AMENITY_CATALOG: {
  category: RoomAmenityCategory;
  slugs: string[];
}[] = [
  { category: "in_room", slugs: [
    "accessible_by_lift", "adapter", "air_purifiers_available", "airconditioning",
    "alarm_clock", "allergy_free", "blu_ray_player", "board_games_puzzles",
    "book_dvd_music_library_for_children", "bottle_of_water", "cable_channels",
    "carpeted_floor", "cd_player", "children_crib_cots", "chocolate_cookies",
    "clothes_drying_rack", "clothes_rack", "clothing_iron", "coffee_machine",
    "coffee_tea_maker", "computer", "desk", "detached", "dining_area", "dining_table",
    "dressing_room", "dvd_player", "earplugs", "electric_blankets", "electric_kettle",
    "entire_property_on_ground_floor", "entire_unit_wheelchair_accessible",
    "executive_lounge_access", "fan", "fax", "feather_pillow", "fireplace", "flat_screen_tv",
    "fruits", "game_console", "game_console_nintendo_wii", "game_console_ps2",
    "game_console_ps3", "game_console_ps4", "game_console_wii_u", "game_console_xbox_360",
    "game_console_xbox_one", "hair_dryer", "hand_sanitiser", "heating",
    "hypoallergenic_pillow", "interconnecting_room_s_available", "internet_facilities", "ipad",
    "ipod_docking_station", "ironing_facilities", "kitchen_2", "kitchenware", "laptop",
    "linen", "mini_bar", "mosquito_net", "non_feather_pillow", "outdoor_dining_area",
    "outdoor_furniture", "pajamas", "patio", "pay_per_view_channels", "portable_wifi",
    "private_curtain", "private_entrance", "private_flat_in_block_of_flats", "radio",
    "reading_light", "rollaway_bed", "satellite_channels", "seating_area", "semi_detached",
    "single_room_air_conditioning_for_guest_accommodation", "slippers", "smartphone",
    "socket_near_the_bed", "sofa", "sofa_bed", "soundproofing",
    "streaming_service_such_as_netflix", "telephone", "terrace", "tiled_marble_floor",
    "towels_linens_at_surcharge", "trash_cans", "trouser_press", "tv",
    "upper_floor_reachable_by_lift", "upper_floor_reachable_by_stairs_only", "video",
    "video_games", "wake_up_service", "wake_up_service_alarm_clock", "wardrobe_closet",
    "wine_champagne", "wireless_internet", "wooden_parquet_floor", "yukata"
  ] },
  { category: "bathroom", slugs: [
    "adapted_bath", "additional_bathroom", "additional_toilet", "bath", "bath_or_shower",
    "bath_robe", "bathroom", "bidet", "body_soap", "conditioner", "free_toiletries",
    "guest_toilet", "higher_level_toilet", "hot_tub", "kitchen", "low_bathroom_sink",
    "roll_in_shower", "sauna", "shampoo", "shower", "shower_cap", "shower_chair", "spa_bath",
    "toilet", "toilet_paper", "toilet_with_grab_rails", "toothbrush", "towels",
    "walk_in_shower"
  ] },
  { category: "kitchen", slugs: [
    "barbecue", "children_highchair", "cleaning_products", "dishwasher", "kitchenette",
    "microwave", "oven", "refrigerator", "shared_bathroom", "stove", "toaster",
    "tumble_dryer_machine", "washing_machine", "wine_glasses"
  ] },
  { category: "view", slugs: [
    "city_view", "extra_long_beds_2_meter", "garden_view", "inner_courtyard_view", "lake_view",
    "landmark_view", "mountain_view", "pool_view", "quiet_street_view", "river_view",
    "sea_view", "view"
  ] },
  { category: "outside", slugs: [
    "balcony", "heated_pool", "infinity_pool", "plunge_pool", "pool_cover", "pool_towels",
    "pool_with_view", "private_pool", "rooftop_pool", "salt_water_pool", "shallow_end"
  ] },
  { category: "general", slugs: [
    "100_amps", "20_amps", "30_amps", "50_amps", "big_rig_friendly", "dump_station",
    "sewer_hookups", "slide_outs", "water_hookups"
  ] },
  { category: "security", slugs: [
    "baby_safety_gates", "bathroom_emergency_pull_cord", "carbon_monoxide_detector",
    "carbon_monoxide_source", "child_safety_socket_covers", "electronic_key_card_access",
    "fire_alarms_or_smoke_detectors", "fire_extinguishers", "laptop_safe_box", "lockers",
    "metal_keys_access", "safe_deposit_box"
  ] },
];

export const ROOM_AMENITY_SLUGS: string[] = ROOM_AMENITY_CATALOG.flatMap(
  (g) => g.slugs,
);

// Deutsche Kategorie-Titel (Dashboard). Reihenfolge = ROOM_AMENITY_CATALOG.
export const ROOM_AMENITY_CATEGORY_LABELS_DE: Record<
  RoomAmenityCategory,
  string
> = {
  in_room: "Im Zimmer",
  bathroom: "Bad",
  kitchen: "Küche",
  view: "Aussicht",
  outside: "Außenbereich",
  general: "Allgemein",
  security: "Sicherheit",
};

// Ausstattungs-Gliederung: 13 Kategorien nach Vorgabe.
//
// Diese Datei enthält KEINE Merkmalsnamen — die stehen in AMENITY_CATALOG
// (Objekt, 301) und ROOM_AMENITY_CATALOG (Zimmer, 191) und werden dort
// gepflegt. Hier steht nur, in welche Kategorie ein Slug gehört. Merkmale,
// die in beiden Katalogen vorkommen, erscheinen genau einmal.
export const AUSSTATTUNG_KATEGORIEN = [
  "wesentliches",
  "bad_waschkueche",
  "unterhaltung",
  "heizung_klima",
  "sicherheit",
  "internet_buero",
  "kueche_esszimmer",
  "standort",
  "parkplaetze",
  "konditionen",
  "pool_spa",
  "dienstleistungen",
  "sonstiges",
] as const;

export type AusstattungsKategorie =
  (typeof AUSSTATTUNG_KATEGORIEN)[number];

/** Slug → Kategorie. Nicht gelistete Slugs landen in `sonstiges`. */
// Eigene Ausstattungsmerkmale — was der Channex-Katalog NICHT kennt.
//
// Channex fasst zusammen, wo Gäste unterscheiden: ein `heating` statt Zentral-/
// Elektro-/Bodenheizung, ein `barbecue` statt Gas-/Elektro-/Holzkohlegrill,
// keine Trennung privat/gemeinschaftlich bei Pool, Garten, Tennisplatz.
// Diese Merkmale gehen an myBestDays und die eigene Website — NICHT an
// Booking/Airbnb, dort gibt es kein Feld dafür.
// Kein Merkmal aus AMENITY_CATALOG/ROOM_AMENITY_CATALOG wird hier wiederholt.
export const EIGENE_AUSSTATTUNG: string[] = [
  "nd_wash_basin", "nd_piano", "nd_stereo", "nd_tv_antenna", "nd_tv_satellite",
  "nd_sun_loungers", "nd_boat", "nd_canoe_kayak", "nd_table_football", "nd_golf_cart",
  "nd_golf_clubs", "nd_motorboat", "nd_sailboat", "nd_private_gym", "nd_central_heating",
  "nd_electric_heating", "nd_underfloor_heating", "nd_wood_stove", "nd_door_buzzer",
  "nd_concierge", "nd_key_card", "nd_internet_broadband", "nd_internet_dialup",
  "nd_internet_wireless", "nd_blender", "nd_kitchen_stove", "nd_rice_cooker", "nd_spices",
  "nd_vacuum_cleaner", "nd_water_dispenser", "nd_water_filter", "nd_charcoal_grill",
  "nd_electric_grill", "nd_gas_grill", "nd_city_centre", "nd_golf_view", "nd_near_sea",
  "nd_resort", "nd_rural", "nd_village", "nd_harbour_district", "nd_garage",
  "nd_gated_community", "nd_parking_available", "nd_parking_included", "nd_parking_optional",
  "nd_carport", "nd_private_garden", "nd_private_playground", "nd_private_porch",
  "nd_private_tennis", "nd_shared_garden", "nd_shared_playground", "nd_shared_porch",
  "nd_shared_tennis", "nd_credit_card_accepted", "nd_events_allowed", "nd_pets_on_request",
  "nd_pets_not_allowed", "nd_smoking_allowed", "nd_smoking_not_allowed", "nd_senior_friendly",
  "nd_not_senior_friendly", "nd_not_accessible", "nd_indoor_hot_tub", "nd_outdoor_hot_tub",
  "nd_private_dry_sauna", "nd_private_steam_sauna", "nd_private_heated_indoor_pool",
  "nd_private_heated_outdoor_pool", "nd_private_indoor_pool", "nd_private_outdoor_pool",
  "nd_shared_dry_sauna", "nd_shared_steam_sauna", "nd_shared_heated_indoor_pool",
  "nd_shared_heated_outdoor_pool", "nd_shared_indoor_pool", "nd_shared_outdoor_pool",
  "nd_all_inclusive", "nd_full_board", "nd_half_board", "nd_housekeeper_included",
  "nd_housekeeper_optional", "nd_laundry_included", "nd_laundry_optional",
];

// Slugs, die dasselbe Merkmal bezeichnen — Channex führt sie in BEIDEN
// Katalogen mit eigener UUID und gleichem Namen. Im Editor darf die Zeile nur
// EINMAL erscheinen; welcher Slug gewinnt, steht hier fest (der Zimmer-Slug,
// weil er näher am Zimmer liegt). Über den angezeigten Namen zu entdoppeln
// reicht NICHT: beim ersten Render sind die Übersetzungen noch nicht geladen,
// dann liefern beide ihren Slug und die Zeile stünde doppelt da.
export const AUSSTATTUNG_DUBLETTEN: Record<string, string> = {
  jacuzzi_hot_tub: "hot_tub",
  air_conditioning: "airconditioning",
  wifi: "wireless_internet",
  kitchen_2: "kitchen",
  safe: "safe_deposit_box",
  bicycle_rentals: "bike_rental",
  airport_shuttle_srv_surcharge: "airport_shuttle_surcharge",
  key_access: "metal_keys_access",
};

// Merkmale, die Airbnb kennt — abgelesen aus der Vorgabe (Screenshots).
// KEINE Vermutung und keine Ableitung aus dem Channex-Katalog: die Liste
// bildet ab, an welchen Zeilen dort das Airbnb-Zeichen steht.
export const AIRBNB_MERKMALE: ReadonlySet<string> = new Set([
  "air_conditioning", "airconditioning", "beachfront", "bidet", "bike_rental",
  "bikes_available_free", "cable_channels", "carbon_monoxide_detector", "clothing_iron",
  "coffee_machine", "dishwasher", "fan", "fire_extinguishers", "fireplace",
  "first_aid_kit_available", "hair_dryer", "heating", "kitchenette", "kitchenware",
  "lake_view", "linen", "microwave", "nd_blender", "nd_central_heating", "nd_electric_heating",
  "nd_harbour_district", "nd_indoor_hot_tub", "nd_internet_broadband", "nd_internet_dialup",
  "nd_internet_wireless", "nd_outdoor_hot_tub", "nd_parking_available",
  "nd_private_heated_indoor_pool", "nd_private_heated_outdoor_pool", "nd_private_indoor_pool",
  "nd_private_outdoor_pool", "nd_resort", "nd_shared_heated_indoor_pool",
  "nd_shared_heated_outdoor_pool", "nd_shared_indoor_pool", "nd_shared_outdoor_pool",
  "nd_tv_antenna", "nd_tv_satellite", "nd_underfloor_heating", "oven", "pets_allowed",
  "refrigerator", "ski_to_door_access", "smoke_alarms", "swimming_pool", "toaster",
  "tumble_dryer_machine", "washing_machine",
]);

export const AUSSTATTUNG_VON_SLUG: Record<string, AusstattungsKategorie> = {
  // wesentliches (12)
  "air_conditioning": "wesentliches", "airconditioning": "wesentliches",
  "bathroom": "wesentliches", "heating": "wesentliches", "kitchen": "wesentliches",
  "kitchen_2": "wesentliches", "pet_friendly": "wesentliches", "pets_allowed": "wesentliches",
  "tv": "wesentliches", "washing_machine": "wesentliches", "wifi": "wesentliches",
  "wireless_internet": "wesentliches",
  // bad_waschkueche (45)
  "adapted_bath": "bad_waschkueche", "additional_bathroom": "bad_waschkueche",
  "additional_toilet": "bad_waschkueche", "bath": "bad_waschkueche",
  "bath_or_shower": "bad_waschkueche", "bath_robe": "bad_waschkueche",
  "bidet": "bad_waschkueche", "body_soap": "bad_waschkueche",
  "clothes_drying_rack": "bad_waschkueche", "clothing_iron": "bad_waschkueche",
  "community_restrooms": "bad_waschkueche", "community_showers": "bad_waschkueche",
  "conditioner": "bad_waschkueche", "feather_pillow": "bad_waschkueche",
  "free_toiletries": "bad_waschkueche", "guest_toilet": "bad_waschkueche",
  "hair_dryer": "bad_waschkueche", "hand_sanitiser": "bad_waschkueche",
  "higher_level_toilet": "bad_waschkueche", "hypoallergenic_pillow": "bad_waschkueche",
  "ironing_facilities": "bad_waschkueche", "laundry_facilities": "bad_waschkueche",
  "linen": "bad_waschkueche", "low_bathroom_sink": "bad_waschkueche",
  "nd_wash_basin": "bad_waschkueche", "non_feather_pillow": "bad_waschkueche",
  "pajamas": "bad_waschkueche", "pool_towels": "bad_waschkueche",
  "roll_in_shower": "bad_waschkueche", "shampoo": "bad_waschkueche",
  "shared_bathroom": "bad_waschkueche", "shower": "bad_waschkueche",
  "shower_cap": "bad_waschkueche", "shower_chair": "bad_waschkueche",
  "slippers": "bad_waschkueche", "toilet": "bad_waschkueche",
  "toilet_paper": "bad_waschkueche", "toilet_with_grab_rails": "bad_waschkueche",
  "toothbrush": "bad_waschkueche", "towels": "bad_waschkueche",
  "towels_linens_at_surcharge": "bad_waschkueche", "trouser_press": "bad_waschkueche",
  "tumble_dryer_machine": "bad_waschkueche", "walk_in_shower": "bad_waschkueche",
  "yukata": "bad_waschkueche",
  // unterhaltung (103)
  "aerobics": "unterhaltung", "alarm_clock": "unterhaltung", "archery": "unterhaltung",
  "badminton_equipment": "unterhaltung", "beach": "unterhaltung",
  "bicycle_rentals": "unterhaltung", "bike_rental": "unterhaltung",
  "bike_tours": "unterhaltung", "bikes_available_free": "unterhaltung",
  "billiard": "unterhaltung", "bingo": "unterhaltung", "blu_ray_player": "unterhaltung",
  "board_games_puzzles": "unterhaltung", "book_dvd_music_library_for_children": "unterhaltung",
  "bowling": "unterhaltung", "cable_channels": "unterhaltung", "canoeing": "unterhaltung",
  "casino": "unterhaltung", "cd_player": "unterhaltung",
  "children_television_networks": "unterhaltung", "clubhouse": "unterhaltung",
  "cooking_class": "unterhaltung", "cycling": "unterhaltung", "darts": "unterhaltung",
  "diving": "unterhaltung", "dvd_player": "unterhaltung",
  "entertainment_staff": "unterhaltung", "evening_entertainment": "unterhaltung",
  "fishing": "unterhaltung", "fitness": "unterhaltung", "fitness_center": "unterhaltung",
  "fitness_classes": "unterhaltung", "flat_screen_tv": "unterhaltung",
  "game_console": "unterhaltung", "game_console_nintendo_wii": "unterhaltung",
  "game_console_ps2": "unterhaltung", "game_console_ps3": "unterhaltung",
  "game_console_ps4": "unterhaltung", "game_console_wii_u": "unterhaltung",
  "game_console_xbox_360": "unterhaltung", "game_console_xbox_one": "unterhaltung",
  "game_room": "unterhaltung", "golf_course_within_2_miles": "unterhaltung",
  "happy_hour": "unterhaltung", "hiking": "unterhaltung", "horseback_riding": "unterhaltung",
  "indoor_play_area": "unterhaltung", "ipod_docking_station": "unterhaltung",
  "karaoke": "unterhaltung", "kids_club": "unterhaltung", "library": "unterhaltung",
  "live_music_performance": "unterhaltung", "live_sports_events_broadcast": "unterhaltung",
  "minigolf": "unterhaltung", "movie_nights": "unterhaltung", "nd_boat": "unterhaltung",
  "nd_canoe_kayak": "unterhaltung", "nd_golf_cart": "unterhaltung",
  "nd_golf_clubs": "unterhaltung", "nd_motorboat": "unterhaltung", "nd_piano": "unterhaltung",
  "nd_private_gym": "unterhaltung", "nd_sailboat": "unterhaltung", "nd_stereo": "unterhaltung",
  "nd_sun_loungers": "unterhaltung", "nd_table_football": "unterhaltung",
  "nd_tv_antenna": "unterhaltung", "nd_tv_satellite": "unterhaltung",
  "newspaper": "unterhaltung", "nightclub_dj": "unterhaltung",
  "pay_per_view_channels": "unterhaltung", "personal_trainer": "unterhaltung",
  "private_beach_area": "unterhaltung", "pub_crawls": "unterhaltung", "radio": "unterhaltung",
  "reading_light": "unterhaltung", "satellite_channels": "unterhaltung",
  "seating_area": "unterhaltung", "shared_lounge_tv_area": "unterhaltung",
  "ski_equipment_hire_on_site": "unterhaltung", "ski_pass_vendor": "unterhaltung",
  "ski_school": "unterhaltung", "ski_storage": "unterhaltung", "skiing": "unterhaltung",
  "snorkeling": "unterhaltung", "sofa": "unterhaltung", "squash": "unterhaltung",
  "stand_up_comedy": "unterhaltung", "streaming_service_such_as_netflix": "unterhaltung",
  "swimming_pool_toys": "unterhaltung", "table_tennis": "unterhaltung",
  "temporary_art_galleries": "unterhaltung", "tennis_equipment": "unterhaltung",
  "themed_dinner_nights": "unterhaltung", "tour_or_class_about_local_culture": "unterhaltung",
  "video": "unterhaltung", "video_games": "unterhaltung", "walking_tours": "unterhaltung",
  "water_park": "unterhaltung", "water_slide": "unterhaltung",
  "water_sport_facilities_on_site": "unterhaltung", "windsurfing": "unterhaltung",
  "yoga_classes": "unterhaltung",
  // heizung_klima (9)
  "air_purifiers_available": "heizung_klima", "electric_blankets": "heizung_klima",
  "fan": "heizung_klima", "fireplace": "heizung_klima", "nd_central_heating": "heizung_klima",
  "nd_electric_heating": "heizung_klima", "nd_underfloor_heating": "heizung_klima",
  "nd_wood_stove": "heizung_klima",
  "single_room_air_conditioning_for_guest_accommodation": "heizung_klima",
  // sicherheit (26)
  "24_hour_security": "sicherheit", "baby_safety_gates": "sicherheit",
  "bathroom_emergency_pull_cord": "sicherheit", "carbon_monoxide_detector": "sicherheit",
  "carbon_monoxide_source": "sicherheit", "cctv_in_common_areas": "sicherheit",
  "cctv_outside_property": "sicherheit", "child_safety_socket_covers": "sicherheit",
  "electronic_key_card_access": "sicherheit", "fence_around_pool": "sicherheit",
  "fire_alarms_or_smoke_detectors": "sicherheit", "fire_extinguishers": "sicherheit",
  "first_aid_kit_available": "sicherheit", "key_access": "sicherheit",
  "key_card_access": "sicherheit", "laptop_safe_box": "sicherheit", "lockers": "sicherheit",
  "metal_keys_access": "sicherheit", "nd_concierge": "sicherheit",
  "nd_door_buzzer": "sicherheit", "nd_key_card": "sicherheit", "private_curtain": "sicherheit",
  "safe": "sicherheit", "safe_deposit_box": "sicherheit", "security_alarm": "sicherheit",
  "smoke_alarms": "sicherheit",
  // internet_buero (17)
  "adapter": "internet_buero", "business_center": "internet_buero",
  "cable_hookups": "internet_buero", "computer": "internet_buero", "desk": "internet_buero",
  "fax": "internet_buero", "internet_facilities": "internet_buero", "ipad": "internet_buero",
  "laptop": "internet_buero", "meeting_banquet_facilities": "internet_buero",
  "nd_internet_broadband": "internet_buero", "nd_internet_dialup": "internet_buero",
  "nd_internet_wireless": "internet_buero", "portable_wifi": "internet_buero",
  "smartphone": "internet_buero", "socket_near_the_bed": "internet_buero",
  "telephone": "internet_buero",
  // kueche_esszimmer (62)
  "bar": "kueche_esszimmer", "barbecue": "kueche_esszimmer",
  "bbq_picnic_area": "kueche_esszimmer", "bottle_of_water": "kueche_esszimmer",
  "breakfast": "kueche_esszimmer", "breakfast_in_the_room": "kueche_esszimmer",
  "breakfast_takeaway_containers": "kueche_esszimmer",
  "children_highchair": "kueche_esszimmer", "chocolate_cookies": "kueche_esszimmer",
  "cleaning_products": "kueche_esszimmer", "coffee_machine": "kueche_esszimmer",
  "coffee_tea_maker": "kueche_esszimmer", "community_bbq_grill": "kueche_esszimmer",
  "community_water_fountain": "kueche_esszimmer", "dining_area": "kueche_esszimmer",
  "dining_table": "kueche_esszimmer", "dinner": "kueche_esszimmer",
  "dishwasher": "kueche_esszimmer", "drinking_water": "kueche_esszimmer",
  "electric_kettle": "kueche_esszimmer", "fire_ring_grill": "kueche_esszimmer",
  "fruits": "kueche_esszimmer", "general_store": "kueche_esszimmer",
  "in_room_dining_options_available": "kueche_esszimmer",
  "kid_friendly_buffet": "kueche_esszimmer", "kid_meals": "kueche_esszimmer",
  "kitchenette": "kueche_esszimmer", "kitchenware": "kueche_esszimmer",
  "lunch": "kueche_esszimmer", "microwave": "kueche_esszimmer", "mini_bar": "kueche_esszimmer",
  "minimarket_on_site": "kueche_esszimmer", "nd_blender": "kueche_esszimmer",
  "nd_charcoal_grill": "kueche_esszimmer", "nd_electric_grill": "kueche_esszimmer",
  "nd_gas_grill": "kueche_esszimmer", "nd_kitchen_stove": "kueche_esszimmer",
  "nd_rice_cooker": "kueche_esszimmer", "nd_spices": "kueche_esszimmer",
  "nd_vacuum_cleaner": "kueche_esszimmer", "nd_water_dispenser": "kueche_esszimmer",
  "nd_water_filter": "kueche_esszimmer", "on_site_coffee_house": "kueche_esszimmer",
  "outdoor_dining_area": "kueche_esszimmer", "oven": "kueche_esszimmer",
  "packed_lunches": "kueche_esszimmer", "picnic_area": "kueche_esszimmer",
  "picnic_table": "kueche_esszimmer", "pool_bar": "kueche_esszimmer",
  "refrigerator": "kueche_esszimmer", "restaurant": "kueche_esszimmer",
  "room_service": "kueche_esszimmer", "shared_kitchen": "kueche_esszimmer",
  "snack_bar": "kueche_esszimmer", "special_diet_menus_on_request": "kueche_esszimmer",
  "stove": "kueche_esszimmer", "toaster": "kueche_esszimmer", "trash_cans": "kueche_esszimmer",
  "vending_machine_drinks": "kueche_esszimmer", "vending_machine_snacks": "kueche_esszimmer",
  "wine_champagne": "kueche_esszimmer", "wine_glasses": "kueche_esszimmer",
  // standort (29)
  "beachfront": "standort", "city_view": "standort", "detached": "standort",
  "dirt_roads": "standort", "entire_property_on_ground_floor": "standort",
  "garden_view": "standort", "gasoline_nearby": "standort", "gravel_roads": "standort",
  "inner_courtyard_view": "standort", "lake_view": "standort", "landmark_view": "standort",
  "mountain_view": "standort", "nd_city_centre": "standort", "nd_golf_view": "standort",
  "nd_harbour_district": "standort", "nd_near_sea": "standort", "nd_resort": "standort",
  "nd_rural": "standort", "nd_village": "standort", "paved_roads": "standort",
  "pool_view": "standort", "private_flat_in_block_of_flats": "standort",
  "quiet_street_view": "standort", "river_view": "standort", "sea_view": "standort",
  "semi_detached": "standort", "ski_to_door_access": "standort", "view": "standort",
  "waterfront": "standort",
  // parkplaetze (39)
  "accessible_parking": "parkplaetze", "back_in_rv_sites": "parkplaetze",
  "balcony": "parkplaetze", "bike_parking": "parkplaetze", "community_fire_pit": "parkplaetze",
  "electric_vehicle_charging_station": "parkplaetze", "fire_pit": "parkplaetze",
  "garden": "parkplaetze", "hike_bike_campsites": "parkplaetze",
  "indoor_parking": "parkplaetze", "kids_outdoor_play_equipment": "parkplaetze",
  "nd_carport": "parkplaetze", "nd_garage": "parkplaetze", "nd_gated_community": "parkplaetze",
  "nd_parking_available": "parkplaetze", "nd_parking_included": "parkplaetze",
  "nd_parking_optional": "parkplaetze", "nd_private_garden": "parkplaetze",
  "nd_private_playground": "parkplaetze", "nd_private_porch": "parkplaetze",
  "nd_private_tennis": "parkplaetze", "nd_shared_garden": "parkplaetze",
  "nd_shared_playground": "parkplaetze", "nd_shared_porch": "parkplaetze",
  "nd_shared_tennis": "parkplaetze", "outdoor_fireplace": "parkplaetze",
  "outdoor_furniture": "parkplaetze", "patio": "parkplaetze", "playground": "parkplaetze",
  "private_entrance": "parkplaetze", "pull_thru_rv_sites": "parkplaetze",
  "secured_parking": "parkplaetze", "street_parking": "parkplaetze",
  "sun_loungers_or_beach_chairs": "parkplaetze", "sun_terrace": "parkplaetze",
  "sun_umbrellas": "parkplaetze", "tennis_court": "parkplaetze", "terrace": "parkplaetze",
  "valet_parking": "parkplaetze",
  // konditionen (47)
  "24_hour_front_desk": "konditionen", "accessible_by_lift": "konditionen",
  "ada_accessible": "konditionen", "adult_only": "konditionen",
  "all_non_smoking": "konditionen", "allergy_free": "konditionen",
  "atm_on_site": "konditionen", "auditory_guidance": "konditionen",
  "bridal_suite": "konditionen", "cashless_payment_available": "konditionen",
  "children_crib_cots": "konditionen", "clothes_rack": "konditionen",
  "contactless_check_in_out": "konditionen", "designated_smoking_area": "konditionen",
  "dressing_room": "konditionen", "elevators": "konditionen",
  "entire_unit_wheelchair_accessible": "konditionen", "executive_lounge_access": "konditionen",
  "express_check_in_check_out": "konditionen", "extra_long_beds_2_meter": "konditionen",
  "family_rooms": "konditionen", "hypoallergenic_room_available": "konditionen",
  "interconnecting_room_s_available": "konditionen", "invoices_provided": "konditionen",
  "nd_credit_card_accepted": "konditionen", "nd_events_allowed": "konditionen",
  "nd_not_accessible": "konditionen", "nd_not_senior_friendly": "konditionen",
  "nd_pets_not_allowed": "konditionen", "nd_pets_on_request": "konditionen",
  "nd_senior_friendly": "konditionen", "nd_smoking_allowed": "konditionen",
  "nd_smoking_not_allowed": "konditionen", "non_smoking_rooms": "konditionen",
  "pet_basket": "konditionen", "pet_bowls": "konditionen",
  "private_check_in_check_out": "konditionen",
  "property_is_wheel_chair_accessible": "konditionen", "rollaway_bed": "konditionen",
  "rooms_facilities_for_disabled": "konditionen", "sofa_bed": "konditionen",
  "upper_floor_reachable_by_lift": "konditionen",
  "upper_floor_reachable_by_stairs_only": "konditionen", "viproom_facilities": "konditionen",
  "visual_aids_braille": "konditionen", "visual_aids_tactile_signs": "konditionen",
  "wardrobe_closet": "konditionen",
  // pool_spa (72)
  "back_massage": "pool_spa", "beauty_services": "pool_spa", "body_scrub": "pool_spa",
  "body_treatments": "pool_spa", "body_wrap": "pool_spa", "couples_massage": "pool_spa",
  "facial_treatments": "pool_spa", "fitness_spa_locker_rooms": "pool_spa",
  "foot_bath": "pool_spa", "foot_massage": "pool_spa", "full_body_massage": "pool_spa",
  "hair_colouring": "pool_spa", "hair_cut": "pool_spa", "hair_dresser_beautician": "pool_spa",
  "hair_styling": "pool_spa", "hair_treatments": "pool_spa", "hand_massage": "pool_spa",
  "head_massage": "pool_spa", "heated_pool": "pool_spa", "hot_spring_bath": "pool_spa",
  "hot_tub": "pool_spa", "indoor_pool": "pool_spa",
  "indoor_swimming_pool_all_year": "pool_spa", "indoor_swimming_pool_seasonal": "pool_spa",
  "infinity_pool": "pool_spa", "jacuzzi_hot_tub": "pool_spa", "kids_pool": "pool_spa",
  "light_therapy": "pool_spa", "make_up_services": "pool_spa", "manicure": "pool_spa",
  "massage": "pool_spa", "massage_chair": "pool_spa", "nd_indoor_hot_tub": "pool_spa",
  "nd_outdoor_hot_tub": "pool_spa", "nd_private_dry_sauna": "pool_spa",
  "nd_private_heated_indoor_pool": "pool_spa", "nd_private_heated_outdoor_pool": "pool_spa",
  "nd_private_indoor_pool": "pool_spa", "nd_private_outdoor_pool": "pool_spa",
  "nd_private_steam_sauna": "pool_spa", "nd_shared_dry_sauna": "pool_spa",
  "nd_shared_heated_indoor_pool": "pool_spa", "nd_shared_heated_outdoor_pool": "pool_spa",
  "nd_shared_indoor_pool": "pool_spa", "nd_shared_outdoor_pool": "pool_spa",
  "nd_shared_steam_sauna": "pool_spa", "neck_massage": "pool_spa", "open_air_bath": "pool_spa",
  "outdoor_pool": "pool_spa", "outdoor_swimming_pool_all_year": "pool_spa",
  "outdoor_swimming_pool_seasonal": "pool_spa", "pedicure": "pool_spa",
  "plunge_pool": "pool_spa", "pool_cover": "pool_spa", "pool_with_view": "pool_spa",
  "private_pool": "pool_spa", "public_bath": "pool_spa", "rooftop_pool": "pool_spa",
  "salt_water_pool": "pool_spa", "sauna": "pool_spa", "shallow_end": "pool_spa",
  "shallow_end_pool": "pool_spa", "solarium": "pool_spa", "spa_bath": "pool_spa",
  "spa_facilities": "pool_spa", "spa_lounge_relaxation_area": "pool_spa",
  "spa_wellness_centre": "pool_spa", "spa_wellness_packages": "pool_spa",
  "steam_room": "pool_spa", "swimming_pool": "pool_spa", "turkish_steam_bath": "pool_spa",
  "waxing_services": "pool_spa",
  // dienstleistungen (46)
  "airport_shuttle_free": "dienstleistungen",
  "airport_shuttle_srv_surcharge": "dienstleistungen",
  "airport_shuttle_surcharge": "dienstleistungen", "anti_covid_cleaning": "dienstleistungen",
  "baby_sitting": "dienstleistungen", "baggage_storage": "dienstleistungen",
  "car_rental": "dienstleistungen", "chapel_shrine": "dienstleistungen",
  "cleaning_optional": "dienstleistungen", "concierge_desk": "dienstleistungen",
  "currency_exchange": "dienstleistungen", "disinfected_between_stays": "dienstleistungen",
  "dry_cleaning": "dienstleistungen", "events_ticket_service": "dienstleistungen",
  "grocery_service": "dienstleistungen", "housekeeping_daily": "dienstleistungen",
  "ironing_service": "dienstleistungen", "laundry": "dienstleistungen",
  "linens_washed_guidelines": "dienstleistungen",
  "mobile_app_for_room_service": "dienstleistungen", "nd_all_inclusive": "dienstleistungen",
  "nd_full_board": "dienstleistungen", "nd_half_board": "dienstleistungen",
  "nd_housekeeper_included": "dienstleistungen", "nd_housekeeper_optional": "dienstleistungen",
  "nd_laundry_included": "dienstleistungen", "nd_laundry_optional": "dienstleistungen",
  "opt_out_from_daily_room_cleaning": "dienstleistungen",
  "professional_cleaning": "dienstleistungen", "public_transport_tickets": "dienstleistungen",
  "sealed_after_cleaning": "dienstleistungen", "shoeshine": "dienstleistungen",
  "shops_on_site": "dienstleistungen", "shuttle_service": "dienstleistungen",
  "shuttle_service_free": "dienstleistungen", "shuttle_service_surcharge": "dienstleistungen",
  "ski_shuttle": "dienstleistungen", "souvenir_gift_shop": "dienstleistungen",
  "strollers": "dienstleistungen", "tableware_sanitised": "dienstleistungen",
  "ticket_service": "dienstleistungen", "tour_desk": "dienstleistungen",
  "towels_changed_upon_request": "dienstleistungen", "trash_service": "dienstleistungen",
  "wake_up_service": "dienstleistungen", "wake_up_service_alarm_clock": "dienstleistungen",
  // sonstiges (39)
  "100_amps": "sonstiges", "20_amps": "sonstiges", "30_amps": "sonstiges",
  "50_amps": "sonstiges", "access_to_health_care_professionals": "sonstiges",
  "big_rig_friendly": "sonstiges", "carpeted_floor": "sonstiges", "dump_station": "sonstiges",
  "earplugs": "sonstiges", "face_masks_for_guests_available": "sonstiges",
  "food_securely_covered": "sonstiges", "guest_health_check": "sonstiges",
  "keycard_for_room_electricity": "sonstiges", "mosquito_net": "sonstiges",
  "no_plastic_cups": "sonstiges", "no_plastic_cutlery": "sonstiges",
  "no_plastic_drink_bottles": "sonstiges", "no_plastic_stirrers": "sonstiges",
  "no_plastic_straws": "sonstiges", "no_plastic_toiletries": "sonstiges",
  "no_plastic_water_bottles": "sonstiges", "physical_distancing_guidelines": "sonstiges",
  "physical_distancing_in_dining_areas": "sonstiges", "propane_refilling_station": "sonstiges",
  "refillable_water_stations": "sonstiges", "rv_hookup": "sonstiges",
  "rv_sanitation": "sonstiges", "sewer_hookups": "sonstiges",
  "shared_stationery_removed": "sonstiges", "slide_outs": "sonstiges",
  "soundproof_rooms": "sonstiges", "soundproofing": "sonstiges",
  "staff_guest_barriers": "sonstiges", "staff_safety_protocols": "sonstiges",
  "thermometers_provided": "sonstiges", "tiled_marble_floor": "sonstiges",
  "trek_in_1_5m": "sonstiges", "water_hookups": "sonstiges",
  "wooden_parquet_floor": "sonstiges",
};

// Deutsche Kategorie-Titel (Dashboard). Reihenfolge = AMENITY_CATALOG.
export const AMENITY_CATEGORY_LABELS_DE: Record<AmenityCategory, string> = {
  general: "Allgemein & Komfort",
  food_and_drink: "Essen & Trinken",
  outdoors: "Außenbereich",
  services: "Services",
  activites: "Aktivitäten",
  safety_and_security: "Sicherheit",
  parking: "Parken",
  pets: "Haustiere",
  sustainable_practice: "Nachhaltigkeit",
};

// Slug → deutsches Anzeige-Label (Fallback: Slug selbst, falls Altbestand).
export function amenityLabel(slug: string): string {
  return AMENITY_LABELS_DE[slug] ?? slug;
}

// Deutsche Bezeichnungen der Channex-Facilities (Dashboard ist deutsch).
// Für Gast-/Portal-/OTA-Sichten stehen alle 24 Sprachen im i18n-Namespace
// "amenities" bereit. Slug → deutsches Label.
export const AMENITY_LABELS_DE: Record<string, string> = {
  "24_hour_front_desk": "24-Stunden-Rezeption",
  "24_hour_security": "24-Stunden-Sicherheitsdienst",
  "accessible_parking": "Barrierefreie Parkplätze",
  "access_to_health_care_professionals": "Zugang zu medizinischem Fachpersonal",
  "ada_accessible": "Barrierefrei (ADA)",
  "adult_only": "Nur für Erwachsene",
  "aerobics": "Aerobic",
  "air_conditioning": "Klimaanlage",
  "airport_shuttle_free": "Flughafenshuttle (kostenlos)",
  "airport_shuttle_srv_surcharge": "Flughafenshuttle (gegen Aufpreis)",
  "airport_shuttle_surcharge": "Flughafenshuttle (gegen Aufpreis)",
  "tableware_sanitised": "Alle Teller, Besteck, Gläser und weiteres Geschirr wurden desinfiziert",
  "all_non_smoking": "Alle Bereiche rauchfrei (öffentlich und privat)",
  "archery": "Bogenschießen",
  "atm_on_site": "Geldautomat vor Ort",
  "auditory_guidance": "Akustische Leitsysteme",
  "baby_safety_gates": "Kindersicherheitsgitter",
  "baby_sitting": "Babysitting",
  "back_in_rv_sites": "Rückwärts-Wohnmobilstellplätze",
  "back_massage": "Rückenmassage",
  "badminton_equipment": "Badminton-Ausrüstung",
  "baggage_storage": "Gepäckaufbewahrung",
  "bar": "Bar",
  "bathroom_emergency_pull_cord": "Notrufschnur im Badezimmer",
  "bbq_picnic_area": "Grill-/Picknickbereich",
  "beach": "Strand",
  "beachfront": "Direkt am Strand",
  "beauty_services": "Beauty-Anwendungen",
  "bicycle_rentals": "Fahrradverleih",
  "bike_parking": "Fahrradstellplatz",
  "bike_rental": "Fahrradverleih",
  "bikes_available_free": "Fahrräder verfügbar (kostenlos)",
  "bike_tours": "Fahrradtouren",
  "billiard": "Billard",
  "bingo": "Bingo",
  "board_games_puzzles": "Brettspiele/Puzzles",
  "body_scrub": "Körperpeeling",
  "body_treatments": "Körperbehandlungen",
  "body_wrap": "Körperpackung",
  "book_dvd_music_library_for_children": "Buch-/DVD-/Musikbibliothek für Kinder",
  "bottle_of_water": "Wasserflasche",
  "bowling": "Bowling",
  "breakfast": "Frühstück",
  "breakfast_in_the_room": "Frühstück im Zimmer",
  "breakfast_takeaway_containers": "Frühstück zum Mitnehmen in Behältern",
  "bridal_suite": "Hochzeitssuite",
  "business_center": "Business-Center",
  "cable_hookups": "Kabelanschluss",
  "canoeing": "Kanufahren",
  "carbon_monoxide_detector": "Kohlenmonoxidmelder",
  "carbon_monoxide_source": "Kohlenmonoxidquelle",
  "car_rental": "Autovermietung",
  "cashless_payment_available": "Bargeldloses Bezahlen möglich",
  "casino": "Casino",
  "cctv_in_common_areas": "Videoüberwachung in Gemeinschaftsbereichen",
  "cctv_outside_property": "Videoüberwachung außerhalb der Unterkunft",
  "chapel_shrine": "Kapelle/Schrein",
  "children_television_networks": "Kinder-Fernsehsender",
  "chocolate_cookies": "Schokolade/Kekse",
  "clubhouse": "Clubhaus",
  "community_bbq_grill": "Gemeinschafts-Grillplatz",
  "community_fire_pit": "Gemeinschafts-Feuerstelle",
  "community_restrooms": "Gemeinschaftstoiletten",
  "community_showers": "Gemeinschaftsduschen",
  "community_water_fountain": "Gemeinschafts-Trinkbrunnen",
  "concierge_desk": "Concierge-Service",
  "contactless_check_in_out": "Kontaktloser Check-in/Check-out",
  "cooking_class": "Kochkurs",
  "couples_massage": "Paarmassage",
  "currency_exchange": "Geldwechsel",
  "cycling": "Radfahren",
  "darts": "Dart",
  "food_securely_covered": "Geliefertes Essen ist sicher abgedeckt",
  "designated_smoking_area": "Ausgewiesener Raucherbereich",
  "dinner": "Abendessen",
  "dirt_roads": "Unbefestigte Wege",
  "diving": "Tauchen",
  "drinking_water": "Trinkwasser",
  "dry_cleaning": "Chemische Reinigung",
  "electric_vehicle_charging_station": "Ladestation für Elektrofahrzeuge",
  "elevators": "Aufzug",
  "entertainment_staff": "Animationsteam",
  "evening_entertainment": "Abendunterhaltung",
  "events_ticket_service": "Ticketservice für Veranstaltungen",
  "express_check_in_check_out": "Express-Check-in/Check-out",
  "face_masks_for_guests_available": "Mund-Nasen-Schutz für Gäste verfügbar",
  "facial_treatments": "Gesichtsbehandlungen",
  "family_rooms": "Familienzimmer",
  "fence_around_pool": "Zaun um den Pool",
  "fire_extinguishers": "Feuerlöscher",
  "fire_pit": "Feuerstelle",
  "fire_ring_grill": "Feuerstelle / Grill",
  "first_aid_kit_available": "Erste-Hilfe-Set verfügbar",
  "fishing": "Angeln",
  "fitness": "Fitness",
  "fitness_center": "Fitnesscenter",
  "fitness_classes": "Fitnesskurse",
  "fitness_spa_locker_rooms": "Fitness-/Spa-Umkleiden",
  "foot_bath": "Fußbad",
  "foot_massage": "Fußmassage",
  "fruits": "Obst",
  "full_body_massage": "Ganzkörpermassage",
  "game_room": "Spielzimmer",
  "garden": "Garten",
  "gasoline_nearby": "Tankstelle in der Nähe",
  "general_store": "Gemischtwarenladen",
  "golf_course_within_2_miles": "Golfplatz (im Umkreis von 3 km)",
  "gravel_roads": "Schotterwege",
  "grocery_service": "Einkaufsservice für Lebensmittel verfügbar",
  "disinfected_between_stays": "Unterkunft wird zwischen den Aufenthalten desinfiziert",
  "sealed_after_cleaning": "Unterkunft nach der Reinigung versiegelt",
  "cleaning_optional": "Reinigung der Unterkunft auf Wunsch vermeidbar",
  "hair_colouring": "Haarfärbung",
  "hair_cut": "Haarschnitt",
  "hair_dresser_beautician": "Friseur/Kosmetiker",
  "hair_styling": "Haarstyling",
  "hair_treatments": "Haarbehandlungen",
  "hand_massage": "Handmassage",
  "hand_sanitiser": "Handdesinfektionsmittel in der Unterkunft und in wichtigen Bereichen",
  "happy_hour": "Happy Hour",
  "head_massage": "Kopfmassage",
  "heated_pool": "Beheizter Pool",
  "heating": "Heizung",
  "higher_level_toilet": "Erhöhte Toilette",
  "hike_bike_campsites": "Wander-/Radcampingplätze",
  "hiking": "Wandern",
  "horseback_riding": "Reiten",
  "hot_spring_bath": "Thermalquellenbad",
  "housekeeping_daily": "Zimmerreinigung - täglich",
  "hypoallergenic_room_available": "Hypoallergenes Zimmer verfügbar",
  "indoor_parking": "Parkplatz in der Tiefgarage",
  "indoor_play_area": "Indoor-Spielbereich",
  "indoor_pool": "Innenpool",
  "indoor_swimming_pool_all_year": "Innenpool (ganzjährig)",
  "indoor_swimming_pool_seasonal": "Innenpool (saisonal)",
  "infinity_pool": "Infinity-Pool",
  "in_room_dining_options_available": "Speisemöglichkeiten im Zimmer verfügbar",
  "invoices_provided": "Rechnungen werden ausgestellt",
  "ironing_service": "Bügelservice",
  "jacuzzi_hot_tub": "Whirlpool",
  "karaoke": "Karaoke",
  "key_access": "Zugang mit Schlüssel",
  "key_card_access": "Zugang mit Schlüsselkarte",
  "keycard_for_room_electricity": "Schlüsselkarte für Zimmerstrom",
  "kid_friendly_buffet": "Kinderfreundliches Buffet",
  "kid_meals": "Kindergerichte",
  "kids_club": "Kinderclub",
  "kids_outdoor_play_equipment": "Outdoor-Spielgeräte für Kinder",
  "kids_pool": "Kinderpool",
  "laundry": "Wäscheservice",
  "laundry_facilities": "Wäschemöglichkeiten",
  "library": "Bibliothek",
  "light_therapy": "Lichttherapie",
  "linens_washed_guidelines": "Bettwäsche, Handtücher und Wäsche werden gemäß den Richtlinien der örtlichen Behörden gewaschen",
  "live_music_performance": "Livemusik/-auftritte",
  "live_sports_events_broadcast": "Live-Sportübertragungen",
  "lockers": "Schließfächer",
  "low_bathroom_sink": "Niedriges Waschbecken",
  "lunch": "Mittagessen",
  "make_up_services": "Make-up-Service",
  "manicure": "Maniküre",
  "massage": "Massage",
  "massage_chair": "Massagesessel",
  "meeting_banquet_facilities": "Tagungs-/Banketträume",
  "minigolf": "Minigolf",
  "minimarket_on_site": "Minimarkt vor Ort",
  "mobile_app_for_room_service": "Mobile App für den Zimmerservice",
  "movie_nights": "Filmabende",
  "neck_massage": "Nackenmassage",
  "newspaper": "Zeitung",
  "nightclub_dj": "Nachtclub/DJ",
  "non_smoking_rooms": "Nichtraucherzimmer",
  "on_site_coffee_house": "Café vor Ort",
  "open_air_bath": "Freiluftbad",
  "opt_out_from_daily_room_cleaning": "Verzicht auf tägliche Zimmerreinigung möglich",
  "outdoor_fireplace": "Außenkamin",
  "outdoor_furniture": "Gartenmöbel",
  "outdoor_pool": "Außenpool",
  "outdoor_swimming_pool_all_year": "Außenpool (ganzjährig)",
  "outdoor_swimming_pool_seasonal": "Außenpool (saisonal)",
  "packed_lunches": "Lunchpakete",
  "paved_roads": "Befestigte Wege",
  "pedicure": "Pediküre",
  "personal_trainer": "Personal Trainer",
  "pet_basket": "Haustierkörbchen",
  "pet_bowls": "Futternäpfe",
  "pet_friendly": "Haustierfreundlich",
  "pets_allowed": "Haustiere erlaubt",
  "physical_distancing_guidelines": "Abstandsregeln gemäß den Richtlinien der örtlichen Behörden",
  "physical_distancing_in_dining_areas": "Abstandsregeln in Essbereichen",
  "picnic_area": "Picknickbereich",
  "picnic_table": "Picknicktisch",
  "playground": "Spielplatz",
  "plunge_pool": "Tauchbecken",
  "pool_bar": "Poolbar",
  "pool_cover": "Poolabdeckung",
  "pool_towels": "Poolhandtücher",
  "pool_with_view": "Pool mit Aussicht",
  "private_beach_area": "Privatstrandbereich",
  "private_check_in_check_out": "Privater Check-in/Check-out",
  "guest_health_check": "Verfahren zur Gesundheitsprüfung der Gäste vorhanden",
  "propane_refilling_station": "Propangas-Nachfüllstation",
  "professional_cleaning": "Unterkunft wird von professionellen Reinigungsunternehmen gereinigt",
  "property_is_wheel_chair_accessible": "Unterkunft ist rollstuhlgerecht",
  "no_plastic_drink_bottles": "Unterkunft hat alle Plastikflaschen für Nicht-Wasser-Getränke abgeschafft oder nie angeboten",
  "no_plastic_cups": "Unterkunft hat alle Plastikbecher abgeschafft oder nie angeboten",
  "no_plastic_cutlery": "Unterkunft hat Plastikbesteck und -geschirr abgeschafft oder nie angeboten",
  "no_plastic_stirrers": "Unterkunft hat alle Plastikrührstäbchen abgeschafft oder nie angeboten",
  "no_plastic_straws": "Unterkunft hat alle Plastikstrohhalme abgeschafft oder nie angeboten",
  "no_plastic_water_bottles": "Unterkunft hat alle Plastikwasserflaschen abgeschafft oder nie angeboten",
  "no_plastic_toiletries": "Unterkunft hat Einweg-Plastik-Toilettenartikel abgeschafft oder nie angeboten",
  "pub_crawls": "Kneipentouren",
  "public_bath": "Öffentliches Bad",
  "public_transport_tickets": "Tickets für öffentliche Verkehrsmittel",
  "pull_thru_rv_sites": "Durchfahr-Wohnmobilstellplätze",
  "refillable_water_stations": "Wasserauffüllstationen",
  "restaurant": "Restaurant",
  "rooftop_pool": "Dachpool",
  "room_service": "Zimmerservice",
  "rooms_facilities_for_disabled": "Zimmer/Einrichtungen für Menschen mit Behinderung",
  "rv_hookup": "Wohnmobil-Anschluss",
  "rv_sanitation": "Wohnmobil-Entsorgung",
  "safe": "Safe",
  "salt_water_pool": "Salzwasserpool",
  "sauna": "Sauna",
  "staff_guest_barriers": "Trennscheiben oder physische Barrieren zwischen Personal und Gästen in geeigneten Bereichen",
  "secured_parking": "Gesicherter Parkplatz",
  "security_alarm": "Sicherheitsalarm",
  "shallow_end_pool": "Pool mit Flachwasserbereich",
  "shared_kitchen": "Gemeinschaftsküche",
  "shared_lounge_tv_area": "Gemeinschaftslounge/TV-Bereich",
  "shared_stationery_removed": "Gemeinsam genutzte Materialien wie gedruckte Speisekarten, Zeitschriften, Stifte und Papier entfernt",
  "shoeshine": "Schuhputzservice",
  "shops_on_site": "Geschäfte (vor Ort)",
  "shower": "Dusche",
  "shuttle_service": "Shuttleservice",
  "shuttle_service_free": "Shuttleservice (kostenlos)",
  "shuttle_service_surcharge": "Shuttleservice (gegen Aufpreis)",
  "ski_equipment_hire_on_site": "Skiausrüstungsverleih (vor Ort)",
  "skiing": "Skifahren",
  "ski_pass_vendor": "Skipass-Verkauf",
  "ski_school": "Skischule",
  "ski_shuttle": "Skibus",
  "ski_storage": "Skiaufbewahrung",
  "ski_to_door_access": "Ski-in/Ski-out-Zugang",
  "smoke_alarms": "Rauchmelder",
  "snack_bar": "Snackbar",
  "snorkeling": "Schnorcheln",
  "solarium": "Solarium",
  "soundproof_rooms": "Schallisolierte Zimmer",
  "souvenir_gift_shop": "Souvenir-/Geschenkeladen",
  "spa_facilities": "Spa-Einrichtungen",
  "spa_lounge_relaxation_area": "Spa-Lounge/Ruhebereich",
  "spa_wellness_centre": "Spa- & Wellnesscenter",
  "spa_wellness_packages": "Spa-/Wellnesspakete",
  "special_diet_menus_on_request": "Spezielle Diätmenüs (auf Anfrage)",
  "squash": "Squash",
  "staff_safety_protocols": "Personal befolgt alle von den örtlichen Behörden vorgegebenen Sicherheitsprotokolle",
  "stand_up_comedy": "Stand-up-Comedy",
  "steam_room": "Dampfbad",
  "street_parking": "Parken auf der Straße",
  "strollers": "Kinderwagen",
  "sun_loungers_or_beach_chairs": "Sonnenliegen oder Strandstühle",
  "sun_terrace": "Sonnenterrasse",
  "sun_umbrellas": "Sonnenschirme",
  "swimming_pool": "Swimmingpool",
  "swimming_pool_toys": "Poolspielzeug",
  "table_tennis": "Tischtennis",
  "temporary_art_galleries": "Temporäre Kunstgalerien",
  "tennis_court": "Tennisplatz",
  "tennis_equipment": "Tennisausrüstung",
  "terrace": "Terrasse",
  "themed_dinner_nights": "Themen-Dinnerabende",
  "thermometers_provided": "Thermometer für Gäste von der Unterkunft bereitgestellt",
  "ticket_service": "Ticketservice",
  "toilet": "Toilette",
  "toilet_with_grab_rails": "Toilette mit Haltegriffen",
  "tour_desk": "Tourenschalter",
  "tour_or_class_about_local_culture": "Tour oder Kurs über die lokale Kultur",
  "towels_changed_upon_request": "Handtuchwechsel auf Wunsch",
  "trash_service": "Müllentsorgung",
  "trek_in_1_5m": "Zeltwanderung > 1,5 m",
  "trouser_press": "Hosenpresse",
  "turkish_steam_bath": "Türkisches Dampfbad",
  "anti_covid_cleaning": "Verwendung von Reinigungsmitteln, die gegen das Coronavirus wirksam sind",
  "valet_parking": "Parkservice",
  "vending_machine_drinks": "Getränkeautomat",
  "vending_machine_snacks": "Snackautomat",
  "viproom_facilities": "VIP-Zimmer-Ausstattung",
  "visual_aids_braille": "Sehhilfen: Braille-Schrift",
  "visual_aids_tactile_signs": "Sehhilfen: Taktile Beschilderung",
  "walking_tours": "Wandertouren",
  "waterfront": "Direkt am Wasser",
  "water_park": "Wasserpark",
  "water_slide": "Wasserrutsche",
  "water_sport_facilities_on_site": "Wassersportmöglichkeiten (vor Ort)",
  "waxing_services": "Waxing-Service",
  "wifi": "WLAN",
  "windsurfing": "Windsurfen",
  "wine_champagne": "Wein/Champagner",
  "yoga_classes": "Yogakurse",
};

// Räume (Rooms). In type_attributes.rooms gespeichert.
// Zimmer. In type_attributes.rooms als {privat: {slug: anzahl}, gemeinschaftlich:
// {slug: anzahl}} gespeichert — eine Wohnung hat 2 Schlafzimmer, nicht "ein
// Schlafzimmer ja/nein", und in einer Anlage ist ein Gemeinschaftsbad etwas
// anderes als ein eigenes. Slugs sind der DB-Schlüssel und bleiben stabil;
// die Labels kommen aus dem i18n-Namensraum "zimmer" (24 Locales).
export const ZIMMER_SLUGS = [
  "balkon",
  "badezimmer",
  "schlafzimmer",
  "esszimmer",
  "kueche",
  "wohnzimmer",
  "spielzimmer",
  "terrasse",
  "wc",
  "arbeitszimmer",
  // Schlafbereich: eine Schlafecke ohne eigenen Raum (Lodgify fuehrt sie
  // getrennt vom Schlafzimmer — sie traegt Betten, aber keine eigene
  // Ausstattung).
  "schlafbereich",
] as const;

export type ZimmerSlug = (typeof ZIMMER_SLUGS)[number];

// Fallback-Labels (Deutsch) für Server-/PDF-Pfade ohne next-intl.
export const ZIMMER_LABELS: Record<string, string> = {
  balkon: "Balkon",
  badezimmer: "Badezimmer",
  schlafzimmer: "Schlafzimmer",
  esszimmer: "Esszimmer",
  kueche: "Küche",
  wohnzimmer: "Wohnzimmer",
  spielzimmer: "Spielzimmer",
  terrasse: "Terrasse",
  wc: "WC",
  arbeitszimmer: "Arbeitszimmer",
  schlafbereich: "Schlafbereich",
};

export type ZimmerZaehlwerk = {
  privat: Record<string, number>;
  gemeinschaftlich: Record<string, number>;
};

/** Zimmer aus type_attributes lesen — toleriert das Altformat.
 *
 *  Bestand in der DB (live geprüft): `string[]` aus der alten Mehrfachauswahl
 *  (["Badezimmer", "Küche"]). Das wird als je 1 privates Zimmer gelesen, damit
 *  die UI ohne Datenmigration nichts verliert. */
export function readZimmer(raw: unknown): ZimmerZaehlwerk {
  const leer: ZimmerZaehlwerk = { privat: {}, gemeinschaftlich: {} };
  const zaehlwerk = (wert: unknown): Record<string, number> => {
    if (!wert || typeof wert !== "object" || Array.isArray(wert)) return {};
    const out: Record<string, number> = {};
    for (const [slug, n] of Object.entries(wert as Record<string, unknown>)) {
      const anzahl = typeof n === "number" ? Math.trunc(n) : 0;
      if (anzahl > 0) out[slug] = anzahl;
    }
    return out;
  };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      privat: zaehlwerk(o.privat),
      gemeinschaftlich: zaehlwerk(o.gemeinschaftlich),
    };
  }
  // Alt: Mehrfachauswahl mit deutschen Labels → je 1 privates Zimmer.
  if (Array.isArray(raw)) {
    const nachSlug = new Map(
      Object.entries(ZIMMER_LABELS).map(([slug, label]) => [label, slug]),
    );
    const privat: Record<string, number> = {};
    for (const label of raw) {
      const slug =
        nachSlug.get(String(label)) ??
        String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
      privat[slug] = (privat[slug] ?? 0) + 1;
    }
    return { privat, gemeinschaftlich: {} };
  }
  return leer;
}

/** Gesamtzahl der Zimmer über beide Ebenen. */
export function zimmerAnzahl(z: ZimmerZaehlwerk): number {
  const summe = (r: Record<string, number>) =>
    Object.values(r).reduce((a, b) => a + b, 0);
  return summe(z.privat) + summe(z.gemeinschaftlich);
}

// Schlafgelegenheiten. In type_attributes.beds als {slug: anzahl} gespeichert —
// ein Objekt hat i. d. R. mehrere gleiche Betten (2 Einzelbetten), das trägt eine
// reine Auswahlliste nicht. Slugs sind der DB-Schlüssel und bleiben stabil; die
// Labels kommen aus dem i18n-Namespace "beds" (24 Locales), die Illustrationen
// aus components/objekte/bett-illustrationen.tsx.
// Reihenfolge = Anzeigereihenfolge im Editor: die gängigen Betten zuerst.
export const BED_SLUGS = [
  "doppelbett",
  "einzelbett",
  "breites_doppelbett",
  "extrabreites_doppelbett",
  "kingsize",
  "etagenbett",
  "hochbett",
  "schlafsofa",
  "schrankbett",
  "ausziehbett",
  "futon",
  "wasserbett",
  "kinderbett",
  "babybett",
] as const;

export type BedSlug = (typeof BED_SLUGS)[number];

// Fallback-Labels (Deutsch). Die UI nutzt i18n; diese Map deckt Server-/PDF-
// Pfade ohne next-intl ab und dient als Referenz beim Übersetzen.
export const BED_LABELS: Record<string, string> = {
  doppelbett: "Doppelbett",
  einzelbett: "Einzelbett",
  breites_doppelbett: "Breites Doppelbett",
  extrabreites_doppelbett: "Extrabreites Doppelbett",
  kingsize: "Kingsize-Bett",
  etagenbett: "Etagenbett",
  hochbett: "Hochbett",
  schlafsofa: "Schlafsofa",
  schrankbett: "Schrankbett",
  ausziehbett: "Ausziehbett",
  futon: "Futon",
  wasserbett: "Wasserbett",
  kinderbett: "Kinderbett",
  babybett: "Babybett",
};

/** Betten-Zählwerk aus type_attributes lesen — toleriert die beiden Altformate.
 *
 * Bestand in der DB (live geprüft): `string[]` aus der alten Mehrfachauswahl
 * (["Doppelbett"]) und eine blanke `number` aus einer früheren Wizard-Version.
 * Beide werden hier gelesen, damit die UI ohne Datenmigration nichts verliert;
 * beim nächsten Speichern schreibt der Editor das neue Format zurück. */
export function readBeds(raw: unknown): Record<string, number> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [slug, n] of Object.entries(raw as Record<string, unknown>)) {
      const anzahl = typeof n === "number" ? Math.trunc(n) : 0;
      if (anzahl > 0) out[slug] = anzahl;
    }
    return out;
  }
  // Alt 1: Mehrfachauswahl mit deutschen Labels → je 1 Stück.
  if (Array.isArray(raw)) {
    const nachSlug = new Map(
      Object.entries(BED_LABELS).map(([slug, label]) => [label, slug]),
    );
    const out: Record<string, number> = {};
    for (const label of raw) {
      const slug = nachSlug.get(String(label)) ?? String(label).toLowerCase();
      out[slug] = (out[slug] ?? 0) + 1;
    }
    return out;
  }
  // Alt 2: blanke Zahl = "so viele Betten", ohne Typ. Als Doppelbett deuten wäre
  // geraten — die Zahl geht daher als Einzelbetten ein (kleinste Aussage, die
  // die Kapazität nicht überzeichnet).
  if (typeof raw === "number" && raw > 0) {
    return { einzelbett: Math.trunc(raw) };
  }
  return {};
}

/** Gesamtzahl der Schlafplätze — Betten mit zwei Liegeplätzen zählen doppelt. */
export function bedCount(beds: Record<string, number>): number {
  const zweiPlaetze = new Set([
    "doppelbett",
    "breites_doppelbett",
    "extrabreites_doppelbett",
    "kingsize",
    "etagenbett",
    "wasserbett",
  ]);
  return Object.entries(beds).reduce(
    (summe, [slug, n]) => summe + n * (zweiPlaetze.has(slug) ? 2 : 1),
    0,
  );
}
