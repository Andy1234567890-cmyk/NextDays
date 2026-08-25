#!/usr/bin/env node
// Findet Werte, die in einer Fremdsprachdatei noch WORTGLEICH zum Deutschen
// stehen — also nie übersetzt wurden.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM ES DIESE PRÜFUNG BRAUCHT
//
// Alle bestehenden i18n-Gates prüfen VOLLSTÄNDIGKEIT: ist der Schlüssel in
// allen 24 Dateien da (`pruefe-uebersetzungen.mjs`), gibt es zu jeder Sprache
// eine Datei (`pruefe-locales-vollstaendig.mjs`), hat jedes Backend-Feld ein
// Etikett (`pruefe-feld-labels.mjs`). Ein Schlüssel, der in der bulgarischen
// Datei den DEUTSCHEN Text trägt, besteht jede dieser Prüfungen: vorhanden,
// strukturgleich, platzhaltertreu. Er ist nur nicht übersetzt.
//
// `uebersetzungs-luecken-pruefen.mjs` (Prüfung A) fängt davon nur die Fälle,
// die in MINDESTENS 80 % der Sprachen gleichzeitig deutsch stehen. Genau daran
// ist der reale Anlass vorbeigelaufen (25.08.2026): `inbox.checkIn`,
// `inbox.checkOut` und `inbox.nights` standen in 15 von 23 Sprachen auf
// „Anreise/Abreise/Nächte" — 65 %, also unter der Schwelle, also stumm. Der
// ganze `inbox.*`-Namensraum war in denselben 15 Sprachen deutsch: über
// hundert Schlüssel, die ein bulgarischer oder griechischer Nutzer als
// deutsche Wörter im Posteingang sieht.
//
// Diese Prüfung urteilt deshalb PRO SPRACHE statt über eine Sprachmehrheit:
// jeder Wert, der in genau dieser einen Datei wortgleich zum Deutschen steht,
// ist ein Verdacht.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM DER VERDACHT NICHT DER BEFUND IST
//
// „Gleich wie Deutsch" ist kein Beweis für „vergessen". Drei Klassen stehen
// zu Recht gleich:
//
//   1. Textfreie Werte — „—", „–", „…", „{property} · {date} · {status}",
//      „12345", „https://…/calendar.ics". Die erkennt das Skript STRUKTURELL
//      (siehe STRUKTURELL_FREI): sie enthalten nach Abzug von Platzhaltern,
//      Ziffern und Zeichensetzung keinen übersetzbaren Buchstaben mehr.
//      Diese Regel ist bewusst eng — sie darf kein echtes Wort verstecken.
//
//   2. Marken, Kürzel, technische Marker — Airbnb, IBAN, DOC_META:. Die
//      stehen in ALLEN Sprachen gleich und gehören in die Allowlist mit
//      `"sprachen": "alle"`.
//
//   3. Wörter, die in EINER bestimmten Sprache tatsächlich gleich lauten —
//      „Website" ist niederländisch „Website", „Sauna" ist finnisch „Sauna",
//      „Hotel" ist portugiesisch „Hotel". Das ist keine Musterfrage, sondern
//      eine Sprachfrage: dieselbe Zeichenkette ist in nl richtig und in pl
//      („Strona") falsch. Deshalb trägt jeder solche Allowlist-Eintrag die
//      Liste der Sprachen, für die er geprüft wurde — nie ein pauschales
//      „gilt überall".
//
// Eine Heuristik anstelle der Allowlist wurde verworfen, aus demselben Grund
// wie in `uebersetzungs-luecken-pruefen.mjs`: Musterlisten fangen deutsche
// Komposita mit (Hilfe-Center, Rate-Plan), Wortlisten scheitern an der
// Sprachabhängigkeit. Eine Allowlist mit Grund je Eintrag ist die einzige
// Form, die über Jahre ehrlich bleibt.
//
// Aufruf:  node scripts/i18n/deutsche-restwerte-pruefen.mjs [--json] [sprache …]
// Exit 1 bei jedem Befund, damit das Skript ins Qualitätsgate kann.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "../..");
const NACHRICHTEN = join(WURZEL, "web/messages");
const BASIS = "de";
const ALLOWLIST = join(HIER, "deutsche-restwerte-allowlist.json");

/** Ein Wert gilt als textfrei, wenn nach Abzug aller Platzhalter, Zahlen und
 *  Zeichensetzung kein Buchstabe mehr übrig ist — oder wenn er als Ganzes eine
 *  maschinenlesbare Form ist (URL, E-Mail, technische Vorlagenmarke).
 *
 *  Absichtlich eng gehalten: jede Regel hier versteckt Werte VOR dem
 *  menschlichen Blick, ohne dass jemand einen Grund geschrieben hat. Was nur
 *  „meistens" textfrei ist, gehört nicht hierher, sondern in die Allowlist. */
function strukturellFrei(wert) {
  // Platzhalter ({name}, [%MARKE%]) tragen keinen übersetzbaren Text.
  const ohnePlatzhalter = wert
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[%[^%]*%\]/g, " ");
  if (!/\p{L}/u.test(ohnePlatzhalter)) return "textfrei";

  if (/^https?:\/\//.test(wert.trim())) return "url";
  if (/^[^\s@]+@[^\s@]+\.\p{L}{2,}$/u.test(wert.trim())) return "email";

  // Technische Vorlagenmarke: GROSSBUCHSTABEN-Feldname plus Doppelpunkt, den
  // die Gegenseite maschinell liest (DOC_META:, ADDR1: {value}).
  if (/^[A-Z][A-Z0-9_]{2,}:/.test(wert.trim())) return "technische-marke";

  return null;
}

function flach(objekt, praefix = "", ziel = {}) {
  for (const [schluessel, wert] of Object.entries(objekt)) {
    const pfad = praefix ? `${praefix}.${schluessel}` : schluessel;
    if (wert && typeof wert === "object" && !Array.isArray(wert)) {
      flach(wert, pfad, ziel);
    } else {
      ziel[pfad] = wert;
    }
  }
  return ziel;
}

function lade(sprache) {
  return flach(
    JSON.parse(readFileSync(join(NACHRICHTEN, `${sprache}.json`), "utf8")),
  );
}

// ── Allowlist einlesen und in zwei Nachschlagewerke übersetzen ───────────────
const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
const gruende = new Set(Object.keys(allowlist.gruende ?? {}));
const nachWert = new Map(); // Wert  → Set<Sprache> | "alle"
const nachSchluessel = new Map(); // Schlüssel → Set<Sprache> | "alle"

let allowlistFehler = 0;
for (const [index, eintrag] of (allowlist.erlaubt ?? []).entries()) {
  const stelle = `erlaubt[${index}]`;
  if (!eintrag.grund || !gruende.has(eintrag.grund)) {
    console.error(`✗ ${stelle}: Grund fehlt oder ist unbekannt.`);
    allowlistFehler += 1;
    continue;
  }
  const sprachen =
    eintrag.sprachen === "alle" ? "alle" : new Set(eintrag.sprachen ?? []);
  if (sprachen !== "alle" && sprachen.size === 0) {
    console.error(`✗ ${stelle}: weder "alle" noch eine Sprachliste.`);
    allowlistFehler += 1;
    continue;
  }
  const ziel = eintrag.wert !== undefined ? nachWert : nachSchluessel;
  const kennung = eintrag.wert !== undefined ? eintrag.wert : eintrag.schluessel;
  if (kennung === undefined) {
    console.error(`✗ ${stelle}: weder "wert" noch "schluessel".`);
    allowlistFehler += 1;
    continue;
  }
  const vorhanden = ziel.get(kennung);
  if (vorhanden === "alle" || sprachen === "alle") {
    ziel.set(kennung, "alle");
  } else {
    ziel.set(kennung, new Set([...(vorhanden ?? []), ...sprachen]));
  }
}
if (allowlistFehler > 0) process.exit(2);

function erlaubt(karte, kennung, sprache) {
  const treffer = karte.get(kennung);
  if (!treffer) return false;
  return treffer === "alle" || treffer.has(sprache);
}

// ── Prüfen ──────────────────────────────────────────────────────────────────
const argumente = process.argv.slice(2);
const alsJson = argumente.includes("--json");
const gewuenscht = argumente.filter((a) => !a.startsWith("--"));

const alleSprachen = readdirSync(NACHRICHTEN)
  .filter((n) => n.endsWith(".json"))
  .map((n) => n.replace(/\.json$/, ""))
  .filter((s) => s !== BASIS)
  .sort();
const sprachen = gewuenscht.length > 0 ? gewuenscht : alleSprachen;

const de = lade(BASIS);
const befundeJeSprache = new Map();
const nichtBewertet = new Map(); // strukturell freigestellt — Ehrlichkeitszahl

for (const sprache of sprachen) {
  const daten = lade(sprache);
  const befunde = [];
  let freigestellt = 0;
  for (const [schluessel, deutsch] of Object.entries(de)) {
    if (typeof deutsch !== "string") continue;
    if (daten[schluessel] !== deutsch) continue;
    if (strukturellFrei(deutsch)) {
      freigestellt += 1;
      continue;
    }
    if (erlaubt(nachWert, deutsch, sprache)) continue;
    if (erlaubt(nachSchluessel, schluessel, sprache)) continue;
    befunde.push({ schluessel, wert: deutsch });
  }
  befundeJeSprache.set(sprache, befunde);
  nichtBewertet.set(sprache, freigestellt);
}

const gesamt = [...befundeJeSprache.values()].reduce((s, b) => s + b.length, 0);

if (alsJson) {
  console.log(
    JSON.stringify(
      Object.fromEntries(
        [...befundeJeSprache].map(([s, b]) => [
          s,
          Object.fromEntries(b.map((e) => [e.schluessel, e.wert])),
        ]),
      ),
      null,
      2,
    ),
  );
  process.exit(gesamt > 0 ? 1 : 0);
}

for (const [sprache, befunde] of befundeJeSprache) {
  if (befunde.length === 0) continue;
  console.error(`\n✗ ${sprache}: ${befunde.length} Werte stehen auf Deutsch`);
  for (const { schluessel, wert } of befunde) {
    console.error(`    ${schluessel}  →  ${JSON.stringify(wert)}`);
  }
}

const freigestelltGesamt = [...nichtBewertet.values()].reduce((s, n) => s + n, 0);
if (gesamt === 0) {
  console.log(
    `✓ ${sprachen.length} Sprachen ohne deutsche Restwerte ` +
      `(${freigestelltGesamt} Werte strukturell freigestellt, ` +
      `${allowlist.erlaubt.length} Allowlist-Einträge).`,
  );
} else {
  console.error(
    `\n${gesamt} deutsche Restwerte in ${
      [...befundeJeSprache.values()].filter((b) => b.length > 0).length
    } Sprachen. ` +
      `Übersetzen — oder, wenn der Wert in dieser Sprache wirklich gleich ` +
      `lautet, mit Grund in ${ALLOWLIST.replace(WURZEL + "/", "")} eintragen.`,
  );
}
process.exit(gesamt > 0 ? 1 : 0);
