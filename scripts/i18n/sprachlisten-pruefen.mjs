// Prüft, dass die Liste der 24 EU-Amtssprachen an ALLEN Stellen dieselbe ist.
//
// Es gibt vier Kopien, und jede hat einen Grund:
//   1. web/i18n/locales.ts            — Oberfläche des Dashboards
//   2. apps/api/.../basis.py          — Validierung beim Speichern (_SITE_LOCALES).
//      Lag bis 0436 in `schemas.py`; beim Zeilen-Split wanderte die Liste mit
//      den übrigen Validatoren nach `basis.py`. `schemas.py` re-exportiert sie,
//      aber geprüft wird die QUELLE — dort steht die Wahrheit.
//   3. builder/lib/sprache.ts         — Prüfung des ?lang= aus der Adresszeile
//   4. builder/lib/texte.ts           — Anzeigenamen im Sprachwähler (SPRACH_NAMEN)
//
// Ein gemeinsames Paket wäre der schönere Weg, aber der Renderer und die API
// teilen keine Laufzeit — die Python-Seite müsste die Liste ohnehin doppeln.
// Deshalb dasselbe Muster wie bei den Kanal-Enums: bewusste Kopien plus ein
// Skript, das ihre Deckungsgleichheit erzwingt.
//
// Der Fehler, den das verhindert: eine Sprache wird im Dashboard angeboten, die
// das Backend ablehnt (422 ohne erkennbaren Grund) — oder der Renderer kennt
// sie, hat aber keinen Anzeigenamen und zeigt im Wähler den nackten Code.
import { readFileSync } from "node:fs";

/** Sprachcodes aus einem Ausschnitt lesen.
 *
 *  `art` unterscheidet die zwei Formen, in denen sie vorkommen — als LISTE
 *  (`"de", "en"`) oder als OBJEKT-SCHLÜSSEL (`de: "Deutsch"`). Ohne diese
 *  Unterscheidung greift ein gemeinsames Muster auch in die WERTE: aus
 *  `nl: "Nederlands"` wurde so ein Code „ol" gelesen. */
function codes(quelle, datei, muster, art) {
  const text = readFileSync(datei, "utf8");
  const treffer = text.match(muster);
  if (!treffer) {
    console.error(`✗ ${quelle}: Liste in ${datei} nicht gefunden`);
    process.exit(1);
  }
  const inhalt = treffer[1];
  const gefunden =
    art === "liste"
      ? [...inhalt.matchAll(/"([a-z]{2})"/g)].map((m) => m[1])
      : [...inhalt.matchAll(/^\s*([a-z]{2}):/gm)].map((m) => m[1]);
  return new Set(gefunden);
}

const quellen = {
  "web/i18n/locales.ts": codes(
    "Dashboard",
    "web/i18n/locales.ts",
    /export const LOCALES = \[([\s\S]*?)\] as const;/,
    "liste",
  ),
  "apps/api basis.py": codes(
    "Backend",
    "apps/api/src/features/site_config/basis.py",
    /_SITE_LOCALES = frozenset\(\s*\{([\s\S]*?)\}\s*\)/,
    "liste",
  ),
  "builder/lib/sprache.ts": codes(
    "Renderer-Prüfung",
    "builder/lib/sprache.ts",
    /const ERLAUBT = new Set\(\[([\s\S]*?)\]\);/,
    "liste",
  ),
  "builder/lib/texte.ts": codes(
    "Renderer-Namen",
    "builder/lib/texte.ts",
    /export const SPRACH_NAMEN[\s\S]*?\{([\s\S]*?)\n\};/,
    "objekt",
  ),
};

const [erstesName, ersteMenge] = Object.entries(quellen)[0];
let fehler = 0;
for (const [name, menge] of Object.entries(quellen)) {
  const fehlt = [...ersteMenge].filter((c) => !menge.has(c));
  const zusatz = [...menge].filter((c) => !ersteMenge.has(c));
  if (fehlt.length || zusatz.length) {
    console.error(
      `✗ ${name}: fehlt ${JSON.stringify(fehlt)}, zusätzlich ${JSON.stringify(zusatz)} (Bezug: ${erstesName})`,
    );
    fehler++;
  }
}
if (ersteMenge.size !== 24) {
  console.error(`✗ ${erstesName}: ${ersteMenge.size} Sprachen statt 24`);
  fehler++;
}
if (fehler) process.exit(1);
console.log(`✓ Sprachlisten deckungsgleich (${Object.keys(quellen).length} Quellen, ${ersteMenge.size} Sprachen).`);
