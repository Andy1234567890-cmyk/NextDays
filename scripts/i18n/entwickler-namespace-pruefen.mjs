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

// Namen, die in JEDER Sprache wörtlich stehen bleiben, auch ohne Backticks:
// Header, Zugangsdaten-Bezeichnungen, Standards. Bewusst eine EXPLIZITE Liste
// und kein Muster über „Großbuchstabe + Bindestrich": ein solches Muster fängt
// deutsche Komposita mit (`Hilfe-Center`, `OpenAPI-Datei`, `Basis-Adresse`,
// `Rate-Plan`) und verlangt sie dann unübersetzt in allen 24 Sprachen. Das ist
// die falsche Forderung — „Hilfe-Center" MUSS auf Polnisch anders heißen, und
// `Rate-Plan` soll ausdrücklich übersetzt werden. Der erste Lauf dieses Skripts
// meldete deshalb 154 Befunde, von denen kein einziger einen echten Bezeichner
// betraf.
const FESTE_NAMEN = [
  "Idempotency-Key",
  "Idempotency-Replayed",
  "Retry-After",
  "MyNextDays-Signature",
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
  "HMAC-SHA256",
  "Client-ID",
  "Client-Secret",
  "Access-Token",
  "RFC 9457",
  "OpenAPI 3.1",
  "OAuth2",
  "openapi.json",
];

/**
 * Bezeichner, die in JEDER Sprache identisch stehen müssen: alles in Backticks
 * (Feldnamen, Pfade, Statuswerte) plus die feste Namensliste oben.
 *
 * `includes` statt Regex-Match für die festen Namen: manche Sprachen setzen ein
 * Artikel-Präfix davor (maltesisch „Il-Client-ID"), und ein Wortgrenzen-Match
 * würde das als verändert melden, obwohl die Kennung unversehrt im Text steht.
 */
function bezeichner(text) {
  const treffer = new Set();
  for (const m of text.matchAll(/`([^`]+)`/g)) treffer.add(m[1]);
  for (const name of FESTE_NAMEN) if (text.includes(name)) treffer.add(name);
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

  // ICU-Platzhalter: next-intl liest jedes `{…}` als Argument. Steht in einem
  // Text `{id}` als Teil eines API-Pfades, sucht die Bibliothek einen Wert
  // dafür, findet keinen und rendert statt des Textes den SCHLÜSSEL — die Seite
  // sieht dann aus wie ein halb übersetztes Gerippe, ohne dass etwas fehlt.
  // Genau so ist die Seite „Einschränkungen" live gebrochen, weil dort
  // `PATCH /v1/reservations/{id}` steht.
  //
  // Erlaubt ist deshalb nur die escapte Form `'{'`. Ein echter Platzhalter
  // wäre möglich, würde aber in diesem Namespace bedeuten, dass jede
  // Aufrufstelle ihn füllen muss — hier gibt es keinen.
  for (const p of soll) {
    const uw = wert(ns, p);
    if (typeof uw !== "string") continue;
    // Alles, was nicht direkt hinter einem Apostroph steht, ist unescapt.
    const offen = uw.match(/(?<!')\{/g);
    if (offen) {
      console.error(
        `${sprache}: ${p} — ${offen.length} unescapte geschweifte Klammer(n). ` +
          "Als ICU-Platzhalter gelesen; `{id}` muss `'{'id}` heißen.",
      );
      befunde++;
    }

    // Spitze Klammern sind für next-intl RICH-TEXT-TAGS. `<access_token>` wirft
    // INVALID_MESSAGE: UNCLOSED_TAG und reißt die ganze Seite mit — und anders
    // als bei geschweiften Klammern gibt es dafür KEIN Escaping in ICU. Ein
    // Platzhalter wird deshalb GROSSGESCHRIEBEN (`ACCESS_TOKEN`), nicht
    // geklammert.
    const tags = uw.match(/<[^>]*>/g);
    if (tags) {
      console.error(
        `${sprache}: ${p} — spitze Klammern (${tags.join(", ")}). ` +
          "next-intl liest sie als Tag (UNCLOSED_TAG); " +
          "Platzhalter stattdessen GROSS schreiben, z. B. ACCESS_TOKEN.",
      );
      befunde++;
    }
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
