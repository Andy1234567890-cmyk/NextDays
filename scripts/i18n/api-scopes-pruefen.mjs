#!/usr/bin/env node
// Hält den Scope-Katalog des Backends und den Anzeige-Katalog der Oberfläche
// deckungsgleich — und stellt sicher, dass jeder Bereich ein Etikett in allen
// 24 Sprachen hat.
//
// DREI STELLEN LESEN DENSELBEN KATALOG:
//   1. apps/api/.../api_clients/scopes.py   — was das Dashboard vergeben darf
//      (byte-identische Schwesterdatei von apps/public-api/src/core/scopes.py)
//   2. web/lib/api-scopes.ts                — die Auswahl in der Oberfläche
//   3. web/messages/<lang>.json             — die Etiketten dazu
//
// Driftet einer davon, passiert etwas Stilles: ein Bereich, den die Oberfläche
// nicht anbietet, ist ein Recht, das niemand vergeben kann — die zugehörigen
// Endpunkte der öffentlichen API antworten dauerhaft mit 403, und nirgends
// steht ein Fehler. Umgekehrt ist ein Bereich, den nur die Oberfläche kennt,
// eine Auswahl, die beim Speichern mit 422 abgelehnt wird.
//
// Aufruf: node scripts/i18n/api-scopes-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BACKEND = "apps/api/src/features/api_clients/scopes.py";
const SCHWESTER = "apps/public-api/src/core/scopes.py";
const FRONTEND = "web/lib/api-scopes.ts";
const NACHRICHTEN = "web/messages";

let befunde = 0;
const fehler = (text) => {
  console.error(`::error::${text}`);
  befunde++;
};

// -- 1. Backend-Katalog ----------------------------------------------------
// Die Schlüssel des SCOPE_KATALOG-Dicts, in Reihenfolge. Bewusst per Regex und
// nicht per Python-Aufruf: das Skript läuft im Node-Job der CI, und ein
// Python-Interpreter ist dort nicht garantiert.
const backendQuelle = readFileSync(BACKEND, "utf8");
const katalogBlock = backendQuelle.match(
  /SCOPE_KATALOG:\s*Final\[dict\[str,\s*str\]\]\s*=\s*\{([\s\S]*?)\n\}/,
);
if (!katalogBlock) {
  fehler(`${BACKEND}: SCOPE_KATALOG nicht gefunden — Format geändert?`);
  process.exit(1);
}
const backendScopes = [...katalogBlock[1].matchAll(/^\s*"([a-z_]+:[a-z]+)":/gm)].map(
  (m) => m[1],
);
if (backendScopes.length === 0) {
  fehler(`${BACKEND}: SCOPE_KATALOG ist leer`);
  process.exit(1);
}

// -- 2. Die Schwesterdatei muss identisch sein ----------------------------
// Der eigene CI-Job prüft das byteweise; hier steht es zusätzlich, weil dieses
// Skript auch lokal einzeln gelaufen wird.
if (readFileSync(SCHWESTER, "utf8") !== backendQuelle) {
  fehler(
    `${SCHWESTER} weicht von ${BACKEND} ab — beide müssen byte-identisch sein ` +
      `(scripts/ci/public-api-kopien-pruefen.sh)`,
  );
}

// -- 3. Frontend-Katalog ---------------------------------------------------
const frontendQuelle = readFileSync(FRONTEND, "utf8");
const bereiche = [
  ...frontendQuelle.matchAll(
    /\{\s*key:\s*"([a-z_]+)",\s*labelKey:\s*"([A-Za-z]+)",\s*richtungen:\s*([^}]+)\}/g,
  ),
].map(([, key, labelKey, richtungenRoh]) => {
  const richtungen = richtungenRoh.includes("LESEN_UND_SCHREIBEN")
    ? ["read", "write"]
    : [...richtungenRoh.matchAll(/"(read|write)"/g)].map((m) => m[1]);
  return { key, labelKey, richtungen };
});
if (bereiche.length === 0) {
  fehler(`${FRONTEND}: API_SCOPE_CATALOG nicht lesbar — Format geändert?`);
  process.exit(1);
}
const frontendScopes = bereiche.flatMap((b) =>
  b.richtungen.map((r) => `${b.key}:${r}`),
);

const fehltVorne = backendScopes.filter((s) => !frontendScopes.includes(s));
const fehltHinten = frontendScopes.filter((s) => !backendScopes.includes(s));
if (fehltVorne.length) {
  fehler(
    `${FRONTEND} kennt ${fehltVorne.length} Scope(s) des Backends NICHT: ` +
      `${fehltVorne.join(", ")} — niemand kann dieses Recht vergeben, die ` +
      `zugehörigen Endpunkte antworten dauerhaft 403.`,
  );
}
if (fehltHinten.length) {
  fehler(
    `${FRONTEND} bietet ${fehltHinten.length} Scope(s) an, die das Backend ` +
      `nicht kennt: ${fehltHinten.join(", ")} — Auswahl endet beim Speichern in 422.`,
  );
}

// -- 4. Etiketten in allen Sprachen ---------------------------------------
const sprachen = readdirSync(NACHRICHTEN).filter((f) => f.endsWith(".json"));
for (const datei of sprachen.sort()) {
  const daten = JSON.parse(readFileSync(join(NACHRICHTEN, datei), "utf8"));
  const api = daten.apiAccess ?? {};
  for (const b of bereiche) {
    const key = `scope${b.labelKey.charAt(0).toUpperCase()}${b.labelKey.slice(1)}`;
    const wert = api[key];
    if (typeof wert !== "string" || wert.trim() === "") {
      fehler(`${datei}: apiAccess.${key} fehlt oder ist leer (Bereich ${b.key})`);
    }
  }
}

if (befunde > 0) {
  console.error(`\n${befunde} Befund(e).`);
  process.exit(1);
}
console.log(
  `OK — ${backendScopes.length} Scopes in Backend und Oberfläche deckungsgleich, ` +
    `Etiketten in ${sprachen.length} Sprachen vorhanden.`,
);
