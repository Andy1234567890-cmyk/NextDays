// Design-Tokens. Struktur/Dichte folgen dem Airbnb-App-Muster (weiße Fläche,
// feine Trennlinien, flache Bildradien, randlose Karten). Light + Dark.
// Die Akzentfarbe steht NICHT hier: sie ist ein Markenwert und kommt aus
// theme/marke.ts über den ThemeProvider (ein Default wäre ein Fallback-Wert,
// Wurzel 4).
//
// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App (mobile-bestdays
// bzw. mobile-nextdays) — byte-identisch halten, der CI-Wächter prüft das.

import type { ImageSourcePropType, TextStyle, ViewStyle } from "react-native";

/** Die Schwester-App, in die aus dieser App gesprungen wird (ADR-0019). */
export type AndereApp = {
  name: string;
  /** URL-Scheme der anderen App, z. B. "mynextdays". */
  scheme: string;
  appStoreUrl: string;
  playStoreUrl: string;
};

/** Alles, was diese App von ihrer Marke wissen muss. */
export type Marke = {
  id: "mybestdays" | "mynextdays";
  name: string;
  akzent: string;
  logo: ImageSourcePropType;
  logoHell: ImageSourcePropType;
  /**
   * Seitenverhältnis der Logo-Dateien (Breite ÷ Höhe). Wer das Logo rendert,
   * gibt eine Höhe vor und rechnet die Breite hieraus — sonst steht in jedem
   * Screen eine geschätzte Zahl, die beim nächsten Logo-Tausch still falsch
   * wird und die Wortmarke staucht.
   */
  logoRatio: number;
  /**
   * Die eigene Web-Seite dieser Marke — myNextDays das Betriebs-Dashboard,
   * myBestDays der Marktplatz.
   *
   * WOFÜR: Wege, die eine App bewusst NICHT führt. Ein Betrieb wird nicht in der
   * App angelegt — die Firmenanmeldung verlangt Stammdaten, Steuer- und
   * Zahlungsangaben und einen Vertragsabschluss; das gehört an den Schreibtisch.
   * Eine zweite, schwächere Anmeldestrecke in der App wäre ein zweiter Pfad in
   * dieselbe Tabelle, der stiller veraltet als der gepflegte.
   *
   * Hier und nicht in `lib/config.ts`: jene Datei hält CI byte-identisch
   * (gleiches Backend für beide Apps), dieser Wert ist aber je Marke ein
   * anderer. Markenwerte gehören nach `theme/marke.ts`.
   */
  webUrl: string;
  andereApp: AndereApp;
};

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  soft: string;
  faint: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  /**
   * Der Akzent als SCHRIFT auf einer Themefläche — nicht als Fläche.
   *
   * Warum ein eigener Token (15.09.2026): `accent` muss zwei Rollen erfüllen,
   * die sich im Dunkeln widersprechen. Als FLÄCHE trägt er weiße Schrift
   * (`accentInk`, 5,59:1) und darf deshalb nicht heller werden. Als SCHRIFT
   * steht er auf `surface`/`surface2`/`bg` — und dort kommt `#C42B3A` im
   * Dunkeln nur auf 3,10 / 2,83 / 3,34:1, liegt also unter der Schwelle.
   * Gemessen, nicht geschätzt.
   *
   * Betroffen war genau das, was gelesen werden MUSS: der Login-Fehler, der
   * Klartext einer 422-Antwort, die negativen Verrechnungsposten, das aktive
   * Reiter-Label. Im Hellen war dieselbe Stelle immer unauffällig — deshalb
   * fiel es nie auf.
   *
   * Hell ist er identisch mit `accent` (4,54–5,59:1, überall ausreichend).
   */
  accentText: string;
  star: string;
  // Richtungsfarben für Veränderungen (Trend). Sie GEHÖREN in die Palette:
  // Vorher stand im `Trend` ein festes `#1F8A5B` — ein sattes Grün neben dem
  // warmen Neutralton dieses Themes und dem Marken-Akzent. Auf der Übersicht
  // trug damit jede Zahl eine grelle Zeile, und die Karte las sich wie eine
  // Ampel statt wie eine Auswertung.
  //
  // Gedämpft und warm abgestimmt, nicht knallig: Die Richtung soll beim
  // Überfliegen erkennbar sein, ohne die Zahl zu überstrahlen. Bewusst NICHT
  // der Akzent für „abwärts" — der ist die Markenfarbe und markiert
  // Handlungsbedarf; ein gesunkener Umsatz ist eine Information, kein Knopf.
  positiv: string;
  negativ: string;
};

// Light-Palette.
//
// GRUND UND FIGUR (geändert am 15.09.2026): `bg` und `surface` waren BEIDE
// reines Weiß. Eine Karte hob sich damit allein durch eine Haarlinie mit 12 %
// Deckkraft ab — auf einem Telefon bei Tageslicht praktisch gar nicht. Die
// Übersicht las sich als eine weiße Fläche mit Strichen darin, und der
// Befund des Auftraggebers dazu war schlicht „unsere App ist nur weiß".
//
// Dass es ein Fehler und keine Haltung war, zeigt die Dark-Palette direkt
// darunter: dort ist `surface` (#1C1A18) HELLER als `bg` (#141210) — die
// Abstufung existierte also, nur im Hellmodus nicht. Hier stand zur
// Begründung „Airbnb-Muster"; Airbnb legt seine Karten aber auf Weiß OHNE
// Rahmen und trennt über Bilder und Weißraum, während diese App gerahmte
// Datenkarten stapelt. Übernommen war die halbe Regel.
//
// Der Ton ist WARM (nicht #F7F7F7): Er teilt sich den Farbton mit `ink`
// (#181614) und `soft` (#6F6864). Ein neutralgraues Grau darunter hätte die
// warme Schrift kühl aussehen lassen — der häufigste Weg, wie eine Oberfläche
// „billig" wirkt, ohne dass man sagen kann, woran es liegt.
export function lightPalette(accent: string): Palette {
  return {
    bg: "#F5F3F0",
    surface: "#FFFFFF",
    // Eingelassene Flächen INNERHALB einer Karte (Eingabefelder, Sheet-Zeilen).
    // Muss dunkler als `bg` sein, sonst verschwindet die Einlassung, sobald
    // der Grund selbst getönt ist.
    surface2: "#EBE7E2",
    ink: "#181614",
    soft: "#6F6864",
    // 25 % Richtung `ink`. Bis zum 15.09.2026 stand hier #A8A29C — 2,53:1
    // auf `surface`, 2,05:1 auf `surface2`, also unter der 3:1-Schwelle,
    // die schon fuer GRAFISCHE Objekte gilt. Der Ton ist als Dekoration
    // gedacht, wird aber ueberall gegriffen, wo Text zuruecktreten soll:
    // der Status einer Abrechnung, die einzige Bedienanleitung des
    // Kalenders, das ⓘ-Tippziel neben der Auszahlung, 14 Symbole. Statt
    // 30 Aufrufstellen umzuschreiben, traegt jetzt der Ton selbst.
    faint: "#847F7A",
    line: "rgba(24,22,20,0.12)",
    accent,
    accentInk: "#FFFFFF",
    // CSS: color-mix(accent 12%, #fff) — 12 % Akzent auf Weiß, also eine SANFTE
    // Tönung. Der dritte Parameter von `mix` ist der Anteil der ZWEITEN Farbe:
    // mit 0.12 kamen 88 % Akzent heraus, und jede Fläche, die „accentSoft"
    // benutzte, war knallig statt sanft — im Dashboard leuchtete ein Hinweis
    // „1 offene Konversation" wie eine Warnung, und ein offener Zusatzposten
    // ebenso. Deshalb 0.88.
    accentSoft: mix(accent, "#FFFFFF", 0.88),
    // Hell braucht der Akzent keine Aufhellung: auf `surface2`, der dunkelsten
    // hellen Fläche, sind es 4,54:1.
    accentText: accent,
    star: "#181614",
    // Gedecktes Waldgrün und ein warmes Ziegelrot — beide entsättigt, damit
    // sie neben dem warmen Neutralton (`ink` #181614) sitzen und nicht davor.
    positiv: "#2F6B4F",
    negativ: "#9E3B2E",
  };
}

// Dark-Palette (aus den Dark-Mode-Overrides des Design-Kits).
export function darkPalette(accent: string): Palette {
  return {
    bg: "#141210",
    surface: "#1C1A18",
    surface2: "#252220",
    ink: "#F4F1ED",
    soft: "#A9A29B",
    // Dunkel dieselbe Rechnung: 3,01:1 auf `surface2` war ebenfalls zu
    // knapp, jetzt 4,01:1.
    faint: "#867F79",
    line: "rgba(255,255,255,0.14)",
    accent,
    accentInk: "#FFFFFF",
    // Wie in der Light-Palette: der Anteil gehört der zweiten Farbe. 16 %
    // Akzent auf dem dunklen Grund heißt 0.84.
    //
    // Bis zum 15.09.2026 stand hier 0.76 (24 % Akzent). Darauf kam `accentText`
    // nur auf 4,28:1 — die Statuspille „Abgelehnt" war damit die letzte Stelle
    // unter der Schwelle. 0.84 ergibt 4,59:1, ohne dass die Fläche als Tönung
    // aufhört zu wirken. Die Hell-Fassung bleibt bei 0.88 und liegt mit 4,65:1
    // ohnehin darüber.
    accentSoft: mix(accent, "#1C1A18", 0.84),
    // 30 % Richtung Weiß — der KLEINSTE Schritt, mit dem die schlechteste
    // dunkle Fläche (`surface2`) 4,5:1 erreicht: 4,68:1. Bei 25 % wären es
    // 4,26:1. Gerechnet aus `accent`, nicht als Hexwert hinterlegt, damit ein
    // Markenwechsel durchschlägt. Dieselbe Begründung wie bei
    // `positiv`/`negativ` weiter unten.
    accentText: mix(accent, "#FFFFFF", 0.3),
    star: "#F4F1ED",
    // Auf dunklem Grund aufgehellt statt abgedunkelt: dieselben Töne wären
    // hier nicht mehr lesbar.
    positiv: "#86BBA1",
    negativ: "#D98A7B",
  };
}

// Eckradien (px aus dem Kit — Borderradien sind erlaubte px-Ausnahme).
// `img` folgt dem Airbnb-Kachelbild (flach, ~12), `sheet` der Bottom-Sheet-Kappe.
export const radius = {
  card: 12,
  img: 12,
  btn: 12,
  sheet: 28,
  pill: 999,
};

// Dichte-Stufen (Padding/Gap) — wie der Tweak „Dichte" im Mockup.
export type Density = "kompakt" | "regular" | "luftig";
export const density: Record<Density, { pad: number; gap: number }> = {
  kompakt: { pad: 16, gap: 12 },
  regular: { pad: 20, gap: 16 },
  luftig: { pad: 24, gap: 20 },
};

// Schatten. `sm` ist der schwebende Ring der Such-Pill / runder Buttons,
// `card` der Sheet-Schatten. Flächenkarten tragen bewusst KEINEN Schatten.
export const shadow = {
  sm: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  } as ViewStyle,
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  } as ViewStyle,
};

// Schrift-Familien — PostScript-Namen der eingebundenen TTFs (assets/fonts).
// In bare RN ist fontFamily auf iOS der PostScript-Name (NICHT der Dateiname).
export const fonts = {
  regular: "SchibstedGrotesk-Regular",
  medium: "SchibstedGrotesk-Medium",
  semibold: "SchibstedGrotesk-SemiBold",
  bold: "SchibstedGrotesk-Bold",
  extrabold: "SchibstedGrotesk-ExtraBold",
};

// Typo-Skala (font-size/weight/spacing). Größen folgen der Airbnb-App:
// Sheet-Überschrift 26, Sektionstitel 22, Kartentitel 15, Kartenmeta 15.
export const type: Record<string, TextStyle> = {
  display: { fontSize: 30, fontFamily: fonts.extrabold, lineHeight: 34, letterSpacing: -0.7 },
  h1: { fontSize: 26, fontFamily: fonts.bold, lineHeight: 31, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontFamily: fonts.bold, lineHeight: 27, letterSpacing: -0.4 },
  title: { fontSize: 15, fontFamily: fonts.semibold, lineHeight: 20, letterSpacing: -0.1 },
  body: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 21 },
  sm: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 20 },
  xs: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.32,
    textTransform: "uppercase",
  },
  // Reine Font-Weight-Styles, damit `type.bold.fontFamily` etc. funktioniert
  // (in Screens genutzt, um nur die Schriftfamilie zu setzen).
  regular: { fontFamily: fonts.regular },
  medium: { fontFamily: fonts.medium },
  semibold: { fontFamily: fonts.semibold },
  bold: { fontFamily: fonts.bold },
  extrabold: { fontFamily: fonts.extrabold },
};

// Lineare Farbmischung (Ersatz für CSS color-mix) — t=0 → a, t=1 → b.
/**
 * Schwarz oder Weiss — je nachdem, was auf DIESER Flaeche lesbar ist.
 *
 * Fuer Flaechen, deren Farbe aus DATEN kommt (Kanalfarben, vom Betrieb
 * gesetzte Hexwerte) oder die mit dem Thema mitdrehen. Eine Konstante geht
 * dort zwangslaeufig irgendwann daneben: `CHIP_TEXT = "#FFFFFF"` im Kalender
 * stand auf der Eigennutzungs-Flaeche (`soft`), und die ist im Dunkeln HELL —
 * gemessen 2,52:1. Auf Airbnbs `#ff5a5f` waren es 3,05:1.
 *
 * Gewaehlt wird ueber die relative Luminanz nach WCAG, nicht ueber eine
 * Helligkeitsschaetzung: `#ff5a5f` und `#71717a` haben aehnliche Mittelwerte
 * und sehr verschiedene Luminanz.
 */
export function schriftAuf(hintergrund: string): string {
  const l = luminanz(hintergrund);
  // Kontrast gegen Weiss bzw. gegen den dunkelsten Textton, und der Sieger
  // gewinnt. Kein fester Schwellwert: der waere fuer Grenzfaelle geraten.
  const gegenWeiss = 1.05 / (l + 0.05);
  const gegenSchwarz = (l + 0.05) / (luminanz("#181614") + 0.05);
  return gegenWeiss >= gegenSchwarz ? "#FFFFFF" : "#181614";
}

/** Relative Luminanz (WCAG 2.1). */
function luminanz(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const teil = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * teil(rgb.r) + 0.7152 * teil(rgb.g) + 0.0722 * teil(rgb.b);
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}
