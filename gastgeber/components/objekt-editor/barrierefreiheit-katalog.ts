// Barrierefreiheits-Merkmale (Airbnb „Accessibility features"), 12 aktuelle
// Merkmale über 4 Kategorien (belegt: airbnb.com/help/article/2000 & 3138).
// key = stabiler Slug (in type_attributes.accessibility gespeichert, NIE ändern).
// `facility` = passender Channex-property_facilities-Slug (aus _CHANNEX_FACILITY),
// falls vorhanden — dieses Merkmal wird dann zusätzlich in properties.amenities
// gespiegelt und synct an die OTAs. null = kein OTA-Gegenstück (nur intern).
// `bilder` = lokale Demo-/Beispielfotos (Vorlage „so sieht ein gutes Foto aus",
// werden NIE hochgeladen/gespeichert) unter public/barrierefreiheit/.
export type BarriereMerkmal = {
  key: string;
  label: string;
  beschreibung: string;
  kategorie: string;
  facility: string | null;
  bilder: { src: string; alt: string }[];
  // Foto-Anleitung (Airbnb: Bullet-Liste unter „vorhanden") — wie ein gutes
  // Beweisfoto dieses Merkmals aufzunehmen ist.
  fotoHinweise: string[];
};

// Standard-Anleitung für Zugangs-/Tür-Merkmale (schwellenlos / Türbreite).
const HINWEISE_ZUGANG = [
  "Achte vor dem Fotografieren darauf, dass der Bereich ebenerdig oder per Aufzug/Rampe erreichbar ist.",
  "Öffne die Tür und richte die Kamera von außen in den Raum.",
  "Neige die Kamera nach unten, um die gesamte Schwelle des Zugangs einzufangen.",
];
// Anleitung für ein Ausstattungsmerkmal (Haltegriff, Stuhl, Lift, Parkplatz).
const HINWEISE_OBJEKT = [
  "Fotografiere das Merkmal aus kurzer Entfernung, sodass es klar erkennbar ist.",
  "Achte auf gute Beleuchtung und einen freien Blick ohne störende Gegenstände.",
  "Nimm zusätzlich ein Übersichtsfoto auf, das zeigt, wo sich das Merkmal befindet.",
];

const BILD = (key: string, n: number, alt: string) => ({
  src: `/barrierefreiheit/${key}-${n}.jpg`,
  alt,
});

export const BARRIERE_KATEGORIEN = [
  "Zugang zum Objekt",
  "Schlafzimmer",
  "Bad",
  "Anpassungen",
];

export const BARRIERE_MERKMALE: BarriereMerkmal[] = [
  // — Zugang zum Objekt —
  {
    key: "step_free_guest_entrance",
    label: "Schwellenloser Zugang zum Eingang",
    beschreibung:
      "Zum Gästeeingang führen keine Stufen, Treppen oder Schwellen höher als 5 cm. Er ist ebenerdig oder per Rampe erreichbar.",
    kategorie: "Zugang zum Objekt",
    facility: null,
    bilder: [
      BILD("step_free_guest_entrance", 1, "Ebenerdiger Eingang mit Rampe"),
      BILD("step_free_guest_entrance", 2, "Schwellenlose Türschwelle"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "guest_entrance_wider_than_32_inches",
    label: "Gästeeingang breiter als 81 cm",
    beschreibung:
      "Die Eingangstür ist mindestens 81 cm breit, sodass ein Rollstuhl hindurchpasst.",
    kategorie: "Zugang zum Objekt",
    facility: null,
    bilder: [
      BILD("guest_entrance_wider_than_32_inches", 1, "Breite Eingangstür"),
      BILD("guest_entrance_wider_than_32_inches", 2, "Breiter Türdurchgang"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "disabled_parking_spot",
    label: "Behindertenparkplatz",
    beschreibung:
      "Ein ausgewiesener barrierefreier Parkplatz für Gäste mit Behinderung ist in der Nähe des Eingangs vorhanden.",
    kategorie: "Zugang zum Objekt",
    facility: "accessible_parking",
    bilder: [
      BILD("disabled_parking_spot", 1, "Behindertenparkplatz mit Symbol"),
      BILD("disabled_parking_spot", 2, "Barrierefreie Parkfläche"),
    ],
    fotoHinweise: HINWEISE_OBJEKT,
  },
  // — Schlafzimmer —
  {
    key: "step_free_bedroom_access",
    label: "Schwellenloser Zugang zum Schlafzimmer",
    beschreibung:
      "Zum Schlafzimmer führen keine Stufen oder Schwellen höher als 5 cm; es ist ebenerdig oder per Aufzug/Rampe erreichbar.",
    kategorie: "Schlafzimmer",
    facility: null,
    bilder: [
      BILD("step_free_bedroom_access", 1, "Ebenerdiges Schlafzimmer"),
      BILD("step_free_bedroom_access", 2, "Schwellenloser Schlafzimmerzugang"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "bedroom_entrance_wider_than_32_inches",
    label: "Schlafzimmereingang breiter als 81 cm",
    beschreibung:
      "Die Schlafzimmertür ist mindestens 81 cm breit, sodass ein Rollstuhl hindurchpasst.",
    kategorie: "Schlafzimmer",
    facility: null,
    bilder: [
      BILD("bedroom_entrance_wider_than_32_inches", 1, "Breite Schlafzimmertür"),
      BILD("bedroom_entrance_wider_than_32_inches", 2, "Breiter Zugang zum Schlafzimmer"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  // — Bad —
  {
    key: "step_free_bathroom_access",
    label: "Schwellenloser Zugang zum Bad",
    beschreibung:
      "Zum Badezimmer führen keine Stufen oder Schwellen höher als 5 cm; es ist ebenerdig erreichbar.",
    kategorie: "Bad",
    facility: null,
    bilder: [
      BILD("step_free_bathroom_access", 1, "Ebenerdiges Badezimmer"),
      BILD("step_free_bathroom_access", 2, "Schwellenloser Badzugang"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "bathroom_entrance_wider_than_32_inches",
    label: "Badeingang breiter als 81 cm",
    beschreibung:
      "Die Badezimmertür ist mindestens 81 cm breit, sodass ein Rollstuhl hindurchpasst.",
    kategorie: "Bad",
    facility: null,
    bilder: [
      BILD("bathroom_entrance_wider_than_32_inches", 1, "Breite Badezimmertür"),
      BILD("bathroom_entrance_wider_than_32_inches", 2, "Breiter Zugang zum Bad"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "toilet_grab_bar",
    label: "Haltegriff am WC",
    beschreibung:
      "Neben dem WC ist ein fest montierter Haltegriff angebracht, der beim Hinsetzen und Aufstehen Halt gibt.",
    kategorie: "Bad",
    facility: "toilet_with_grab_rails",
    bilder: [
      BILD("toilet_grab_bar", 1, "Haltegriff im Bad"),
      BILD("toilet_grab_bar", 2, "Barrierefreies Bad mit Haltegriffen"),
    ],
    fotoHinweise: HINWEISE_OBJEKT,
  },
  {
    key: "shower_grab_bar",
    label: "Haltegriff in der Dusche",
    beschreibung:
      "In der Dusche ist ein fest montierter Haltegriff angebracht, der beim Duschen Halt gibt.",
    kategorie: "Bad",
    facility: null,
    bilder: [
      BILD("shower_grab_bar", 1, "Haltegriff in der Dusche"),
      BILD("shower_grab_bar", 2, "Dusche mit Griffstange"),
    ],
    fotoHinweise: HINWEISE_OBJEKT,
  },
  {
    key: "step_free_shower",
    label: "Schwellenlose Dusche",
    beschreibung:
      "Die Dusche ist ebenerdig begehbar, ohne Stufe oder Schwelle, sodass sie mit Rollstuhl oder Duschstuhl befahrbar ist.",
    kategorie: "Bad",
    facility: null,
    bilder: [
      BILD("step_free_shower", 1, "Bodengleiche Dusche"),
      BILD("step_free_shower", 2, "Schwellenlose Roll-in-Dusche"),
    ],
    fotoHinweise: HINWEISE_ZUGANG,
  },
  {
    key: "shower_or_bath_chair",
    label: "Dusch- oder Badestuhl",
    beschreibung:
      "Ein Dusch- oder Badestuhl steht zur Verfügung, sodass Gäste im Sitzen duschen oder baden können.",
    kategorie: "Bad",
    facility: null,
    bilder: [
      BILD("shower_or_bath_chair", 1, "Duschstuhl"),
      BILD("shower_or_bath_chair", 2, "Badewannensitz"),
    ],
    fotoHinweise: HINWEISE_OBJEKT,
  },
  // — Anpassungen —
  {
    key: "ceiling_or_mobile_hoist",
    label: "Decken- oder mobiler Lift",
    beschreibung:
      "Ein Deckenlift oder mobiler Personenlifter ist vorhanden, um Gäste z. B. vom Rollstuhl ins Bett oder in die Dusche zu heben.",
    kategorie: "Anpassungen",
    facility: null,
    bilder: [
      BILD("ceiling_or_mobile_hoist", 1, "Personenlifter"),
      BILD("ceiling_or_mobile_hoist", 2, "Lifthilfe"),
    ],
    fotoHinweise: HINWEISE_OBJEKT,
  },
];
