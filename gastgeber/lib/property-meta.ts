// Objekttyp-Metadaten (Labels + Betriebsart-Filter). Portiert aus web/lib/
// property-meta.ts — die bestehende, korrekte Struktur: der Objekttyp ist
// property_type (was das Objekt IST), gefiltert nach Betriebsart. FeWo sieht
// Ferienobjekt-Typen, Hotel sieht Zimmertypen — nie beides gemischt.

export type AccommodationType = "vacation_rental" | "hotel";

// Deutsche Labels je interner property_type (public.property_type, 0009/0098).
export const TYPE_LABELS: Record<string, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  stellplatz: "Stellplatz",
  hausboot: "Hausboot",
  // Hotel-Zimmertypen (Betriebsart 'hotel')
  einzelzimmer: "Einzelzimmer",
  doppelzimmer: "Doppelzimmer",
  zweibettzimmer: "Zweibettzimmer",
  familienzimmer: "Familienzimmer",
  junior_suite: "Junior Suite",
  suite: "Suite",
};

// Ferienvermietung: Ferienobjekt-Typen. Hotel: Zimmertypen. Der Anlage-/Editor-
// Dialog zeigt NUR die zur Betriebsart passende Liste (typeOptionsFor).
export const VR_TYPES: string[] = [
  "ferienhaus",
  "appartement",
  "glamping",
  "tiny_house",
  "stellplatz",
  "hausboot",
];

export const HOTEL_TYPES: string[] = [
  "einzelzimmer",
  "doppelzimmer",
  "zweibettzimmer",
  "familienzimmer",
  "junior_suite",
  "suite",
];

/** Objekttyp-Optionen für die Betriebsart. Ohne Betriebsart (Altbestand) → VR. */
export function typeOptionsFor(
  accommodationType: AccommodationType | null | undefined,
): { value: string; label: string }[] {
  const types = accommodationType === "hotel" ? HOTEL_TYPES : VR_TYPES;
  return types.map((value) => ({ value, label: TYPE_LABELS[value] }));
}

/** Anzeige-Label für einen property_type (Fallback: der rohe Wert). */
export function typeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value;
}
