#!/usr/bin/env node
// Hält den Ausstattungs-Katalog des SERVERS deckungsgleich mit den
// Sprachdateien des Dashboards (0474).
//
// WARUM ES DIESE PRÜFUNG BRAUCHT
// Die Labels stehen an zwei Stellen, und nur eine davon wird gepflegt:
//   1. QUELLE  — `web/messages/<sprache>.json`, Namensräume `amenities`,
//                `eigeneAusstattung`, `roomAmenities`. Hier arbeitet das
//                Übersetzungs-Werkzeug, hier greifen die i18n-Gates.
//   2. ABZUG   — `apps/api/.../booking_engine/ausstattung_texte.py`, erzeugt von
//                `scripts/i18n/ausstattung-katalog-erzeugen.py`. Von hier holt
//                der Renderer seine Bezeichnungen.
//
// Ohne diese Prüfung läuft der Abzug still weg: ein neues Merkmal steht im
// Dashboard übersetzt da, und die Kunden-Website zeigt seinen ROHEN CODE. Genau
// das war der Anlass — „nd_parking_included" stand live auf der Objektseite,
// während das Dashboard „Parkmöglichkeit inklusive" anzeigte. Ein fehlendes
// Label ist keine Fehlermeldung, sondern ein Wort, das falsch aussieht, und das
// fällt nur auf, wenn jemand hinsieht.
//
// Bewusst NICHT geprüft: dass jedes Label übersetzt IST. Das macht
// `deutsche-restwerte-pruefen.mjs` an der Quelle — hier geht es nur darum, dass
// der Abzug den Stand der Quelle trägt.
//
// Aufruf: node scripts/i18n/ausstattung-katalog-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NACHRICHTEN = join(wurzel, "web", "messages");
const ABZUG = join(
  wurzel,
  "apps",
  "api",
  "src",
  "features",
  "booking_engine",
  "ausstattung_texte.py",
);

// Dieselbe Reihenfolge wie im Generator UND in `web/lib/use-amenity-labels.ts`.
// Sie entscheidet bei den 31 Codes, die in zwei Katalogen mit abweichendem Text
// stehen — ohne feste Reihenfolge gewänne der Zufall.
const NAMENSRAEUME = ["amenities", "eigeneAusstattung", "roomAmenities"];

const fehler = [];

/** Codes und Labels aus den Sprachdateien — die QUELLE. */
function ausQuelle() {
  const de = JSON.parse(readFileSync(join(NACHRICHTEN, "de.json"), "utf8"));
  const codes = [];
  const gesehen = new Set();
  for (const ns of NAMENSRAEUME) {
    for (const code of Object.keys(de[ns] ?? {})) {
      if (!gesehen.has(code)) {
        gesehen.add(code);
        codes.push(code);
      }
    }
  }
  const sprachen = readdirSync(NACHRICHTEN)
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.replace(/\.json$/, ""));
  return { codes, sprachen };
}

/** Codes und Sprachen aus dem erzeugten Python-Abzug. */
function ausAbzug() {
  const quelle = readFileSync(ABZUG, "utf8");
  const codeBlock = quelle
    .split("CODES: tuple[str, ...] = (")[1]
    ?.split(")")[0];
  if (!codeBlock) throw new Error("CODES nicht gefunden in " + ABZUG);
  const codes = [...codeBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const labelBlock = quelle.split("_LABELS: dict[str, tuple[str, ...]] = {")[1];
  if (!labelBlock) throw new Error("_LABELS nicht gefunden in " + ABZUG);
  const sprachen = [...labelBlock.matchAll(/^ {4}"(\w{2})": \(/gm)].map(
    (m) => m[1],
  );
  return { codes, sprachen };
}

const quelle = ausQuelle();
const abzug = ausAbzug();

// Die REIHENFOLGE zählt, nicht nur die Menge: Codes und Labels sind im Abzug
// über die Position verbunden. Eine Verschiebung um eins hieße, dass jedes
// Merkmal die Bezeichnung seines Nachbarn trägt — plausibel aussehend und
// vollständig falsch.
if (quelle.codes.length !== abzug.codes.length) {
  fehler.push(
    `Codes: Quelle hat ${quelle.codes.length}, Abzug ${abzug.codes.length}`,
  );
} else {
  const abweichung = quelle.codes.findIndex((c, i) => c !== abzug.codes[i]);
  if (abweichung >= 0) {
    fehler.push(
      `Codes verschoben ab Position ${abweichung}: Quelle "${quelle.codes[abweichung]}", ` +
        `Abzug "${abzug.codes[abweichung]}"`,
    );
  }
}

const fehlendeSprachen = quelle.sprachen.filter(
  (s) => !abzug.sprachen.includes(s),
);
if (fehlendeSprachen.length) {
  fehler.push(`Sprachen fehlen im Abzug: ${fehlendeSprachen.join(", ")}`);
}

if (fehler.length) {
  console.error("✗ Ausstattungs-Katalog nicht deckungsgleich:\n");
  for (const f of fehler) console.error("  " + f);
  console.error(
    "\nNeu erzeugen: python3 scripts/i18n/ausstattung-katalog-erzeugen.py",
  );
  process.exit(1);
}

console.log(
  `✓ Ausstattungs-Katalog deckungsgleich (${abzug.codes.length} Codes, ` +
    `${abzug.sprachen.length} Sprachen).`,
);
