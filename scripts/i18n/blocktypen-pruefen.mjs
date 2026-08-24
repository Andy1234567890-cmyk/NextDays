#!/usr/bin/env node
// Hält die Abschnitts-Typen des Website-Baukastens über die ganze Kette gleich.
//
// Ein Abschnittstyp steht an SIEBEN Stellen, und keine davon prüft die anderen:
//   1. DB    — CHECK `site_blocks_type_check` (Migration 0087, erweitert 0266/0431)
//   2. API   — `BlockType` (StrEnum, site_config/schemas.py)
//   3. API   — `_CONTENT_MODEL` (welcher Typ welches content-Schema hat)
//   4. web   — `BlockType` (Union in lib/site-pages.ts)
//   5. web   — `ABSCHNITTE` (der Katalog, aus dem der Editor sein Formular baut)
//   6. builder — `BlockType` (Union in lib/site.ts)
//   7. builder — `renderBlock` (das switch, das wirklich rendert)
// Dazu je Sprachdatei `website.abschnitte.<label>` und `<label>Hinweis`.
//
// Was ohne diese Prüfung passiert, ist keine Theorie, sondern das Muster, das
// bei den Kanal-Enums schon zugeschlagen hat (siehe kanal-enums-pruefen.mjs):
//   · Typ in der DB, aber nicht im Enum      → 422 beim Speichern einer Seite,
//     die vorher funktionierte
//   · Typ im Katalog, aber nicht im Renderer → der Kunde legt den Abschnitt an,
//     die Vorschau bleibt leer, und nichts sagt ihm warum
//   · Typ im Renderer, aber nicht im Katalog → toter Code, unerreichbar
//   · Label ohne Übersetzung                 → MISSING_MESSAGE im Katalog
//
// Bewusst NICHT geprüft: dass jeder Typ ein Icon hat (der Katalog erzwingt es
// im Typ) und dass die Feldnamen zum content-Schema passen — letzteres ließe
// sich nur mit einem Python-Parser klären, und das Backend lehnt einen falschen
// Feldnamen ohnehin mit einer klaren Meldung ab.
//
// Aufruf: node scripts/i18n/blocktypen-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (...p) => readFileSync(join(wurzel, ...p), "utf8");

const fehler = [];

/** Vergleicht zwei Wertlisten mengengleich und meldet beide Richtungen.
 *
 *  Beide Richtungen, weil beide Fälle echte Fehler sind: ein fehlender Wert
 *  bricht zur Laufzeit, ein überzähliger ist unerreichbarer Code, den niemand
 *  mehr anfasst. */
function pruefe(was, soll, ist) {
  const fehlend = soll.filter((w) => !ist.includes(w));
  const zusatz = ist.filter((w) => !soll.includes(w));
  if (fehlend.length) fehler.push(`${was}: fehlt ${fehlend.join(", ")}`);
  if (zusatz.length) fehler.push(`${was}: unbekannt ${zusatz.join(", ")}`);
}

// --- 1) DB: der jüngste CHECK auf site_blocks.type --------------------------
// Der CHECK wird bei jeder Erweiterung neu gesetzt (drop + add). Gültig ist
// also der aus der HÖCHSTEN Migrationsnummer, nicht der erste Treffer.
function dbTypen() {
  const verzeichnis = join(wurzel, "supabase", "migrations");
  const dateien = readdirSync(verzeichnis)
    .filter((n) => n.endsWith(".sql"))
    .sort();
  let letzte = null;
  for (const name of dateien) {
    const quelle = readFileSync(join(verzeichnis, name), "utf8");
    // Der Block zwischen `check (type in (` und der schließenden Klammer.
    const treffer = [
      ...quelle.matchAll(/site_blocks[\s\S]{0,400}?check \(type in \(([\s\S]*?)\)\)/g),
    ];
    if (treffer.length) letzte = { name, block: treffer[treffer.length - 1][1] };
  }
  if (!letzte) throw new Error("Kein site_blocks_type_check in den Migrationen");
  return {
    quelle: letzte.name,
    typen: [...letzte.block.matchAll(/'(\w+)'/g)].map((m) => m[1]),
  };
}

// --- 2) API: BlockType (StrEnum) -------------------------------------------
function pythonEnum(datei, klasse) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(`class ${klasse}(StrEnum):`)[1]?.split("\n\n\n")[0];
  if (!block) throw new Error(`${klasse} in ${datei} nicht gefunden`);
  return [...block.matchAll(/^\s+\w+ = "(\w+)"$/gm)].map((m) => m[1]);
}

// --- 3) API: _CONTENT_MODEL ------------------------------------------------
function contentModelTypen() {
  const quelle = lies(
    "apps", "api", "src", "features", "site_config", "block_inhalte.py",
  );
  const block = quelle.split("_CONTENT_MODEL: dict[BlockType, type[BaseModel]] = {")[1]
    ?.split("}")[0];
  if (!block) throw new Error("_CONTENT_MODEL nicht gefunden");
  return [...block.matchAll(/BlockType\.(\w+):/g)].map((m) => m[1]);
}

// --- 4/6) TypeScript-Union -------------------------------------------------
function tsUnion(datei, name) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(`export type ${name} =`)[1]?.split(";")[0];
  if (!block) throw new Error(`${name} in ${datei} nicht gefunden`);
  return [...block.matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

// --- 5) web: der Abschnitts-Katalog ---------------------------------------
function katalog() {
  const quelle = lies("web", "components", "website", "abschnitte.ts");
  const block = quelle.split("export const ABSCHNITTE: Abschnitt[] = [")[1];
  if (!block) throw new Error("ABSCHNITTE nicht gefunden");
  // Typ + Label + Hinweis je Eintrag. Alle drei aus derselben Quelle, damit
  // ein Eintrag ohne Label nicht als „Typ vorhanden" durchgeht.
  return [
    ...block.matchAll(
      /typ:\s*"(\w+)",[\s\S]*?label:\s*"(\w+)",[\s\S]*?hinweis:\s*"(\w+)",/g,
    ),
  ].map((m) => ({ typ: m[1], label: m[2], hinweis: m[3] }));
}

// --- 7) builder: das switch, das wirklich rendert -------------------------
function rendererTypen() {
  const quelle = lies("builder", "components", "blocks", "block-renderer.tsx");
  const block = quelle.split("switch (block.type) {")[1]?.split("\n}")[0];
  if (!block) throw new Error("renderBlock-switch nicht gefunden");
  return [...block.matchAll(/case "(\w+)":/g)].map((m) => m[1]);
}

const db = dbTypen();
// `BlockType` liegt seit dem Zeilen-Split in `basis.py`, die content-Modelle in
// `block_inhalte.py` — `schemas.py` re-exportiert beides. Das Skript liest die
// QUELLE und nicht den Re-Export: dort steht die Wahrheit.
const backend = pythonEnum(
  "apps/api/src/features/site_config/basis.py",
  "BlockType",
);

// Der DB-CHECK ist der Anfang der Kette: er entscheidet, was gespeichert werden
// KANN. Ein Typ, den er erlaubt und das Enum nicht kennt, lässt jede Antwort an
// der Validierung zerbrechen — auch für Seiten, die vorher liefen.
pruefe(`DB-CHECK (${db.quelle}) ↔ BlockType`, db.typen, backend);
pruefe("_CONTENT_MODEL (jeder Typ braucht ein content-Schema)", backend,
  contentModelTypen());
pruefe("web/lib/site-pages.ts BlockType", backend,
  tsUnion("web/lib/site-pages.ts", "BlockType"));
pruefe("builder/lib/site.ts BlockType", backend,
  tsUnion("builder/lib/site.ts", "BlockType"));

const eintraege = katalog();
pruefe("web/components/website/abschnitte.ts ABSCHNITTE", backend,
  eintraege.map((e) => e.typ));
pruefe("builder/components/blocks/block-renderer.tsx renderBlock", backend,
  rendererTypen());

// Übersetzungen. Ein fehlender Schlüssel wirft in next-intl zur Laufzeit
// (MISSING_MESSAGE) — der Abschnitts-Katalog wäre dann unbenutzbar.
const nachrichten = join(wurzel, "web", "messages");
for (const datei of readdirSync(nachrichten).filter((n) => n.endsWith(".json"))) {
  const abschnitte =
    JSON.parse(readFileSync(join(nachrichten, datei), "utf8")).website
      ?.abschnitte ?? {};
  const fehlend = [];
  for (const e of eintraege) {
    if (!abschnitte[e.label]) fehlend.push(e.label);
    if (!abschnitte[e.hinweis]) fehlend.push(e.hinweis);
  }
  if (fehlend.length) {
    fehler.push(
      `web/messages/${datei} website.abschnitte: fehlt ${fehlend.join(", ")}`,
    );
  }
}

for (const z of fehler) console.error(z);
if (fehler.length) {
  console.error(
    `\n${fehler.length} Abweichung(en). Backend-Typen: ${backend.join(", ")}`,
  );
  process.exit(1);
}
console.log(
  `✓ Abschnitts-Typen deckungsgleich (${backend.length} Typen) über DB, API,` +
    " web-Katalog, Renderer und alle Sprachdateien.",
);
