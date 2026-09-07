// Editier-Kontext der Entwurfs-Vorschau.
//
// Die Vorschau im Baukasten ist dieselbe Seite, die der Gast sieht — mit EINEM
// Unterschied: im Editiermodus tragen die Textstellen Marker, an denen der
// Editor sie anklickbar macht. Live gibt es diese Marker nicht.
//
// Übertragen wird der Modus per Query-Parameter, weil der Renderer keine Sitzung
// mit dem Dashboard teilt (eigener Origin, eigener Prozess). Der Zugriff hängt
// weiter am HMAC-Token; `edit` schaltet nur die Marker frei und gibt keine
// zusätzlichen Daten heraus.

/** Welche Sprache bearbeitet wird und ob Marker gesetzt werden. */
export type EditierModus = {
  /** true = Textstellen tragen `data-feld` und sind im Editor anklickbar. */
  aktiv: boolean;
  /** Sprache, die gezeigt UND bearbeitet wird. */
  locale: string;
};

export const NICHT_EDITIERBAR: EditierModus = { aktiv: false, locale: "de" };

/** Modus aus den Query-Parametern der Render-Route.
 *
 *  `locale` wird auf ein enges Muster geprüft, bevor es weiterläuft: der Wert
 *  landet als Schlüssel in einer Locale-Map und im Markup. Ein beliebiger String
 *  aus der Adresszeile hat dort nichts zu suchen (Wurzel 3 — der Anfrage nicht
 *  vertrauen). Bei ungültiger Eingabe gilt die Standardsprache, kein Fehler:
 *  eine kaputte Adresse soll die Vorschau nicht verweigern. */
export function editierModusAus(
  params: { edit?: string; locale?: string } | undefined,
): EditierModus {
  const aktiv = params?.edit === "1";
  const roh = params?.locale ?? "";
  // ISO-639-1 (zwei Kleinbuchstaben), optional mit Region: "de", "pt-BR".
  const gueltig = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(roh);
  return { aktiv, locale: gueltig ? roh : NICHT_EDITIERBAR.locale };
}

/**
 * Attribute für eine Stelle des Bausteins — eine Überschrift, ein Absatz, ein
 * Bild, ein Knopf.
 *
 * `data-feld` war bis zum 06.09.2026 ein reiner EDITOR-Marker (nur in der
 * Entwurfs-Vorschau, damit man dort tippen kann). Seither ist es zusätzlich
 * der ANKER DER GESTALTUNG: jeder Teil eines Bausteins lässt sich im
 * Style-Panel einzeln einstellen (`settings.teile.<feld>`), und der Renderer
 * schreibt dafür eine Regel mit genau diesem Selektor
 * (`[data-block-index="3"] [data-feld="heading"]`, siehe `stilCss`).
 *
 * Deshalb steht das Attribut jetzt AUCH auf der veröffentlichten Seite. Es ist
 * kein Editor-Werkzeug mehr, sondern die Stelle, an der die Einstellung
 * greift — ohne es wäre jeder Teil-Stil im Editor sichtbar und beim Gast weg
 * (Wurzel 4: die Vorschau darf nicht mehr zeigen, als die Seite kann).
 *
 * Es bleibt genau EIN Attribut, ohne Wert aus Nutzerhand: `feld` kommt aus dem
 * Katalog des Bausteins, nicht aus den Daten.
 */
export function editierbar(
  modus: EditierModus,
  feld: string,
): Record<string, string> {
  // `modus` bleibt im Aufruf stehen: er entscheidet weiterhin, ob die Stelle
  // BEARBEITBAR ist (das setzt die Brücke im iframe), und die Signatur ist an
  // über hundert Stellen im Renderer gesetzt.
  void modus;
  return { "data-feld": feld };
}
