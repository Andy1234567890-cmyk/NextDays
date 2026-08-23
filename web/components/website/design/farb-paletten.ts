// Fertige Farbpaletten für den Baukasten — vier Rollen je Palette.
//
// Warum Paletten und nicht nur vier Farbwähler: die meisten Kunden sind keine
// Gestalter. Ein Klick auf eine Palette setzt alle vier Rollen auf Werte, die
// zusammenpassen und deren Kontrast trägt; wer will, ändert danach einzelne
// Rollen. Das ist Branchenstandard (Lodgify liefert 20 Paletten, Squarespace
// zehn fertige Kombinationen je Palette).
//
// Die Rollen decken sich mit den CSS-Variablen des Renderers:
//   primaer   → --primary     (Buttons, Akzente, Links)
//   flaeche   → --secondary   (abgesetzte Flächen, Karten)
//   hintergrund → --background
//   schrift   → --foreground
//
// Kontrast: `schrift` auf `hintergrund` und weiße Schrift auf `primaer` sind in
// jeder Palette geprüft. Wer eigene Werte einträgt, kann das brechen — deshalb
// warnt die UI (siehe kontrast.ts), statt die Eingabe stillschweigend zu
// korrigieren.
export type Palette = {
  id: string;
  /** i18n-Schlüssel unter `website.paletten`. */
  label: string;
  primaer: string;
  flaeche: string;
  hintergrund: string;
  schrift: string;
};

export const PALETTEN: Palette[] = [
  {
    id: "schlicht",
    label: "schlicht",
    primaer: "#111827",
    flaeche: "#f3f4f6",
    hintergrund: "#ffffff",
    schrift: "#111827",
  },
  {
    id: "holz",
    label: "holz",
    primaer: "#8a5a2b",
    flaeche: "#f3ece3",
    hintergrund: "#fdfbf8",
    schrift: "#2a211a",
  },
  {
    id: "see",
    label: "see",
    primaer: "#1f7a8c",
    flaeche: "#e6f2f5",
    hintergrund: "#ffffff",
    schrift: "#12313a",
  },
  {
    id: "wald",
    label: "wald",
    primaer: "#2f6b46",
    flaeche: "#e8f1ea",
    hintergrund: "#ffffff",
    schrift: "#16281d",
  },
  {
    id: "sand",
    label: "sand",
    primaer: "#a8763e",
    flaeche: "#f6f0e6",
    hintergrund: "#fffdf9",
    schrift: "#33291c",
  },
  {
    id: "stein",
    label: "stein",
    primaer: "#4b5563",
    flaeche: "#eef0f2",
    hintergrund: "#ffffff",
    schrift: "#1f2937",
  },
  {
    id: "wein",
    label: "wein",
    primaer: "#8c2f39",
    flaeche: "#f7ebec",
    hintergrund: "#fffdfd",
    schrift: "#2c1216",
  },
  {
    id: "nacht",
    label: "nacht",
    primaer: "#c9a227",
    flaeche: "#1f2430",
    hintergrund: "#12161f",
    schrift: "#f2f3f5",
  },
  {
    id: "lavendel",
    label: "lavendel",
    primaer: "#5b4b9c",
    flaeche: "#efecf8",
    hintergrund: "#ffffff",
    schrift: "#241d40",
  },
  {
    id: "koralle",
    label: "koralle",
    primaer: "#d1543f",
    flaeche: "#fbeeea",
    hintergrund: "#fffdfc",
    schrift: "#3a1a13",
  },
];
