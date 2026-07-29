// Barrierefreiheits-Merkmale (Airbnb „Accessibility features"), 14 aktuelle
// Merkmale über 4 Kategorien (belegt: airbnb.com/help/article/2000 & 3138).
// key = stabiler Slug (in type_attributes.accessibility gespeichert, NIE ändern).
// `facility` = passender Channex-property_facilities-Slug (aus _CHANNEX_FACILITY),
// falls vorhanden — dieses Merkmal wird dann zusätzlich in properties.amenities
// gespiegelt und synct an die OTAs. null = kein OTA-Gegenstück (nur intern).
// `bilder` = lokale Demo-/Beispielfotos (Vorlage „so sieht ein gutes Foto aus",
// werden NIE hochgeladen/gespeichert) unter public/barrierefreiheit/.
//
// Datenmodul ohne React-Kontext: `useTranslations` läuft hier nicht. Alle
// Anzeigetexte tragen deshalb Übersetzungs-SCHLÜSSEL (…Key), die erst in der
// rendernden Komponente über t(...) aufgelöst werden. `key` und `facility`
// sind stabile technische Werte und bleiben unübersetzt.
export type BarriereMerkmal = {
  key: string;
  labelKey: string;
  beschreibungKey: string;
  kategorieKey: string;
  /** Iconify-Name für die Merkmal-Liste (Airbnb zeigt je Merkmal ein Symbol). */
  icon: string;
  facility: string | null;
  bilder: { src: string; altKey: string }[];
  // Foto-Anleitung (Airbnb: Bullet-Liste unter „vorhanden") — wie ein gutes
  // Beweisfoto dieses Merkmals aufzunehmen ist.
  fotoHinweisKeys: string[];
};

// Standard-Anleitung für Zugangs-/Tür-Merkmale (schwellenlos / Türbreite).
const HINWEISE_ZUGANG = [
  "barriereHinweisZugang1",
  "barriereHinweisZugang2",
  "barriereHinweisZugang3",
];
// Anleitung für ein Ausstattungsmerkmal (Haltegriff, Stuhl, Lift, Parkplatz).
const HINWEISE_OBJEKT = [
  "barriereHinweisObjekt1",
  "barriereHinweisObjekt2",
  "barriereHinweisObjekt3",
];

const BILD = (key: string, n: number, altKey: string) => ({
  src: `/barrierefreiheit/${key}-${n}.jpg`,
  altKey,
});

export const BARRIERE_KATEGORIEN = [
  "barriereKatZugang",
  "barriereKatSchlafzimmer",
  "barriereKatBad",
  "barriereKatAnpassungen",
];

export const BARRIERE_MERKMALE: BarriereMerkmal[] = [
  // — Zugang zum Objekt —
  {
    key: "step_free_guest_entrance",
    labelKey: "barriereMStepFreeGuestEntranceLabel",
    beschreibungKey: "barriereMStepFreeGuestEntranceText",
    kategorieKey: "barriereKatZugang",
    icon: "ph:door-open",
    facility: null,
    bilder: [
      BILD("step_free_guest_entrance", 1, "barriereMStepFreeGuestEntranceAlt1"),
      BILD("step_free_guest_entrance", 2, "barriereMStepFreeGuestEntranceAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "guest_entrance_wider_than_32_inches",
    labelKey: "barriereMGuestEntranceWiderThan32InchesLabel",
    beschreibungKey: "barriereMGuestEntranceWiderThan32InchesText",
    kategorieKey: "barriereKatZugang",
    icon: "ph:arrows-out-line-horizontal",
    facility: null,
    bilder: [
      BILD("guest_entrance_wider_than_32_inches", 1, "barriereMGuestEntranceWiderThan32InchesAlt1"),
      BILD("guest_entrance_wider_than_32_inches", 2, "barriereMGuestEntranceWiderThan32InchesAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "disabled_parking_spot",
    labelKey: "barriereMDisabledParkingSpotLabel",
    beschreibungKey: "barriereMDisabledParkingSpotText",
    kategorieKey: "barriereKatZugang",
    icon: "ph:car",
    facility: "accessible_parking",
    bilder: [
      BILD("disabled_parking_spot", 1, "barriereMDisabledParkingSpotAlt1"),
      BILD("disabled_parking_spot", 2, "barriereMDisabledParkingSpotAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  {
    key: "well_lit_path_to_entrance",
    labelKey: "barriereMWellLitPathToEntranceLabel",
    beschreibungKey: "barriereMWellLitPathToEntranceText",
    kategorieKey: "barriereKatZugang",
    icon: "ph:lightbulb",
    facility: null,
    // Noch keine Demofotos vorhanden. Leer statt Verweise auf fehlende
    // Dateien: Ein gebrochenes Bild sieht nach Defekt aus, das Merkmal
    // funktioniert ohne Beispiele vollständig. Bilder unter
    // public/barrierefreiheit/well_lit_path_to_entrance-{1,2}.jpg ablegen,
    // dann hier BILD(...) eintragen.
    bilder: [],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  // — Schlafzimmer —
  {
    key: "step_free_bedroom_access",
    labelKey: "barriereMStepFreeBedroomAccessLabel",
    beschreibungKey: "barriereMStepFreeBedroomAccessText",
    kategorieKey: "barriereKatSchlafzimmer",
    icon: "ph:bed",
    facility: null,
    bilder: [
      BILD("step_free_bedroom_access", 1, "barriereMStepFreeBedroomAccessAlt1"),
      BILD("step_free_bedroom_access", 2, "barriereMStepFreeBedroomAccessAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "bedroom_entrance_wider_than_32_inches",
    labelKey: "barriereMBedroomEntranceWiderThan32InchesLabel",
    beschreibungKey: "barriereMBedroomEntranceWiderThan32InchesText",
    kategorieKey: "barriereKatSchlafzimmer",
    icon: "ph:arrows-out-line-horizontal",
    facility: null,
    bilder: [
      BILD("bedroom_entrance_wider_than_32_inches", 1, "barriereMBedroomEntranceWiderThan32InchesAlt1"),
      BILD("bedroom_entrance_wider_than_32_inches", 2, "barriereMBedroomEntranceWiderThan32InchesAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  // — Bad —
  {
    key: "step_free_bathroom_access",
    labelKey: "barriereMStepFreeBathroomAccessLabel",
    beschreibungKey: "barriereMStepFreeBathroomAccessText",
    kategorieKey: "barriereKatBad",
    icon: "ph:bathtub",
    facility: null,
    bilder: [
      BILD("step_free_bathroom_access", 1, "barriereMStepFreeBathroomAccessAlt1"),
      BILD("step_free_bathroom_access", 2, "barriereMStepFreeBathroomAccessAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "bathroom_entrance_wider_than_32_inches",
    labelKey: "barriereMBathroomEntranceWiderThan32InchesLabel",
    beschreibungKey: "barriereMBathroomEntranceWiderThan32InchesText",
    kategorieKey: "barriereKatBad",
    icon: "ph:arrows-out-line-horizontal",
    facility: null,
    bilder: [
      BILD("bathroom_entrance_wider_than_32_inches", 1, "barriereMBathroomEntranceWiderThan32InchesAlt1"),
      BILD("bathroom_entrance_wider_than_32_inches", 2, "barriereMBathroomEntranceWiderThan32InchesAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "toilet_grab_bar",
    labelKey: "barriereMToiletGrabBarLabel",
    beschreibungKey: "barriereMToiletGrabBarText",
    kategorieKey: "barriereKatBad",
    icon: "ph:toilet",
    facility: "toilet_with_grab_rails",
    bilder: [
      BILD("toilet_grab_bar", 1, "barriereMToiletGrabBarAlt1"),
      BILD("toilet_grab_bar", 2, "barriereMToiletGrabBarAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  {
    key: "shower_grab_bar",
    labelKey: "barriereMShowerGrabBarLabel",
    beschreibungKey: "barriereMShowerGrabBarText",
    kategorieKey: "barriereKatBad",
    icon: "ph:shower",
    facility: null,
    bilder: [
      BILD("shower_grab_bar", 1, "barriereMShowerGrabBarAlt1"),
      BILD("shower_grab_bar", 2, "barriereMShowerGrabBarAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  {
    key: "step_free_shower",
    labelKey: "barriereMStepFreeShowerLabel",
    beschreibungKey: "barriereMStepFreeShowerText",
    kategorieKey: "barriereKatBad",
    icon: "ph:shower",
    facility: null,
    bilder: [
      BILD("step_free_shower", 1, "barriereMStepFreeShowerAlt1"),
      BILD("step_free_shower", 2, "barriereMStepFreeShowerAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_ZUGANG,
  },
  {
    key: "shower_or_bath_chair",
    labelKey: "barriereMShowerOrBathChairLabel",
    beschreibungKey: "barriereMShowerOrBathChairText",
    kategorieKey: "barriereKatBad",
    icon: "ph:chair",
    facility: null,
    bilder: [
      BILD("shower_or_bath_chair", 1, "barriereMShowerOrBathChairAlt1"),
      BILD("shower_or_bath_chair", 2, "barriereMShowerOrBathChairAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  // — Anpassungen —
  {
    key: "ceiling_or_mobile_hoist",
    labelKey: "barriereMCeilingOrMobileHoistLabel",
    beschreibungKey: "barriereMCeilingOrMobileHoistText",
    kategorieKey: "barriereKatAnpassungen",
    icon: "ph:elevator",
    facility: null,
    bilder: [
      BILD("ceiling_or_mobile_hoist", 1, "barriereMCeilingOrMobileHoistAlt1"),
      BILD("ceiling_or_mobile_hoist", 2, "barriereMCeilingOrMobileHoistAlt2"),
    ],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
  {
    key: "pool_or_hot_tub_hoist",
    labelKey: "barriereMPoolOrHotTubHoistLabel",
    beschreibungKey: "barriereMPoolOrHotTubHoistText",
    kategorieKey: "barriereKatAnpassungen",
    icon: "ph:swimming-pool",
    facility: null,
    // Noch keine Demofotos vorhanden — siehe Hinweis bei
    // well_lit_path_to_entrance. Dateien unter
    // public/barrierefreiheit/pool_or_hot_tub_hoist-{1,2}.jpg ablegen, dann
    // hier BILD(...) eintragen.
    bilder: [],
    fotoHinweisKeys: HINWEISE_OBJEKT,
  },
];
