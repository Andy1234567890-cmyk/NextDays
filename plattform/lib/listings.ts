// UI-Modell der Buchungsplattform. Die Daten kommen aus dem Backend
// (booking_engine-Slice, /api/v1/booking-engine/listings) — KEINE Demo mehr.
// Das Mapping API → Listing liegt in lib/inserate.ts.
export type Listing = {
  id: string;
  titel: string;
  typ: string; // property_type (für Themen-Reihen)
  ort: string; // "Stadt, Land" (gast-sicher, keine exakte Adresse)
  preisProNacht: number | null; // „ab"-Preis; null = kein Preis hinterlegt
  currency: string | null;
  hue: number; // Farbton für den Platzhalter, falls kein Foto vorhanden
  fotos: string[]; // echte Foto-URLs (kann leer sein → Platzhalter)
  schlafzimmer: number | null;
  baeder: number | null;
  gaeste: number;
  // Haustiere erlaubt? Entscheidet, ob die Buchungsstrecke die Tierauswahl
  // anbietet. Ohne Angabe des Betriebs false (fail-closed, siehe booking_engine).
  haustiereErlaubt: boolean;
  ausstattung: string[];
  beschreibung: string | null;
  // Bewertungen werden NICHT erfunden — nur gesetzt, wenn echte Daten existieren.
  bewertung?: number;
  anzahlBewertungen?: number;
  istFavorit?: boolean;
  // Ob die Detailseite für Suchmaschinen indexierbar ist (Airbnb „Objekte in
  // Suchmaschinen aufnehmen"). Nur beim Detail gesetzt; false → robots-noindex.
  suchmaschinenIndex?: boolean;
};

// Themen-Reihe für die Startseite (horizontale Kategorie).
// Eine Themen-Reihe der Startseite. Der Titel ist NICHT ausformuliert, sondern
// benannt: „beliebt", ein Objekttyp oder eine Stadt. Übersetzt wird in der
// Komponente (die Serverfunktion `ladeReihen` kennt die Gast-Sprache nicht und
// hätte sonst deutsche Titel in jede Sprache geschrieben).
export type ReihenTitel =
  | { art: "beliebt" }
  | { art: "typ"; typ: string }
  | { art: "stadt"; stadt: string };

export type Reihe = { titel: ReihenTitel; listings: Listing[] };

/** Stabiler React-Key einer Reihe (der Titel selbst ist jetzt ein Objekt). */
export function reihenSchluessel(titel: ReihenTitel): string {
  if (titel.art === "beliebt") return "beliebt";
  return titel.art === "typ" ? `typ:${titel.typ}` : `stadt:${titel.stadt}`;
}

// Stabiler Farbton aus der ID (deterministisch) — für den Bild-Platzhalter,
// wenn ein Objekt (noch) keine Fotos hat. Kein Zufall (SSR-stabil).
export function hueAusId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

// Preis in der WÄHRUNG DES OBJEKTS formatieren — Single Source im geteilten
// Paket (@nextdays/currency), kein €-Hardcode, symbollos bei fehlender Währung
// (Wurzel 4). Re-Export, damit die bestehenden Importe aus "@/lib/listings"
// unverändert bleiben (ADR-0016, Duplikation beseitigt).
export { formatCurrency } from "@nextdays/currency";
