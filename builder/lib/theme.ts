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
  return vars as CSSProperties;
}

/** Google-Fonts-Stylesheet für die drei Schrift-Rollen dieser Site.
 *  null, wenn keine ladbare Google-Familie dabei ist (System-Fonts brauchen
 *  keinen Request). */
export function siteFontsHref(
  branding: SiteBranding | null | undefined,
): string | null {
  if (!branding) return null;
  return googleFontsHref([
    branding.font_family,
    branding.heading_font,
    branding.button_font,
    // Firmenname und Slogan können eigene Familien haben (0426). Fehlten sie
    // hier, stünden beide in der Fallback-Schrift und die Einstellung wäre in
    // der Vorschau unsichtbar — der Fehler, der bei den ersten drei Rollen
    // schon einmal passiert ist.
    branding.logo_name_font,
    branding.slogan_font,
  ]);
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
