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
 * Attribute für eine editierbare Textstelle.
 *
 * Im Live-Betrieb ein leeres Objekt — die veröffentlichte Seite trägt keine
 * Editor-Marker, weder als Attribut noch als Klasse. Genau deshalb steht das
 * hier zentral und nicht als `data-feld="…"` von Hand an jeder Stelle: sonst
 * vergisst ein neuer Abschnitt die Bedingung und liefert die Marker auch live.
 *
 * `index` ist der Abschnitts-Index auf der Seite (dieselbe Ordnung wie in der
 * Liste des Editors), `feld` der Schlüssel im `content` des Abschnitts.
 */
export function editierbar(
  modus: EditierModus,
  feld: string,
): Record<string, string> {
  if (!modus.aktiv) return {};
  return { "data-feld": feld };
}
