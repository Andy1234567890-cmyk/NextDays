// Kontrastprüfung für die vier Farbrollen (WCAG 2.1 relative Luminanz).
//
// Der eigentliche Grund, warum ein Laie hier nichts kaputt machen kann: er darf
// jede Farbe wählen, sieht aber SOFORT, wenn eine Kombination unlesbar wird.
// Wir korrigieren nichts stillschweigend und ersetzen nichts durch einen
// „besseren" Wert (Wurzel 4) — die Farbe des Kunden ist seine Entscheidung, wir
// benennen nur die Folge.
//
// Formeln: WCAG 2.1 SC 1.4.3. Schwellen: 4.5 für normalen Text, 3.0 für großen
// Text und Bedienelemente (SC 1.4.11).

/** #rrggbb → [r,g,b] 0–255. null bei ungültiger Eingabe (kein geratener Wert). */
export function hexZuRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative Luminanz nach WCAG 2.1. */
export function luminanz(hex: string): number | null {
  const rgb = hexZuRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(kanal) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Farben (1–21). null, wenn eine ungültig ist. */
export function kontrast(a: string, b: string): number | null {
  const la = luminanz(a);
  const lb = luminanz(b);
  if (la === null || lb === null) return null;
  const hell = Math.max(la, lb);
  const dunkel = Math.min(la, lb);
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Welche Textfarbe auf dieser Fläche besser liest — für die Vorschau des
 *  Button-Textes. Keine Erfindung: es ist die rechnerisch kontrastreichere von
 *  Schwarz und Weiß, nicht ein geratener Markenwert. */
export function lesbareSchriftAuf(hex: string): "#ffffff" | "#000000" {
  const l = luminanz(hex);
  if (l === null) return "#000000";
  return l > 0.5 ? "#000000" : "#ffffff";
}

export type Befund = {
  /** i18n-Schlüssel unter `website.kontrast`. */
  schluessel: string;
  verhaeltnis: number;
  /** Ab wann es als bestanden gilt. */
  schwelle: number;
};

/**
 * Prüft die Kombinationen, die auf der Kunden-Site wirklich vorkommen.
 * Rückgabe: nur die BEANSTANDETEN Paare — eine leere Liste heißt „alles lesbar".
 */
export function pruefeFarben(farben: {
  primaer: string | null;
  flaeche: string | null;
  hintergrund: string | null;
  schrift: string | null;
  // --- Farbrollen aus 0426 -----------------------------------------------
  // Sie fehlten hier, obwohl es sie im Baukasten seit 0426 gibt: Kopf- und
  // Fußzeile haben eigene Hintergründe, und genau dort entsteht der häufigste
  // Lesbarkeitsfehler — ein dunkler Header mit den dunklen Standard-Linkfarben.
  // Ohne diese Paare hat die Prüfung „alles lesbar" gemeldet, während die
  // Navigation unsichtbar war.
  kopfHintergrund?: string | null;
  kopfLink?: string | null;
  fussHintergrund?: string | null;
  link?: string | null;
  markenName?: string | null;
}): Befund[] {
  const befunde: Befund[] = [];

  const paare: Array<{
    schluessel: string;
    a: string | null;
    b: string | null;
    schwelle: number;
  }> = [
    // Fließtext auf dem Seitenhintergrund — die häufigste Kombination.
    {
      schluessel: "schriftAufHintergrund",
      a: farben.schrift,
      b: farben.hintergrund,
      schwelle: 4.5,
    },
    // Derselbe Text auf abgesetzten Flächen (Karten, Kontaktblock).
    {
      schluessel: "schriftAufFlaeche",
      a: farben.schrift,
      b: farben.flaeche,
      schwelle: 4.5,
    },
    // Der Button: weiße Beschriftung auf der Markenfarbe. Bedienelement → 3.0.
    {
      schluessel: "buttonText",
      a: farben.primaer,
      b: "#ffffff",
      schwelle: 3,
    },
    // Links im Text: Markenfarbe auf dem Hintergrund.
    {
      schluessel: "linkAufHintergrund",
      a: farben.primaer,
      b: farben.hintergrund,
      schwelle: 3,
    },
    // --- Kopf- und Fußzeile (0426) ----------------------------------------
    // Die Navigation ist Text und kein Bedienelement im Sinne von SC 1.4.11 —
    // sie muss LESBAR sein, nicht nur erkennbar. Deshalb 4.5 und nicht 3.
    {
      schluessel: "kopfLinkAufKopf",
      a: farben.kopfLink ?? farben.schrift ?? null,
      b: farben.kopfHintergrund ?? null,
      schwelle: 4.5,
    },
    // Der Firmenname neben dem Logo. Er ist groß (SC 1.4.3: großer Text) →
    // 3.0 genügt.
    {
      schluessel: "markenNameAufKopf",
      a: farben.markenName ?? null,
      b: farben.kopfHintergrund ?? null,
      schwelle: 3,
    },
    // Die Fußzeile trägt Impressum und Datenschutz — Pflichtangaben, die
    // lesbar sein MÜSSEN. Ohne eigene Linkfarbe gilt die Textfarbe.
    {
      schluessel: "textAufFuss",
      a: farben.link ?? farben.schrift ?? null,
      b: farben.fussHintergrund ?? null,
      schwelle: 4.5,
    },
  ];

  for (const p of paare) {
    if (!p.a || !p.b) continue; // nicht gesetzt = nichts zu prüfen
    const v = kontrast(p.a, p.b);
    if (v === null) continue; // ungültiger Hex → das Eingabefeld meldet es
    if (v < p.schwelle) {
      befunde.push({
        schluessel: p.schluessel,
        verhaeltnis: Math.round(v * 10) / 10,
        schwelle: p.schwelle,
      });
    }
  }
  return befunde;
}

// =========================================================================
// WCAG-Stufen im Farbwähler (Hostaway-Gleichzug)
// =========================================================================
//
// Hostaway zeigt im Farbwähler vier Prüfungen nebeneinander: Regular AAA 7:1,
// Large AAA 4.5:1, Regular AA 4.5:1, Large AA 3:1. Genau die stehen hier —
// nicht als eigene Erfindung, sondern als die vier Schwellen aus WCAG 2.1
// SC 1.4.3.
//
// „Large" ist dabei kein Geschmacksurteil: WCAG definiert es als ab 18 pt
// (24 px) normal oder ab 14 pt (18,66 px) fett. Welche Rolle als groß gilt,
// entscheidet deshalb ihre eingestellte Größe — nicht ihr Name.

/** Die vier WCAG-Schwellen, in der Reihenfolge von streng nach mild. */
export const WCAG_SCHWELLEN = [
  { schluessel: "normalAAA", schwelle: 7 },
  { schluessel: "grossAAA", schwelle: 4.5 },
  { schluessel: "normalAA", schwelle: 4.5 },
  { schluessel: "grossAA", schwelle: 3 },
] as const;

export type WcagSchluessel = (typeof WCAG_SCHWELLEN)[number]["schluessel"];

export type WcagPunkt = {
  schluessel: WcagSchluessel;
  schwelle: number;
  bestanden: boolean;
};

export type WcagPruefung = {
  /** Auf eine Nachkommastelle gerundet — mehr behauptet eine Genauigkeit, die
   *  bei Rundungen im Rendering ohnehin nicht trägt. */
  verhaeltnis: number;
  punkte: WcagPunkt[];
};

/**
 * Kontrast zweier Farben gegen alle vier WCAG-Schwellen prüfen.
 * `null`, wenn eine der beiden Farben fehlt oder ungültig ist — dann gibt es
 * nichts zu behaupten (Wurzel 4: kein geratener Ersatzwert).
 */
export function wcagPruefung(
  vordergrund: string | null | undefined,
  hintergrund: string | null | undefined,
): WcagPruefung | null {
  if (!vordergrund || !hintergrund) return null;
  const v = kontrast(vordergrund, hintergrund);
  if (v === null) return null;
  return {
    verhaeltnis: Math.round(v * 10) / 10,
    punkte: WCAG_SCHWELLEN.map((s) => ({
      schluessel: s.schluessel,
      schwelle: s.schwelle,
      bestanden: v >= s.schwelle,
    })),
  };
}

/** Gilt Text dieser Größe als „groß" im Sinne von WCAG 2.1?
 *
 *  18 pt = 24 px normal, 14 pt = 18,66 px fett. Ohne eingestellte Größe ist die
 *  Antwort `false` — die strengere Annahme, weil wir die tatsächliche Größe
 *  dann nicht kennen (fail-closed, Wurzel 5). */
export function giltAlsGross(
  groessePx: number | null | undefined,
  gewicht: number | null | undefined,
): boolean {
  if (!groessePx) return false;
  return (gewicht ?? 400) >= 700 ? groessePx >= 18.66 : groessePx >= 24;
}
