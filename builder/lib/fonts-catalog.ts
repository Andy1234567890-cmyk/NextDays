// Kuratierter Schrift-Katalog (wie die Font-Auswahl in Framer/Figma). Die Agentur
// stellt im Builder Headline- und Body-Schrift ein — global pro Site und je Block
// überschreibbar. Geladen werden die Fonts per Google-Fonts-CSS (stylesheet) und
// als CSS-Variable (--font-display / --font-sans bzw. inline am Block) gesetzt.
//
// EINZIGE Wahrheit für wählbare Schriften — Editor (apps/web) und Renderer
// (builder/) referenzieren denselben Katalog über die Familie als Schlüssel.

export type FontKategorie = "sans" | "serif" | "display" | "mono";

export type FontEintrag = {
  /** Stabiler Schlüssel = exakter CSS-Familienname (auch in der DB gespeichert). */
  family: string;
  /** Anzeigename im Editor. */
  label: string;
  kategorie: FontKategorie;
  /** Vollständiger font-family-Stack inkl. System-Fallback (kein Hardcode beim Render). */
  stack: string;
  /** Google-Fonts-Familienparameter (für das Stylesheet); null = System-Font. */
  google: string | null;
};

// Kuratierte Auswahl: moderne Sans, klassische Serifen, Display, Mono. Bewusst
// begrenzt (Qualität vor Masse) — deckt das Framer-Spektrum ab.
export const FONT_CATALOG: FontEintrag[] = [
  // System / bereits eingebunden
  {
    family: "Inter",
    label: "Inter",
    kategorie: "sans",
    stack: "'Inter', system-ui, sans-serif",
    google: "Inter:wght@400;500;600;700",
  },
  {
    family: "Fraunces",
    label: "Fraunces",
    kategorie: "display",
    stack: "'Fraunces', Georgia, serif",
    google: "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700",
  },
  // Sans
  {
    family: "DM Sans",
    label: "DM Sans",
    kategorie: "sans",
    stack: "'DM Sans', system-ui, sans-serif",
    google: "DM+Sans:wght@400;500;700",
  },
  {
    family: "Poppins",
    label: "Poppins",
    kategorie: "sans",
    stack: "'Poppins', system-ui, sans-serif",
    google: "Poppins:wght@400;500;600;700",
  },
  {
    family: "Manrope",
    label: "Manrope",
    kategorie: "sans",
    stack: "'Manrope', system-ui, sans-serif",
    google: "Manrope:wght@400;500;600;700;800",
  },
  {
    family: "Work Sans",
    label: "Work Sans",
    kategorie: "sans",
    stack: "'Work Sans', system-ui, sans-serif",
    google: "Work+Sans:wght@400;500;600;700",
  },
  {
    family: "Space Grotesk",
    label: "Space Grotesk",
    kategorie: "sans",
    stack: "'Space Grotesk', system-ui, sans-serif",
    google: "Space+Grotesk:wght@400;500;600;700",
  },
  // Serif / Display
  {
    family: "Playfair Display",
    label: "Playfair Display",
    kategorie: "display",
    stack: "'Playfair Display', Georgia, serif",
    google: "Playfair+Display:wght@400;500;600;700;800",
  },
  {
    family: "Lora",
    label: "Lora",
    kategorie: "serif",
    stack: "'Lora', Georgia, serif",
    google: "Lora:wght@400;500;600;700",
  },
  {
    family: "Cormorant Garamond",
    label: "Cormorant",
    kategorie: "display",
    stack: "'Cormorant Garamond', Georgia, serif",
    google: "Cormorant+Garamond:wght@400;500;600;700",
  },
  {
    family: "Libre Baskerville",
    label: "Libre Baskerville",
    kategorie: "serif",
    stack: "'Libre Baskerville', Georgia, serif",
    google: "Libre+Baskerville:wght@400;700",
  },
  {
    family: "Spectral",
    label: "Spectral",
    kategorie: "serif",
    stack: "'Spectral', Georgia, serif",
    google: "Spectral:wght@400;500;600;700",
  },
  // Mono
  {
    family: "JetBrains Mono",
    label: "JetBrains Mono",
    kategorie: "mono",
    stack: "'JetBrains Mono', ui-monospace, monospace",
    google: "JetBrains+Mono:wght@400;500;700",
  },
];

const BY_FAMILY = new Map(FONT_CATALOG.map((f) => [f.family, f]));

/** Font-Eintrag zu einer Familie (oder null, wenn unbekannt). */
export function fontByFamily(family: string | null | undefined): FontEintrag | null {
  if (!family) return null;
  return BY_FAMILY.get(family) ?? null;
}

/** Vollständiger CSS-Stack zu einer Familie; null, wenn unbekannt (kein Fallback-Erfinden). */
export function fontStack(family: string | null | undefined): string | null {
  return fontByFamily(family)?.stack ?? null;
}

/**
 * Google-Fonts-Stylesheet-URL für eine Menge von Familien (deduped). Liefert
 * null, wenn keine ladbare (Google-)Familie dabei ist.
 */
export function googleFontsHref(families: Array<string | null | undefined>): string | null {
  const params = new Set<string>();
  for (const fam of families) {
    const eintrag = fontByFamily(fam);
    if (eintrag?.google) params.add(eintrag.google);
  }
  if (params.size === 0) return null;
  const query = [...params].map((p) => `family=${p}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
