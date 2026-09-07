// Stil-Kaskade des Website-Baukastens (Etappe 2 der Framer-Parität, 05.09.2026).
//
// Ein Block trägt in `settings` (jsonb) seine Darstellung: die flachen Felder
// (Layout, Abstände, Größe — seit 0432/28.08.2026) und die Framer-Abschnitte
// als Unterobjekte (`position`, `groesse`, `stil`, `transform`, `scroll`,
// `a11y`, siehe `apps/api/.../schemas_darstellung.py`). Dazu `je_geraet`
// mit Überschreibungen für `tablet` und `mobil`.
//
// Dieses Paket ist die EINE Stelle, die daraus CSS macht. Der Renderer
// (`builder/components/blocks/block-renderer.tsx`) schreibt das Ergebnis als
// `<style>` je Block; der Editor (`web/components/website/editor/*`) zeigt mit
// derselben Funktion, welcher Wert auf welchem Gerät gilt und woher er kommt.
// Zwei Kopien dieser Regeln liefen beim nächsten Feld auseinander — genau die
// Fehlerklasse, die `baukasten-doppel-kopien-pruefen.mjs` jagt.
//
// Drei Regeln, die überall gelten:
// 1. Alles wird beim LESEN erneut geprüft, obwohl das Backend beim Speichern
//    prüft: `settings` ist ein offenes jsonb, in der Datenbank stehen Zeilen,
//    die älter sind als jede Prüfung, und das Ergebnis landet in einem
//    `<style>` (Wurzel 8). Ungültiges wird verworfen, nicht geraten (Wurzel 4).
// 2. Kein Wert ohne Angabe. Ein fehlendes Feld ergibt KEINE CSS-Zeile; es gibt
//    keine Standardwerte, die eine bestehende Kundenseite umbauen (Wurzel 1).
// 3. Die Kaskade läuft Desktop → Tablet → Mobil, feldweise. Ein Wert gilt ab
//    dem Gerät, an dem er gesetzt ist, für alle schmaleren — bis ein
//    schmaleres ihn erneut setzt. Das ist Framers Breakpoint-Modell.

export type Geraet = "desktop" | "tablet" | "mobil";

/** Reihenfolge = Kaskadenrichtung (breit → schmal) und Anzeigeordnung.
 *  SCHWESTERWERT: `BlockGeraet` in `apps/api/.../site_config/schemas.py`,
 *  `GERAETE` in `builder/lib/site.ts` und `web/.../editor/sichtbarkeit.ts`. */
export const GERAETE: readonly Geraet[] = ["desktop", "tablet", "mobil"];

/** Die Breitenbereiche der drei Geräte in CSS-Pixeln — dieselben Grenzen, an
 *  denen Tailwind im Renderer schaltet (`md:` = 768, `lg:` = 1024). Die
 *  Media-Queries unten und die Wurzelzeilen des Ebenen-Baums lesen sie hier. */
export const GERAETE_BEREICHE: Readonly<
  Record<Geraet, { min: number; max: number | null }>
> = {
  desktop: { min: 1024, max: null },
  tablet: { min: 768, max: 1023 },
  mobil: { min: 0, max: 767 },
};

/** Die Farbrollen des Themes (`builder/app/globals.css`). Eine Farbe im Stil
 *  ist Hex ODER `rolle:<name>` — SCHWESTERWERT `FARBROLLEN` im Backend-Schema. */
export const FARBROLLEN = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
] as const;
export type Farbrolle = (typeof FARBROLLEN)[number];

// --- Typen (Spiegel von schemas_darstellung.py) -----------------------------

export type MassModus = "fest" | "relativ" | "viewport" | "fuellen" | "inhalt";
export type Mass = { modus: MassModus; wert?: number | null };
export type PositionTyp = "relativ" | "absolut" | "fixiert" | "klebend";
export type Position = {
  typ?: PositionTyp | null;
  oben?: string | null;
  rechts?: string | null;
  unten?: string | null;
  links?: string | null;
  ebene?: number | null;
};
export type Groesse = {
  breite?: Mass | null;
  hoehe?: Mass | null;
  min_breite?: string | null;
  max_breite?: string | null;
  min_hoehe?: string | null;
  max_hoehe?: string | null;
  seitenverhaeltnis?: string | null;
};
export type Lage =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right";
export type Verlaufsstufe = { farbe: string; position: number };
/** Framers drei Verlaufsformen (Vollerfassung §4.8). `undefined` = linear. */
export const VERLAUF_FORMEN = ["linear", "radial", "konisch"] as const;
export type VerlaufForm = (typeof VERLAUF_FORMEN)[number];
export type Fuellung = {
  art: "farbe" | "verlauf" | "bild";
  farbe?: string | null;
  form?: VerlaufForm | null;
  winkel?: number | null;
  stufen?: Verlaufsstufe[] | null;
  url?: string | null;
  auflage?: number | null;
  groesse?: "cover" | "contain" | "auto" | null;
  lage?: Lage | null;
  wiederholen?: boolean | null;
};
export type Radius = {
  alle?: number | null;
  oben_links?: number | null;
  oben_rechts?: number | null;
  unten_rechts?: number | null;
  unten_links?: number | null;
};
export type Grenze = {
  breite: number;
  farbe: string;
  art?: "solid" | "dashed" | "dotted" | "double";
  seiten?: Array<"oben" | "rechts" | "unten" | "links"> | null;
};
export type Schatten = {
  x?: number;
  y?: number;
  weich?: number;
  ausbreitung?: number;
  farbe: string;
  innen?: boolean;
};
export type Ueberlauf = "sichtbar" | "verborgen" | "abschneiden" | "scrollen";
export const MISCHMODI = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "difference", "exclusion", "hue", "saturation", "color", "luminosity",
] as const;
export type Mischmodus = (typeof MISCHMODI)[number];
export type Filter = {
  weichzeichnen?: number | null;
  helligkeit?: number | null;
  kontrast?: number | null;
  saettigung?: number | null;
  graustufen?: number | null;
};
/** Framer „Styles › Mask": Verlaufsmaske. SCHWESTERWERT `Maske` im Backend. */
export type Maske = {
  art: "linear" | "radial";
  winkel: number;
  start: number;
  ende: number;
  umkehren: boolean;
};
export type Stil = {
  maske?: Maske | null;
  /** Framer „Selection": Farben der Textmarkierung (`::selection`). */
  auswahl_farbe?: string | null;
  auswahl_hintergrund?: string | null;
  mischmodus?: Mischmodus | null;
  filter?: Filter | null;
  ueberlauf_x?: Ueberlauf | null;
  ueberlauf_y?: Ueberlauf | null;
  zeiger_ereignisse?: boolean | null;
  text_auswahl?: boolean | null;
  tippfarbe?: string | null;
  opazitaet?: number | null;
  sichtbar?: boolean | null;
  fuellung?: Fuellung | null;
  ueberlauf?: Ueberlauf | null;
  radius?: Radius | null;
  grenze?: Grenze | null;
  schatten?: Schatten[] | null;
};
export type Transform = {
  rotation?: number | null;
  skalierung?: number | null;
  versatz_x?: string | null;
  versatz_y?: string | null;
  neigung_x?: number | null;
  neigung_y?: number | null;
  ursprung?: Lage | null;
  perspektive?: number | null;
  /** 3D (06.09.2026): Drehung um X/Y, Tiefe (translateZ), Rückseite, Raum. */
  rotation_x?: number | null;
  rotation_y?: number | null;
  tiefe?: number | null;
  rueckseite?: "sichtbar" | "verborgen" | null;
  raum_3d?: boolean | null;
};
/** Framer „Text": Schrift am Element, für alle Textknoten des Bausteins. */
export type TextGewicht = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type Text = {
  /** Framer „Text Styles": Theme-Rolle (`h1`…) oder nur die Familienart. */
  schrift?: SchriftWahl | null;
  /** Framer „Font": eine Familie des Katalogs — sie schlägt die Rolle. */
  schriftfamilie?: Schriftfamilie | null;
  farbe?: string | null;
  groesse?: string | null;
  gewicht?: TextGewicht | null;
  laufweite?: string | null;
  zeilenhoehe?: string | null;
  ausrichtung?: "start" | "center" | "end" | "justify" | null;
  transformation?: "none" | "uppercase" | "lowercase" | "capitalize" | null;
  dekoration?: "none" | "underline" | "line-through" | null;
  balance?: boolean | null;
  kuerzen?: number | null;
  opentype?: OpenType[] | null;
};
/** Framer „OpenType": Merkmale als `font-feature-settings`-Tags.
 *  SCHWESTERWERT: `TextDarstellung.opentype` im Backend. */
export const OPENTYPE = [
  "liga", "dlig", "smcp", "c2sc", "onum", "lnum", "tnum", "pnum", "frac", "sups", "subs", "kern", "zero",
] as const;
export type OpenType = (typeof OPENTYPE)[number];
export type Scroll = { anker: string; versatz_y?: number | null };
export type A11yTag =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "header"
  | "footer"
  | "nav"
  | "main";
export type A11y = {
  tag?: A11yTag | null;
  label?: string | null;
  tab_index?: number | null;
  fuer_leser_verborgen?: boolean | null;
  /** Framer „Google Bot: Skip" → `data-nosnippet`. */
  nosnippet?: boolean | null;
};

/** Framer „Link": das Element als Ganzes verlinkt. Nicht je Gerät.
 *  `anker` = Scroll-Abschnitt der Zielseite, wird als `#anker` angehängt. */
export const LINK_REL = ["nofollow", "sponsored", "noopener", "noreferrer"] as const;
export type LinkRel = (typeof LINK_REL)[number];
export type Link = {
  href: string;
  neuer_tab?: boolean | null;
  anker?: string | null;
  rel?: LinkRel[] | null;
  /** Abfrageteil ohne `?`. */
  parameter?: string | null;
  /** Framer „Scrollen: Smooth/Instant" beim Sprung auf einen Anker. */
  scrollen?: "sanft" | "sofort" | null;
  /** Framer „Tracking": Name des Ereignisses für das Google-Tag der Site. */
  tracking?: string | null;
};

/** Framer „Effects" (Vollerfassung §8) — ohne Komponenten/Varianten.
 *  SCHWESTERWERT: `EffekteDarstellung` im Backend. Nicht je Gerät. */
export const ERSCHEINEN_ARTEN = ["einblenden", "hochgleiten", "vergroessern", "von_links", "von_rechts"] as const;
export const SCHLEIFEN_ARTEN = ["pulsieren", "schweben", "drehen", "wippen"] as const;
export type EffektErscheinen = {
  art: (typeof ERSCHEINEN_ARTEN)[number];
  dauer: number;
  verzoegerung: number;
  wiederholen: boolean;
};
export type EffektHover = {
  opazitaet?: number | null;
  skalierung?: number | null;
  rotation?: number | null;
  versatz_x?: string | null;
  versatz_y?: string | null;
  dauer: number;
};
export type EffektSchleife = { art: (typeof SCHLEIFEN_ARTEN)[number]; dauer: number };
/** Framer „Drag": das Element lässt sich verschieben. */
export type EffektZiehen = { frei: boolean; achse?: "x" | "y" | null; zurueck: boolean };
/** Framer „Lightbox": Klick öffnet die Bilder groß. */
export type EffektLichtkasten = {
  max_breite: number;
  innenabstand: number;
  ebene: number;
  hintergrund: string;
};
/** Framer „Ticker": Endlosband. */
export const TICKER_RICHTUNGEN = ["links", "rechts", "oben", "unten"] as const;
export type EffektTicker = {
  tempo: number;
  richtung: (typeof TICKER_RICHTUNGEN)[number];
  hover: "weiter" | "langsamer" | "stopp";
  ziehbar: boolean;
};
/** Ein Zustand für From/To des Scroll-Transforms. */
export type EffektZustand = {
  opazitaet?: number | null;
  skalierung?: number | null;
  rotation?: number | null;
  versatz_x?: string | null;
  versatz_y?: string | null;
};
export const SCROLL_AUSLOESER = ["scroll", "ebene_sichtbar", "abschnitt_sichtbar"] as const;
export type EffektScrollTransform = {
  ausloeser: (typeof SCROLL_AUSLOESER)[number];
  von?: EffektZustand | null;
  nach?: EffektZustand | null;
};
export type Effekte = {
  erscheinen?: EffektErscheinen;
  hover?: EffektHover;
  druck?: EffektHover;
  schleife?: EffektSchleife;
  ziehen?: EffektZiehen;
  lichtkasten?: EffektLichtkasten;
  ticker?: EffektTicker;
  scroll_transform?: EffektScrollTransform;
  scroll_tempo?: number;
};

/** Framer „Cursor › Custom Cursor" — bei uns ein Bild mit Hotspot. */
export type CursorBild = { url: string; x: number; y: number };

/** Framer „Overlays" (Vollerfassung §9): Popover am Element bzw. Modal.
 *  SCHWESTERWERT: `OverlayDarstellung` im Backend. Nicht je Gerät. */
export type Overlay = {
  typ: "relativ" | "fixiert";
  ausloeser: "klick" | "hover";
  position: "oben" | "rechts" | "unten" | "links";
  ausrichten: "start" | "mitte" | "ende";
  versatz_x: number;
  versatz_y: number;
  schliessen: "auto" | "klick";
  breite?: number | null;
  /** Mehrsprachiger Text, wie jedes Textfeld eines Bausteins. */
  inhalt: Record<string, string>;
};

/** Framer „Text Styles": die acht Theme-Rollen aus Design › Text plus die
 *  beiden Altwerte, die nur die Familie wählen. SCHWESTERWERT: `schrift` in
 *  `TextDarstellung` und `TEXT_ROLLEN` in `web/.../design/text-rollen.tsx`. */
export const TEXT_ROLLEN = ["dflt", "par", "h1", "h2", "h3", "h4", "h5", "h6"] as const;
export type TextRolle = (typeof TEXT_ROLLEN)[number];
export const SCHRIFT_WAHL = ["ueberschrift", "fliesstext", ...TEXT_ROLLEN] as const;
export type SchriftWahl = (typeof SCHRIFT_WAHL)[number];

/** Framer „Font": die Familien des Katalogs. SCHWESTERWERT: `FONT_CATALOG` in
 *  `web/lib/website-fonts.ts` / `builder/lib/fonts-catalog.ts` und
 *  `SCHRIFTFAMILIEN` im Backend — geprüft von
 *  `scripts/i18n/schriftfamilien-pruefen.mjs`. */
export const SCHRIFT_STACKS: Readonly<Record<string, string>> = {
  Inter: "'Inter', system-ui, sans-serif",
  Fraunces: "'Fraunces', Georgia, serif",
  "DM Sans": "'DM Sans', system-ui, sans-serif",
  Poppins: "'Poppins', system-ui, sans-serif",
  Manrope: "'Manrope', system-ui, sans-serif",
  "Work Sans": "'Work Sans', system-ui, sans-serif",
  "Space Grotesk": "'Space Grotesk', system-ui, sans-serif",
  "Playfair Display": "'Playfair Display', Georgia, serif",
  Lora: "'Lora', Georgia, serif",
  "Cormorant Garamond": "'Cormorant Garamond', Georgia, serif",
  "Libre Baskerville": "'Libre Baskerville', Georgia, serif",
  Spectral: "'Spectral', Georgia, serif",
  "JetBrains Mono": "'JetBrains Mono', ui-monospace, monospace",
};
export const SCHRIFTFAMILIEN = Object.keys(SCHRIFT_STACKS) as readonly Schriftfamilie[];
export type Schriftfamilie =
  | "Inter"
  | "Fraunces"
  | "DM Sans"
  | "Poppins"
  | "Manrope"
  | "Work Sans"
  | "Space Grotesk"
  | "Playfair Display"
  | "Lora"
  | "Cormorant Garamond"
  | "Libre Baskerville"
  | "Spectral"
  | "JetBrains Mono";

/** Framer „Cursor › Web Cursor". Nicht je Gerät (Touch hat keinen Zeiger).
 *  SCHWESTERWERT: `cursor` in `ContainerDarstellung` (schemas_darstellung.py). */
export const CURSOR = [
  "auto",
  "pointer",
  "grab",
  "text",
  "crosshair",
  "move",
  "zoom-in",
  "zoom-out",
  "not-allowed",
  "help",
  "wait",
] as const;
export type Cursor = (typeof CURSOR)[number];

/** Die flachen Felder der Grundfassung (0432 / 28.08.2026), die es je Gerät
 *  ebenfalls gibt. */
export type Flach = {
  layout_richtung?: "zeile" | "spalte" | null;
  layout_verteilen?: "start" | "mitte" | "ende" | "zwischen" | "umgeben" | null;
  layout_ausrichten?: "start" | "mitte" | "ende" | "strecken" | null;
  layout_umbruch?: boolean | null;
  layout_abstand?: number | null;
  layout_typ?: "stapel" | "raster" | null;
  raster_spalten?: number | null;
  raster_zeilen?: number | null;
  raster_abstand_x?: number | null;
  raster_abstand_y?: number | null;
  /** Framer „Columns/Rows Span": wie viele Rasterfelder das Element belegt. */
  raster_span_x?: number | null;
  raster_span_y?: number | null;
  min_hoehe?: number | null;
  max_breite?: number | null;
  margin_top?: string | null;
  margin_right?: string | null;
  margin_bottom?: string | null;
  margin_left?: string | null;
  padding_top?: string | null;
  padding_right?: string | null;
  padding_bottom?: string | null;
  padding_left?: string | null;
};

/** Die WIRKSAME Darstellung auf einem Gerät — nach der Kaskade. */
export type Darstellung = Flach & {
  position?: Position;
  groesse?: Groesse;
  stil?: Stil;
  transform?: Transform;
  text?: Text;
};

/** Der Hintergrund der Grundfassung aus 0432 — gilt für alle Geräte, wird von
 *  `stil.fuellung` überschrieben. */
type Altbestand = {
  background_color?: string;
  background_image_url?: string;
  background_overlay?: number;
};

// --- Lesen mit Prüfung -------------------------------------------------------

const ABSTAND_RE = /^-?\d{1,4}(px|%|vh|vw)$/;
const INNEN_RE = /^\d{1,4}(px|%|vh|vw)$/;
const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const ANKER_RE = /^[a-z][a-z0-9-]{0,49}$/;
const VERHAELTNIS_RE = /^\d{1,4}(\.\d{1,3})?\s*\/\s*\d{1,4}(\.\d{1,3})?$/;
const LAGEN: readonly Lage[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
];

type Roh = Record<string, unknown>;

function objekt(v: unknown): Roh | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Roh)
    : null;
}
function zahl(v: unknown, min: number, max: number): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : undefined;
}
function text(v: unknown, muster: RegExp): string | undefined {
  return typeof v === "string" && muster.test(v) ? v : undefined;
}
function auswahl<T extends string>(
  v: unknown,
  liste: readonly T[],
): T | undefined {
  return typeof v === "string" && (liste as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}
function schalter(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
/** Hex oder Farbrolle — alles andere wird verworfen. */
function farbeLesen(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (HEX_RE.test(v)) return v;
  if (v.startsWith("rolle:")) {
    const rolle = v.slice(6);
    if ((FARBROLLEN as readonly string[]).includes(rolle)) return v;
  }
  return undefined;
}
/** Eine Adresse für `url()`. Nur http(s) und relative Pfade; und weil der Wert
 *  in ein `<style>` geschrieben wird, fliegt alles heraus, was ein `url()`
 *  oder das `<style>` selbst beenden könnte. */
function adresseLesen(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const klein = s.toLowerCase();
  const erlaubt =
    klein.startsWith("https://") ||
    klein.startsWith("http://") ||
    (s.startsWith("/") && !s.startsWith("//"));
  if (!erlaubt) return undefined;
  const sicher = s.replace(/["'\\()<>\s]/g, "");
  return sicher || undefined;
}
/** Entfernt `undefined`-Felder; ein leeres Objekt wird zu `undefined`. */
function gestrafft<T extends object>(o: T): T | undefined {
  const r: Roh = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v;
  return Object.keys(r).length ? (r as T) : undefined;
}

function massLesen(v: unknown): Mass | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const modus = auswahl(o.modus, [
    "fest",
    "relativ",
    "viewport",
    "fuellen",
    "inhalt",
  ] as const);
  if (!modus) return undefined;
  const braucht = modus === "fest" || modus === "relativ" || modus === "viewport";
  const wert = zahl(o.wert, 0, modus === "fest" ? 10000 : 1000);
  if (braucht && wert === undefined) return undefined;
  return braucht ? { modus, wert } : { modus };
}

function positionLesen(v: unknown): Position | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Position>({
    typ: auswahl(o.typ, ["relativ", "absolut", "fixiert", "klebend"] as const),
    oben: text(o.oben, ABSTAND_RE),
    rechts: text(o.rechts, ABSTAND_RE),
    unten: text(o.unten, ABSTAND_RE),
    links: text(o.links, ABSTAND_RE),
    ebene: zahl(o.ebene, -10, 100),
  });
}

function groesseLesen(v: unknown): Groesse | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Groesse>({
    breite: massLesen(o.breite),
    hoehe: massLesen(o.hoehe),
    min_breite: text(o.min_breite, INNEN_RE),
    max_breite: text(o.max_breite, INNEN_RE),
    min_hoehe: text(o.min_hoehe, INNEN_RE),
    max_hoehe: text(o.max_hoehe, INNEN_RE),
    seitenverhaeltnis: text(o.seitenverhaeltnis, VERHAELTNIS_RE),
  });
}

function fuellungLesen(v: unknown): Fuellung | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const art = auswahl(o.art, ["farbe", "verlauf", "bild"] as const);
  if (!art) return undefined;
  if (art === "farbe") {
    const farbe = farbeLesen(o.farbe);
    return farbe ? { art, farbe } : undefined;
  }
  if (art === "verlauf") {
    const roh = Array.isArray(o.stufen) ? o.stufen : [];
    const stufen: Verlaufsstufe[] = [];
    for (const s of roh.slice(0, 8)) {
      const so = objekt(s);
      const farbe = so ? farbeLesen(so.farbe) : undefined;
      const position = so ? zahl(so.position, 0, 100) : undefined;
      if (farbe && position !== undefined) stufen.push({ farbe, position });
    }
    if (stufen.length < 2) return undefined;
    return gestrafft<Fuellung>({
      art,
      stufen,
      // Framers Radial/Conic (Vollerfassung §4.8). `lage` ist dort der
      // Mittelpunkt des Verlaufs, bei einem Bild die Bildlage — dasselbe Feld,
      // weil es dieselbe Frage beantwortet („wo liegt der Ursprung").
      form: auswahl(o.form, VERLAUF_FORMEN),
      lage: auswahl(o.lage, LAGEN),
      winkel: zahl(o.winkel, 0, 360),
    });
  }
  const url = adresseLesen(o.url);
  if (!url) return undefined;
  return gestrafft<Fuellung>({
    art,
    url,
    auflage: zahl(o.auflage, 0, 0.9),
    groesse: auswahl(o.groesse, ["cover", "contain", "auto"] as const),
    lage: auswahl(o.lage, LAGEN),
    wiederholen: schalter(o.wiederholen),
  });
}

function radiusLesen(v: unknown): Radius | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Radius>({
    alle: zahl(o.alle, 0, 500),
    oben_links: zahl(o.oben_links, 0, 500),
    oben_rechts: zahl(o.oben_rechts, 0, 500),
    unten_rechts: zahl(o.unten_rechts, 0, 500),
    unten_links: zahl(o.unten_links, 0, 500),
  });
}

function grenzeLesen(v: unknown): Grenze | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const breite = zahl(o.breite, 0, 40);
  const farbe = farbeLesen(o.farbe);
  if (breite === undefined || !farbe) return undefined;
  const seiten = Array.isArray(o.seiten)
    ? (["oben", "rechts", "unten", "links"] as const).filter((s) =>
        (o.seiten as unknown[]).includes(s),
      )
    : undefined;
  return gestrafft<Grenze>({
    breite,
    farbe,
    art: auswahl(o.art, ["solid", "dashed", "dotted", "double"] as const),
    seiten: seiten && seiten.length ? seiten : undefined,
  });
}

function schattenLesen(v: unknown): Schatten[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const liste: Schatten[] = [];
  for (const s of v.slice(0, 6)) {
    const o = objekt(s);
    const farbe = o ? farbeLesen(o.farbe) : undefined;
    if (!o || !farbe) continue;
    liste.push(
      gestrafft<Schatten>({
        farbe,
        x: zahl(o.x, -200, 200),
        y: zahl(o.y, -200, 200),
        weich: zahl(o.weich, 0, 200),
        ausbreitung: zahl(o.ausbreitung, -100, 100),
        innen: schalter(o.innen),
      }) as Schatten,
    );
  }
  return liste.length ? liste : undefined;
}

const UEBERLAEUFE = ["sichtbar", "verborgen", "abschneiden", "scrollen"] as const;
function filterLesen(v: unknown): Filter | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Filter>({
    weichzeichnen: zahl(o.weichzeichnen, 0, 100),
    helligkeit: zahl(o.helligkeit, 0, 200),
    kontrast: zahl(o.kontrast, 0, 200),
    saettigung: zahl(o.saettigung, 0, 200),
    graustufen: zahl(o.graustufen, 0, 100),
  });
}

function maskeLesen(v: unknown): Maske | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const start = zahl(o.start, 0, 100) ?? 0;
  const ende = zahl(o.ende, 0, 100) ?? 100;
  // Eine Maske, deren Ende vor dem Start liegt, ergäbe einen Verlauf, den der
  // Browser umdreht — der Kunde sähe das Gegenteil seiner Eingabe (Wurzel 4).
  if (start >= ende) return undefined;
  return {
    art: auswahl(o.art, ["linear", "radial"] as const) ?? "linear",
    winkel: zahl(o.winkel, 0, 360) ?? 180,
    start,
    ende,
    umkehren: o.umkehren === true,
  };
}

function stilLesen(v: unknown): Stil | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Stil>({
    maske: maskeLesen(o.maske),
    auswahl_farbe: farbeLesen(o.auswahl_farbe),
    auswahl_hintergrund: farbeLesen(o.auswahl_hintergrund),
    opazitaet: zahl(o.opazitaet, 0, 1),
    sichtbar: schalter(o.sichtbar),
    fuellung: fuellungLesen(o.fuellung),
    ueberlauf: auswahl(o.ueberlauf, [
      "sichtbar",
      "verborgen",
      "abschneiden",
      "scrollen",
    ] as const),
    radius: radiusLesen(o.radius),
    grenze: grenzeLesen(o.grenze),
    schatten: schattenLesen(o.schatten),
    mischmodus: auswahl(o.mischmodus, MISCHMODI),
    filter: filterLesen(o.filter),
    ueberlauf_x: auswahl(o.ueberlauf_x, UEBERLAEUFE),
    ueberlauf_y: auswahl(o.ueberlauf_y, UEBERLAEUFE),
    zeiger_ereignisse: schalter(o.zeiger_ereignisse),
    text_auswahl: schalter(o.text_auswahl),
    tippfarbe: farbeLesen(o.tippfarbe),
  });
}

function transformLesen(v: unknown): Transform | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<Transform>({
    rotation: zahl(o.rotation, -360, 360),
    skalierung: zahl(o.skalierung, 0, 10),
    versatz_x: text(o.versatz_x, ABSTAND_RE),
    versatz_y: text(o.versatz_y, ABSTAND_RE),
    neigung_x: zahl(o.neigung_x, -89, 89),
    neigung_y: zahl(o.neigung_y, -89, 89),
    ursprung: auswahl(o.ursprung, LAGEN),
    perspektive: zahl(o.perspektive, 0, 5000),
    rotation_x: zahl(o.rotation_x, -360, 360),
    rotation_y: zahl(o.rotation_y, -360, 360),
    tiefe: zahl(o.tiefe, -500, 500),
    rueckseite: auswahl(o.rueckseite, ["sichtbar", "verborgen"] as const),
    raum_3d: schalter(o.raum_3d),
  });
}

export function cursorLesen(settings: Roh): Cursor | undefined {
  return auswahl(settings.cursor, CURSOR);
}

/** Framer „Custom Cursor" — ein Bild als Zeiger, mit Hotspot. */
export function cursorBildLesen(settings: Roh): CursorBild | undefined {
  const o = objekt(settings.cursor_bild);
  const url = o ? adresseLesen(o.url) : undefined;
  if (!url) return undefined;
  return { url, x: zahl(o!.x, 0, 128) ?? 0, y: zahl(o!.y, 0, 128) ?? 0 };
}

/** Framer „Overlays" (Vollerfassung §9). */
export function overlayLesen(settings: Roh): Overlay | undefined {
  const o = objekt(settings.overlay);
  if (!o) return undefined;
  const rohInhalt = objekt(o.inhalt) ?? {};
  const inhalt: Record<string, string> = {};
  for (const [code, wert] of Object.entries(rohInhalt)) {
    if (/^[a-z]{2}$/.test(code) && typeof wert === "string" && wert.trim()) {
      inhalt[code] = wert.trim().slice(0, 2000);
    }
  }
  // Ein Overlay ohne Text hat nichts zu zeigen — es wäre ein Kasten, der
  // aufgeht und leer bleibt (Wurzel 4).
  if (Object.keys(inhalt).length === 0) return undefined;
  return {
    typ: auswahl(o.typ, ["relativ", "fixiert"] as const) ?? "relativ",
    ausloeser: auswahl(o.ausloeser, ["klick", "hover"] as const) ?? "klick",
    position: auswahl(o.position, ["oben", "rechts", "unten", "links"] as const) ?? "unten",
    ausrichten: auswahl(o.ausrichten, ["start", "mitte", "ende"] as const) ?? "mitte",
    versatz_x: zahl(o.versatz_x, -200, 200) ?? 0,
    versatz_y: zahl(o.versatz_y, -200, 200) ?? 10,
    schliessen: auswahl(o.schliessen, ["auto", "klick"] as const) ?? "auto",
    breite: zahl(o.breite, 120, 800),
    inhalt,
  };
}

// --- Codeüberschreibungen (Framer „Code Overrides") -------------------------
// SCHWESTERWERT: `CSS_EIGENSCHAFTEN` und `css_zerlegen` in
// `apps/api/.../schemas_darstellung.py`. Der Editor prüft mit DIESER Funktion,
// bevor er sendet; das Backend prüft dieselbe Regel noch einmal beim Speichern
// (Wurzel 3 — der Anfrage nicht vertrauen), und der Renderer liest sie ein
// drittes Mal, weil in der Datenbank Zeilen stehen, die älter sind als jede
// Prüfung (Wurzel 8).
export const CSS_EIGENSCHAFTEN: ReadonlySet<string> = new Set([
  "color", "background", "background-color", "background-image",
  "background-size", "background-position", "background-repeat",
  "background-clip", "border", "border-top", "border-right",
  "border-bottom", "border-left", "border-color", "border-width",
  "border-style", "border-radius", "outline", "outline-offset",
  "box-shadow", "opacity", "filter", "backdrop-filter", "mix-blend-mode",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "aspect-ratio", "margin", "margin-top", "margin-right", "margin-bottom",
  "margin-left", "padding", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "gap", "row-gap", "column-gap",
  "display", "flex", "flex-direction", "flex-wrap", "flex-grow",
  "flex-shrink", "flex-basis", "justify-content", "align-items",
  "align-self", "align-content", "order", "grid-template-columns",
  "grid-template-rows", "grid-column", "grid-row", "grid-auto-flow",
  "position", "top", "right", "bottom", "left", "inset", "z-index",
  "overflow", "overflow-x", "overflow-y", "transform", "transform-origin",
  "transition", "animation", "cursor", "pointer-events", "user-select",
  "visibility", "font-family", "font-size", "font-weight", "font-style",
  "line-height", "letter-spacing", "text-align", "text-transform",
  "text-decoration", "text-shadow", "white-space", "word-break",
  "text-overflow", "object-fit", "object-position", "clip-path",
  "mask-image", "isolation", "will-change", "scroll-margin-top",
  "text-wrap", "hyphens", "columns",
]);
const CSS_WERT_VERBOTEN = ["url(", "expression(", "javascript", "@", "{", "}", "<", ">", "\\", "/*"];

/** `prop: wert; …` → geprüfte Paare und die ABGEWIESENEN Zeilen.
 *  Der Editor zeigt die abgewiesenen Zeilen im Feld an, statt sie still
 *  fallen zu lassen (Wurzel 5). */
export function codeCssZerlegen(roh: string): {
  paare: Array<[string, string]>;
  fehler: string[];
} {
  const paare: Array<[string, string]> = [];
  const fehler: string[] = [];
  for (const zeile of roh.replace(/\n/g, ";").split(";")) {
    const z = zeile.trim();
    if (!z) continue;
    const i = z.indexOf(":");
    if (i < 0) {
      fehler.push(z);
      continue;
    }
    const prop = z.slice(0, i).trim().toLowerCase();
    const wert = z.slice(i + 1).trim();
    const klein = wert.toLowerCase();
    if (
      !CSS_EIGENSCHAFTEN.has(prop) ||
      !wert ||
      wert.length > 200 ||
      CSS_WERT_VERBOTEN.some((v) => klein.includes(v))
    ) {
      fehler.push(z);
      continue;
    }
    paare.push([prop, wert]);
  }
  return { paare, fehler };
}

/** Die geprüften Eigenschaften der Codeüberschreibung eines Blocks. */
export function codeLesen(settings: Roh): Eigenschaften | undefined {
  const o = objekt(settings.code);
  if (!o || typeof o.css !== "string" || o.css.length > 4000) return undefined;
  const { paare } = codeCssZerlegen(o.css);
  if (!paare.length) return undefined;
  return Object.fromEntries(paare);
}

export function scrollLesen(settings: Roh): Scroll | undefined {
  const o = objekt(settings.scroll);
  if (!o) return undefined;
  const anker = text(o.anker, ANKER_RE);
  if (!anker) return undefined;
  return gestrafft<Scroll>({ anker, versatz_y: zahl(o.versatz_y, -500, 500) });
}

/** Erlaubte Link-Schemata — dieselbe Allowlist wie `_validate_href` im
 *  Backend; relativ (`/`, `#`, `?`) oder ohne Schema vor dem ersten `/`. */
const LINK_SCHEMATA = ["http://", "https://", "mailto:", "tel:"];
export function linkLesen(settings: Roh): Link | undefined {
  const o = objekt(settings.link);
  if (!o || typeof o.href !== "string") return undefined;
  const href = o.href.trim();
  if (!href || href.length > 2000) return undefined;
  const klein = href.toLowerCase();
  const relativ =
    /^[/#?]/.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href.split("/")[0] ?? "");
  if (!relativ && !LINK_SCHEMATA.some((s) => klein.startsWith(s))) return undefined;
  const anker = text(o.anker, ANKER_RE);
  return gestrafft<Link>({
    href,
    neuer_tab: o.neuer_tab === true,
    anker,
    rel: listeLesen(o.rel, LINK_REL),
    parameter: text(o.parameter, PARAMETER_RE),
    scrollen: auswahl(o.scrollen, ["sanft", "sofort"] as const),
    tracking: text(o.tracking, EREIGNIS_RE),
  }) as Link;
}

/** Die Adresse, die ins `href` geschrieben wird: Parameter vor dem Anker,
 *  Anker nur, wenn die Adresse nicht selbst schon einen trägt. */
export function linkZiel(l: Link): string {
  let href = l.href;
  if (l.parameter) {
    const [vorAnker, anker] = href.split("#", 2);
    const basis = vorAnker ?? "";
    href =
      basis + (basis.includes("?") ? "&" : "?") + l.parameter + (anker !== undefined ? `#${anker}` : "");
  }
  if (!l.anker || href.includes("#")) return href;
  return `${href}#${l.anker}`;
}

/** Das `rel` des Links: eigene Angaben plus `noopener noreferrer` bei neuem Tab. */
export function linkRel(l: Link): string | undefined {
  const teile = new Set<string>(l.rel ?? []);
  if (l.neuer_tab) {
    teile.add("noopener");
    teile.add("noreferrer");
  }
  return teile.size ? [...teile].join(" ") : undefined;
}

/** Eine Liste erlaubter Werte, entdoppelt; leer → undefined. */
function listeLesen<T extends string>(v: unknown, erlaubt: readonly T[]): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const aus = [
    ...new Set(
      v.filter((x): x is T => typeof x === "string" && (erlaubt as readonly string[]).includes(x)),
    ),
  ];
  return aus.length ? aus : undefined;
}

const PARAMETER_RE = /^[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*(&[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*){0,9}$/;
/** GA4-Ereignisname: klein, Ziffern, Unterstrich — SCHWESTERWERT im Backend. */
const EREIGNIS_RE = /^[a-z][a-z0-9_]{0,39}$/;

function hoverLesen(v: unknown): EffektHover | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const e = gestrafft<Omit<EffektHover, "dauer">>({
    opazitaet: zahl(o.opazitaet, 0, 1),
    skalierung: zahl(o.skalierung, 0, 10),
    rotation: zahl(o.rotation, -360, 360),
    versatz_x: text(o.versatz_x, ABSTAND_RE),
    versatz_y: text(o.versatz_y, ABSTAND_RE),
  });
  if (!e) return undefined;
  return { ...e, dauer: zahl(o.dauer, 0, 3000) ?? 200 };
}

function zustandLesen(v: unknown): EffektZustand | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  return gestrafft<EffektZustand>({
    opazitaet: zahl(o.opazitaet, 0, 1),
    skalierung: zahl(o.skalierung, 0, 10),
    rotation: zahl(o.rotation, -360, 360),
    versatz_x: text(o.versatz_x, ABSTAND_RE),
    versatz_y: text(o.versatz_y, ABSTAND_RE),
  });
}

export function effekteLesen(settings: Roh): Effekte | undefined {
  const o = objekt(settings.effekte);
  if (!o) return undefined;
  const er = objekt(o.erscheinen);
  const sch = objekt(o.schleife);
  const zieh = objekt(o.ziehen);
  const licht = objekt(o.lichtkasten);
  const tick = objekt(o.ticker);
  const scrollT = objekt(o.scroll_transform);
  const von = scrollT ? zustandLesen(scrollT.von) : undefined;
  const nach = scrollT ? zustandLesen(scrollT.nach) : undefined;
  return gestrafft<Effekte>({
    ziehen: zieh
      ? {
          frei: zieh.frei !== false,
          achse: auswahl(zieh.achse, ["x", "y"] as const),
          zurueck: zieh.zurueck === true,
        }
      : undefined,
    lichtkasten: licht
      ? {
          max_breite: zahl(licht.max_breite, 200, 2000) ?? 800,
          innenabstand: zahl(licht.innenabstand, 0, 200) ?? 20,
          ebene: zahl(licht.ebene, 0, 100) ?? 10,
          hintergrund: farbeLesen(licht.hintergrund) ?? "#000000",
        }
      : undefined,
    ticker: tick
      ? {
          tempo: zahl(tick.tempo, 10, 500) ?? 100,
          richtung: auswahl(tick.richtung, TICKER_RICHTUNGEN) ?? "links",
          hover: auswahl(tick.hover, ["weiter", "langsamer", "stopp"] as const) ?? "weiter",
          ziehbar: tick.ziehbar === true,
        }
      : undefined,
    // Ein Scroll-Transform ohne beide Zustände bewegt nichts — dann gibt es
    // ihn auch nicht (Wurzel 4).
    scroll_transform:
      scrollT && (von || nach)
        ? {
            ausloeser: auswahl(scrollT.ausloeser, SCROLL_AUSLOESER) ?? "scroll",
            von,
            nach,
          }
        : undefined,
    erscheinen: er
      ? {
          art: auswahl(er.art, ERSCHEINEN_ARTEN) ?? "einblenden",
          dauer: zahl(er.dauer, 100, 3000) ?? 600,
          verzoegerung: zahl(er.verzoegerung, 0, 3000) ?? 0,
          wiederholen: er.wiederholen === true,
        }
      : undefined,
    hover: hoverLesen(o.hover),
    druck: hoverLesen(o.druck),
    schleife: sch
      ? { art: auswahl(sch.art, SCHLEIFEN_ARTEN) ?? "pulsieren", dauer: zahl(sch.dauer, 300, 20000) ?? 2000 }
      : undefined,
    scroll_tempo: zahl(o.scroll_tempo, 10, 300),
  });
}

export function a11yLesen(settings: Roh): A11y | undefined {
  const o = objekt(settings.a11y);
  if (!o) return undefined;
  const label =
    typeof o.label === "string" && o.label.trim() && o.label.length <= 120
      ? o.label.trim()
      : undefined;
  return gestrafft<A11y>({
    tag: auswahl(o.tag, [
      "div",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "nav",
      "main",
    ] as const),
    label,
    tab_index: zahl(o.tab_index, -1, 100),
    fuer_leser_verborgen: schalter(o.fuer_leser_verborgen),
    nosnippet: schalter(o.nosnippet),
  });
}

function flachLesen(o: Roh): Flach {
  return (
    gestrafft<Flach>({
      layout_richtung: auswahl(o.layout_richtung, ["zeile", "spalte"] as const),
      layout_verteilen: auswahl(o.layout_verteilen, [
        "start",
        "mitte",
        "ende",
        "zwischen",
        "umgeben",
      ] as const),
      layout_ausrichten: auswahl(o.layout_ausrichten, [
        "start",
        "mitte",
        "ende",
        "strecken",
      ] as const),
      layout_umbruch: schalter(o.layout_umbruch),
      layout_abstand: zahl(o.layout_abstand, 0, 160),
      layout_typ: auswahl(o.layout_typ, ["stapel", "raster"] as const),
      raster_spalten: zahl(o.raster_spalten, 1, 12),
      raster_zeilen: zahl(o.raster_zeilen, 1, 12),
      raster_abstand_x: zahl(o.raster_abstand_x, 0, 160),
      raster_abstand_y: zahl(o.raster_abstand_y, 0, 160),
      raster_span_x: zahl(o.raster_span_x, 1, 12),
      raster_span_y: zahl(o.raster_span_y, 1, 12),
      min_hoehe: zahl(o.min_hoehe, 0, 2000),
      max_breite: zahl(o.max_breite, 320, 2560),
      margin_top: text(o.margin_top, ABSTAND_RE),
      margin_right: text(o.margin_right, ABSTAND_RE),
      margin_bottom: text(o.margin_bottom, ABSTAND_RE),
      margin_left: text(o.margin_left, ABSTAND_RE),
      padding_top: text(o.padding_top, INNEN_RE),
      padding_right: text(o.padding_right, INNEN_RE),
      padding_bottom: text(o.padding_bottom, INNEN_RE),
      padding_left: text(o.padding_left, INNEN_RE),
    }) ?? {}
  );
}

/** EINE Fassung (Grundfassung oder eine Geräte-Überschreibung), geprüft. */
const TEXT_GROESSE_RE = /^\d{1,3}(\.\d{1,2})?(px|rem)$/;
const TEXT_LAUFWEITE_RE = /^-?\d{1,2}(\.\d{1,3})?(em|px)$/;
const TEXT_ZEILE_RE = /^\d{1,3}(\.\d{1,3})?(em|px|%)$/;
const TEXT_GEWICHTE: readonly TextGewicht[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function textLesen(v: unknown): Text | undefined {
  const o = objekt(v);
  if (!o) return undefined;
  const gewicht =
    typeof o.gewicht === "number" && (TEXT_GEWICHTE as readonly number[]).includes(o.gewicht)
      ? (o.gewicht as TextGewicht)
      : undefined;
  const kuerzen =
    typeof o.kuerzen === "number" && Number.isInteger(o.kuerzen) && o.kuerzen >= 1 && o.kuerzen <= 20
      ? o.kuerzen
      : undefined;
  return gestrafft<Text>({
    schrift: auswahl(o.schrift, SCHRIFT_WAHL),
    schriftfamilie: auswahl(o.schriftfamilie, SCHRIFTFAMILIEN),
    farbe: farbeLesen(o.farbe),
    groesse: text(o.groesse, TEXT_GROESSE_RE),
    gewicht,
    laufweite: text(o.laufweite, TEXT_LAUFWEITE_RE),
    zeilenhoehe: text(o.zeilenhoehe, TEXT_ZEILE_RE),
    ausrichtung: auswahl(o.ausrichtung, ["start", "center", "end", "justify"] as const),
    transformation: auswahl(o.transformation, ["none", "uppercase", "lowercase", "capitalize"] as const),
    dekoration: auswahl(o.dekoration, ["none", "underline", "line-through"] as const),
    balance: schalter(o.balance),
    kuerzen,
    opentype: listeLesen(o.opentype, OPENTYPE),
  });
}

function fassungLesen(o: Roh): Darstellung {
  return {
    ...flachLesen(o),
    ...gestrafft({
      position: positionLesen(o.position),
      groesse: groesseLesen(o.groesse),
      stil: stilLesen(o.stil),
      transform: transformLesen(o.transform),
      text: textLesen(o.text),
    }),
  };
}

function altbestandLesen(settings: Roh): Altbestand {
  const bild = adresseLesen(settings.background_image_url);
  return (
    gestrafft<Altbestand>({
      background_color: text(settings.background_color, /^#[0-9a-fA-F]{6}$/),
      background_image_url: bild,
      background_overlay: bild ? zahl(settings.background_overlay, 0, 0.9) : undefined,
    }) ?? {}
  );
}

// --- Kaskade -----------------------------------------------------------------

/** Die Überschreibung eines Geräts, geprüft — `undefined`, wenn keine da ist. */
export function ueberschreibung(
  settings: Roh,
  geraet: "tablet" | "mobil",
): Darstellung | undefined {
  const je = objekt(settings.je_geraet);
  const o = je ? objekt(je[geraet]) : null;
  if (!o) return undefined;
  const d = fassungLesen(o);
  return Object.keys(d).length ? d : undefined;
}

/** Welche Geräte eine Überschreibung tragen — für die blaue Markierung im
 *  Inspektor und das `data-stil-geraete`-Attribut im Editor. */
export function geraeteMitUeberschreibung(settings: Roh): Array<"tablet" | "mobil"> {
  return (["tablet", "mobil"] as const).filter((g) => ueberschreibung(settings, g));
}

/** Zwei Fassungen FELDWEISE mischen: Unterobjekte Position/Größe/Stil/Transform
 *  werden Feld für Feld überlagert (ein Tablet mit nur `stil.opazitaet` behält
 *  Radius und Grenze des Desktops); ein einzelnes Feld ersetzt ganz —
 *  auch `radius`, `grenze`, `fuellung`, `schatten`, die im Inspektor je EINE
 *  Zeile sind. */
function mischen(basis: Darstellung, oben: Darstellung | undefined): Darstellung {
  if (!oben) return basis;
  const { position, groesse, stil, transform, text: textFassung, ...flach } = oben;
  const ergebnis: Darstellung = { ...basis, ...flach };
  if (position) ergebnis.position = { ...basis.position, ...position };
  if (groesse) ergebnis.groesse = { ...basis.groesse, ...groesse };
  if (stil) ergebnis.stil = { ...basis.stil, ...stil };
  if (transform) ergebnis.transform = { ...basis.transform, ...transform };
  if (textFassung) ergebnis.text = { ...basis.text, ...textFassung };
  return ergebnis;
}

/** Die wirksame Darstellung eines Blocks auf EINEM Gerät.
 *
 *  Eine einzige Sonderregel, und sie ist Bestand, kein Erfinden: eine Reihe
 *  (`layout_richtung: "zeile"`) stapelt auf dem Telefon untereinander. So
 *  rendert der Baukasten seit 28.08.2026 (`flex-col md:flex-row`) — drei
 *  Spalten zu je einem Drittel sind auf 390 px drei unlesbare Streifen. Wer
 *  auf dem Telefon wirklich eine Reihe will, setzt sie dort ausdrücklich
 *  (`je_geraet.mobil.layout_richtung: "zeile"`). */
export function darstellungFuer(settings: Roh, geraet: Geraet): Darstellung {
  let d = fassungLesen(settings);
  if (geraet === "desktop") return d;
  d = mischen(d, ueberschreibung(settings, "tablet"));
  if (geraet === "tablet") return d;
  const mobil = ueberschreibung(settings, "mobil");
  d = mischen(d, mobil);
  if (d.layout_richtung === "zeile" && mobil?.layout_richtung == null) {
    d.layout_richtung = "spalte";
  }
  return d;
}

/** Woher ein Wert auf einem Gerät kommt — für den Inspektor: eigener
 *  Override (blau), geerbt von einem breiteren Gerät, oder nicht gesetzt.
 *  `pfad` wie `["stil", "opazitaet"]` oder `["layout_abstand"]`. */
export function herkunft(
  settings: Roh,
  geraet: Geraet,
  pfad: readonly string[],
): { quelle: Geraet; eigen: boolean } | null {
  const kette: Geraet[] =
    geraet === "desktop"
      ? ["desktop"]
      : geraet === "tablet"
        ? ["tablet", "desktop"]
        : ["mobil", "tablet", "desktop"];
  for (const g of kette) {
    const fassung =
      g === "desktop" ? fassungLesen(settings) : ueberschreibung(settings, g);
    let wert: unknown = fassung;
    for (const teil of pfad) {
      wert = objekt(wert)?.[teil];
      if (wert === undefined) break;
    }
    if (wert !== undefined && wert !== null) {
      return { quelle: g, eigen: g === geraet };
    }
  }
  return null;
}

// --- Schreiben (Etappe 3, Inspektor) -----------------------------------------
// Der Inspektor schreibt über DIESE zwei Funktionen — nie direkt in `settings`.
// Ein Wert auf Desktop landet in der Grundfassung, auf Tablet/Mobil in
// `je_geraet.<gerät>`; `null` LÖSCHT ihn dort (der Rückweg, Wurzel 1), und
// leer gewordene Unterobjekte verschwinden mit, damit `{stil: {}}` nicht als
// „geändert" stehen bleibt (Wurzel 2: dieselbe Seite zweimal unverändert
// geschlossen ergibt denselben Datensatz).

/** Felder, die es NICHT je Gerät gibt: sie stehen immer in der Grundfassung.
 *  SCHWESTERWERT: `GeraeteUeberschreibung` in `schemas_darstellung.py` kennt
 *  genau diese nicht. */
const NUR_GRUNDFASSUNG: ReadonlySet<string> = new Set([
  "scroll",
  "a11y",
  "link",
  "cursor",
  "effekte",
  "hidden_on",
  "locked",
  "name",
  "spacing_x_gekoppelt",
]);

/** Ob ein Pfad je Gerät überschreibbar ist. */
export function jeGeraetMoeglich(pfad: readonly string[]): boolean {
  return pfad.length > 0 && !NUR_GRUNDFASSUNG.has(pfad[0]!);
}

function ohneLeere(o: Roh): Roh {
  const ergebnis: Roh = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const kind = objekt(v);
    if (kind) {
      const bereinigt = ohneLeere(kind);
      if (Object.keys(bereinigt).length === 0) continue;
      ergebnis[k] = bereinigt;
    } else {
      ergebnis[k] = v;
    }
  }
  return ergebnis;
}

function pfadSetzen(o: Roh, pfad: readonly string[], wert: unknown): Roh {
  const [kopf, ...rest] = pfad;
  if (kopf === undefined) return o;
  const kopie: Roh = { ...o };
  if (rest.length === 0) {
    if (wert === null || wert === undefined) delete kopie[kopf];
    else kopie[kopf] = wert;
    return kopie;
  }
  kopie[kopf] = pfadSetzen(objekt(o[kopf]) ?? {}, rest, wert);
  return kopie;
}

/** Neue Settings mit `wert` an `pfad` für `geraet`; `null` löscht.
 *
 *  Der Rückgabewert ist ein neues Objekt — `settings` bleibt unberührt. */
export function mitWert(
  settings: Roh,
  geraet: Geraet,
  pfad: readonly string[],
  wert: unknown,
): Roh {
  if (geraet === "desktop" || !jeGeraetMoeglich(pfad)) {
    return ohneLeere(pfadSetzen(settings, pfad, wert));
  }
  return ohneLeere(pfadSetzen(settings, ["je_geraet", geraet, ...pfad], wert));
}

/** Der auf DIESEM Gerät selbst gesetzte Wert an `pfad` — ohne Kaskade.
 *  `undefined` heißt „hier nicht gesetzt" (der Inspektor zeigt dann den
 *  geerbten Wert grau und ohne Reset-Knopf). */
export function eigenerWert(
  settings: Roh,
  geraet: Geraet,
  pfad: readonly string[],
): unknown {
  let wert: unknown =
    geraet === "desktop" || !jeGeraetMoeglich(pfad)
      ? settings
      : objekt(objekt(settings.je_geraet)?.[geraet]);
  for (const teil of pfad) {
    wert = objekt(wert)?.[teil];
    if (wert === undefined) return undefined;
  }
  return wert ?? undefined;
}

/** Der wirksame Wert an `pfad` auf `geraet` — geprüft, durch die Kaskade. */
export function wirksamerWert(
  settings: Roh,
  geraet: Geraet,
  pfad: readonly string[],
): unknown {
  let wert: unknown = darstellungFuer(settings, geraet);
  for (const teil of pfad) {
    wert = objekt(wert)?.[teil];
    if (wert === undefined) return undefined;
  }
  return wert ?? undefined;
}

// --- CSS ---------------------------------------------------------------------

/** Ein Satz CSS-Eigenschaften (Schreibweise wie im Stylesheet). */
export type Eigenschaften = Record<string, string>;

/** `#rrggbb` bleibt; `rolle:primary` wird zur Theme-Variablen. */
export function farbeCss(farbe: string): string {
  return farbe.startsWith("rolle:") ? `var(--${farbe.slice(6)})` : farbe;
}

function massCss(m: Mass, achse: "breite" | "hoehe"): Eigenschaften {
  const eig = achse === "breite" ? "width" : "height";
  switch (m.modus) {
    case "fest":
      return achse === "breite"
        ? { width: `${m.wert}px`, "flex-basis": `${m.wert}px`, "flex-grow": "0" }
        : { height: `${m.wert}px` };
    case "relativ":
      return achse === "breite"
        ? { width: `${m.wert}%`, "flex-basis": `${m.wert}%`, "flex-grow": "0" }
        : { height: `${m.wert}%` };
    case "viewport":
      return achse === "breite"
        ? { width: `${m.wert}vw`, "flex-basis": `${m.wert}vw`, "flex-grow": "0" }
        : { height: `${m.wert}vh` };
    case "fuellen":
      // Restplatz der Flex-Reihe. `min-width: 0`, damit ein langes Wort das
      // Kind nicht über den Rest hinaus aufbläht.
      return achse === "breite"
        ? { width: "auto", "flex-basis": "0%", "flex-grow": "1", "min-width": "0" }
        : { height: "auto", "flex-grow": "1", "align-self": "stretch" };
    case "inhalt":
      return achse === "breite"
        ? { width: "fit-content", "flex-basis": "auto", "flex-grow": "0" }
        : { [eig]: "auto" };
  }
}

function fuellungCss(f: Fuellung): Eigenschaften {
  if (f.art === "farbe") {
    return { "background-color": farbeCss(f.farbe as string), "background-image": "none" };
  }
  if (f.art === "verlauf") {
    const stufen = (f.stufen ?? [])
      .map((s) => `${farbeCss(s.farbe)} ${s.position}%`)
      .join(", ");
    // Framers drei Formen (§4.8): Linear mit Winkel, Radial vom Mittelpunkt,
    // Conic mit Startwinkel um den Mittelpunkt.
    const mitte = f.lage ?? "center";
    if (f.form === "radial") {
      return { "background-image": `radial-gradient(circle at ${mitte}, ${stufen})` };
    }
    if (f.form === "konisch") {
      return {
        "background-image": `conic-gradient(from ${f.winkel ?? 0}deg at ${mitte}, ${stufen})`,
      };
    }
    return { "background-image": `linear-gradient(${f.winkel ?? 180}deg, ${stufen})` };
  }
  const auflage =
    f.auflage && f.auflage > 0
      ? `linear-gradient(rgba(0,0,0,${f.auflage}), rgba(0,0,0,${f.auflage})), `
      : "";
  const e: Eigenschaften = {
    "background-image": `${auflage}url("${f.url}")`,
    "background-size": f.groesse ?? "cover",
    "background-position": f.lage ?? "center",
  };
  if (f.wiederholen !== undefined && f.wiederholen !== null) {
    e["background-repeat"] = f.wiederholen ? "repeat" : "no-repeat";
  }
  return e;
}

/** Der Hintergrund aus 0432 (`background_color`, `background_image_url`,
 *  `background_overlay`) — genau die Regeln des bisherigen `bgStyle`. */
function altbestandCss(a: Altbestand): Eigenschaften {
  const e: Eigenschaften = {};
  if (a.background_color) e["background-color"] = a.background_color;
  if (a.background_image_url) {
    const deckung = a.background_overlay ?? 0;
    const auflage = deckung
      ? `linear-gradient(rgba(0,0,0,${deckung}), rgba(0,0,0,${deckung})), `
      : "";
    e["background-image"] = `${auflage}url("${a.background_image_url}")`;
    e["background-size"] = "cover";
    e["background-position"] = "center";
  }
  return e;
}

const POSITION_CSS: Record<PositionTyp, string> = {
  relativ: "relative",
  absolut: "absolute",
  fixiert: "fixed",
  klebend: "sticky",
};
const UEBERLAUF_CSS: Record<Ueberlauf, string> = {
  sichtbar: "visible",
  verborgen: "hidden",
  abschneiden: "clip",
  scrollen: "auto",
};
const JUSTIFY: Record<NonNullable<Flach["layout_verteilen"]>, string> = {
  start: "flex-start",
  mitte: "center",
  ende: "flex-end",
  zwischen: "space-between",
  umgeben: "space-around",
};
const ALIGN: Record<NonNullable<Flach["layout_ausrichten"]>, string> = {
  start: "flex-start",
  mitte: "center",
  ende: "flex-end",
  strecken: "stretch",
};
const SEITE_CSS = { oben: "top", rechts: "right", unten: "bottom", links: "left" } as const;

/** Die CSS-Eigenschaften des TEXTES eines Blocks auf einem Gerät (Framer
 *  „Text"). Gilt für alle Textknoten — der Renderer setzt den Selektor
 *  entsprechend. Die Schrift ist eine Theme-Rolle: die Variablen kommen aus
 *  dem Design-Panel (`--txt-h1-font`, `--txt-dflt-font`). */
export function textStil(settings: Roh, geraet: Geraet): Eigenschaften {
  const t = darstellungFuer(settings, geraet).text;
  const e: Eigenschaften = {};
  if (!t) return e;
  if (t.schrift === "ueberschrift") e["font-family"] = "var(--txt-h1-font, var(--font-display))";
  else if (t.schrift === "fliesstext") e["font-family"] = "var(--txt-dflt-font, var(--font-sans))";
  else if (t.schrift) {
    // Framer „Text Styles": eine Rolle des Themes bringt ihren ganzen Satz mit
    // (Design › Text schreibt die Variablen, `builder/lib/theme.ts`). Die
    // Fallbacks sind `inherit` und nicht erfundene Werte: eine Rolle, die der
    // Betrieb nicht eingestellt hat, erbt vom Elternteil (Wurzel 4).
    const p = `--txt-${t.schrift}`;
    e["font-family"] = `var(${p}-font, inherit)`;
    e["font-size"] = `var(${p}-size, inherit)`;
    e["font-weight"] = `var(${p}-weight, inherit)`;
    e["line-height"] = `var(${p}-lh, inherit)`;
    e["letter-spacing"] = `var(${p}-ls, inherit)`;
    e.color = `var(${p}-color, inherit)`;
    e["text-transform"] = `var(${p}-tt, inherit)`;
    e["text-shadow"] = `var(${p}-shadow, none)`;
  }
  // Framer „Font": die gewählte Familie schlägt die Rolle — sie steht in der
  // Zeile darunter im Panel und ist die genauere Angabe.
  const stack = t.schriftfamilie ? SCHRIFT_STACKS[t.schriftfamilie] : undefined;
  if (stack) e["font-family"] = stack;
  if (t.farbe) e.color = farbeCss(t.farbe);
  if (t.groesse) e["font-size"] = t.groesse;
  if (t.gewicht != null) e["font-weight"] = String(t.gewicht);
  if (t.laufweite) e["letter-spacing"] = t.laufweite;
  if (t.zeilenhoehe) e["line-height"] = t.zeilenhoehe;
  if (t.ausrichtung) e["text-align"] = t.ausrichtung;
  if (t.transformation) e["text-transform"] = t.transformation;
  if (t.opentype?.length) e["font-feature-settings"] = t.opentype.map((f) => `"${f}" 1`).join(", ");
  if (t.dekoration) e["text-decoration-line"] = t.dekoration;
  if (t.balance != null) e["text-wrap"] = t.balance ? "balance" : "wrap";
  if (t.kuerzen != null) {
    e.display = "-webkit-box";
    e["-webkit-box-orient"] = "vertical";
    e["-webkit-line-clamp"] = String(t.kuerzen);
    e.overflow = "hidden";
  }
  return e;
}

export type StilOptionen = {
  /** Im Editor wird nichts ausgeblendet, sondern durchscheinend gezeigt —
   *  derselbe Rückweg wie bei `hidden_on`. */
  editor?: boolean;
  /** Breitenanteil einer Spalte in Zwölfteln (aus `block.span`). Er gilt nur,
   *  solange keine eigene Breite gesetzt ist. */
  span?: number | null;
};

/** Die CSS-Eigenschaften des RAHMENS (das äußere `div` eines Blocks) auf einem
 *  Gerät. Alles, was dieser Block je Gerät anders aussehen lassen kann. */
export function rahmenStil(
  settings: Roh,
  geraet: Geraet,
  opt: StilOptionen = {},
): Eigenschaften {
  const d = darstellungFuer(settings, geraet);
  const e: Eigenschaften = {};

  // Hintergrund: Grundfassung (0432), dann die Füllung des Inspektors darüber.
  Object.assign(e, altbestandCss(altbestandLesen(settings)));
  if (d.stil?.fuellung) Object.assign(e, fuellungCss(d.stil.fuellung));

  // Abstände (nur gesetzte Werte — ein fehlender ist nicht 0, Wurzel 1).
  for (const [feld, css] of [
    ["margin_top", "margin-top"],
    ["margin_right", "margin-right"],
    ["margin_bottom", "margin-bottom"],
    ["margin_left", "margin-left"],
    ["padding_top", "padding-top"],
    ["padding_right", "padding-right"],
    ["padding_bottom", "padding-bottom"],
    ["padding_left", "padding-left"],
  ] as const) {
    const wert = d[feld];
    if (wert) e[css] = wert;
  }

  // Größe: die flachen Felder von 28.08.2026, dann der Inspektor darüber.
  if (d.min_hoehe != null && d.min_hoehe > 0) e["min-height"] = `${d.min_hoehe}px`;
  if (d.max_breite != null && d.max_breite > 0) {
    e["max-width"] = `${d.max_breite}px`;
    // Ohne Zentrierung klebte eine begrenzte Spur am linken Rand.
    e["margin-inline"] = "auto";
  }
  if (opt.span != null && !d.groesse?.breite) {
    e["flex-basis"] = `${(opt.span / 12) * 100}%`;
  }
  // Framer „Columns/Rows Span": das Element belegt mehrere Rasterfelder. Es
  // wirkt nur, wenn der Elternteil wirklich ein Raster ist — steht dort keines,
  // ignoriert CSS die Zeile, und das Panel zeigt sie erst gar nicht.
  if (d.raster_span_x != null) e["grid-column"] = `span ${d.raster_span_x}`;
  if (d.raster_span_y != null) e["grid-row"] = `span ${d.raster_span_y}`;
  const g = d.groesse;
  if (g) {
    if (g.breite) Object.assign(e, massCss(g.breite, "breite"));
    if (g.hoehe) Object.assign(e, massCss(g.hoehe, "hoehe"));
    if (g.min_breite) e["min-width"] = g.min_breite;
    if (g.max_breite) e["max-width"] = g.max_breite;
    if (g.min_hoehe) e["min-height"] = g.min_hoehe;
    if (g.max_hoehe) e["max-height"] = g.max_hoehe;
    if (g.seitenverhaeltnis) e["aspect-ratio"] = g.seitenverhaeltnis.replace(/\s*\/\s*/, " / ");
  }

  // Position.
  const p = d.position;
  if (p?.typ) {
    e.position = POSITION_CSS[p.typ];
    if (p.typ !== "relativ") {
      for (const seite of ["oben", "rechts", "unten", "links"] as const) {
        const wert = p[seite];
        if (wert) e[SEITE_CSS[seite]] = wert;
      }
    }
  }
  if (p?.ebene != null) e["z-index"] = String(p.ebene);

  // Stile.
  const s = d.stil;
  if (s) {
    if (s.opazitaet != null) e.opacity = String(s.opazitaet);
    if (s.sichtbar === false) {
      if (opt.editor) e.opacity = "0.4";
      else e.display = "none";
    }
    if (s.ueberlauf) e.overflow = UEBERLAUF_CSS[s.ueberlauf];
    if (s.radius) {
      const r = s.radius;
      if (r.alle != null) e["border-radius"] = `${r.alle}px`;
      else {
        e["border-radius"] =
          `${r.oben_links ?? 0}px ${r.oben_rechts ?? 0}px ` +
          `${r.unten_rechts ?? 0}px ${r.unten_links ?? 0}px`;
      }
    }
    if (s.grenze) {
      const b = s.grenze;
      const wert = `${b.breite}px ${b.art ?? "solid"} ${farbeCss(b.farbe)}`;
      if (b.seiten?.length) {
        for (const seite of b.seiten) e[`border-${SEITE_CSS[seite]}`] = wert;
      } else e.border = wert;
    }
    if (s.schatten?.length) {
      e["box-shadow"] = s.schatten
        .map(
          (sch) =>
            `${sch.innen ? "inset " : ""}${sch.x ?? 0}px ${sch.y ?? 0}px ` +
            `${sch.weich ?? 0}px ${sch.ausbreitung ?? 0}px ${farbeCss(sch.farbe)}`,
        )
        .join(", ");
    }
  }

  if (s) {
    if (s.mischmodus && s.mischmodus !== "normal") e["mix-blend-mode"] = s.mischmodus;
    if (s.filter) {
      const f = s.filter;
      const fx: string[] = [];
      if (f.weichzeichnen) fx.push(`blur(${f.weichzeichnen}px)`);
      if (f.helligkeit != null && f.helligkeit !== 100) fx.push(`brightness(${f.helligkeit}%)`);
      if (f.kontrast != null && f.kontrast !== 100) fx.push(`contrast(${f.kontrast}%)`);
      if (f.saettigung != null && f.saettigung !== 100) fx.push(`saturate(${f.saettigung}%)`);
      if (f.graustufen) fx.push(`grayscale(${f.graustufen}%)`);
      if (fx.length) e.filter = fx.join(" ");
    }
    if (s.ueberlauf_x) e["overflow-x"] = UEBERLAUF_CSS[s.ueberlauf_x];
    if (s.ueberlauf_y) e["overflow-y"] = UEBERLAUF_CSS[s.ueberlauf_y];
    if (s.zeiger_ereignisse === false && !opt.editor) e["pointer-events"] = "none";
    if (s.text_auswahl === false) e["user-select"] = "none";
    if (s.tippfarbe) e["-webkit-tap-highlight-color"] = farbeCss(s.tippfarbe);
    // Framer „Styles+ › Mask": ein Verlauf als Maske. `-webkit-` daneben, weil
    // Safari die Kurzform bis heute nur mit Präfix kennt — ohne sie bliebe die
    // Maske dort einfach aus, und niemand sähe warum.
    if (s.maske) {
      const m = s.maske;
      const [a, b] = m.umkehren ? ["transparent", "black"] : ["black", "transparent"];
      const stufen = `${a} ${m.start}%, ${b} ${m.ende}%`;
      const bild =
        m.art === "radial"
          ? `radial-gradient(circle, ${stufen})`
          : `linear-gradient(${m.winkel}deg, ${stufen})`;
      e["mask-image"] = bild;
      e["-webkit-mask-image"] = bild;
    }
  }

  // Transform.
  const t = d.transform;
  if (t) {
    const teile: string[] = [];
    if (t.versatz_x || t.versatz_y) {
      teile.push(`translate(${t.versatz_x ?? "0px"}, ${t.versatz_y ?? "0px"})`);
    }
    if (t.tiefe) teile.push(`translateZ(${t.tiefe}px)`);
    if (t.rotation) teile.push(`rotate(${t.rotation}deg)`);
    if (t.rotation_x) teile.push(`rotateX(${t.rotation_x}deg)`);
    if (t.rotation_y) teile.push(`rotateY(${t.rotation_y}deg)`);
    if (t.skalierung != null && t.skalierung !== 1) teile.push(`scale(${t.skalierung})`);
    if (t.neigung_x || t.neigung_y) {
      teile.push(`skew(${t.neigung_x ?? 0}deg, ${t.neigung_y ?? 0}deg)`);
    }
    if (teile.length) e.transform = teile.join(" ");
    if (t.ursprung) e["transform-origin"] = t.ursprung;
    if (t.perspektive) e.perspective = `${t.perspektive}px`;
    if (t.rueckseite) e["backface-visibility"] = t.rueckseite === "verborgen" ? "hidden" : "visible";
    if (t.raum_3d) e["transform-style"] = "preserve-3d";
  }

  // Cursor (nicht je Gerät) — im Editor nicht, dort zeigt der Zeiger die
  // Auswahl. Ein eigenes Bild (Framer „Custom Cursor") gewinnt; der Web-Cursor
  // steht dahinter als Rückfall, falls der Browser das Bild verweigert (zu
  // groß, nicht geladen) — ohne ihn hätte das Element gar keinen Zeiger.
  const cursor = cursorLesen(settings);
  const cursorBild = cursorBildLesen(settings);
  if (!opt.editor) {
    if (cursorBild) e.cursor = `url("${cursorBild.url}") ${cursorBild.x} ${cursorBild.y}, ${cursor ?? "auto"}`;
    else if (cursor) e.cursor = cursor;
  }

  // Scroll-Anker: Abstand zur festen Kopfzeile beim Anspringen.
  const sc = scrollLesen(settings);
  if (sc?.versatz_y) e["scroll-margin-top"] = `${sc.versatz_y}px`;

  // Framer „Drag"/„Ticker": beide brauchen einen Raum, in dem sich etwas
  // bewegt. `touch-action` verhindert, dass das Telefon beim Ziehen scrollt.
  const ef = effekteLesen(settings);
  if (ef?.ziehen && !opt.editor) {
    e["touch-action"] = ef.ziehen.frei ? "none" : ef.ziehen.achse === "x" ? "pan-y" : "pan-x";
    e["user-select"] = "none";
  }
  if (ef?.ticker) {
    e.overflow = "hidden";
    e["white-space"] = "nowrap";
  }

  // ZULETZT die Codeüberschreibung (Framer „Code Overrides"): sie ist die
  // Ausnahme, die der Kunde ausdrücklich hingeschrieben hat, und muss deshalb
  // die Zeilen des Inspektors schlagen — in derselben Regel gewinnt die letzte.
  const code = codeLesen(settings);
  if (code) Object.assign(e, code);

  return e;
}

/** Die CSS-Eigenschaften der KINDERREIHE (das Flex-`div`, das die Kinder eines
 *  Containers hält) auf einem Gerät — die Karte `Layout`. */
export function layoutStil(settings: Roh, geraet: Geraet): Eigenschaften {
  const d = darstellungFuer(settings, geraet);
  const e: Eigenschaften = {};
  if (d.layout_richtung === "zeile") e["flex-direction"] = "row";
  else if (d.layout_richtung === "spalte") e["flex-direction"] = "column";
  if (d.layout_verteilen) e["justify-content"] = JUSTIFY[d.layout_verteilen];
  if (d.layout_ausrichten) e["align-items"] = ALIGN[d.layout_ausrichten];
  if (d.layout_umbruch === true) e["flex-wrap"] = "wrap";
  else if (d.layout_umbruch === false) e["flex-wrap"] = "nowrap";
  if (d.layout_abstand != null) e.gap = `${d.layout_abstand}px`;
  // Framer „Grid": Raster statt Stapel. `display:grid` schlägt die Flex-Klasse
  // des Renderers (Regel außerhalb der Layer).
  if (d.layout_typ === "raster") {
    e.display = "grid";
    e["grid-template-columns"] = `repeat(${d.raster_spalten ?? 2}, minmax(0, 1fr))`;
    if (d.raster_zeilen) e["grid-template-rows"] = `repeat(${d.raster_zeilen}, auto)`;
    if (d.raster_abstand_x != null || d.raster_abstand_y != null) {
      e.gap = `${d.raster_abstand_y ?? d.layout_abstand ?? 0}px ${d.raster_abstand_x ?? d.layout_abstand ?? 0}px`;
    }
  } else if (d.layout_typ === "stapel") {
    e.display = "flex";
  }
  return e;
}

// --- Teile eines Bausteins (06.09.2026) --------------------------------------
//
// „jeder text und bild und alles ist eine einzelne Funktion, die individuell
// einzeln gestaltbar ist" (Auftrag 06.09.2026). Ein Teil steht in
// `settings.teile.<feld>` und trägt DIESELBE Struktur wie ein ganzer Block —
// deshalb rechnen hier dieselben Funktionen, nur mit einem anderen Selektor.
//
// Der Feldname ist der, den der Renderer ohnehin an die Stelle schreibt
// (`data-feld`), also die Verbindung zwischen Inhalt, Editor und Stil.

/** Die Namen der Teile, die dieser Block gestaltet. */
export function teileVon(settings: Roh): string[] {
  const t = objekt(settings.teile);
  if (!t) return [];
  return Object.keys(t).filter((k) => /^[a-z][a-z0-9_]{0,39}$/.test(k) && objekt(t[k]));
}

/** Der CSS-Selektor eines Teils, RELATIV zum Baustein.
 *
 *  Zwei Formen, beide aus der Messung bei Framer (06.09.2026), wo jede Kiste
 *  eine eigene Ebene ist:
 *
 *  * ein FELDNAME (`heading`, `cta_label`) — der Renderer schreibt ihn als
 *    `data-feld` an die Stelle. Er überlebt jeden Umbau des Markups, solange
 *    das Feld bleibt, und ist deshalb die bevorzugte Form.
 *  * ein PFAD aus Kind-Nummern (`c1_3_2`) für alles andere: die dritte Kiste
 *    im ersten Kind, und darin die zweite. Er trifft jedes Element des
 *    Bausteins — auch die, die kein Feld tragen (Rahmen, Stapel, Raster).
 *
 *  Ein Pfad hängt am Aufbau des Markups: ändert der Renderer die
 *  Verschachtelung eines Bausteins, zeigt eine gespeicherte Einstellung
 *  woandershin. Deshalb der Feldname, wo es einen gibt — und deshalb steht
 *  hier keine dritte Form. */
export function teilSelektor(feld: string): string | null {
  if (/^c[0-9_]+$/.test(feld)) {
    const teile = feld.slice(1).split("_").filter(Boolean);
    if (!teile.length || teile.some((n) => !/^[0-9]{1,3}$/.test(n))) return null;
    return teile.map((n) => `> :nth-child(${n})`).join(" ");
  }
  if (/^[a-z][a-z0-9_]{0,39}$/.test(feld)) return `[data-feld="${feld}"]`;
  return null;
}

/** Die Settings EINES Teils — leer, wenn es ihn nicht gibt.
 *
 *  Ein Teil hat KEINE eigenen Teile: die Verschachtelung endet nach einer
 *  Stufe. Das ist nicht nur fachlich richtig (ein Textstück hat keine
 *  Textstücke), sondern die Abbruchbedingung der Rekursion in `stilCss` — ohne
 *  sie könnte eine tief verschachtelte Zeile in der Datenbank den Renderer
 *  beschäftigen, bis nichts mehr geht (Wurzel 8). Das Backend weist sie
 *  ebenfalls ab; hier steht der Gürtel zum Hosenträger, weil in der Datenbank
 *  Zeilen stehen, die älter sind als jede Prüfung. */
export function teilSettings(settings: Roh, feld: string): Roh {
  const o = objekt(objekt(settings.teile)?.[feld]);
  if (!o) return {};
  const { teile: _weg, ...rest } = o;
  return rest;
}

/** Neue Settings mit einem geänderten TEIL. `null` löscht ihn. */
export function mitTeil(settings: Roh, feld: string, teil: Roh | null): Roh {
  return ohneLeere(pfadSetzen(settings, ["teile", feld], teil));
}

/** Die Schriftfamilien, die ein Block auf IRGENDEINEM Gerät benutzt.
 *
 *  Der Renderer lädt genau diese nach: eine im Panel gewählte Schrift, deren
 *  Stylesheet niemand anfordert, steht beim Gast im Fallback — die Einstellung
 *  wäre unsichtbar, und zwar nur auf der Live-Seite (im Editor ist die Familie
 *  meist schon vom Design-Panel geladen). Genau diese Klasse Fehler ist bei
 *  Firmenname und Slogan schon einmal passiert (`builder/lib/theme.ts`). */
export function schriftfamilienVon(settings: Roh): Schriftfamilie[] {
  const menge = new Set<Schriftfamilie>();
  for (const g of GERAETE) {
    const f = darstellungFuer(settings, g).text?.schriftfamilie;
    if (f) menge.add(f);
  }
  return [...menge];
}

/** Hat der Container auf IRGENDEINEM Gerät eine Layout-Angabe? Nur dann wird
 *  seine Kinderreihe ein Flex-Container — sonst bleibt der bisherige Zustand. */
export function hatLayout(settings: Roh): boolean {
  return GERAETE.some((g) => Object.keys(layoutStil(settings, g)).length > 0);
}

/** Braucht der Elternteil `position: relative`, weil ein Kind absolut liegt? */
export function brauchtBezug(kinderSettings: readonly Roh[]): boolean {
  return kinderSettings.some((k) =>
    GERAETE.some((g) => darstellungFuer(k, g).position?.typ === "absolut"),
  );
}

function regel(selektor: string, e: Eigenschaften): string {
  const zeilen = Object.entries(e).map(([k, v]) => `${k}:${v}`);
  return zeilen.length ? `${selektor}{${zeilen.join(";")}}` : "";
}

/** Nur die Unterschiede zur breiteren Stufe — was dort galt und hier fehlt,
 *  wird ausdrücklich zurückgesetzt. */
function unterschied(vorher: Eigenschaften, jetzt: Eigenschaften): Eigenschaften {
  const d: Eigenschaften = {};
  for (const [k, v] of Object.entries(jetzt)) if (vorher[k] !== v) d[k] = v;
  for (const k of Object.keys(vorher)) if (!(k in jetzt)) d[k] = "unset";
  return d;
}

/** Das komplette CSS eines Blocks: Grundregel (Desktop) plus je eine
 *  Media-Query für Tablet und Mobil mit den Unterschieden. Leer, wenn der
 *  Block nichts einstellt — dann schreibt der Renderer kein `<style>`.
 *
 *  Desktop-first (`max-width`), weil die Kaskade so läuft; die Grenzen sind
 *  `GERAETE_BEREICHE`. Die Regeln liegen außerhalb jeder `@layer` und schlagen
 *  damit jede Tailwind-Klasse des Renderers, egal welche Spezifität. */
export function stilCss(
  settings: Roh,
  selektoren: { rahmen: string; layout?: string; text?: string },
  opt: StilOptionen = {},
): string {
  const teile: string[] = [];
  const stufen: Array<{ geraet: Geraet; medien: string | null }> = [
    { geraet: "desktop", medien: null },
    { geraet: "tablet", medien: `(max-width:${GERAETE_BEREICHE.tablet.max}px)` },
    { geraet: "mobil", medien: `(max-width:${GERAETE_BEREICHE.mobil.max}px)` },
  ];
  let rahmenVorher: Eigenschaften = {};
  let layoutVorher: Eigenschaften = {};
  let textVorher: Eigenschaften = {};
  for (const { geraet, medien } of stufen) {
    const rahmen = rahmenStil(settings, geraet, opt);
    const layout = selektoren.layout ? layoutStil(settings, geraet) : {};
    const textE = selektoren.text ? textStil(settings, geraet) : {};
    const regeln = [
      regel(selektoren.rahmen, medien ? unterschied(rahmenVorher, rahmen) : rahmen),
      selektoren.layout
        ? regel(selektoren.layout, medien ? unterschied(layoutVorher, layout) : layout)
        : "",
      selektoren.text ? regel(selektoren.text, medien ? unterschied(textVorher, textE) : textE) : "",
    ]
      .filter(Boolean)
      .join("");
    if (regeln) teile.push(medien ? `@media ${medien}{${regeln}}` : regeln);
    rahmenVorher = rahmen;
    layoutVorher = layout;
    textVorher = textE;
  }
  // Die TEILE des Bausteins: jeder mit seinem eigenen Selektor
  // (`… [data-feld="heading"]`) und derselben Kaskade. Der Text eines Teils
  // wirkt auf das Element selbst, nicht auf Nachfahren — ein Teil IST die
  // Textstelle.
  for (const feld of teileVon(settings)) {
    const rel = teilSelektor(feld);
    if (!rel) continue;
    const eigen = teilSettings(settings, feld);
    const wahl = `${selektoren.rahmen} ${rel}`;
    const css = stilCss(eigen, { rahmen: wahl, text: wahl }, opt);
    if (css) teile.push(css);
  }

  const ef = effekteCss(settings, selektoren.rahmen, opt);
  if (ef) teile.push(ef);
  const aus = auswahlCss(settings, selektoren.rahmen);
  if (aus) teile.push(aus);
  const ov = overlayCss(settings, selektoren.rahmen, opt);
  if (ov) teile.push(ov);
  if (!teile.length) return "";
  // Im Editor steht davor, welche Geräte eigene Werte tragen — die Diagnose,
  // die man in den DevTools sieht, ohne die Datenbank zu öffnen.
  const kopf = opt.editor
    ? `/* ${selektoren.rahmen}: desktop${geraeteMitUeberschreibung(settings)
        .map((g) => `+${g}`)
        .join("")} */`
    : "";
  return kopf + teile.join("");
}

/** Die HTML-Attribute des Rahmens, die aus den Settings kommen: Element, Anker,
 *  Aria. Getrennt vom CSS, weil sie nicht je Gerät gelten. */
export function rahmenAttribute(
  settings: Roh,
  optionen: {
    /** false = ein Link am Element wird NICHT angewandt (Bausteine mit
     *  eigenen Links/Formularen: ein `<a>` um ein `<form>` ist ungültig). */
    linkErlaubt?: boolean;
    /** true = Editor-iframe: keine Erscheinen-/Tempo-Marker. */
    editor?: boolean;
  } = {},
): {
  tag: A11yTag | "a";
  id?: string;
  href?: string;
  target?: "_blank";
  rel?: string;
  "aria-label"?: string;
  tabIndex?: number;
  "aria-hidden"?: true;
  "data-nosnippet"?: "";
  "data-erscheinen"?: string;
  "data-scroll-tempo"?: string;
  "data-effekt-wiederholen"?: "";
  "data-ziehen"?: string;
  "data-ziehen-zurueck"?: "";
  "data-lichtkasten"?: string;
  "data-ticker-lauf"?: string;
  "data-scroll-transform"?: string;
  "data-scrollen"?: string;
  "data-ereignis"?: string;
  "data-overlay-ausloeser"?: string;
  "data-overlay-schliessen"?: string;
} {
  const a = a11yLesen(settings);
  const sc = scrollLesen(settings);
  const link = optionen.linkErlaubt === false ? undefined : linkLesen(settings);
  return {
    // Ein Link macht das Element zum `<a>` — Framer verlinkt so jedes Frame.
    tag: link ? "a" : (a?.tag ?? "div"),
    ...(link ? { href: linkZiel(link) } : {}),
    ...(link?.neuer_tab ? { target: "_blank" as const } : {}),
    ...(link && linkRel(link) ? { rel: linkRel(link) } : {}),
    // Framer „Scrollen": sanft oder sofort beim Sprung auf einen Anker. CSS
    // kennt das nur global (`scroll-behavior` an der Wurzel), deshalb ein
    // Marker fürs Live-Skript — der Link bleibt ein normaler Link.
    ...(link?.scrollen && optionen.editor !== true ? { "data-scrollen": link.scrollen } : {}),
    // Framer „Tracking": der Klick meldet dieses Ereignis an das Google-Tag.
    ...(link?.tracking && optionen.editor !== true ? { "data-ereignis": link.tracking } : {}),
    ...(sc ? { id: sc.anker } : {}),
    ...(a?.label ? { "aria-label": a.label } : {}),
    ...(a?.tab_index != null ? { tabIndex: a.tab_index } : {}),
    ...(a?.fuer_leser_verborgen ? { "aria-hidden": true as const } : {}),
    ...(a?.nosnippet ? { "data-nosnippet": "" as const } : {}),
    ...effektAttribute(settings, optionen.editor === true),
    ...overlayAttribute(settings, optionen.editor === true),
  };
}

/** Die Marker des Overlays für das Live-Skript (Klick öffnet/schließt).
 *  Bei `hover` reicht CSS — dann steht hier nichts. Im Editor gar nichts: dort
 *  ist der Kasten immer offen, damit man ihn bearbeiten kann. */
function overlayAttribute(
  settings: Roh,
  editor: boolean,
): { "data-overlay-ausloeser"?: string; "data-overlay-schliessen"?: string } {
  if (editor) return {};
  const o = overlayLesen(settings);
  if (!o || o.ausloeser !== "klick") return {};
  return { "data-overlay-ausloeser": "klick", "data-overlay-schliessen": o.schliessen };
}

/** Die Daten-Attribute, an denen das Live-Skript (`effekte.tsx` im Renderer)
 *  Erscheinen und Scroll-Tempo erkennt. Im Editor NICHT: dort sähe der Kunde
 *  einen unsichtbaren Baustein, der erst beim Scrollen erscheint. */
function effektAttribute(
  settings: Roh,
  editor: boolean,
): {
  "data-erscheinen"?: string;
  "data-scroll-tempo"?: string;
  "data-effekt-wiederholen"?: "";
  "data-ziehen"?: string;
  "data-ziehen-zurueck"?: "";
  "data-lichtkasten"?: string;
  "data-ticker-lauf"?: string;
  "data-scroll-transform"?: string;
} {
  if (editor) return {};
  const ef = effekteLesen(settings);
  if (!ef) return {};
  return {
    ...(ef.erscheinen ? { "data-erscheinen": ef.erscheinen.art } : {}),
    ...(ef.erscheinen?.wiederholen ? { "data-effekt-wiederholen": "" as const } : {}),
    ...(ef.scroll_tempo != null && ef.scroll_tempo !== 100
      ? { "data-scroll-tempo": String(ef.scroll_tempo) }
      : {}),
    // Ziehen: die erlaubte Achse steht im Wert („frei", „x", „y").
    ...(ef.ziehen
      ? { "data-ziehen": ef.ziehen.frei ? "frei" : (ef.ziehen.achse ?? "frei") }
      : {}),
    ...(ef.ziehen?.zurueck ? { "data-ziehen-zurueck": "" as const } : {}),
    // Lichtkasten: die Maße reisen als JSON mit, damit das Skript sie ohne
    // zweiten Datenweg kennt (es sieht nur das DOM).
    ...(ef.lichtkasten
      ? {
          "data-lichtkasten": JSON.stringify({
            b: ef.lichtkasten.max_breite,
            p: ef.lichtkasten.innenabstand,
            z: ef.lichtkasten.ebene,
            g: farbeCss(ef.lichtkasten.hintergrund),
          }),
        }
      : {}),
    ...(ef.ticker
      ? {
          "data-ticker-lauf": `${ef.ticker.richtung}:${ef.ticker.tempo}:${ef.ticker.ziehbar ? 1 : 0}`,
        }
      : {}),
    ...(ef.scroll_transform
      ? {
          "data-scroll-transform": JSON.stringify({
            a: ef.scroll_transform.ausloeser,
            v: ef.scroll_transform.von ?? null,
            n: ef.scroll_transform.nach ?? null,
          }),
        }
      : {}),
  };
}

/** Die Keyframes und Ruhezustände der Effekte — EINMAL je Seite einbinden. */
export const EFFEKTE_KEYFRAMES =
  "@keyframes bk-pulsieren{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}" +
  "@keyframes bk-schweben{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}" +
  "@keyframes bk-drehen{from{transform:rotate(0)}to{transform:rotate(360deg)}}" +
  "@keyframes bk-wippen{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}" +
  "[data-erscheinen]:not([data-erschienen]){opacity:0}" +
  "[data-erscheinen=hochgleiten]:not([data-erschienen]){transform:translateY(24px)}" +
  "[data-erscheinen=vergroessern]:not([data-erschienen]){transform:scale(.92)}" +
  "[data-erscheinen=von_links]:not([data-erschienen]){transform:translateX(-32px)}" +
  "[data-erscheinen=von_rechts]:not([data-erschienen]){transform:translateX(32px)}" +
  // Framer „Ticker": das Band läuft um die halbe Strecke, weil der Inhalt
  // einmal verdoppelt im DOM steht — so entsteht die Endlosschleife ohne Sprung.
  "@keyframes bk-ticker-links{from{translate:0}to{translate:-50% 0}}" +
  "@keyframes bk-ticker-rechts{from{translate:-50% 0}to{translate:0}}" +
  "@keyframes bk-ticker-oben{from{translate:0}to{translate:0 -50%}}" +
  "@keyframes bk-ticker-unten{from{translate:0 -50%}to{translate:0}}" +
  "[data-ticker]{display:flex;gap:inherit;width:max-content;will-change:translate}" +
  "[data-ticker-senkrecht]{flex-direction:column;width:auto;height:max-content}" +
  // Framer „Lightbox": der Kasten über allem. Er steht im `<dialog>`, das der
  // Browser selbst über die Seite legt — Fokusfalle und Escape kommen mit.
  "dialog[data-lichtkasten]{border:0;padding:0;max-width:100vw;max-height:100vh;background:transparent}" +
  "dialog[data-lichtkasten]::backdrop{background:var(--bk-lichtkasten-grund,#000000)}" +
  "dialog[data-lichtkasten] img{display:block;max-width:100%;max-height:90vh;object-fit:contain}" +
  "@media (prefers-reduced-motion:reduce){[data-erscheinen]{opacity:1!important;transform:none!important;transition:none!important}[data-schleife],[data-ticker]{animation:none!important}}";

function hoverCss(h: EffektHover): Eigenschaften {
  const e: Eigenschaften = {};
  const teile: string[] = [];
  if (h.versatz_x || h.versatz_y) teile.push(`translate(${h.versatz_x ?? "0px"}, ${h.versatz_y ?? "0px"})`);
  if (h.rotation) teile.push(`rotate(${h.rotation}deg)`);
  if (h.skalierung != null && h.skalierung !== 1) teile.push(`scale(${h.skalierung})`);
  if (teile.length) e.transform = teile.join(" ");
  if (h.opazitaet != null) e.opacity = String(h.opazitaet);
  return e;
}

/** Die CSS-Regeln der Effekte eines Blocks: Übergang und Zielzustand für Hover
 *  und Press, Dauerbewegung für Loop, Übergang des Erscheinens. Ohne Effekte
 *  leer. Im Editor nur Hover/Press (Erscheinen und Tempo sind Live-Skript). */
export function effekteCss(settings: Roh, selektor: string, opt: StilOptionen = {}): string {
  const ef = effekteLesen(settings);
  if (!ef) return "";
  const teile: string[] = [];
  const dauern = [ef.hover?.dauer, ef.druck?.dauer].filter((x): x is number => x != null);
  const grund: Eigenschaften = {};
  if (dauern.length) {
    const d = Math.max(...dauern);
    grund.transition = `transform ${d}ms ease, opacity ${d}ms ease`;
  }
  if (ef.erscheinen && !opt.editor) {
    const er = ef.erscheinen;
    grund.transition =
      `${grund.transition ? grund.transition + ", " : ""}` +
      `opacity ${er.dauer}ms ease ${er.verzoegerung}ms, transform ${er.dauer}ms ease ${er.verzoegerung}ms`;
  }
  if (ef.schleife && !opt.editor) {
    grund.animation = `bk-${ef.schleife.art} ${ef.schleife.dauer}ms ease-in-out infinite`;
  }
  if (ef.ziehen?.zurueck && !opt.editor) {
    // Framer „Snap Back": das Element federt zurück, sobald man loslässt. Der
    // Übergang liegt am Element und wird vom Live-Skript beim Ziehen
    // ausgeschaltet (`data-zieht`) — sonst hinkte es dem Zeiger hinterher.
    grund.transition = `${grund.transition ? grund.transition + ", " : ""}translate 300ms ease`;
  }
  if (Object.keys(grund).length) teile.push(regel(selektor, grund));
  if (ef.hover) teile.push(regel(`${selektor}:hover`, hoverCss(ef.hover)));
  if (ef.druck) teile.push(regel(`${selektor}:active`, hoverCss(ef.druck)));
  if (ef.ziehen && !opt.editor) {
    teile.push(regel(`${selektor}[data-zieht]`, { transition: "none", cursor: "grabbing" }));
  }
  if (ef.ticker && !opt.editor) {
    // Die DAUER kommt vom Live-Skript (`--bk-ticker-dauer`), weil sie von der
    // gemessenen Breite abhängt; hier steht nur, was ohne Messung gilt.
    teile.push(
      regel(`${selektor} [data-ticker]`, {
        animation: `bk-ticker-${ef.ticker.richtung} var(--bk-ticker-dauer, 20s) linear infinite`,
      }),
    );
    if (ef.ticker.hover === "stopp") {
      teile.push(regel(`${selektor}:hover [data-ticker]`, { "animation-play-state": "paused" }));
    } else if (ef.ticker.hover === "langsamer") {
      teile.push(
        regel(`${selektor}:hover [data-ticker]`, {
          "animation-duration": "calc(var(--bk-ticker-dauer, 20s) * 3)",
        }),
      );
    }
  }
  if (ef.lichtkasten && !opt.editor) {
    teile.push(regel(`${selektor} img`, { cursor: "zoom-in" }));
  }
  return teile.join("");
}

/** Framer „Overlays" (Vollerfassung §9): Lage und Sichtbarkeit des Kastens.
 *
 *  Der Kasten steht als `[data-overlay]` IM Element (der Renderer schreibt ihn
 *  dorthin). Ausgeblendet ist er über `display:none` und nicht über `opacity`:
 *  ein durchsichtiger Kasten fängt weiterhin Klicks und liegt über dem, was
 *  darunter steht.
 *
 *  Im EDITOR steht er offen da — ein Popover, das man auf der Fläche nicht
 *  sieht, lässt sich auch nicht bearbeiten. */
function overlayCss(settings: Roh, selektor: string, opt: StilOptionen = {}): string {
  const o = overlayLesen(settings);
  if (!o) return "";
  const kasten: Eigenschaften = {
    position: o.typ === "fixiert" ? "fixed" : "absolute",
    "z-index": "50",
    display: "none",
  };
  if (o.breite) kasten.width = `${o.breite}px`;
  if (o.typ === "fixiert") {
    kasten.top = "50%";
    kasten.left = "50%";
    kasten.translate = `-50% -50%`;
  } else {
    // Die vier Lagen: der Kasten hängt an einer Kante des Elements, quer dazu
    // ausgerichtet. `translate` verschiebt ihn um den eingestellten Versatz.
    const quer = o.ausrichten === "start" ? "0" : o.ausrichten === "ende" ? "auto" : "50%";
    if (o.position === "unten" || o.position === "oben") {
      kasten[o.position === "unten" ? "top" : "bottom"] = "100%";
      if (o.ausrichten === "mitte") {
        kasten.left = "50%";
        kasten.translate = `calc(-50% + ${o.versatz_x}px) ${o.position === "unten" ? "" : "-"}${o.versatz_y}px`;
      } else {
        kasten[o.ausrichten === "start" ? "left" : "right"] = quer === "auto" ? "0" : quer;
        kasten.translate = `${o.versatz_x}px ${o.position === "unten" ? "" : "-"}${o.versatz_y}px`;
      }
    } else {
      kasten[o.position === "rechts" ? "left" : "right"] = "100%";
      if (o.ausrichten === "mitte") {
        kasten.top = "50%";
        kasten.translate = `${o.position === "rechts" ? "" : "-"}${o.versatz_x}px calc(-50% + ${o.versatz_y}px)`;
      } else {
        kasten[o.ausrichten === "start" ? "top" : "bottom"] = quer === "auto" ? "0" : quer;
        kasten.translate = `${o.position === "rechts" ? "" : "-"}${o.versatz_x}px ${o.versatz_y}px`;
      }
    }
  }
  const teile = [
    // Ein relativ liegendes Overlay braucht seinen Bezug am Element.
    o.typ === "relativ" ? regel(selektor, { position: "relative" }) : "",
    regel(`${selektor} > [data-overlay]`, kasten),
    regel(`${selektor} > [data-overlay][data-offen]`, { display: "block" }),
  ];
  if (o.ausloeser === "hover" && !opt.editor) {
    teile.push(regel(`${selektor}:hover > [data-overlay]`, { display: "block" }));
  }
  if (opt.editor) {
    teile.push(regel(`${selektor} > [data-overlay]`, { display: "block" }));
  }
  return teile.filter(Boolean).join("");
}

/** Framer „Selection" (Vollerfassung §7): die Farben der Textmarkierung.
 *  EIGENE Regel, weil `::selection` ein Pseudo-Element ist — es lässt sich
 *  nicht in die Rahmenregel schreiben. */
function auswahlCss(settings: Roh, selektor: string): string {
  const s = darstellungFuer(settings, "desktop").stil;
  if (!s?.auswahl_farbe && !s?.auswahl_hintergrund) return "";
  const e: Eigenschaften = {};
  if (s.auswahl_farbe) e.color = farbeCss(s.auswahl_farbe);
  if (s.auswahl_hintergrund) e["background-color"] = farbeCss(s.auswahl_hintergrund);
  // Beide Schreibweisen: Safari kennt `::selection` an Nachfahren nur mit
  // Präfix, und eine Regel, die dort still ausfällt, sieht aus wie ein Bug.
  return regel(`${selektor} ::selection`, e) + regel(`${selektor} ::-moz-selection`, e);
}

export * from "./regionen";
