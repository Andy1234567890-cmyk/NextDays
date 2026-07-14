// Standort-Erweiterungen eines Objekts (Location): Entfernungen
// zu Verkehrsmitteln, eigene Karte (Bild), Wegbeschreibung sowie Adress-Zusätze
// (Bundesland/Region, eigener Stadtname, Standortgenauigkeit). Die Basis-Adresse
// (Straße, PLZ, Stadt, Land, lat/lng) liegt in eigenen Spalten; diese Zusätze
// flexibel in type_attributes.location.
import { type LocalizedText, LANGS } from "@/lib/policy-meta";

function emptyLocalized(): LocalizedText {
  return LANGS.reduce((acc, l) => ({ ...acc, [l]: "" }), {} as LocalizedText);
}

// Entfernungs-Kategorien: Flughafen, Bus, U-Bahn, Zug, Autobahn, Hafen.
export type DistanceKey =
  | "airport"
  | "bus"
  | "underground"
  | "train"
  | "motorway"
  | "port";

export type DistanceUnit = "km" | "mi";

export const DISTANCE_FIELDS: { key: DistanceKey; label: string; icon: string }[] = [
  { key: "airport", label: "Flughafen", icon: "ph:airplane-tilt" },
  { key: "bus", label: "Bus", icon: "ph:bus" },
  { key: "underground", label: "U-Bahn", icon: "ph:subway" },
  { key: "train", label: "Zug", icon: "ph:train" },
  { key: "motorway", label: "Autobahn", icon: "ph:road-horizon" },
  { key: "port", label: "Hafen", icon: "ph:anchor" },
];

export type Distances = {
  unit: DistanceUnit;
  // Werte je Kategorie (in der gewählten Einheit). null = nicht angegeben.
  values: Partial<Record<DistanceKey, number | null>>;
};

export type LocationExtras = {
  stateProvince: string;
  useCustomCity: boolean;
  customCity: string;
  showPreciseLocation: boolean;
  distances: Distances;
  customMapUrl: string;
  directions: LocalizedText;
};

export const DEFAULT_LOCATION_EXTRAS: LocationExtras = {
  stateProvince: "",
  useCustomCity: false,
  customCity: "",
  showPreciseLocation: false,
  distances: { unit: "km", values: {} },
  customMapUrl: "",
  directions: emptyLocalized(),
};

// Liest die Standort-Zusätze robust aus type_attributes.
export function readLocationExtras(
  attrs: Record<string, unknown>,
): LocationExtras {
  const raw = (attrs?.location ?? {}) as Record<string, unknown>;
  const d = (raw.distances ?? {}) as Record<string, unknown>;
  const dir = (raw.directions ?? {}) as Record<string, unknown>;
  const directions = emptyLocalized();
  for (const l of LANGS) {
    if (typeof dir[l] === "string") directions[l] = dir[l] as string;
  }
  return {
    stateProvince: str(raw.stateProvince),
    useCustomCity: raw.useCustomCity === true,
    customCity: str(raw.customCity),
    showPreciseLocation: raw.showPreciseLocation === true,
    distances: {
      unit: d.unit === "mi" ? "mi" : "km",
      values:
        d.values && typeof d.values === "object"
          ? (d.values as Distances["values"])
          : {},
    },
    customMapUrl: str(raw.customMapUrl),
    directions,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Gibt es eine angegebene Entfernung?
export function hasAnyDistance(d: Distances): boolean {
  return Object.values(d.values).some((v) => typeof v === "number" && v > 0);
}
