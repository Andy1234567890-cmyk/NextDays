// Design-Tokens einer Kunden-Site → CSS-Variablen. EINE Wahrheit für den ganzen
// Renderer.
//
// Warum überhaupt Tokens statt eines Editors, der jede Stelle einzeln bemalt:
// Farbe wird als ROLLE gesetzt („Primärfarbe"), nie an der Anzeigestelle. Damit
// kann der Kunde nichts kaputt machen — jede Sektion liest dieselben Variablen,
// und ein Wert an einer Stelle geändert wirkt konsistent überall.
//
// Fehlt ein Wert, bleibt die Variable UNGESETZT und der Default aus globals.css
// gilt. Es wird KEIN Ersatzwert erfunden (Wurzel 4) — „nicht gesetzt" ist ein
// gültiger Zustand, kein Fehler, und darf nicht als plausible Fantasiefarbe
// erscheinen.
import type { CSSProperties } from "react";

import { fontStack, googleFontsHref } from "./fonts-catalog";
import type { ButtonRadius, SiteBranding, SiteTheme } from "./site-context";

/** Die Theme-Felder aus 0446/0447.
 *
 *  Sie stehen HIER und nicht in `site-context.ts`, obwohl sie fachlich zum
 *  Branding gehören: `site-context` beschreibt die Antwort des öffentlichen
 *  Resolvers und wird von mehreren Bereichen gleichzeitig gepflegt. Die
 *  Theme-Ebene ist als eigener Typ angehängt, damit hier alles beieinander
 *  liegt, was das Theme ausmacht — die Felder selbst kommen mit derselben
 *  JSON-Antwort und sind zur Laufzeit da.
 *
 *  Der Zugriff läuft über `themeFelder()` unten. Das ist genauso typsicher wie
 *  der Rest: `SiteBranding` entsteht ohnehin aus einem `JSON.parse(...) as
 *  SiteBranding` — die Wahrheit über die Form ist die API, nicht der Typ. */
export type Breiteneinheit = "px" | "vw";

/** Ein benannter Eintrag der Designfarben-Palette (0446). */
export type ThemeFarbe = { id: string; name: string; color: string };

/** Text-Rollen wie bei Hostaway: DFLT (alles ohne eigene Zuordnung), PAR (der
 *  Absatz) und H1–H6. */
export const TEXT_ROLLEN = [
  "dflt",
  "par",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
] as const;
export type TextRolle = (typeof TEXT_ROLLEN)[number];

export type TextSchatten = "keiner" | "weich" | "hart";

/** Eine Text-Rolle. Jedes Feld darf fehlen — dann gilt genau das, was der
 *  Renderer ohne diese Rolle tut (Wurzel 1). */
export type TextStil = {
  font?: string | null;
  size_desktop?: number | null;
  size_mobile?: number | null;
  scale_text?: boolean;
  color?: string | null;
  weight?: number | null;
  line_height?: number | null;
  letter_spacing?: number | null;
  uppercase?: boolean;
  shadow?: TextSchatten;
  /** Nur DFLT. */
  link_color?: string | null;
  link_hover_color?: string | null;
  link_visited_color?: string | null;
  link_underline?: boolean | null;
};

type ThemeFelder = {
  content_width_unit?: Breiteneinheit | null;
  content_full_width?: boolean | null;
  section_spacing_y?: number | null;
  section_spacing_x?: number | null;
  theme_colors?: ThemeFarbe[] | null;
  text_styles?: Partial<Record<TextRolle, TextStil>> | null;
};

function themeFelder(branding: SiteBranding): ThemeFelder {
  return branding as SiteBranding & ThemeFelder;
}

/** Welches Skelett gilt, wenn der Kunde nie eines gewählt hat.
 *  Diese Entscheidung gehört in den Renderer, NICHT als DB-Default in die
 *  Spalte: in der DB heißt NULL „nie gewählt", und genau das soll ablesbar
 *  bleiben. Hier ist die schlichteste Variante die richtige Wahl. */
const THEME_WENN_UNGESETZT: SiteTheme = "klar";

export function themeOf(branding: SiteBranding | null | undefined): SiteTheme {
  return branding?.theme ?? THEME_WENN_UNGESETZT;
}

// Button-Eckenform als drei Presets statt eines px-Reglers: der Kunde soll die
// Form wählen, nicht einen Zahlenwert raten. Oval ist die Repo-Vorgabe für
// Buttons, deshalb der Wert, den `pill` liefert.
const RADIUS_REM: Record<ButtonRadius, string> = {
  sharp: "0",
  rounded: "0.625rem",
  pill: "9999px",
};

/** Alle gesetzten Tokens als Inline-CSS-Variablen für <html>.
 *
 *  Hex-Werte kommen aus der DB → sie gehören in eine Inline-Variable, nie in
 *  eine Tailwind-Klasse (Repo-Regel: keine arbitrary Hex-Werte im Markup). */
export function brandStyle(
  branding: SiteBranding | null | undefined,
): CSSProperties {
  const vars: Record<string, string> = {};
  if (!branding) return vars as CSSProperties;

  if (branding.primary_color) {
    vars["--primary"] = branding.primary_color;
    // Der Fokusring folgt der Markenfarbe, sonst leuchtet beim Tabben plötzlich
    // eine fremde Farbe auf.
    vars["--ring"] = branding.primary_color;
    vars["--accent"] = branding.primary_color;
  }
  if (branding.secondary_color) {
    vars["--secondary"] = branding.secondary_color;
    vars["--muted"] = branding.secondary_color;
  }
  if (branding.background_color) {
    vars["--background"] = branding.background_color;
    vars["--card"] = branding.background_color;
  }
  if (branding.foreground_color) {
    vars["--foreground"] = branding.foreground_color;
    vars["--card-foreground"] = branding.foreground_color;
    vars["--secondary-foreground"] = branding.foreground_color;
  }

  const body = fontStack(branding.font_family);
  if (body) vars["--font-sans"] = body;
  const heading = fontStack(branding.heading_font);
  if (heading) vars["--font-display"] = heading;
  const button = fontStack(branding.button_font);
  // Ohne eigene Button-Schrift erbt der Button die Absatz-Schrift — das ist keine
  // Erfindung, sondern das Weglassen einer Sonderregel.
  if (button) vars["--font-button"] = button;

  // --- Eigene Farben für Kopfzeile, Fußzeile, Links, Firmenname (0426) ----
  //
  // Diese Rollen haben KEINEN Rückfall auf eine andere Farbe. Kopf- und
  // Fußzeile lasen vorher den Seitenhintergrund; sobald es eigene Variablen
  // gibt, wäre ein hier gesetzter Ersatzwert eine erfundene Entscheidung. Die
  // Komponenten prüfen deshalb selbst, ob die Variable existiert, und bleiben
  // sonst beim Seitenhintergrund (siehe site-header/site-footer).
  if (branding.header_background) {
    vars["--header-background"] = branding.header_background;
  }
  if (branding.header_link_color) {
    vars["--header-link"] = branding.header_link_color;
  }
  if (branding.footer_background) {
    vars["--footer-background"] = branding.footer_background;
  }
  if (branding.link_color) vars["--link"] = branding.link_color;
  if (branding.brand_name_color) {
    vars["--brand-name"] = branding.brand_name_color;
  }

  // Typografie des Logo-Bereichs. Der Firmenname steht NEBEN dem Logo und muss
  // zu ihm passen, nicht zu den Überschriften im Text — deshalb eine eigene
  // Familie und eine eigene Größe statt der Überschriftenschrift.
  const logoName = fontStack(branding.logo_name_font);
  if (logoName) vars["--font-logo-name"] = logoName;
  if (branding.logo_name_size) {
    // Der Kunde stellt Punkte ein (8–48, wie im Markt üblich); gerendert wird
    // in rem, damit die Systemschriftgröße des Besuchers weiter wirkt.
    vars["--logo-name-size"] = `${branding.logo_name_size / 16}rem`;
  }
  const slogan = fontStack(branding.slogan_font);
  if (slogan) vars["--font-slogan"] = slogan;

  if (branding.button_radius) {
    vars["--button-radius"] = RADIUS_REM[branding.button_radius];
  }
  // --- Breite und Schriftgrößen (0435) ------------------------------------
  // Als CSS-Variablen und nicht als Klassen: die Werte kommen aus der DB, und
  // eine Tailwind-Klasse mit dynamischem Wert (`max-w-[1440px]`) existiert im
  // gebauten CSS nicht — sie fehlt einfach, ohne Fehlermeldung.
  //
  // `NULL` in der DB heißt „nie gewählt": dann wird die Variable NICHT gesetzt,
  // und der Rückfall in globals.css greift. So sieht eine bestehende
  // Kundenseite nach dem Deploy unverändert aus (Wurzel 1).
  // Breite: Einheit und „Full width" kamen mit 0447 dazu.
  //
  // Reihenfolge ist Absicht — `content_full_width` gewinnt über den Zahlenwert,
  // genau wie Hostaways Schalter über dem Regler steht. Ohne eine der beiden
  // Angaben bleibt die Variable UNGESETZT, und die Abschnitte begrenzen sich
  // weiter selbst (Bestand).
  const th = themeFelder(branding);
  if (th.content_full_width) {
    vars["--content-width"] = "100%";
  } else if (branding.content_width) {
    vars["--content-width"] = `${branding.content_width}${th.content_width_unit ?? "px"}`;
  }
  if (branding.heading_scale) {
    // Als Faktor, nicht als Größe: die Überschriften-Stufen stehen in einem
    // gestalteten Verhältnis zueinander. `globals.css` multipliziert damit.
    vars["--heading-scale"] = String(branding.heading_scale / 100);
  }
  if (branding.body_scale) {
    vars["--body-scale"] = String(branding.body_scale / 100);
  }

  // --- Abstand der Abschnitte (0447) --------------------------------------
  // ZUSÄTZLICHER Abstand, kein Ersatz: jeder Abschnitt setzt sein eigenes `py`
  // (der Hero anders als eine Galerie), und dieser Wert kommt oben drauf.
  // Genau dieselbe Bedeutung wie das `padding` je Abschnitt (0432) — sonst
  // müsste der Kunde für jeden Abschnittstyp den richtigen Wert raten, damit
  // es aussieht wie vorher.
  if (th.section_spacing_y != null) {
    vars["--abschnitt-abstand-y"] = `${th.section_spacing_y}px`;
  }
  if (th.section_spacing_x != null) {
    vars["--abschnitt-abstand-x"] = `${th.section_spacing_x}px`;
  }

  // --- Designfarben-Palette (0446) ----------------------------------------
  // Jede benannte Farbe wird zu `--theme-farbe-<id>`. Die neun ROLLEN oben
  // stehen bereits auf ihrem aufgelösten Wert (der Service schreibt ihn beim
  // Speichern durch) — diese Variablen sind für alles, was sich auf eine
  // Nebenfarbe der Marke beziehen will, ohne eine der Rollen zu sein.
  //
  // Die Kennung ist serverseitig auf [a-z0-9_-] beschränkt; hier wird trotzdem
  // gegengeprüft, weil dieser Text unverändert in einen Variablennamen läuft
  // und ein Ausbruch daraus die ganze Style-Angabe kippen würde (Wurzel 8,
  // fail-closed: unbekannte Form → Eintrag fällt weg, nicht „bereinigt").
  for (const farbe of th.theme_colors ?? []) {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(farbe?.id ?? "")) continue;
    if (!/^#[0-9a-fA-F]{6}$/.test(farbe?.color ?? "")) continue;
    vars[`--theme-farbe-${farbe.id}`] = farbe.color;
  }

  // --- Text-Rollen DFLT · PAR · H1–H6 (0447) ------------------------------
  // Die Referenzbreite für „Text skalieren" ist die Breite, in der der Inhalt
  // wirklich steht: die eingestellte, wenn sie in px vorliegt, sonst die
  // breiteste Container-Breite unserer Abschnitte.
  const referenz =
    !th.content_full_width &&
    branding.content_width &&
    (th.content_width_unit ?? "px") === "px"
      ? branding.content_width
      : SKALIER_REFERENZ_PX;
  textRollenVars(th, vars, referenz);

  return vars as CSSProperties;
}

/** Die drei Schatten-Stufen als fertige `text-shadow`-Werte.
 *
 *  Benannte Stufen statt vier Zahlenfeldern: der einzige legitime Zweck des
 *  Effekts ist Lesbarkeit auf einem Foto, und die freie Form ist die häufigste
 *  Art, eine Überschrift unlesbar zu machen. */
const SCHATTEN: Record<TextSchatten, string | null> = {
  keiner: null,
  weich: "0 0.125rem 0.75rem rgba(0,0,0,0.45)",
  hart: "0.125rem 0.125rem 0 rgba(0,0,0,0.35)",
};

/** Referenzbreite für „Text skalieren".
 *
 *  Sie ist KEIN erfundener Wert: 1152 px ist `max-w-6xl`, die breiteste
 *  Container-Breite, die unsere Abschnitte selbst setzen. Hat der Kunde eine
 *  eigene Inhaltsbreite in px gewählt, gilt seine. */
const SKALIER_REFERENZ_PX = 1152;

/** Variablen einer Text-Rolle.
 *
 *  Die Namen sind bewusst so gewählt, dass KEINER Präfix eines anderen ist:
 *  `globals.css` schaltet jede Regel über `[style*="--txt-h1-size"]` frei, und
 *  ein Name, der in einem anderen steckt, würde eine Regel scharf machen, deren
 *  Variable gar nicht gesetzt ist — die Eigenschaft fiele dann auf `unset`
 *  zurück und die Seite sähe kaputt aus. Deshalb `-msize` (Mobil) neben
 *  `-size`, und `lka/lkh/lkv/lku` für die vier Link-Angaben. */
function textRollenVars(
  th: ThemeFelder,
  vars: Record<string, string>,
  referenzBreite: number,
): void {
  const stile = th.text_styles ?? {};
  for (const rolle of TEXT_ROLLEN) {
    const stil = stile[rolle];
    if (!stil) continue;
    const praefix = `--txt-${rolle}`;

    const schrift = fontStack(stil.font);
    if (schrift) vars[`${praefix}-font`] = schrift;
    if (stil.color) vars[`${praefix}-color`] = stil.color;
    if (stil.weight) vars[`${praefix}-weight`] = String(stil.weight);
    if (stil.line_height) vars[`${praefix}-lh`] = String(stil.line_height);
    if (stil.letter_spacing != null) {
      vars[`${praefix}-ls`] = `${stil.letter_spacing}em`;
    }
    if (stil.uppercase) vars[`${praefix}-tt`] = "uppercase";
    const schatten = SCHATTEN[stil.shadow ?? "keiner"];
    if (schatten) vars[`${praefix}-shadow`] = schatten;

    if (stil.size_desktop) {
      vars[`${praefix}-size`] = stil.scale_text
        ? skalierendeGroesse(
            stil.size_desktop,
            stil.size_mobile,
            referenzBreite,
          )
        : `${stil.size_desktop}px`;
    }
    // Eine eigene Mobilgröße gewinnt über die automatische Verkleinerung. Ohne
    // sie rechnet globals.css sie aus der Desktop-Größe.
    if (stil.size_mobile) vars[`${praefix}-msize`] = `${stil.size_mobile}px`;

    if (rolle === "dflt") {
      if (stil.link_color) vars[`${praefix}-lka`] = stil.link_color;
      if (stil.link_hover_color) vars[`${praefix}-lkh`] = stil.link_hover_color;
      if (stil.link_visited_color) {
        vars[`${praefix}-lkv`] = stil.link_visited_color;
      }
      if (stil.link_underline != null) {
        vars[`${praefix}-lku`] = stil.link_underline ? "underline" : "none";
      }
    }
  }
}

/** „Text skalieren": die Größe folgt der Breite des Inhaltsbereichs.
 *
 *  Gedacht gegen Zeilenumbrüche in Überschriften — eine feste Größe, die auf
 *  dem Laptop passt, bricht auf dem Tablet mitten im Wort. Umgesetzt als
 *  `clamp()` zwischen der Mobil- und der Desktop-Größe, mit `vw` als Träger:
 *  ein echtes Container-Query wäre genauer, bräuchte aber ein
 *  `container-type` an jedem Abschnitt — das gehört dem Abschnitts-Renderer,
 *  nicht dem Theme.
 *
 *  Die Untergrenze ist die Mobilgröße, wenn es eine gibt, sonst 60 % der
 *  Desktop-Größe. 60 % ist kein Geschmackswert, sondern der Punkt, an dem
 *  Hostaways eigene automatische Verkleinerung endet (80 % Mobil auf eine
 *  Tablet-Größe von 85 %). */
function skalierendeGroesse(
  desktop: number,
  mobil: number | null | undefined,
  referenzBreite: number,
): string {
  const untergrenze = mobil ?? Math.round(desktop * 0.6);
  const anteil = ((desktop / referenzBreite) * 100).toFixed(3);
  return `clamp(${untergrenze}px, ${anteil}vw, ${desktop}px)`;
}

/** Google-Fonts-Stylesheet für die drei Schrift-Rollen dieser Site.
 *  null, wenn keine ladbare Google-Familie dabei ist (System-Fonts brauchen
 *  keinen Request). */
export function siteFontsHref(
  branding: SiteBranding | null | undefined,
): string | null {
  if (!branding) return null;
  return googleFontsHref(
    [
      branding.font_family,
      branding.heading_font,
      branding.button_font,
    // Firmenname und Slogan können eigene Familien haben (0426). Fehlten sie
    // hier, stünden beide in der Fallback-Schrift und die Einstellung wäre in
    // der Vorschau unsichtbar — der Fehler, der bei den ersten drei Rollen
    // schon einmal passiert ist.
      branding.logo_name_font,
      branding.slogan_font,
      // Die Schriften der Text-Rollen (0447). Fehlten sie hier, stünde eine
      // für H1 gewählte Familie im Fallback und die Einstellung wäre
      // wirkungslos — derselbe Fehler, der bei Firmenname und Slogan schon
      // einmal passiert ist.
      ...TEXT_ROLLEN.map(
        (rolle) => themeFelder(branding).text_styles?.[rolle]?.font ?? null,
      ),
    ],
    // Der Schalter „Systemschrift zeigen, bis die eigene geladen ist" (0430).
    // AN = `swap` (sofort lesbar, sichtbarer Wechsel), AUS = `block` (kein
    // Wechsel, dafür kurz gar kein Text). `false` ist hier die Ausnahme, nicht
    // der Normalfall — siehe Begründung in fonts-catalog.ts.
    branding.system_fonts_first === false ? "block" : "swap",
  );
}

/** Klassen für den Marken-Button (Kopfzeile, Abschnitte, Buchungsstrecke).
 *
 *  Eckenform, Schrift und Füllung stecken in `.btn-marke` /
 *  `.btn-marke-primaer` (globals.css) — sie hängen an CSS-Variablen bzw. am
 *  `data-button-style`-Attribut auf <html>. Deshalb braucht hier NICHTS über
 *  Props durchgereicht zu werden: ein neuer Abschnitt setzt die Klasse und ist
 *  automatisch markenkonform, statt dass jemand es vergisst. */
export const BUTTON_KLASSEN =
  "btn-marke btn-marke-primaer inline-flex items-center justify-center gap-2 " +
  "bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground " +
  "shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
