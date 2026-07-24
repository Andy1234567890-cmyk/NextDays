// Bett-Typen für „Schlafmöglichkeiten" (Airbnb „Sleeping arrangements").
// Stabile Schlüssel (in type_attributes.sleeping gespeichert) + deutsches Label
// + Icon. Reihenfolge wie bei Airbnb. Schlüssel NIE umbenennen (sonst verwaisen
// gespeicherte Zähler).
export type BettTyp = { key: string; label: string; icon: string };

export const BETT_TYPEN: BettTyp[] = [
  { key: "single", label: "Einzelbett", icon: "mdi:bed-single-outline" },
  { key: "double", label: "Doppelbett", icon: "mdi:bed-double-outline" },
  { key: "queen", label: "Queensize-Bett", icon: "mdi:bed-queen-outline" },
  { key: "king", label: "Kingsize-Bett", icon: "mdi:bed-king-outline" },
  { key: "small_double", label: "Kleines Doppelbett", icon: "mdi:bed-double-outline" },
  { key: "bunk", label: "Etagenbett", icon: "mdi:bunk-bed-outline" },
  { key: "sofa_bed", label: "Schlafsofa", icon: "mdi:sofa-single-outline" },
  { key: "couch", label: "Couch", icon: "mdi:sofa-outline" },
  { key: "floor_mattress", label: "Bodenmatratze", icon: "mdi:bed-king-outline" },
  { key: "air_mattress", label: "Luftmatratze", icon: "mdi:bed-empty" },
  { key: "crib", label: "Babybett", icon: "mdi:cradle-outline" },
  { key: "toddler_bed", label: "Kinderbett", icon: "mdi:bed-single-outline" },
  { key: "hammock", label: "Hängematte", icon: "mdi:hanger" },
  { key: "water_bed", label: "Wasserbett", icon: "mdi:bed-outline" },
];
