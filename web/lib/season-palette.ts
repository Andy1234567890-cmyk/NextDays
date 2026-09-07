// Standardfarben der Saisons A–G (Lastenheft §2.3): sieben Pastelltöne mit
// fester Buchstaben-Zuordnung, damit Legende, Kalenderzelle und Gespräch
// („Saison C") dasselbe meinen. Die Hex-Werte sind Tailwind-300/400-Töne als
// Konstanten — die EINE Stelle dafür; Komponenten setzen sie per `style`,
// nie als arbitrary-Hex in className.
//
// Reihenfolge = Preisrang, wie der Betrieb ihn liest: A = Hochsaison (mittleres
// Rot) bis G = Nebensaison (helles Grün). Die DB nimmt jeden `#RRGGBB` (0138),
// deshalb gibt es daneben ein freies Farbfeld — die Buchstaben gelten nur für
// diese sieben Werte, eine freie Farbe trägt keinen.
export type SeasonPaletteEntry = { letter: string; hex: string };

export const SEASON_PALETTE: readonly SeasonPaletteEntry[] = [
  { letter: "A", hex: "#f87171" }, // red-400 — mittelrot
  { letter: "B", hex: "#fca5a5" }, // red-300 — hellrot
  { letter: "C", hex: "#fdba74" }, // orange-300 — hellorange
  { letter: "D", hex: "#fde047" }, // yellow-300 — hellgelb
  { letter: "E", hex: "#d8b4fe" }, // purple-300 — helllila
  { letter: "F", hex: "#93c5fd" }, // blue-300 — hellblau
  { letter: "G", hex: "#86efac" }, // green-300 — hellgrün
] as const;

// Spiegel des DB-Checks `seasons_color_check` (0138): #RRGGBB, sonst 422.
export const SEASON_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Buchstabe zu einer Farbe — null für freie Farben außerhalb der Palette. */
export function seasonLetter(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const wanted = hex.toLowerCase();
  return SEASON_PALETTE.find((p) => p.hex === wanted)?.letter ?? null;
}

export function isSeasonColor(hex: string): boolean {
  return SEASON_COLOR_RE.test(hex);
}
