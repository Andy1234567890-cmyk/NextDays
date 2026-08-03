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
export type Reihe = { titel: string; listings: Listing[] };

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
