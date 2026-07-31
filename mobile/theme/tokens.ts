// Design-Tokens der myBestDays-App. Struktur/Dichte folgen dem Airbnb-App-Muster
// (weiße Fläche, feine Trennlinien, flache Bildradien, randlose Karten), die
// Farbwelt bleibt myBestDays. Light + Dark.
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

// Light-Palette. Die Fläche ist weiß (Airbnb-Muster), Abgrenzung entsteht über
// feine Linien statt über eingefärbte Flächen.
export function lightPalette(accent: string): Palette {
  return {
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#F7F7F7",
    ink: "#181614",
    soft: "#6F6864",
    faint: "#A8A29C",
    line: "rgba(24,22,20,0.12)",
    accent,
    accentInk: "#FFFFFF",
    // CSS: color-mix(accent 12%, #fff) — als statische Annäherung gerendert.
    accentSoft: mix(accent, "#FFFFFF", 0.12),
    star: "#181614",
  };
}

// Dark-Palette (aus den Dark-Mode-Overrides im myBestDays App.html).
export function darkPalette(accent: string): Palette {
  return {
    bg: "#141210",
    surface: "#1C1A18",
    surface2: "#252220",
    ink: "#F4F1ED",
    soft: "#A9A29B",
    faint: "#726B64",
    line: "rgba(255,255,255,0.14)",
    accent,
    accentInk: "#FFFFFF",
    accentSoft: mix(accent, "#1C1A18", 0.24),
    star: "#F4F1ED",
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
