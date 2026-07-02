// Schrift-Katalog für den Website-Baukasten (Editor-Seite). Spiegelt
// builder/lib/fonts-catalog.ts — beide MÜSSEN identische Familien-Schlüssel
// führen, damit die im Editor gewählte Schrift im Renderer exakt gleich wirkt.
// Wie die Font-Auswahl in Framer/Figma: Headline + Body, global pro Site und
// je Block überschreibbar.

export type FontKategorie = "sans" | "serif" | "display" | "mono";

export type FontEintrag = {
  family: string; // stabiler Schlüssel = CSS-Familienname (auch in der DB)
  label: string;
  kategorie: FontKategorie;
  stack: string; // voller font-family-Stack inkl. Fallback
  google: string | null;
};

export const FONT_CATALOG: FontEintrag[] = [
  { family: "Inter", label: "Inter", kategorie: "sans", stack: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700" },
  { family: "Fraunces", label: "Fraunces", kategorie: "display", stack: "'Fraunces', Georgia, serif", google: "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700" },
  { family: "DM Sans", label: "DM Sans", kategorie: "sans", stack: "'DM Sans', system-ui, sans-serif", google: "DM+Sans:wght@400;500;700" },
  { family: "Poppins", label: "Poppins", kategorie: "sans", stack: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700" },
  { family: "Manrope", label: "Manrope", kategorie: "sans", stack: "'Manrope', system-ui, sans-serif", google: "Manrope:wght@400;500;600;700;800" },
  { family: "Work Sans", label: "Work Sans", kategorie: "sans", stack: "'Work Sans', system-ui, sans-serif", google: "Work+Sans:wght@400;500;600;700" },
  { family: "Space Grotesk", label: "Space Grotesk", kategorie: "sans", stack: "'Space Grotesk', system-ui, sans-serif", google: "Space+Grotesk:wght@400;500;600;700" },
  { family: "Playfair Display", label: "Playfair Display", kategorie: "display", stack: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;500;600;700;800" },
  { family: "Lora", label: "Lora", kategorie: "serif", stack: "'Lora', Georgia, serif", google: "Lora:wght@400;500;600;700" },
  { family: "Cormorant Garamond", label: "Cormorant", kategorie: "display", stack: "'Cormorant Garamond', Georgia, serif", google: "Cormorant+Garamond:wght@400;500;600;700" },
  { family: "Libre Baskerville", label: "Libre Baskerville", kategorie: "serif", stack: "'Libre Baskerville', Georgia, serif", google: "Libre+Baskerville:wght@400;700" },
  { family: "Spectral", label: "Spectral", kategorie: "serif", stack: "'Spectral', Georgia, serif", google: "Spectral:wght@400;500;600;700" },
  { family: "JetBrains Mono", label: "JetBrains Mono", kategorie: "mono", stack: "'JetBrains Mono', ui-monospace, monospace", google: "JetBrains+Mono:wght@400;500;700" },
];

const BY_FAMILY = new Map(FONT_CATALOG.map((f) => [f.family, f]));

export function fontByFamily(family: string | null | undefined): FontEintrag | null {
  return family ? BY_FAMILY.get(family) ?? null : null;
}

export function fontStack(family: string | null | undefined): string | null {
  return fontByFamily(family)?.stack ?? null;
}

/** Google-Fonts-Stylesheet-URL für eine Menge Familien (für den Editor-Canvas). */
export function googleFontsHref(families: Array<string | null | undefined>): string | null {
  const params = new Set<string>();
  for (const fam of families) {
    const e = fontByFamily(fam);
    if (e?.google) params.add(e.google);
  }
  if (params.size === 0) return null;
  return `https://fonts.googleapis.com/css2?${[...params].map((p) => `family=${p}`).join("&")}&display=swap`;
}

// --- Live-Katalog aus der Google Fonts Developer API (voller Katalog) ---------
// Der statische FONT_CATALOG oben ist die kuratierte Basis; für die volle
// Framer-artige Auswahl lädt der Editor den kompletten Google-Katalog über die
// eigene Proxy-Route /api/google-fonts (Server-Key). Die gewählte Familie wird
// zur Laufzeit per <link> in <head> geladen, damit sie sofort im Canvas wirkt.

export type GoogleFontEntry = {
  family: string;
  category: string; // sans-serif | serif | display | handwriting | monospace
  variants: string[];
};

let _catalogCache: GoogleFontEntry[] | null = null;
let _catalogPromise: Promise<GoogleFontEntry[]> | null = null;

/** Vollen Google-Fonts-Katalog laden (einmal pro Session gecacht). */
export async function loadGoogleFontCatalog(): Promise<GoogleFontEntry[]> {
  if (_catalogCache) return _catalogCache;
  if (_catalogPromise) return _catalogPromise;
  _catalogPromise = fetch("/api/google-fonts")
    .then(async (r) => {
      if (!r.ok) throw new Error(`Katalog-Fehler ${r.status}`);
      const data = (await r.json()) as { items?: GoogleFontEntry[] };
      _catalogCache = data.items ?? [];
      return _catalogCache;
    })
    .finally(() => { _catalogPromise = null; });
  return _catalogPromise;
}

// Bereits injizierte Familien merken (nicht doppelt laden).
const _loadedFamilies = new Set<string>();

/** Eine beliebige Google-Font-Familie zur Laufzeit in <head> laden (Editor). */
export function ensureGoogleFontLoaded(family: string | null | undefined): void {
  if (!family || typeof document === "undefined") return;
  if (_loadedFamilies.has(family)) return;
  _loadedFamilies.add(family);
  // Übliche Gewichte anfordern; Google liefert vorhandene, ignoriert fehlende.
  const spec = `${family.replace(/ /g, "+")}:wght@400;500;600;700`;
  const href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.googleFont = family;
  document.head.appendChild(link);
}

/** CSS-font-family-Stack für eine beliebige Familie (mit Kategorie-Fallback). */
export function anyFontStack(family: string | null | undefined, category?: string): string | null {
  if (!family) return null;
  const known = fontByFamily(family);
  if (known) return known.stack;
  const generic =
    category === "serif" ? "serif" :
    category === "monospace" ? "monospace" :
    category === "display" || category === "handwriting" ? "cursive" :
    "sans-serif";
  return `'${family}', ${generic}`;
}
