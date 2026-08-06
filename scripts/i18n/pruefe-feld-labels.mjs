#!/usr/bin/env node
// Jeder Platzhalter aus dem Backend-Katalog braucht ein Etikett in JEDER Sprache.
//
// DER VORFALL (06.08.2026): Mit der Lodgify-Platzhalterliste kamen 31 neue
// Felder ins Backend (`inbox/felder.py`). Der Picker im Posteingang holt seine
// Chips vom Server und übersetzt jeden Schlüssel über `inbox.field_<name>` —
// die 31 Etiketten fehlten aber in allen 24 Sprachdateien. Ergebnis: die
// Konsole voller `MISSING_MESSAGE`, und im Picker standen nackte Schlüssel.
//
// WARUM DIE BESTEHENDE PRÜFUNG DAS NICHT FAND: `pruefe-uebersetzungen.mjs`
// vergleicht die Sprachen UNTEREINANDER. Fehlt ein Schlüssel in ALLEN 24, sind
// sie deckungsgleich — und die Prüfung ist zufrieden. Die Wahrheit steht aber
// im Backend-Katalog, nicht in den Sprachdateien.
//
// Deshalb prüft dieses Skript gegen die QUELLE: es liest die Feldschlüssel aus
// `felder.py` und verlangt für jeden ein Etikett in jeder Sprache.
//
// Aufruf: node scripts/i18n/pruefe-feld-labels.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WURZEL = new URL("../..", import.meta.url).pathname;
const KATALOG = join(WURZEL, "apps/api/src/features/inbox/felder.py");
const NACHRICHTEN = join(WURZEL, "web/messages");

// `Feld("guest_name", "guest", …)` — der erste String ist der Schlüssel.
const quelle = readFileSync(KATALOG, "utf8");
const schluessel = [...quelle.matchAll(/\n\s{4}Feld\(\s*"([a-z0-9_]+)"/g)].map(
  (m) => m[1],
);
if (schluessel.length === 0) {
  console.error(
    `✗ Keine Felder in ${KATALOG} gefunden — hat sich die Schreibweise geändert?`,
  );
  process.exit(2);
}

let fehler = 0;
for (const datei of readdirSync(NACHRICHTEN).filter((f) => f.endsWith(".json"))) {
  const sprache = datei.replace(/\.json$/, "");
  const inhalt = JSON.parse(readFileSync(join(NACHRICHTEN, datei), "utf8"));
  const inbox = inhalt.inbox ?? {};
  const fehlend = schluessel.filter((k) => !(`field_${k}` in inbox));
  if (fehlend.length > 0) {
    console.error(`✗ ${sprache}: ${fehlend.length} Etiketten fehlen —`, fehlend.join(", "));
    fehler += 1;
  }
}

if (fehler > 0) {
  console.error(
    `\n${fehler} Sprache(n) unvollständig. Jeder Platzhalter erscheint im ` +
      "Picker; ohne Etikett steht dort sein roher Schlüssel und die Konsole " +
      "meldet MISSING_MESSAGE.",
  );
  process.exit(1);
}
console.log(
  `✓ ${schluessel.length} Platzhalter in allen Sprachdateien beschriftet.`,
);
