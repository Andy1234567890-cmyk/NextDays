#!/usr/bin/env node
// Prüft, dass der Namespace `entwickler` in ALLEN 24 Sprachdateien der
// Marketing-App vollständig und strukturgleich vorliegt.
//
// Warum das ein eigenes Skript braucht: `marketing/i18n/request.ts` lädt die
// Sprachdatei OHNE Merge mit der Basissprache. Ein fehlender Schlüssel ist
// deshalb kein deutscher Text, sondern ein `MISSING_MESSAGE` — und in einer
// Server Component bricht damit die ganze Seite. Von Hand nachzuzählen ist bei
// 179 Schlüsseln × 24 Sprachen keine Prüfung, sondern ein Ritual.
//
// Zusätzlich geprüft wird, was beim Übersetzen am leichtesten kaputtgeht:
//   * Code-Bezeichner (Feldnamen, Header, Pfade in Backticks) müssen identisch
//     bleiben — ein übersetztes `booked_at` ist eine Falschaussage.
//   * Leere Werte: ein Schlüssel, der als "" durchgereicht wurde, ist schlimmer
//     als ein fehlender (er fällt nicht auf).
//
// Aufruf:  node scripts/i18n/entwickler-namespace-pruefen.mjs
// Exit 1 bei jedem Befund.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VERZEICHNIS = "marketing/messages";
const BASIS = "de";
const NAMESPACE = "entwickler";

/** Alle Blatt-Pfade eines Objekts, punktgetrennt. */
function pfade(obj, prefix = "") {
  const raus = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) raus.push(...pfade(v, p));
    else raus.push(p);
  }
  return raus;
}

function wert(obj, pfad) {
  return pfad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Bezeichner, die in JEDER Sprache identisch stehen müssen: alles in Backticks
 * (Feldnamen, Pfade, Statuswerte) und die Header-Namen mit Bindestrich.
 */
function bezeichner(text) {
  const treffer = new Set();
  for (const m of text.matchAll(/`([^`]+)`/g)) treffer.add(m[1]);
  for (const m of text.matchAll(/\b([A-Z][A-Za-z]+-[A-Za-z-]+)\b/g)) treffer.add(m[1]);
  return treffer;
}

const dateien = readdirSync(VERZEICHNIS).filter((f) => f.endsWith(".json"));
const basis = JSON.parse(readFileSync(join(VERZEICHNIS, `${BASIS}.json`), "utf8"));
const basisNs = basis[NAMESPACE];
if (!basisNs) {
  console.error(`FEHLER: ${BASIS}.json hat keinen Namespace \`${NAMESPACE}\`.`);
  process.exit(1);
}
const soll = pfade(basisNs).sort();

let befunde = 0;
for (const datei of dateien.sort()) {
  const sprache = datei.replace(/\.json$/, "");
  const daten = JSON.parse(readFileSync(join(VERZEICHNIS, datei), "utf8"));
  const ns = daten[NAMESPACE];
  if (!ns) {
    console.error(`${sprache}: Namespace \`${NAMESPACE}\` fehlt vollständig.`);
    befunde++;
    continue;
  }
  const ist = pfade(ns).sort();
  const fehlt = soll.filter((p) => !ist.includes(p));
  const zuviel = ist.filter((p) => !soll.includes(p));
  const leer = soll.filter((p) => {
    const v = wert(ns, p);
    return typeof v === "string" && v.trim() === "";
  });

  if (fehlt.length) {
    console.error(`${sprache}: ${fehlt.length} Schlüssel fehlen — ${fehlt.slice(0, 5).join(", ")}${fehlt.length > 5 ? " …" : ""}`);
    befunde++;
  }
  if (zuviel.length) {
    console.error(`${sprache}: ${zuviel.length} unbekannte Schlüssel — ${zuviel.slice(0, 5).join(", ")}`);
    befunde++;
  }
  if (leer.length) {
    console.error(`${sprache}: ${leer.length} leere Werte — ${leer.slice(0, 5).join(", ")}`);
    befunde++;
  }

  // Bezeichner-Treue nur dort prüfen, wo die Basissprache welche enthält.
  if (sprache !== BASIS) {
    for (const p of soll) {
      const dt = wert(basisNs, p);
      const uw = wert(ns, p);
      if (typeof dt !== "string" || typeof uw !== "string") continue;
      const erwartet = bezeichner(dt);
      if (erwartet.size === 0) continue;
      const vorhanden = bezeichner(uw);
      const verloren = [...erwartet].filter((b) => !vorhanden.has(b));
      if (verloren.length) {
        console.error(
          `${sprache}: ${p} — Bezeichner verändert/verloren: ${verloren.join(", ")}`,
        );
        befunde++;
      }
    }
  }
}

if (befunde > 0) {
  console.error(`\n${befunde} Befund(e). Der Namespace ist nicht auslieferbar.`);
  process.exit(1);
}
console.log(
  `OK — \`${NAMESPACE}\` in ${dateien.length} Sprachen vollständig (${soll.length} Schlüssel je Sprache).`,
);
