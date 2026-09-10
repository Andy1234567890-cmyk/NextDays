#!/usr/bin/env node
// Hält den Funktions-Katalog und die vier Listen deckungsgleich, die ihn zeigen.
//
// WARUM ES DIESES SKRIPT GIBT:
// `content/funktionen.ts` ist die Quelle der Funktions-Unterseiten, aber KEINE
// der Anzeigestellen leitet sich daraus ab — jede führt ihre eigene Reihenfolge:
//   1. `marketing-nav.tsx`      → MENU_SPALTEN (Megamenü, der einzige Weg zur Seite)
//   2. `marketing-features.tsx` → GRUPPEN (Funktionsliste der Startseite)
//   3. `preis-rechner.tsx`      → GRUPPEN (Leistungsumfang im Tarif)
//   4. `messages/de.json`       → features.gruppen (Name + Stichwortzeile)
// Eine fünfte Stelle, `app/llms.txt/route.ts` → FUNKTION_NOTIZ, prüft sich
// selbst: sie ist `Record<FunktionsSchluessel, string>` typisiert, `tsc` meldet
// dort einen fehlenden Schlüssel von allein. Genau so ist sie beim Anlegen der
// Eigentümer-Seite aufgefallen — deshalb steht sie hier als Vorbild und nicht
// als weiterer Prüffall: wo ein Typ die Vollständigkeit erzwingen kann, braucht
// es kein Skript.
// Eine neue Funktionsseite ohne Eintrag im Megamenü ist gebaut und unerreichbar:
// `tsc` sieht das nicht, `lint` auch nicht, und im Browser fällt es nur auf, wenn
// jemand gezielt danach sucht. Genau das ist beim Anlegen der Eigentümer-Seite
// (09.09.2026) beinahe passiert — aufgefallen ist es nicht dem Werkzeug, sondern
// dem Zuruf „denke an das nav".
//
// Die Preisseite ist bewusst mitgeprüft: sie verspricht den Leistungsumfang des
// Tarifs. Fehlt dort eine Gruppe, die es gibt, verkauft die Seite zu wenig;
// steht dort eine, die es nicht gibt, verspricht sie zu viel.
//
// Exit 1 mit Klartext, damit der Lauf in CI bricht statt nur zu mahnen.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p) => readFileSync(join(wurzel, p), "utf8");

/** Schlüssel aus `content/funktionen.ts` — die Quelle. */
function katalogSchluessel() {
  const quelle = lies("content/funktionen.ts");
  // Nur der Rumpf von FUNKTIONEN, nicht der Typ darüber (der listet dieselben
  // Namen als Union und würde jeden Schlüssel doppelt liefern).
  const start = quelle.indexOf("export const FUNKTIONEN");
  if (start === -1) throw new Error("FUNKTIONEN nicht gefunden in content/funktionen.ts");
  return [...quelle.slice(start).matchAll(/^\s*key:\s*"([^"]+)"/gm)].map((m) => m[1]);
}

/** Der Zuweisungs-Rumpf ab `= [` bis zur zugehörigen schließenden Klammer.
 *
 *  Klammern werden GEZÄHLT, nicht gesucht: die Typdeklaration einer Liste
 *  enthält selbst `string[];`, und ein `indexOf("];")` endete deshalb vor den
 *  Daten — der erste Anlauf dieses Skripts meldete daraufhin jeden Schlüssel
 *  als fehlend, auch die seit Monaten vorhandenen. Ein Prüfer, der immer
 *  Alarm schlägt, ist so wertlos wie einer, der nie anschlägt. */
function rumpfNachZuweisung(quelle, ankerIndex) {
  const start = quelle.indexOf("[", quelle.indexOf("=", ankerIndex));
  let tiefe = 0;
  for (let i = start; i < quelle.length; i++) {
    if (quelle[i] === "[") tiefe++;
    else if (quelle[i] === "]" && --tiefe === 0) return quelle.slice(start, i + 1);
  }
  throw new Error("Keine schließende Klammer gefunden");
}

/** Schlüssel einer als Array notierter Liste von Zeichenketten. */
function listeSchluessel(datei, anker) {
  const quelle = lies(datei);
  const i = quelle.indexOf(anker);
  if (i === -1) throw new Error(`Anker "${anker}" nicht gefunden in ${datei}`);
  return [...rumpfNachZuweisung(quelle, i).matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
}

const katalog = katalogSchluessel();

// Megamenü: alle drei Spalten zusammen. Hier zählen nur die Werte hinter
// `gruppen:` — „kern"/„gast"/„betrieb" sind Spaltentitel, keine Funktionen.
const menue = (() => {
  const quelle = lies("components/marketing/marketing-nav.tsx");
  const rumpf = rumpfNachZuweisung(quelle, quelle.indexOf("const MENU_SPALTEN"));
  return [...rumpf.matchAll(/gruppen:\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  );
})();

const startseite = listeSchluessel(
  "components/marketing/marketing-features.tsx",
  "const GRUPPEN",
);
const preisseite = listeSchluessel("components/preise/preis-rechner.tsx", "const GRUPPEN");
const texte = Object.keys(JSON.parse(lies("messages/de.json")).features.gruppen);

const stellen = [
  ["Megamenü (marketing-nav.tsx)", menue],
  ["Startseite (marketing-features.tsx)", startseite],
  ["Preisseite (preis-rechner.tsx)", preisseite],
  ["Texte (messages/de.json → features.gruppen)", texte],
];

let fehler = 0;
for (const [name, liste] of stellen) {
  const fehlt = katalog.filter((k) => !liste.includes(k));
  const zuviel = liste.filter((k) => !katalog.includes(k));
  if (fehlt.length) {
    console.error(`FEHLT in ${name}: ${fehlt.join(", ")}`);
    fehler++;
  }
  if (zuviel.length) {
    console.error(`UNBEKANNT in ${name} (nicht im Katalog): ${zuviel.join(", ")}`);
    fehler++;
  }
}

// Jede Funktionsseite braucht ihren Textblock — sonst rendert sie
// MISSING_MESSAGE statt einer Überschrift.
const seiten = Object.keys(JSON.parse(lies("messages/de.json")).funktionen);
const ohneTexte = katalog.filter((k) => !seiten.includes(k));
if (ohneTexte.length) {
  console.error(`OHNE Textblock (messages/de.json → funktionen.<key>): ${ohneTexte.join(", ")}`);
  fehler++;
}

if (fehler) {
  console.error(`\n${fehler} Abweichung(en). Der Katalog ist content/funktionen.ts.`);
  process.exit(1);
}
console.log(`${katalog.length} Funktionen an ${stellen.length} Stellen deckungsgleich.`);
