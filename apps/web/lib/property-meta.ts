// Anzeige-Metadaten für Objekte: Typ-/Status-Labels + Standard-Ausstattung.
// Wird von Liste, Detailseite und Editoren gemeinsam genutzt.
import type { PropertyStatus, PropertyType } from "@/lib/properties";

export const TYPE_LABELS: Record<PropertyType, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  stellplatz: "Stellplatz",
  hausboot: "Hausboot",
};

export const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value: value as PropertyType,
  label,
}));

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  inactive: "Inaktiv",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ value: value as PropertyStatus, label }),
);

// Häufige Ausstattung (Lodgify-Amenities), gruppiert für die Auswahl.
export const AMENITY_GROUPS: { group: string; items: string[] }[] = [
  {
    group: "Küche",
    items: [
      "Kaffeemaschine",
      "Kochutensilien",
      "Geschirrspüler",
      "Mikrowelle",
      "Backofen",
      "Kühlschrank",
      "Wasserkocher",
    ],
  },
  {
    group: "Komfort",
    items: ["WLAN", "Klimaanlage", "Heizung", "TV", "Waschmaschine", "Trockner"],
  },
  {
    group: "Außen",
    items: ["Terrasse", "Balkon", "Garten", "Grill", "Parkplatz", "Pool"],
  },
  {
    group: "Sonstiges",
    items: ["Haustiere erlaubt", "Nichtraucher", "Kinderbett", "Aufzug"],
  },
];

// Räume (Lodgify „Rooms"). In type_attributes.rooms gespeichert.
export const ROOM_OPTIONS = [
  "Badezimmer",
  "Schlafzimmer",
  "Esszimmer",
  "Küche",
  "Wohnzimmer",
  "Terrasse",
  "Gäste-WC",
  "Arbeitszimmer",
];

// Betten (Lodgify „Sleeping arrangements"). In type_attributes.beds gespeichert.
export const BED_OPTIONS = [
  "Doppelbett",
  "Einzelbett",
  "Etagenbett",
  "Schlafsofa",
  "Kingsize-Bett",
  "Babybett",
];
