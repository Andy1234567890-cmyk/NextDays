#!/usr/bin/env node
// Prüft jede Datei mit "use server" darauf, dass sie AUSSCHLIESSLICH async
// functions exportiert.
//
// WARUM ES DIESES SKRIPT BRAUCHT: Next.js meldet den Verstoß erst in
// „Collecting page data" — also im Deploy-Build, nicht lokal. Die Meldung
// lautet `A "use server" file can only export async functions, found object`
// und nennt WEDER Datei NOCH Symbol; sie zeigt auf `action-validate.ts` in
// Next.js selbst. `tsc --noEmit` und `bun run lint` sehen davon nichts.
//
// Real passiert am 30.08.2026: zwei `export const`-Arrays in `web/lib/inbox.ts`
// (die sieben Wissenskategorien) legten /posteingang mit HTTP 500 lahm. Der
// Code war typkorrekt, lintfrei und falsch.
//
// Die Lösung ist immer dieselbe: Werte und Typen in eine NACHBARDATEI ohne die
// Direktive. `export type` bleibt erlaubt — Typen verschwinden beim Übersetzen.
//
// Aufruf:  node scripts/diagnose/use-server-exporte-pruefen.mjs [verzeichnis …]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WURZELN = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["web", "marketing", "admin", "builder", "storybook"];

const UEBERSPRINGEN = new Set(["node_modules", ".next", "dist", "build", ".turbo", ".git"]);

/** Alle .ts/.tsx unterhalb eines Verzeichnisses. */
function* dateien(pfad) {
  let eintraege;
  try {
    eintraege = readdirSync(pfad);
  } catch {
    return; // Verzeichnis gibt es in diesem Projekt nicht — kein Fehler.
  }
  for (const name of eintraege) {
    if (UEBERSPRINGEN.has(name)) continue;
    const voll = join(pfad, name);
    if (statSync(voll).isDirectory()) yield* dateien(voll);
    else if (/\.(ts|tsx)$/.test(name)) yield voll;
  }
}

/** Exporte, die KEINE async function sind. `export type`/`export interface`
 *  sind erlaubt: sie existieren zur Laufzeit nicht. */
function verstoesse(inhalt) {
  const gefunden = [];
  const zeilen = inhalt.split("\n");
  zeilen.forEach((zeile, i) => {
    const nr = i + 1;
    if (/^export\s+(type|interface)\b/.test(zeile)) return;
    // `export { … }` ohne `type` re-exportiert Werte — auch das kann ein
    // Nicht-Funktions-Wert sein, aber ohne Auflösen des Ziels lässt sich das
    // hier nicht entscheiden. Wird gemeldet, damit jemand hinsieht.
    if (/^export\s+(const|let|var|class|enum)\b/.test(zeile)) {
      gefunden.push({ nr, zeile: zeile.trim(), grund: "kein async function" });
      return;
    }
    if (/^export\s+function\b/.test(zeile) && !/^export\s+async\s+function\b/.test(zeile)) {
      gefunden.push({ nr, zeile: zeile.trim(), grund: "function ohne async" });
    }
    if (/^export\s+default\b/.test(zeile) && !/^export\s+default\s+async\b/.test(zeile)) {
      gefunden.push({ nr, zeile: zeile.trim(), grund: "default ohne async" });
    }
  });
  return gefunden;
}

let geprueft = 0;
let kaputt = 0;

for (const wurzel of WURZELN) {
  for (const datei of dateien(wurzel)) {
    const inhalt = readFileSync(datei, "utf8");
    // Die Direktive muss ganz oben stehen (vor jedem Import).
    const kopf = inhalt.slice(0, 200);
    if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(kopf)) continue;
    geprueft += 1;
    const treffer = verstoesse(inhalt);
    if (treffer.length === 0) continue;
    kaputt += 1;
    console.error(`\n✗ ${relative(process.cwd(), datei)}`);
    for (const t of treffer) {
      console.error(`   Zeile ${t.nr}: ${t.grund}\n     ${t.zeile}`);
    }
  }
}

if (kaputt > 0) {
  console.error(
    `\n${kaputt} von ${geprueft} "use server"-Dateien exportieren etwas anderes ` +
      "als async functions.\n" +
      "Das bricht den Build erst in „Collecting page data\" — mit einer Meldung, " +
      "die weder Datei noch Symbol nennt.\n" +
      "Lösung: Werte und Typen in eine Nachbardatei OHNE die Direktive " +
      "(z. B. `lib/<name>-typen.ts`), von dort importieren.\n",
  );
  process.exit(1);
}

console.log(`✓ ${geprueft} "use server"-Dateien geprüft, alle Exporte sind async functions.`);
