// Eigener Code des Betriebs auf seiner Kunden-Website (0426).
//
// Der Zweck ist alltäglich: ein google-site-verification-Tag, ein
// Analytics-Schnipsel, ein Preconnect auf einen eigenen Bildserver. Jeder
// Baukasten im Markt bietet das, und ohne es kann ein Betrieb seine Seite bei
// Google nicht verifizieren.
//
// WAS HIER SCHÜTZT
//
// Nicht diese Datei. Sie gibt aus, was das Backend freigegeben hat. Der Schutz
// liegt an drei Stellen, und es ist wichtig zu wissen, an welchen:
//
//   1. Beim SPEICHERN. `head_html` läuft im Backend durch einen echten
//      HTML-Parser mit Tag-Allowlist (nh3: nur meta/link/title, kein script,
//      kein http-equiv, nur http(s)-URLs). Ein `<img onerror=…>` existiert nach
//      dieser Prüfung nicht mehr — und wenn dabei ein href verworfen wurde,
//      bekommt der Kunde einen Fehler statt eines still leeren Feldes.
//   2. An der ROLLE. Schreiben darf nur, wer MANAGE_SITE_CONFIG hat — dieselbe
//      Schwelle wie fürs Eintragen der eigenen Domain. Der Betrieb öffnet sein
//      eigenes Fenster, niemand sonst. Der DB-Direktpfad ist zu (0337).
//   3. An der TRENNUNG. In der Zahlungsstrecke läuft KEIN Kundencode. Und
//      Kartendaten liegen ohnehin in Stripe-eigenen iframes auf Stripes Origin,
//      wo Code dieser Seite nicht herankommt.
//
// WAS HIER NICHT SCHÜTZT: eine CSP-Nonce. Die CSP dieser App führt
// `script-src 'self' 'unsafe-inline'`, weil Next 15 im App Router
// Inline-Bootstrap-Skripte einhängt. Sobald eine Nonce in der Direktive steht,
// ignoriert der Browser `unsafe-inline` — und genau diese Skripte brächen. Eine
// Nonce hier wäre also eine Schutzbehauptung ohne Wirkung, und die ist
// schlimmer als keine, weil sich niemand mehr um die echten drei kümmert.

import type { SiteBranding } from "./site-context";

/** Wo der Code eingebunden wird. Drei Flächen, weil es drei Antworten gibt:
 *
 *  · `oeffentlich`   Startseite, Unterseiten, Inseratsseite: head_html,
 *                    head_css und custom_js.
 *  · `zahlung`       Die Zahlungsseite selbst: GAR KEIN Kundencode. Nicht
 *                    „weniger", sondern keiner — hier gibt der Gast seine Daten
 *                    ein, und fremder Code hat auf dieser Seite nichts zu tun.
 *  · `bestaetigung`  Die Seite NACH abgeschlossener Zahlung: ausschließlich
 *                    `checkout_js`. Genau dort gehört das Conversion-Pixel hin,
 *                    das ein Betrieb für seine Werbeauswertung braucht — und nur
 *                    dort.
 *
 *  Die Zahlungsseite und die Bestätigung zu EINER Fläche zusammenzufassen wäre
 *  der Fehler, der sich später niemandem erklärt: „checkout" hätte dann
 *  bedeutet, dass das Pixel auch im Formular läuft. */
export type CodeFlaeche = "oeffentlich" | "zahlung" | "bestaetigung";

export type CodeStuecke = {
  /** HTML für den <head> (nur meta/link/title, serverseitig geprüft). */
  html: string | null;
  /** CSS des Betriebs. */
  css: string | null;
  /** JavaScript des Betriebs für DIESE Fläche. */
  js: string | null;
};

/** Was auf dieser Fläche eingebunden wird. Leere Felder werden zu `null`, damit
 *  der Aufrufer nicht zwischen `""` und „nicht gesetzt" unterscheiden muss. */
export function codeStuecke(
  branding: SiteBranding | null | undefined,
  flaeche: CodeFlaeche,
): CodeStuecke {
  const leer: CodeStuecke = { html: null, css: null, js: null };
  if (!branding) return leer;
  if (flaeche === "zahlung") return leer;
  if (flaeche === "bestaetigung") {
    // AUSSCHLIESSLICH checkout_js. Kein head_html, kein head_css, kein
    // custom_js — das ist der Punkt der Trennung, nicht eine Sparmaßnahme.
    return { html: null, css: null, js: text(branding.checkout_js) };
  }
  return {
    html: text(branding.head_html),
    css: text(branding.head_css),
    js: text(branding.custom_js),
  };
}

function text(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s || null;
}

/** Bricht ein `</script>` im Kundencode aus dem Element aus?
 *
 *  Muss geprüft werden, weil der Inhalt eines `<script>`-Elements im HTML nicht
 *  escaped wird: der Parser beendet das Element beim ersten `</script`,
 *  unabhängig davon, ob es in einem String steht. Ein Kunde, der ein
 *  `document.write("</script>")` einfügt, würde damit alles danach als Markup
 *  auf seine Seite schreiben.
 *
 *  Der Ausweg ist die übliche Ersetzung: `<\/` im JS-String ist derselbe
 *  Zeichenwert wie `</`, aber der HTML-Parser erkennt darin kein Endtag. Ein
 *  Ablehnen wäre hier falsch — der Code ist legitim, nur die Einbettung braucht
 *  die Ersetzung. */
export function jsFuerElement(js: string): string {
  return js.replace(/<\/(script)/gi, String.raw`<\/$1`);
}

/** Dasselbe für `<style>`: `</style>` beendet das Element. Anders als bei JS
 *  gibt es in CSS keine Escape-Schreibweise dafür — hier wird die Zeichenfolge
 *  deshalb entfernt statt umgeschrieben. Sie hat in echtem CSS keinen Zweck. */
export function cssFuerElement(css: string): string {
  return css.replace(/<\/(style)/gi, "");
}
