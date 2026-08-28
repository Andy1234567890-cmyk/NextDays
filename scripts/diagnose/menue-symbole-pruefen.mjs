#!/usr/bin/env node
// Jede Menü-Kennung des Baukastens braucht ein Symbol.
//
// WARUM ALS PRÜFUNG
// `menueSymbol` fällt auf `ph:dot-outline` zurück, wenn eine Kennung in
// `MENUE_SYMBOL` fehlt. Ein grauer Punkt sieht aber nicht wie ein Fehler aus,
// sondern wie eine Gestaltungsentscheidung — und genau deshalb wurde dieselbe
// Lücke DREIMAL in Folge vom Nutzer gemeldet statt vom System:
//
//   1. die sieben Theme-Unterpunkte (Prüfbericht B1)
//   2. die fünf Katalog-Kategorien (zuletzt · inhalt · buchung · medien ·
//      sonstiges) — alle fünf trugen den Punkt
//   3. „layout", unmittelbar nachdem 2. behoben war und die Gruppe dazukam
//
// Ein Auffangwert, der an fünf Stellen gleichzeitig greift, verbirgt seinen
// eigenen Anlass. Die Prüfung nimmt ihm das ab.
//
// Aufruf: node scripts/diagnose/menue-symbole-pruefen.mjs
// Exit 1, wenn eine Kennung ohne Symbol dasteht.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Pfade relativ zu DIESER Datei, nicht zum Arbeitsverzeichnis: sonst läuft das
// Skript nur aus der Repo-Wurzel und scheitert in CI oder aus `web/` heraus mit
// ENOENT — was wie ein kaputtes Repo aussieht statt wie ein falscher Aufruf.
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REITER = join(WURZEL, "web/components/website/reiter.ts");
const ABSCHNITTE = join(WURZEL, "web/components/website/abschnitte.ts");

const reiter = readFileSync(REITER, "utf8");
const abschnitte = readFileSync(ABSCHNITTE, "utf8");

/** Zeilen- und Blockkommentare entfernen.
 *
 *  Ohne das zog der Regex Wörter aus den Erklärtexten ZWISCHEN den Einträgen
 *  als Kennungen mit — sieben erfundene Befunde beim ersten Lauf, und der eine
 *  echte („bausteine") stand mitten im Rauschen. Ein Prüfskript, das Fehler
 *  meldet, die es nicht gibt, ist schlimmer als keines. */
function ohneKommentare(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Die Schlüssel eines `Record`-Literals im Quelltext. */
function schluessel(quelle, name) {
  const start = quelle.indexOf(`export const ${name}`);
  if (start === -1) throw new Error(`${name} nicht gefunden`);
  const auf = quelle.indexOf("{", start);
  let tiefe = 0;
  let ende = auf;
  for (let i = auf; i < quelle.length; i++) {
    if (quelle[i] === "{") tiefe++;
    else if (quelle[i] === "}" && --tiefe === 0) {
      ende = i;
      break;
    }
  }
  const blob = ohneKommentare(quelle.slice(auf + 1, ende));
  // `farben: "…"` und `"site-layout": "…"` — beide Schreibweisen.
  return new Set(
    [...blob.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z_]\w*)):/gm)].map(
      (m) => m[1] ?? m[2],
    ),
  );
}

/** Die Einträge eines String-Array-Literals. */
function werte(quelle, name) {
  const m = quelle.match(
    new RegExp(`export const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`, "s"),
  );
  if (!m) throw new Error(`${name} nicht gefunden`);
  return [...ohneKommentare(m[1]).matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const symbole = schluessel(reiter, "MENUE_SYMBOL");
const reiterSymbole = schluessel(reiter, "REITER_SYMBOL");
const hat = (id) => symbole.has(id) || reiterSymbole.has(id);

// Woraus die Menüspalte ihre Kennungen zieht:
//   · die Katalog-Kategorien: ZULETZT_ID + GRUPPEN
//   · die Unterpunkte von SEO und Einstellungen
//   · die Theme-Unterpunkte (MENUE_I18N_SCHLUESSEL führt sie)
//   · die Extras „mediathek" und „siteText"
//   · alles, was in REITER_MENUE als `id` steht
const gruppen = werte(abschnitte, "GRUPPEN");
const zuletzt = (reiter.match(/export const ZULETZT_ID = "([^"]+)"/) ?? [])[1];
const seo = werte(reiter, "SEO_UNTERPUNKTE");
const einst = werte(reiter, "EINSTELLUNGEN_UNTERPUNKTE");
const theme = [...schluessel(reiter, "MENUE_I18N_SCHLUESSEL")];
// Die anklickbaren Einträge aus REITER_MENUE.
//
// NUR `art: "ziel"`. Eine Gruppenzeile (`art: "gruppe"`) trägt bewusst kein
// Symbol — sie ist keine Adresse, sondern klappt nur auf, und `menue-spalte.tsx`
// zeichnet dort ausschließlich den Auf-/Zu-Pfeil (so wie im Vorbild). Sie
// mitzuprüfen wäre ein gemeldeter Fehler, den es nicht gibt.
const menueBlock = ohneKommentare(
  reiter.slice(reiter.indexOf("export const REITER_MENUE")),
);
const ausMenue = [
  ...menueBlock.matchAll(/art:\s*"ziel",\s*id:\s*"([^"]+)"/g),
].map((m) => m[1]);

const quellen = [
  ["GRUPPEN (abschnitte.ts)", gruppen],
  ["ZULETZT_ID", zuletzt ? [zuletzt] : []],
  ["SEO_UNTERPUNKTE", seo],
  ["EINSTELLUNGEN_UNTERPUNKTE", einst],
  ["MENUE_I18N_SCHLUESSEL (Theme)", theme],
  ["REITER_MENUE", [...new Set(ausMenue)]],
];

let fehlt = 0;
for (const [woher, ids] of quellen) {
  const ohne = ids.filter((id) => !hat(id));
  if (ohne.length === 0) {
    console.log(`✓ ${woher} (${ids.length})`);
    continue;
  }
  fehlt += ohne.length;
  console.error(`\n✗ ${woher}: ${ohne.length} Kennung(en) ohne Symbol:`);
  for (const id of ohne) console.error(`    ${id}`);
}

if (fehlt > 0) {
  console.error(
    `\n${fehlt} Kennung(en) ohne Symbol. Sie tragen in der Oberfläche einen ` +
      `neutralen Punkt, der wie Absicht aussieht — in MENUE_SYMBOL ` +
      "(web/components/website/reiter.ts) eintragen.",
  );
  process.exit(1);
}
console.log("\nJede Menü-Kennung hat ein Symbol.");
