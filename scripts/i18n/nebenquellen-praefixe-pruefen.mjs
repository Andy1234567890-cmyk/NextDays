#!/usr/bin/env node
// Hält die Nebenquellen-Präfixe des Posteingangs an ALLEN Stellen gleich.
//
//   node scripts/i18n/nebenquellen-praefixe-pruefen.mjs
//
// WOZU: Ein Thread ohne Zeile in `channex_booking` kennt die Flag-, Archiv-
// und Zuweisungs-Endpunkte nicht. Fehlt sein Präfix an einer der Stellen,
// läuft der Aufruf in einen 404 — und weil das Ergebnis in der Oberfläche
// verworfen wird, bleibt der Fehler STUMM: Der Thread gilt für immer als
// ungelesen und zählt dauerhaft im Zähler mit.
//
// Genau das ist am 09.09.2026 passiert: `eig:` (Eigentümer-Chat, 0611) stand
// im Backend, aber nicht in der Frontend-Liste. Und die Frontend-Liste trug
// ein `wa-neu:`, das es nie gab — der echte Präfix ist `wa:new:`. Beides fiel
// erst bei einer Prüfung auf, nicht im Betrieb.
//
// DREI Quellen, die deckungsgleich sein müssen:
//   1. apps/api/.../inbox/service.py  `_NEBENQUELLEN_PRAEFIXE`  (die Wahrheit)
//   2. web/components/inbox/inbox-eigentuemer.ts  `NEBENQUELLEN_PREFIXE`
//   3. die `PREFIX`-Konstanten der Quell-Module (anfragen, eigentuemer,
//      marktplatz, uebernahme) — dort entstehen sie
import { readFileSync } from "node:fs";

const wurzel = new URL("../..", import.meta.url).pathname;
const lies = (p) => readFileSync(wurzel + p, "utf8");

/** Alle Zeichenketten aus einer Klammer/Liste. */
const strings = (text) => [...text.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);

// 1. Der Server — die Quelle der Wahrheit.
const service = lies("apps/api/src/features/inbox/service.py");
const serverBlock = service.match(
  /_NEBENQUELLEN_PRAEFIXE:[^=]*=\s*\(([\s\S]*?)\)/,
);
if (!serverBlock) {
  console.error("_NEBENQUELLEN_PRAEFIXE nicht gefunden — Struktur geändert?");
  process.exit(1);
}
const server = new Set(strings(serverBlock[1]));

// 2. Das Web.
const webDatei = lies("web/components/inbox/inbox-eigentuemer.ts");
const webBlock = webDatei.match(/NEBENQUELLEN_PREFIXE\s*=\s*\[([\s\S]*?)\]/);
if (!webBlock) {
  console.error("NEBENQUELLEN_PREFIXE nicht gefunden — Struktur geändert?");
  process.exit(1);
}
const web = new Set(strings(webBlock[1]));

// 3. Die Module, in denen die Präfixe entstehen.
const module = {
  anfragen: "apps/api/src/features/inbox/anfragen.py",
  eigentuemer: "apps/api/src/features/inbox/eigentuemer.py",
  marktplatz: "apps/api/src/features/inbox/marktplatz.py",
  uebernahme: "apps/api/src/features/inbox/uebernahme.py",
};
const ausModulen = new Map();
for (const [name, pfad] of Object.entries(module)) {
  const treffer = lies(pfad).match(/^PREFIX(?::\s*Final)?\s*=\s*["']([^"']+)["']/m);
  if (!treffer) {
    console.error(`${name}: PREFIX nicht gefunden.`);
    process.exit(1);
  }
  ausModulen.set(name, treffer[1]);
}

let fehler = 0;
const melde = (t) => {
  console.error(`  ${t}`);
  fehler++;
};

// Jedes Modul-Präfix MUSS beim Server stehen.
for (const [name, praefix] of ausModulen) {
  if (!server.has(praefix)) {
    melde(
      `"${praefix}" (${name}.PREFIX) fehlt in _NEBENQUELLEN_PRAEFIXE — ` +
        "jeder Flag-Zugriff auf so einen Thread läuft in einen stillen Fehler.",
    );
  }
}

// Server und Web müssen deckungsgleich sein.
for (const p of server) {
  if (!web.has(p)) {
    melde(`"${p}" fehlt in web/.../inbox-eigentuemer.ts — Frontend ruft ins Leere.`);
  }
}
for (const p of web) {
  if (!server.has(p)) {
    melde(`"${p}" steht nur im Web — toter Eintrag oder Tippfehler.`);
  }
}

if (fehler) {
  console.error(`\n${fehler} Abweichung(en).`);
  process.exit(1);
}
console.log(
  `✓ Nebenquellen-Präfixe deckungsgleich (${server.size} Präfixe, ` +
    `${ausModulen.size} Module, Server + Web).`,
);
