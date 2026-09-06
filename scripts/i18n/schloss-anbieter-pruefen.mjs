#!/usr/bin/env node
// Haelt die Schloss-Anbieter an ALLEN Stellen deckungsgleich (0577).
//
// WARUM DIESES SKRIPT: die 32 Hersteller stehen an fuenf Stellen — im
// Frontend-Katalog, im Backend-Schema, im Seam-Provider-Filter, in der
// DB-Migration und als Logodatei. Weicht EINE ab, ist der Fehler stumm:
//   * fehlt die Kennung im Backend-Schema, kennt `MODULE_KEYS` das Modul
//     nicht → „Aktivieren" antwortet 400 „Unbekanntes Modul".
//   * fehlt sie in der Migration, wirft der DB-CHECK 23514 → HTTP 500.
//   * fehlt sie im Provider-Filter, erscheint der Hersteller in der
//     Anmeldemaske nicht — obwohl sein Modul buchbar ist.
//   * fehlt der PREIS-Eintrag, wird das Modul aktiviert und NIE abgerechnet.
// Genau diese Klasse Fehler faellt in Tests nicht auf, weil jede Stelle
// einzeln in sich stimmig ist.
//
// Aufruf:  node scripts/i18n/schloss-anbieter-pruefen.mjs
// Exit 1 bei jeder Abweichung.

import { readFileSync, existsSync, readdirSync } from "node:fs";

const wurzel = new URL("../../", import.meta.url).pathname;
const lies = (p) => readFileSync(wurzel + p, "utf8");

// --- 1. Frontend-Katalog (die Quelle der Anzeige) -------------------------
const tsQuelle = lies("web/lib/schloss-anbieter.ts");
const ts = [...tsQuelle.matchAll(/kennung:\s*"([^"]+)"/g)].map((m) => m[1]);

// --- 2. Backend-Schema ----------------------------------------------------
const pyQuelle = lies("apps/api/src/features/subscriptions/schemas.py");
const anbieterBlock = pyQuelle.match(
  /SCHLOSS_ANBIETER[^=]*=\s*\(([\s\S]*?)\n\)/,
);
const py = anbieterBlock
  ? [...anbieterBlock[1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1])
  : [];

// --- 3. Seam-Provider-Filter ---------------------------------------------
const seamQuelle = lies("apps/api/src/features/schloesser/seam_client.py");
const providerBlock = seamQuelle.match(
  /SCHLOSS_PROVIDER[^=]*=\s*\(([\s\S]*?)\n\)/,
);
const provider = providerBlock
  ? [...providerBlock[1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1])
  : [];

// --- 4. DB-Migration ------------------------------------------------------
const migDatei = "supabase/migrations/0577_schloss_anbieter_module.sql";
const mig = existsSync(wurzel + migDatei)
  ? [...lies(migDatei).matchAll(/'schloss_([a-z_0-9]+)'/g)].map((m) => m[1])
  : [];

// --- 5. Logodateien (duerfen fehlen, aber nichts Fremdes enthalten) ------
const logoDir = "web/public/schloesser";
const logos = existsSync(wurzel + logoDir)
  ? readdirSync(wurzel + logoDir).map((f) => f.replace(/\.(svg|png)$/, ""))
  : [];

// --- 6. Die im Katalog eingetragenen Logo-Endungen -----------------------
const endungBlock = tsQuelle.match(/LOGO_ENDUNG[^{]*\{([\s\S]*?)\n\};/);
const endungen = endungBlock
  ? [...endungBlock[1].matchAll(/^\s*([a-z_0-9]+):\s*"(svg|png)"/gm)].map(
      (m) => [m[1], m[2]],
    )
  : [];

const fehler = [];
const menge = (xs) => new Set(xs);
const fehlt = (a, b) => [...menge(a)].filter((x) => !menge(b).has(x)).sort();

if (ts.length === 0) fehler.push("web/lib/schloss-anbieter.ts: keine Kennung gefunden");
if (py.length === 0) fehler.push("schemas.py: SCHLOSS_ANBIETER nicht lesbar");
if (provider.length === 0) fehler.push("seam_client.py: SCHLOSS_PROVIDER nicht lesbar");
if (mig.length === 0) fehler.push(`${migDatei}: keine Modulschluessel gefunden`);

const vergleiche = [
  ["Backend-Schema (schemas.py SCHLOSS_ANBIETER)", py],
  ["Seam-Provider-Filter (seam_client.py)", provider],
  ["DB-Migration 0577", mig],
];
for (const [name, andere] of vergleiche) {
  for (const k of fehlt(ts, andere)) fehler.push(`${name}: Kennung fehlt: ${k}`);
  for (const k of fehlt(andere, ts)) fehler.push(`${name}: Kennung ueberzaehlig (nicht im Katalog): ${k}`);
}

// Doppelte Kennungen und Slugs im Katalog.
const doppelt = ts.filter((k, i) => ts.indexOf(k) !== i);
for (const k of new Set(doppelt)) fehler.push(`Katalog: Kennung doppelt: ${k}`);
const slugs = [...tsQuelle.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
const slugDoppelt = slugs.filter((s, i) => slugs.indexOf(s) !== i);
for (const s of new Set(slugDoppelt)) fehler.push(`Katalog: Slug doppelt: ${s}`);
if (slugs.length !== ts.length) fehler.push(`Katalog: ${ts.length} Kennungen, aber ${slugs.length} Slugs`);

// Jede eingetragene Endung MUSS eine Datei haben, und umgekehrt.
for (const [k, e] of endungen) {
  if (!ts.includes(k)) fehler.push(`LOGO_ENDUNG: ${k} ist kein Anbieter im Katalog`);
  if (!existsSync(`${wurzel}${logoDir}/${k}.${e}`))
    fehler.push(`LOGO_ENDUNG sagt ${k}.${e}, Datei fehlt unter ${logoDir}/`);
}
const eingetragen = menge(endungen.map(([k]) => k));
for (const f of logos)
  if (!eingetragen.has(f))
    fehler.push(`${logoDir}/${f}.*: Datei ohne Eintrag in LOGO_ENDUNG (wird nie angezeigt)`);

// Jeder Anbieter braucht einen PREIS-Eintrag, sonst wird nie abgerechnet.
const preisBlock = pyQuelle.match(/MODULE_PRICE_LOOKUP\.update\(SCHLOSS_PRICE_LOOKUP\)/);
if (!preisBlock)
  fehler.push(
    "schemas.py: `MODULE_PRICE_LOOKUP.update(SCHLOSS_PRICE_LOOKUP)` fehlt — " +
      "die Schloss-Module wuerden aktiviert, aber NIE abgerechnet",
  );

if (fehler.length) {
  console.error(`\n${fehler.length} Abweichung(en):\n`);
  for (const f of fehler) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✓ ${ts.length} Schloss-Anbieter deckungsgleich ` +
    `(Katalog, Schema, Provider-Filter, Migration) · ` +
    `${endungen.length} Logos, ${ts.length - endungen.length} ohne Original`,
);
