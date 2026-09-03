#!/usr/bin/env node
// Ausstattungs-Labels beider Mobile-Apps aus web/messages erzeugen.
//
// DER ANLASS (19.08.2026): Auf der Inserat-Seite der myBestDays-App standen
// rohe Slugs — „air_conditioning", „nd_single_level", „bbq_picnic_area". Für
// einen Gast ist das nichts. Dasselbe war am 11.08.2026 im Web-Marktplatz
// passiert und dort mit `plattform/lib/ausstattung.ts` + dem Sync-Skript
// `scripts/i18n/ausstattung-plattform-sync.mjs` behoben worden; die Apps hatten
// den Fix nie bekommen:
//   * mobile-bestdays hatte GAR KEINE Label-Tabelle (`{a}` direkt gerendert),
//   * mobile-nextdays nur den Portal-Katalog `amenities`, also fielen unsere
//     eigenen `nd_`-Merkmale durch (`nd_parking_included` → Slug).
//
// ZWEI KATALOGE, weil es zwei Herkünfte gibt (identisch zur Gast-Seite):
//   `amenities`         — Portal-Katalog (Airbnb ∪ Booking)
//   `eigeneAusstattung` — unsere eigenen `nd_`-Merkmale
//
// EINE QUELLE: gepflegt wird in `web/messages/de.json`; diese Datei erzeugt
// daraus die identische `lib/ausstattung.ts` in BEIDEN Apps. Nicht von Hand
// pflegen — sonst driften drei Kopien auseinander, und der Gast sieht wieder
// einen Slug.
//
// Nur Deutsch: die Apps haben (noch) kein i18n. Sobald sie eines haben, kommen
// die Labels aus denselben Katalogen in allen 24 Sprachen — die Slugs sind
// dieselben.
//
//   node scripts/mobile/ausstattung-labels-sync.mjs            → schreibt
//   node scripts/mobile/ausstattung-labels-sync.mjs --pruefen   → prüft (CI)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..", "..");
const KATALOGE = ["amenities", "eigeneAusstattung"];
const APPS = ["mobile-nextdays", "mobile-bestdays", "mobile-owner"];
const ZIEL = path.join("lib", "ausstattung.ts");

const pruefen = process.argv.includes("--pruefen");

const quelle = JSON.parse(
  readFileSync(path.join(WURZEL, "web", "messages", "de.json"), "utf8"),
);

/** Alle Slugs beider Kataloge, alphabetisch — Reihenfolge muss stabil sein,
 *  sonst erzeugt jeder Lauf ein neues Diff. */
const eintraege = [];
for (const katalog of KATALOGE) {
  const werte = quelle[katalog];
  if (!werte) {
    console.error(`✗ web/messages/de.json hat keinen Namespace ${katalog}`);
    process.exit(1);
  }
  for (const [slug, label] of Object.entries(werte)) {
    eintraege.push([slug, label, katalog]);
  }
}
eintraege.sort((a, b) => a[0].localeCompare(b[0], "en"));

// Ein Slug in BEIDEN Katalogen wäre eine doppelte Wahrheit: welcher Text gilt?
const gesehen = new Map();
for (const [slug, , katalog] of eintraege) {
  if (gesehen.has(slug)) {
    console.error(
      `✗ Slug „${slug}" steht in ${gesehen.get(slug)} UND ${katalog} — ` +
        "in web/messages/de.json auflösen.",
    );
    process.exit(1);
  }
  gesehen.set(slug, katalog);
}

const zeilen = eintraege.map(
  ([slug, label]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(label)},`,
);

const inhalt = `// Deutsche Bezeichnungen der Ausstattungsmerkmale.
//
// ERZEUGT — nicht von Hand pflegen:
//   node scripts/mobile/ausstattung-labels-sync.mjs
//
// Quelle ist \`web/messages/de.json\` mit BEIDEN Katalogen:
//   \`amenities\`         — Portal-Katalog (Airbnb ∪ Booking)
//   \`eigeneAusstattung\` — unsere eigenen \`nd_\`-Merkmale
// Dieselben Kataloge nutzen das PMS-Dashboard und der Web-Marktplatz
// (\`plattform/lib/ausstattung.ts\`). Ein neues Merkmal wird in web/messages
// ergänzt und diese Datei neu erzeugt — nie hier eingetippt.
//
// \`null\` heißt „kein Katalogeintrag". Was daraus wird, entscheidet die
// Oberfläche: der Betrieb sieht den Slug (sichtbarer Datenfehler), der GAST
// sieht die Zeile gar nicht — ein roher Slug ist für ihn keine Information
// (Wurzel 4: kein erfundener Ersatztext, aber auch keine leere Zusage).
const LABELS: Record<string, string> = {
${zeilen.join("\n")}
};

/** Label des Merkmals, oder \`null\`, wenn kein Katalog es kennt. */
export function ausstattungLabel(slug: string): string | null {
  return LABELS[slug] ?? null;
}

/** Anzahl der bekannten Merkmale — für Prüfskripte und Tests. */
export const AUSSTATTUNG_ANZAHL = ${eintraege.length};
`;

let abweichungen = 0;
for (const app of APPS) {
  const pfad = path.join(WURZEL, app, ZIEL);
  // Fehlt die Zieldatei, ist das im Prueflauf ein Befund, kein Absturz: live
  // (19.08.2026) lag `mobile-bestdays/lib/ausstattung.ts` nur lokal vor und war
  // untracked — der Runner sah bloss einen MODULE_NOT_FOUND-Stacktrace.
  let ist = null;
  try {
    ist = readFileSync(pfad, "utf8");
  } catch (fehler) {
    if (fehler.code !== "ENOENT") throw fehler;
    if (pruefen) {
      console.error(`\u2717 ${app}/${ZIEL} fehlt \u2014 nicht eingecheckt?`);
      abweichungen += 1;
      continue;
    }
  }
  if (ist === inhalt) continue;
  abweichungen += 1;
  if (pruefen) {
    console.error(`✗ ${app}/${ZIEL} weicht von web/messages ab`);
    continue;
  }
  writeFileSync(pfad, inhalt, "utf8");
  console.log(`↻ ${app}/${ZIEL} aktualisiert`);
}

if (pruefen && abweichungen > 0) {
  console.error(
    `\n${abweichungen} Datei(en) veraltet — ` +
      "node scripts/mobile/ausstattung-labels-sync.mjs ausführen.",
  );
  process.exit(1);
}
console.log(
  abweichungen === 0
    ? `✓ ${eintraege.length} Merkmale, ${APPS.length} Apps deckungsgleich mit web/messages`
    : `✓ ${eintraege.length} Merkmale in ${abweichungen} Datei(en) geschrieben`,
);
