// Design-Tokens der NextDays-App — portiert aus dem Design-Kit (app-kit.jsx
// ND_CSS). Farben, Radien, Schatten, Typo-Skala und Dichte. Light + Dark.
// Akzentfarbe ist konfigurierbar (Tweak „Akzent" im Mockup → hier Default).

import type { TextStyle, ViewStyle } from "react-native";

export const ACCENT_DEFAULT = "#C42B3A";

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
  star: string;
};

// Light-Palette (Default-Werte aus ND_CSS).
export function lightPalette(accent: string): Palette {
  return {
    bg: "#F6F2EC",
    surface: "#FFFFFF",
    surface2: "#F2ECE3",
    ink: "#1C1A17",
    soft: "#837A6E",
    faint: "#B6ADA0",
    line: "rgba(28,26,23,0.09)",
    accent,
    accentInk: "#FFFFFF",
    // CSS: color-mix(accent 12%, #fff) — als statische Annäherung gerendert.
    accentSoft: mix(accent, "#FFFFFF", 0.12),
    star: "#E8A33D",
  };
}

// Dark-Palette (aus den Dark-Mode-Overrides im NextDays App.html).
export function darkPalette(accent: string): Palette {
  return {
    bg: "#15130F",
    surface: "#211E18",
    surface2: "#2C281F",
    ink: "#F4EFE7",
    soft: "#A89E8E",
    faint: "#6F665A",
    line: "rgba(255,255,255,0.10)",
    accent,
    accentInk: "#FFFFFF",
    accentSoft: mix(accent, "#211E18", 0.24),
    star: "#E8A33D",
  };
}

// Eckradien (px aus dem Kit — Borderradien sind erlaubte px-Ausnahme).
export const radius = {
  card: 22,
  img: 18,
  btn: 14,
  pill: 999,
};

// Dichte-Stufen (Padding/Gap) — wie der Tweak „Dichte" im Mockup.
export type Density = "kompakt" | "regular" | "luftig";
export const density: Record<Density, { pad: number; gap: number }> = {
  kompakt: { pad: 16, gap: 12 },
  regular: { pad: 20, gap: 16 },
  luftig: { pad: 24, gap: 20 },
};

// Schatten (iOS + Android elevation) — aus den --shadow-Variablen abgeleitet.
export const shadow = {
  sm: {
    shadowColor: "#1C1A17",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  } as ViewStyle,
  card: {
    shadowColor: "#1C1A17",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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

// Typo-Skala (font-size/weight/spacing) aus ND_CSS. Letter-Spacing in px.
export const type: Record<string, TextStyle> = {
  display: { fontSize: 30, fontFamily: fonts.extrabold, lineHeight: 31, letterSpacing: -0.9 },
  h1: { fontSize: 24, fontFamily: fonts.bold, lineHeight: 26, letterSpacing: -0.6 },
  h2: { fontSize: 19, fontFamily: fonts.bold, letterSpacing: -0.38 },
  title: { fontSize: 16, fontFamily: fonts.semibold, letterSpacing: -0.16 },
  body: { fontSize: 14.5, fontFamily: fonts.regular, lineHeight: 21 },
  sm: { fontSize: 13, fontFamily: fonts.medium },
  xs: { fontSize: 11.5, fontFamily: fonts.semibold },
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
