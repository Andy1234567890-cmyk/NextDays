#!/usr/bin/env node
// Führt flache Key-Dateien (aus parallelen Verkeyungs-Läufen) in die
// Basissprachdatei einer App zusammen.
//
// Warum getrennt gesammelt und dann gemerged: Mehrere Läufe schreiben sonst
// gleichzeitig in dieselbe de.json und überschreiben einander. Jeder Lauf legt
// eine eigene flache Datei ab, dieses Skript fügt sie kontrolliert zusammen.
//
// Bricht ab, wenn ein Key bereits mit ANDEREM Text existiert — das wäre ein
// stiller Textverlust. Solche Fälle gehören angesehen, nicht überschrieben.
//
// Aufruf: node scripts/i18n/merge-keys.mjs gastgeber <verzeichnis-mit-keys>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [app, quelle] = process.argv.slice(2);
if (!app || !quelle) {
  console.error("Aufruf: merge-keys.mjs <app> <verzeichnis-mit-keys-*.json>");
  process.exit(2);
}

const ziel = join(process.cwd(), app, "messages", "de.json");
const basis = JSON.parse(readFileSync(ziel, "utf8"));

function setzeTief(objekt, pfad, wert) {
  const teile = pfad.split(".");
  let knoten = objekt;
  for (const teil of teile.slice(0, -1)) {
    if (typeof knoten[teil] !== "object" || knoten[teil] === null) {
      knoten[teil] = {};
    }
    knoten = knoten[teil];
  }
  knoten[teile.at(-1)] = wert;
}

function leseTief(objekt, pfad) {
  return pfad
    .split(".")
    .reduce((knoten, teil) => (knoten == null ? undefined : knoten[teil]), objekt);
}

const dateien = readdirSync(quelle)
  .filter((n) => n.startsWith("keys-") && n.endsWith(".json"))
  .sort();

let neu = 0;
let unveraendert = 0;
const konflikte = [];

for (const datei of dateien) {
  const keys = JSON.parse(readFileSync(join(quelle, datei), "utf8"));
  for (const [pfad, wert] of Object.entries(keys)) {
    const vorhanden = leseTief(basis, pfad);
    if (vorhanden === undefined) {
      setzeTief(basis, pfad, wert);
      neu += 1;
    } else if (vorhanden === wert) {
      unveraendert += 1;
    } else {
      konflikte.push({ datei, pfad, alt: vorhanden, neu: wert });
    }
  }
  console.log(`${datei}: ${Object.keys(keys).length} Keys gelesen`);
}

if (konflikte.length > 0) {
  console.error(`\n✗ ${konflikte.length} Konflikt(e) — nichts geschrieben:`);
  for (const k of konflikte.slice(0, 10)) {
    console.error(`  ${k.pfad}  (aus ${k.datei})`);
    console.error(`    vorhanden: ${k.alt}`);
    console.error(`    neu:       ${k.neu}`);
  }
  process.exit(1);
}

writeFileSync(ziel, `${JSON.stringify(basis, null, 2)}\n`, "utf8");
console.log(
  `\n✓ ${neu} neue Keys ergänzt, ${unveraendert} bereits identisch vorhanden.`,
);
console.log(`  → ${ziel}`);
