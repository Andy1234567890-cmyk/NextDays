// Sichtbarkeit eines Abschnitts je Gerät (0449) — die Lese- und Schreibregeln.
//
// Der Wert steht in `settings.hidden_on` und nicht in einer eigenen Spalte: eine
// Seite wird an sechs Stellen für den Renderer zusammengebaut (veröffentlichte
// Seite, Entwurfs-Vorschau, eigene Fehlerseite, Pop-ups, Blog-Beiträge,
// Vorlagen-Vorschau), und jede davon reicht `settings` unverändert durch. Eine
// siebte Spalte hätte an jeder einzeln nachgezogen werden müssen — und der
// Fehler dabei wäre der stille: die Seite rendert, der Abschnitt ist nur
// überall sichtbar, obwohl der Kunde ihn ausgeblendet hat.
//
// Diese Datei ist die EINE Stelle, an der die Menge gelesen und geschrieben
// wird. Ohne sie stünde `settings.hidden_on` an fünf Stellen in der Oberfläche
// und die Normalisierung (entdoppeln, sortieren) an keiner.
import type { Geraet } from "../vorschau";

/** Reihenfolge = Anzeigeordnung im „Ausblenden auf"-Menü und in der DB.
 *
 *  SCHWESTERWERT: `BlockGeraet` in `apps/api/.../site_config/schemas.py` und
 *  `GERAETE` in `builder/lib/site.ts`. Dieselben Werte in derselben
 *  Reihenfolge — das Backend sortiert `hidden_on` danach, und eine abweichende
 *  Reihenfolge hier ließe den Editor die eben gespeicherte Menge für geändert
 *  halten und endlos weiterschreiben (Wurzel 2). */
export const GERAETE: readonly Geraet[] = ["desktop", "tablet", "mobil"];

/** Auf welchen Geräten dieser Abschnitt beim GAST nicht erscheint.
 *
 *  Unbekannte Werte werden verworfen, nicht geraten: `settings` ist ein offenes
 *  jsonb, und ein Wert, den der Renderer nicht kennt, würde dort zu einer
 *  Tailwind-Klasse, die es nicht gibt (Wurzel 4). */
export function versteckteGeraete(settings: Record<string, unknown>): Geraet[] {
  const roh = settings.hidden_on;
  if (!Array.isArray(roh)) return [];
  return GERAETE.filter((g) => roh.includes(g));
}

/** Neue Settings mit gesetzter Geräte-Menge.
 *
 *  Normalisiert wie das Backend: entdoppelt und in fester Reihenfolge. Dieselbe
 *  Eingabe zweimal ergibt damit denselben `settings`-Wert — sonst hielte der
 *  Editor die Seite für geändert und schriebe endlos weiter (Wurzel 2).
 *
 *  Eine LEERE Menge entfernt den Schlüssel ganz, statt `[]` zu speichern:
 *  „nirgends versteckt" ist der Normalfall und braucht keinen Eintrag. */
export function mitVersteckt(
  settings: Record<string, unknown>,
  geraete: Geraet[],
): Record<string, unknown> {
  const menge = GERAETE.filter((g) => geraete.includes(g));
  const neu = { ...settings };
  if (menge.length === 0) delete neu.hidden_on;
  else neu.hidden_on = menge;
  return neu;
}

/** Menge nach einem Klick auf ein einzelnes Gerät (an/aus). */
export function umgeschaltet(vorher: Geraet[], geraet: Geraet): Geraet[] {
  return vorher.includes(geraet)
    ? vorher.filter((g) => g !== geraet)
    : [...vorher, geraet];
}
