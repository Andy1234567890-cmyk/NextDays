// Demo-Daten für die Buchungsplattform — Platzhalter bis zur Backend-Anbindung.
// Bilder sind Platzhalter (Farbverläufe via PhotoPlaceholder), keine echten Fotos.
export type Listing = {
  id: string;
  titel: string;
  ort: string;
  preisProNacht: number;
  bewertung: number;
  anzahlBewertungen: number;
  istFavorit?: boolean;
  hue: number; // Farbton für den Platzhalter
  schlafzimmer: number;
  baeder: number;
  gaeste: number;
};

export const LISTINGS: Listing[] = [
  { id: "architekt", titel: "Charmante 2-Zimmer-Wohnung zentraler Architekt", ort: "Paris, Frankreich", preisProNacht: 183.75, bewertung: 4.91, anzahlBewertungen: 23, istFavorit: true, hue: 150, schlafzimmer: 1, baeder: 1, gaeste: 2 },
  { id: "altstadt", titel: "Helle Altbauwohnung mit Balkon", ort: "Wien, Österreich", preisProNacht: 129, bewertung: 4.85, anzahlBewertungen: 41, hue: 30, schlafzimmer: 2, baeder: 1, gaeste: 4 },
  { id: "see", titel: "Ferienhaus direkt am See", ort: "Tegernsee, Deutschland", preisProNacht: 245, bewertung: 4.97, anzahlBewertungen: 88, istFavorit: true, hue: 200, schlafzimmer: 3, baeder: 2, gaeste: 6 },
  { id: "loft", titel: "Modernes Loft im Szeneviertel", ort: "Berlin, Deutschland", preisProNacht: 98, bewertung: 4.72, anzahlBewertungen: 64, hue: 280, schlafzimmer: 1, baeder: 1, gaeste: 2 },
  { id: "finca", titel: "Mediterrane Finca mit Pool", ort: "Mallorca, Spanien", preisProNacht: 310, bewertung: 4.94, anzahlBewertungen: 52, hue: 15, schlafzimmer: 4, baeder: 3, gaeste: 8 },
  { id: "chalet", titel: "Gemütliches Chalet mit Bergblick", ort: "Zermatt, Schweiz", preisProNacht: 199, bewertung: 4.89, anzahlBewertungen: 37, hue: 220, schlafzimmer: 2, baeder: 1, gaeste: 4 },
  { id: "studio", titel: "Stilvolles Studio am Hafen", ort: "Porto, Portugal", preisProNacht: 87, bewertung: 4.80, anzahlBewertungen: 29, hue: 190, schlafzimmer: 1, baeder: 1, gaeste: 2 },
  { id: "villa", titel: "Großzügige Villa mit Garten", ort: "Toskana, Italien", preisProNacht: 275, bewertung: 4.96, anzahlBewertungen: 73, istFavorit: true, hue: 90, schlafzimmer: 5, baeder: 3, gaeste: 10 },
];

export function getListing(id: string): Listing | undefined {
  return LISTINGS.find((l) => l.id === id);
}

// Themen-Reihen für die Suchseite (horizontale Kategorien). Eigene Inhalte,
// Platzhalter bis zur Backend-Anbindung.
export type Reihe = { titel: string; listings: Listing[] };

// Hilfsfunktion: erzeugt aus dem Basis-Bestand eine variierte Reihe, damit ohne
// Backend mehrere Kategorien gefüllt sind (Hue/Preis leicht versetzt).
function variiere(basis: Listing[], offsetHue: number, ortPrefix?: string): Listing[] {
  return basis.map((l, i) => ({
    ...l,
    id: `${l.id}-${offsetHue}-${i}`,
    hue: (l.hue + offsetHue) % 360,
    ort: ortPrefix ?? l.ort,
  }));
}

// Erzeugt eine Stadt-Reihe: variierter Bestand, alle Inserate auf die Stadt
// gesetzt, mit stadttypischen Titeln. Eigene Demo-Inhalte, Platzhalter.
const WOHNTYPEN = ["Wohnung", "Zimmer", "Apartment", "Studio", "Loft", "Ferienwohnung", "Maisonette", "Penthouse"];

function stadtReihe(stadt: string, land: string, offsetHue: number): Reihe {
  const listings = LISTINGS.map((l, i) => ({
    ...l,
    id: `${stadt.toLowerCase()}-${i}`,
    titel: `${WOHNTYPEN[i % WOHNTYPEN.length]} in ${stadt}`,
    ort: `${stadt}, ${land}`,
    hue: (l.hue + offsetHue) % 360,
  }));
  return { titel: `Unterkünfte in ${stadt}`, listings };
}

export const REIHEN: Reihe[] = [
  { titel: "Beliebte Unterkünfte in deiner Nähe", listings: LISTINGS },
  { titel: "Ferienhäuser am Wasser", listings: variiere(LISTINGS, 60) },
  stadtReihe("Berlin", "Deutschland", 100),
  stadtReihe("Hamburg", "Deutschland", 140),
  stadtReihe("München", "Deutschland", 180),
  stadtReihe("Wien", "Österreich", 220),
  stadtReihe("Zürich", "Schweiz", 260),
  { titel: "Gemütliche Unterkünfte in den Bergen", listings: variiere(LISTINGS, 200) },
  stadtReihe("Köln", "Deutschland", 300),
  stadtReihe("Frankfurt", "Deutschland", 340),
];

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
