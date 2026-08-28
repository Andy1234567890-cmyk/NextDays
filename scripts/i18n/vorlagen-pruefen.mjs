#!/usr/bin/env node
// Hält die Vorlagen-Kataloge über Backend, Oberfläche und Sprachdateien gleich.
//
// Es gibt ZWEI Kataloge, und sie sind bewusst getrennt:
//   · Seiten-Vorlagen  (0434) — `seiten_vorlagen.py`,  Auswahl bei page_type=normal
//   · Pop-up-Vorlagen  (0440) — `popup_vorlagen.py`,   Auswahl bei page_type=popup
//
// Jeder steht an DREI Stellen: im Backend-Katalog, in der Liste im Dialog
// „Neue Seite" und als Beschriftung in 24 Sprachdateien. Keine dieser Stellen
// prüft die anderen:
//   · Name nur im Dialog        → 422 beim Anlegen („Unbekannte Vorlage")
//   · Name nur im Backend       → tote Vorlage, niemand kann sie wählen
//   · Beschriftung fehlt        → MISSING_MESSAGE in der Auswahlliste
//
// Dieselbe Fehlerklasse wie bei den Abschnitts-Typen (blocktypen-pruefen.mjs)
// und den Kanal-Enums. Aufruf: node scripts/i18n/vorlagen-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (...p) => readFileSync(join(wurzel, ...p), "utf8");
const fehler = [];

function pruefe(was, soll, ist) {
  const fehlend = soll.filter((w) => !ist.includes(w));
  const zusatz = ist.filter((w) => !soll.includes(w));
  if (fehlend.length) fehler.push(`${was}: fehlt ${fehlend.join(", ")}`);
  if (zusatz.length) fehler.push(`${was}: unbekannt ${zusatz.join(", ")}`);
}

/** Die Schlüssel des Python-Dicts `VORLAGEN` auf oberster Ebene.
 *
 *  Über die Einrückung und nicht über einen Python-Parser: die Einträge stehen
 *  alle mit genau vier Leerzeichen, verschachtelte Werte tiefer. Ein echter
 *  Parser wäre hier mehr Maschinerie als Gewinn. */
function pythonKatalog(datei) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split("VORLAGEN: dict[str, dict[str, Any]] = {")[1];
  if (!block) throw new Error(`VORLAGEN in ${datei} nicht gefunden`);
  return [...block.matchAll(/^ {4}"(\w+)":/gm)].map((m) => m[1]);
}

/** Eine `const NAME = [...]`-Liste aus dem Dialog. */
function tsListe(datei, name) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(`const ${name} = [`)[1]?.split("]")[0];
  if (!block) throw new Error(`${name} in ${datei} nicht gefunden`);
  return [...block.matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

const KATALOGE = [
  {
    name: "Seiten-Vorlagen",
    python: "apps/api/src/features/site_config/seiten_vorlagen.py",
    tsName: "VORLAGEN",
    i18n: (website) => website?.seiten?.vorlage ?? {},
    // `label` und `keine` sind Beschriftungen des Dialogs, keine Vorlagen.
    ignorieren: ["label", "keine"],
  },
  {
    name: "Pop-up-Vorlagen",
    python: "apps/api/src/features/site_config/popup_vorlagen.py",
    tsName: "POPUP_VORLAGEN",
    i18n: (website) => website?.seiten?.popupVorlage ?? {},
    ignorieren: [],
  },
];

const DIALOG = "web/components/website/seiten/neue-seite.tsx";
const nachrichten = join(wurzel, "web", "messages");
const sprachen = readdirSync(nachrichten).filter((n) => n.endsWith(".json"));

for (const katalog of KATALOGE) {
  const backend = pythonKatalog(katalog.python);
  pruefe(`${katalog.name}: Dialog`, backend, tsListe(DIALOG, katalog.tsName));

  for (const datei of sprachen) {
    const website = JSON.parse(
      readFileSync(join(nachrichten, datei), "utf8"),
    ).website;
    const texte = katalog.i18n(website);
    const vorhanden = Object.keys(texte).filter(
      (k) => !katalog.ignorieren.includes(k),
    );
    pruefe(`${katalog.name}: web/messages/${datei}`, backend, vorhanden);
  }
}

for (const z of fehler) console.error(z);
if (fehler.length) {
  console.error(`\n${fehler.length} Abweichung(en) in den Vorlagen-Katalogen.`);
  process.exit(1);
}
console.log(
  `✓ Vorlagen deckungsgleich (${KATALOGE.map(
    (k) => `${k.name}: ${pythonKatalog(k.python).length}`,
  ).join(", ")}) über Backend, Dialog und ${sprachen.length} Sprachdateien.`,
);
