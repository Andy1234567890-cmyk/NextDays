#!/usr/bin/env node
// Ausstattungs-Kataloge der Gast-Seite mit web/ gleichhalten.
//
// Die 400 Merkmale (`amenities` = Portal-Katalog Airbnb ∪ Booking,
// `eigeneAusstattung` = unsere nd_-Merkmale) werden im PMS gepflegt
// (web/messages/<loc>.json). Die Gast-Seite (plattform/) braucht dieselben
// Labels in denselben 24 Sprachen — der Gast sieht sonst rohe Slugs wie
// „nd_sun_loungers" (live so passiert, 11.08.2026).
//
// Zwei Kopien wären zwei Wahrheiten, deshalb ist die eine generiert:
//   node scripts/i18n/ausstattung-plattform-sync.mjs            → schreibt
//   node scripts/i18n/ausstattung-plattform-sync.mjs --pruefen  → prüft (CI)
//
// Die übrigen Keys der Gast-Seite (inserat.*, checkout.*) bleiben unberührt —
// dieses Skript fasst NUR die beiden Katalog-Namespaces an.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..", "..");
const KATALOGE = ["amenities", "eigeneAusstattung"];

// Genau die Sprachen der Gast-Seite (plattform/i18n/locales.ts).
const LOCALES = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
];

const pruefen = process.argv.includes("--pruefen");
let abweichungen = 0;

for (const loc of LOCALES) {
  const quellPfad = path.join(WURZEL, "web", "messages", `${loc}.json`);
  const zielPfad = path.join(WURZEL, "plattform", "messages", `${loc}.json`);
  const quelle = JSON.parse(readFileSync(quellPfad, "utf8"));
  const ziel = JSON.parse(readFileSync(zielPfad, "utf8"));

  let geaendert = false;
  for (const katalog of KATALOGE) {
    if (!quelle[katalog]) {
      console.error(`✗ ${loc}: web/messages hat keinen Namespace ${katalog}`);
      process.exit(1);
    }
    const soll = JSON.stringify(quelle[katalog]);
    const ist = JSON.stringify(ziel[katalog] ?? null);
    if (soll !== ist) {
      geaendert = true;
      ziel[katalog] = quelle[katalog];
    }
  }

  if (!geaendert) continue;
  abweichungen += 1;
  if (pruefen) {
    console.error(`✗ ${loc}.json: Ausstattungs-Katalog weicht von web/ ab`);
    continue;
  }
  writeFileSync(zielPfad, `${JSON.stringify(ziel, null, 2)}\n`, "utf8");
  console.log(`↻ ${loc}.json aktualisiert`);
}

if (pruefen && abweichungen > 0) {
  console.error(
    `\n${abweichungen} Sprachdatei(en) veraltet — ` +
      "node scripts/i18n/ausstattung-plattform-sync.mjs ausführen.",
  );
  process.exit(1);
}
console.log(
  abweichungen === 0
    ? `✓ Ausstattungs-Kataloge in ${LOCALES.length} Sprachen deckungsgleich mit web/`
    : `✓ ${abweichungen} Sprachdatei(en) geschrieben`,
);
