#!/usr/bin/env node
// Prüft die Länderliste `web/constants/countries.ts` gegen die ISO-Tabelle der
// Laufzeit (Intl.DisplayNames).
//
// WARUM ES DIESES SKRIPT GIBT (03.09.2026): Die Liste führte 193 Länder und war
// damit unvollständig — es fehlten ALLE abhängigen und teilautonomen Gebiete.
// Gemeldet wurde es nicht von einem Test, sondern vom Nutzer: „faroe islands
// fehlt". Genau dort wohnen Eigentümer; ein Ferienhaus auf den Färöern gehört
// einem Färinger, und dessen Land war nicht wählbar.
//
// Drei Codes waren zusätzlich UNGÜLTIG und fielen niemandem auf, weil
// Intl.DisplayNames für einen unbekannten Code den gespeicherten deutschen
// Namen zurückgibt — die Auswahl sah also korrekt aus, während ein Code
// gespeichert wurde, den kein Portal und kein Zahlungsdienst kennt:
//   FX → FR   „France métropolitaine", nie in ISO 3166-1 aufgenommen
//   SU → RU   SU ist die Sowjetunion
//   UK → GB   UK ist kein ISO-3166-1-Code
//
// Was hier NICHT geprüft wird: dass jedes von Intl gekannte Kürzel enthalten
// ist. Intls Tabelle führt 279 Einträge, darunter Organisationen (EU, EZ, UN),
// Platzhalter (ZZ, QO, XA/XB = Pseudo-Locales), unbewohnte Gebiete (Antarktis,
// Bouvetinsel) und veraltete Codes (DD, BU, CS). Ein Wohnsitz in der
// „Europäischen Union" ist keine Angabe, die ein Portal verarbeiten kann —
// diese Kürzel stehen in AUSGESCHLOSSEN und sind dort mit Grund vermerkt.
//
// AUFRUF (vom Repo-Root):
//     node scripts/i18n/laenderliste-pruefen.mjs
// Exit 1 bei ungültigem Code, Dublette oder fehlendem Pflicht-Gebiet.

import { readFileSync } from "node:fs";

const DATEI = "web/constants/countries.ts";

// Kürzel, die Intl kennt, die aber KEIN wählbarer Wohnsitz sind.
const AUSGESCHLOSSEN = new Set([
  // Organisationen und Platzhalter
  "EU", "EZ", "UN", "QO", "ZZ", "XA", "XB",
  // Sonderzonen ohne eigenes ISO-Land (gehören zum Mutterland)
  "AC", "TA", "CP", "DG", "IC", "EA",
  // unbewohnt bzw. Forschungsgebiete
  "AQ", "BV", "HM", "GS", "TF", "UM", "IO",
  // veraltet
  "DD", "SU", "FX", "AN", "BU", "CS", "NH", "RH", "VD", "YD", "ZR",
  "UK", "AA", "YU", "DY", "HV", "TP",
]);

// Gebiete, die WIRKLICH gefehlt haben und deshalb namentlich gesichert sind.
// Sie stehen hier, damit ein späteres Neu-Generieren sie nicht wieder verliert.
const PFLICHT = {
  FO: "Färöer — der gemeldete Fall",
  GL: "Grönland",
  GI: "Gibraltar",
  JE: "Jersey",
  GG: "Guernsey",
  IM: "Isle of Man",
  AX: "Ålandinseln",
  PR: "Puerto Rico",
  HK: "Hongkong",
  MO: "Macau",
  RE: "Réunion",
  NC: "Neukaledonien",
  PF: "Französisch-Polynesien",
  GP: "Guadeloupe",
  MQ: "Martinique",
  GF: "Französisch-Guayana",
  YT: "Mayotte",
  // Die drei zuvor falsch codierten Länder
  FR: "Frankreich (war FX)",
  RU: "Russland (war SU)",
  GB: "Vereinigtes Königreich (war UK)",
  // Länder, die schlicht fehlten
  ZA: "Südafrika",
  SS: "Südsudan",
  TL: "Timor-Leste",
  PS: "Palästinensische Autonomiegebiete",
  DM: "Dominica",
  EH: "Westsahara",
};

const quelle = readFileSync(DATEI, "utf8");
const paare = [
  ...quelle.matchAll(/\{ value: "([^"]+)", code: "([A-Z]{2})" \}/g),
].map((m) => ({ name: m[1], code: m[2] }));

if (paare.length === 0) {
  console.error(`${DATEI}: keine Einträge gefunden — Format geändert?`);
  process.exit(1);
}

const anzeige = new Intl.DisplayNames(["de"], { type: "region" });
const fehler = [];

// 1. Jeder Code muss ein gültiges ISO-3166-1-alpha-2-Kürzel sein.
for (const { code, name } of paare) {
  const bekannt = anzeige.of(code);
  if (!bekannt || bekannt === code) {
    fehler.push(`ungültiger Code "${code}" (${name}) — Intl kennt ihn nicht`);
  }
  if (AUSGESCHLOSSEN.has(code)) {
    fehler.push(`"${code}" (${name}) steht in AUSGESCHLOSSEN und darf nicht in der Liste stehen`);
  }
}

// 2. Keine doppelten Codes und keine doppelten Namen: ein doppelter Name ist in
//    der Auswahl nicht unterscheidbar (so war "Serbien" zweimal drin, RS und
//    das veraltete YU).
const jeCode = new Map();
const jeName = new Map();
for (const { code, name } of paare) {
  if (jeCode.has(code)) fehler.push(`Code "${code}" doppelt`);
  jeCode.set(code, name);
  if (jeName.has(name)) {
    fehler.push(`Name "${name}" doppelt (${jeName.get(name)} und ${code})`);
  }
  jeName.set(name, code);
}

// 3. Die namentlich gesicherten Gebiete müssen enthalten sein.
for (const [code, warum] of Object.entries(PFLICHT)) {
  if (!jeCode.has(code)) fehler.push(`"${code}" fehlt — ${warum}`);
}

// 4. Bericht über die Abdeckung: was Intl kennt, wir nicht führen und was auch
//    nicht ausgeschlossen ist. KEIN Fehler, nur ein Hinweis — ISO ändert sich,
//    und ein neues Kürzel soll den Lauf nicht rot machen, sondern auffallen.
const offen = [];
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a) + String.fromCharCode(b);
    if (jeCode.has(code) || AUSGESCHLOSSEN.has(code)) continue;
    if (/^(Q[M-Z]|X[C-Z])$/.test(code)) continue;
    const name = anzeige.of(code);
    if (name && name !== code) offen.push(`${code}=${name}`);
  }
}

console.log(`${DATEI}: ${paare.length} Gebiete, ${fehler.length} Fehler`);
if (offen.length > 0) {
  console.log(
    `\nHINWEIS: ${offen.length} von Intl gekannte Kürzel stehen weder in der ` +
      `Liste noch in AUSGESCHLOSSEN:\n  ${offen.join(", ")}\n` +
      `Entweder aufnehmen oder mit Grund in AUSGESCHLOSSEN eintragen.`,
  );
}
if (fehler.length > 0) {
  console.error("\nFEHLER:");
  for (const f of fehler) console.error(`  ${f}`);
  process.exit(1);
}
console.log("Alle Codes gültig, keine Dubletten, alle Pflicht-Gebiete vorhanden.");
