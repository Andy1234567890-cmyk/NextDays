// Wie Bilder einer Kunden-Seite geladen werden (0430).
//
// Der Schalter im Baukasten heißt „Bilder erst beim Scrollen laden" und ist
// standardmäßig AN — er verkürzt den ersten Aufbau messbar. Er hat aber eine
// Ausnahme, die NICHT einstellbar ist: das erste Bild der Seite lädt immer
// sofort.
//
// Der Grund ist die Kennzahl, um die es geht. Googles „Largest Contentful
// Paint" misst, wann das größte sichtbare Element steht — und das ist auf einer
// Unterkunfts-Website fast immer das Bild im ersten Abschnitt. Lädt es „lazy",
// beginnt der Browser erst damit, NACHDEM er das Layout gerechnet hat: die LCP
// wird schlechter, nicht besser. Hostaway nennt diesen Fall in seiner Hilfe
// nicht, weshalb ein Kunde dort mit eingeschaltetem Lazy-Loading seine
// Startseite verschlechtern kann, ohne es zu erfahren.
//
// Deshalb ist die Regel hier festgelegt und nicht dem Kunden überlassen: erstes
// Bild sofort, alles darunter nach seiner Einstellung.
import type { SiteBranding } from "./site-context";

export type BildLaden = "eager" | "lazy";

/** Ladeart für ein Bild an dieser Blockposition.
 *
 *  `position` ist der Index des Blocks auf der Seite. 0 = der erste Abschnitt,
 *  also über der Falz.
 *
 *  Fehlt das Branding (unbekannte Domain, Backend weg), gilt „lazy" — dasselbe
 *  wie der Spalten-Default. Das ist kein erfundener Wert, sondern derselbe
 *  Zustand, den eine frisch angelegte Website hat. */
export function bildLaden(
  branding: SiteBranding | null | undefined,
  position: number,
): BildLaden {
  if (position === 0) return "eager";
  return branding?.lazy_loading === false ? "eager" : "lazy";
}
