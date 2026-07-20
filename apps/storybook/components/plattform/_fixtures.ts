// Lokale Typ- und Format-Kopie der Plattform (unser eigener Buchungskanal) für die Storybook-
// Werkstatt. Spiegelt plattform/lib/listings.ts — bewusst OHNE Netz-/Server-
// Aufrufe (booking_engine, Stripe): Storybook ist reine UI-Vorschau.
export type Listing = {
  id: string;
  titel: string;
  typ: string;
  ort: string;
  preisProNacht: number | null;
  currency: string;
  hue: number;
  fotos: string[];
  schlafzimmer: number | null;
  baeder: number | null;
  gaeste: number;
  ausstattung: string[];
  beschreibung: string | null;
  bewertung?: number;
  anzahlBewertungen?: number;
  istFavorit?: boolean;
};

export type Reihe = { titel: string; listings: Listing[] };

// Währung IMMER aus den Daten — kein €-Hardcode (27 EU-Länder). Fehlt sie,
// rendert Intl symbollos statt einen Fantasiewert zu erfinden.
export function formatEuro(value: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(value);
}

// Deterministischer Beispiel-Datensatz (keine erfundenen Bewertungen außer wo
// explizit gesetzt — spiegelt die „keine Fantasiewerte"-Regel).
export const DEMO_LISTINGS: Listing[] = [
  {
    id: "l1",
    titel: "Helle Altbauwohnung mit Balkon",
    typ: "apartment",
    ort: "Berlin, Deutschland",
    preisProNacht: 128,
    currency: "EUR",
    hue: 210,
    fotos: [],
    schlafzimmer: 2,
    baeder: 1,
    gaeste: 4,
    ausstattung: ["wifi", "kitchen", "balcony"],
    beschreibung: null,
    bewertung: 4.9,
    anzahlBewertungen: 63,
    istFavorit: true,
  },
  {
    id: "l2",
    titel: "Ferienhaus am Deich",
    typ: "house",
    ort: "Sylt, Deutschland",
    preisProNacht: 245,
    currency: "EUR",
    hue: 40,
    fotos: [],
    schlafzimmer: 3,
    baeder: 2,
    gaeste: 6,
    ausstattung: ["wifi", "parking", "garden"],
    beschreibung: null,
    bewertung: 4.8,
    anzahlBewertungen: 21,
  },
  {
    id: "l3",
    titel: "Chalet mit Bergblick",
    typ: "chalet",
    ort: "Zermatt, Schweiz",
    preisProNacht: 390,
    currency: "CHF",
    hue: 150,
    fotos: [],
    schlafzimmer: 4,
    baeder: 2,
    gaeste: 8,
    ausstattung: ["wifi", "fireplace", "sauna"],
    beschreibung: null,
  },
  {
    id: "l4",
    titel: "Stadthaus am Kanal",
    typ: "house",
    ort: "Amsterdam, Niederlande",
    preisProNacht: null, // Preis auf Anfrage
    currency: "EUR",
    hue: 280,
    fotos: [],
    schlafzimmer: 2,
    baeder: 1,
    gaeste: 4,
    ausstattung: ["wifi", "bikes"],
    beschreibung: null,
  },
  {
    id: "l5",
    titel: "Loft im Hafenviertel",
    typ: "apartment",
    ort: "Hamburg, Deutschland",
    preisProNacht: 156,
    currency: "EUR",
    hue: 330,
    fotos: [],
    schlafzimmer: 1,
    baeder: 1,
    gaeste: 2,
    ausstattung: ["wifi", "elevator"],
    beschreibung: null,
    bewertung: 5,
    anzahlBewertungen: 8,
  },
];

export const DEMO_REIHE: Reihe = {
  titel: "Beliebt in Deutschland",
  listings: DEMO_LISTINGS,
};
