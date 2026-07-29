#!/usr/bin/env node
// Stellt sicher, dass LOCALES und messages/ deckungsgleich sind.
//
// Der Grund: Die Sprachauswahl im Konto rendert alles, was in LOCALE_LABELS
// steht. Steht dort eine Sprache ohne Datei, kann der Nutzer sie wählen und
// sieht danach — Deutsch. Eine wählbare Sprache, die nichts bewirkt, ist genau
// die Attrappe, die wir abgeschafft haben (Wurzel 4: keine Fantasiewerte).
//
// Umgekehrt ist eine Datei ohne Eintrag in LOCALES totes Gewicht: Sie wird
// gepflegt und übersetzt, aber niemand kann sie auswählen.
//
// Gehört ins Qualitätsgate vor dem Ausliefern.
// Aufruf: node scripts/i18n/pruefe-locales-vollstaendig.mjs gastgeber
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const app = process.argv[2];
if (!app) {
  console.error("Aufruf: pruefe-locales-vollstaendig.mjs <app>");
  process.exit(2);
}

const quelle = readFileSync(join(process.cwd(), app, "i18n/locales.ts"), "utf8");

// LOCALES-Array aus der TypeScript-Quelle lesen. Ein Import scheidet aus:
// Das Skript läuft in blankem Node ohne TypeScript-Auflösung.
const block = quelle.split("export const LOCALES")[1]?.split("] as const")[0];
if (!block) {
  console.error("LOCALES-Array in locales.ts nicht gefunden.");
  process.exit(2);
}
const locales = [...block.matchAll(/"([\w-]+)"/g)].map((t) => t[1]);

// LOCALE_LABELS muss dieselben Codes abdecken — sonst zeigt die Auswahl für
// eine Sprache keinen Namen.
const labelBlock = quelle
  .split("LOCALE_LABELS: Record<Locale, string> = {")[1]
  ?.split("};")[0];
const labels = new Set(
  [...(labelBlock ?? "").matchAll(/^\s*"?([\w-]+)"?:/gm)].map((t) => t[1]),
);

const dateien = new Set(
  readdirSync(join(process.cwd(), app, "messages"))
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.replace(/\.json$/, "")),
);

const ohneDatei = locales.filter((c) => !dateien.has(c));
const ohneEintrag = [...dateien].filter((c) => !locales.includes(c));
const ohneLabel = locales.filter((c) => !labels.has(c));

for (const c of ohneDatei) {
  console.error(`✗ ${c}: in LOCALES, aber messages/${c}.json fehlt`);
}
for (const c of ohneEintrag) {
  console.error(`✗ ${c}: messages/${c}.json existiert, fehlt aber in LOCALES`);
}
for (const c of ohneLabel) {
  console.error(`✗ ${c}: in LOCALES, aber kein Eintrag in LOCALE_LABELS`);
}

const fehler = ohneDatei.length + ohneEintrag.length + ohneLabel.length;
if (fehler === 0) {
  console.log(
    `✓ ${locales.length} Locales, ${dateien.size} Sprachdateien, alle Labels vorhanden.`,
  );
}
process.exit(fehler > 0 ? 1 : 0);
