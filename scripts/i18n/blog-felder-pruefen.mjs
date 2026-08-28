#!/usr/bin/env node
// Haelt den Feldkatalog des Blog-CMS an ZWEI Stellen deckungsgleich (0481).
//
// WARUM ES DAS GIBT
// =================
// Die konfigurierbaren Beitragsfelder stehen zweimal:
//   1. `apps/api/src/features/site_config/beitrag_felder.py` → BEITRAG_FELDER
//   2. `web/components/website/blog/felder.ts`               → BEITRAG_FELDER
//
// Eine Kopie ist hier unvermeidlich (Python und TypeScript teilen keinen
// Code), also braucht sie einen Waechter. Ohne ihn ist ein Schluessel, den nur
// eine Seite kennt, ein Feld, dessen Konfiguration erst BEIM SPEICHERN mit 422
// abgelehnt wird — und dann sucht niemand den Fehler in einer Liste.
//
// Dieselbe Klasse Fehler wie bei den Kanal-Enums (`kanal-enums-pruefen.mjs`)
// und den Blocktypen (`blocktypen-pruefen.mjs`): mehrere Stellen, eine
// Wahrheit, ein Pruefskript.
//
// BENUTZUNG
//   node scripts/i18n/blog-felder-pruefen.mjs
// Exit 1, sobald die Mengen auseinanderlaufen.

import { readFileSync } from "node:fs";

const PY = "apps/api/src/features/site_config/beitrag_felder.py";
const TS = "web/components/website/blog/felder.ts";

/** Die Schluessel aus dem `frozenset` des Backends. */
function ausPython(text) {
  const block = text.match(
    /BEITRAG_FELDER:\s*frozenset\[str\]\s*=\s*frozenset\(\s*\{([\s\S]*?)\}\s*\)/,
  );
  if (!block) throw new Error(`BEITRAG_FELDER nicht gefunden in ${PY}`);
  return new Set(
    [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]),
  );
}

/** Die Schluessel aus den `key:`-Zeilen des Katalogs. */
function ausTypescript(text) {
  const block = text.match(
    /export const BEITRAG_FELDER:\s*readonly FeldDef\[\]\s*=\s*\[([\s\S]*?)\n\]\s*as const;/,
  );
  if (!block) throw new Error(`BEITRAG_FELDER nicht gefunden in ${TS}`);
  return new Set(
    [...block[1].matchAll(/key:\s*"([a-z_]+)"/g)].map((m) => m[1]),
  );
}

/** Auch die Liste der nicht ausblendbaren Felder steht doppelt. */
function nichtVersteckbar(pyText, tsText) {
  const py = pyText.match(
    /NICHT_VERSTECKBAR:\s*frozenset\[str\]\s*=\s*frozenset\(\s*\{([\s\S]*?)\}\s*\)/,
  );
  const ts = tsText.match(
    /export const NICHT_VERSTECKBAR:[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/,
  );
  if (!py || !ts) throw new Error("NICHT_VERSTECKBAR nicht gefunden");
  return [
    new Set([...py[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])),
    new Set([...ts[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])),
  ];
}

const pyText = readFileSync(PY, "utf8");
const tsText = readFileSync(TS, "utf8");

const py = ausPython(pyText);
const ts = ausTypescript(tsText);
const [pyVersteckt, tsVersteckt] = nichtVersteckbar(pyText, tsText);

let fehler = 0;

function vergleiche(name, a, aName, b, bName) {
  const nurA = [...a].filter((k) => !b.has(k));
  const nurB = [...b].filter((k) => !a.has(k));
  if (nurA.length === 0 && nurB.length === 0) {
    console.log(`✓ ${name}: ${a.size} Schluessel, beide Seiten gleich`);
    return;
  }
  fehler += 1;
  console.error(`✗ ${name}: die Seiten laufen auseinander`);
  for (const k of nurA) console.error(`    nur in ${aName}: ${k}`);
  for (const k of nurB) console.error(`    nur in ${bName}: ${k}`);
}

vergleiche("BEITRAG_FELDER", py, PY, ts, TS);
vergleiche("NICHT_VERSTECKBAR", pyVersteckt, PY, tsVersteckt, TS);

// Was nicht ausgeblendet werden darf, muss es ueberhaupt geben.
for (const [menge, wo] of [
  [pyVersteckt, PY],
  [tsVersteckt, TS],
]) {
  for (const k of menge) {
    if (!py.has(k)) {
      fehler += 1;
      console.error(
        `✗ NICHT_VERSTECKBAR nennt "${k}" (${wo}), aber das Feld steht in ` +
          `keinem Katalog — eine Regel fuer ein Feld, das es nicht gibt.`,
      );
    }
  }
}

if (fehler > 0) {
  console.error(
    `\n${fehler} Abweichung(en). Beide Listen gleichziehen — ein Schluessel, ` +
      `den nur eine Seite kennt, wird beim Speichern mit 422 abgelehnt.`,
  );
  process.exit(1);
}
console.log("\nAlles deckungsgleich.");
