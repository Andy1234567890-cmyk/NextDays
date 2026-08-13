#!/usr/bin/env node
// Hält die Rechtstexte über alle Sprachen UND beide Apps deckungsgleich.
//
// Der Grund: Die AGB liegen in 24 Sprachen als flaches `sections`-Array ohne
// stabile Schlüssel. Fehlt in `en.ts` ein Paragraph, der in `de.ts` steht,
// merkt das NIEMAND — `tsc` prüft nur den Typ (`LegalDoc`), nicht die Anzahl
// oder Identität der Abschnitte, und ESLint sieht ohnehin nichts. Der Kunde
// bekommt dann stillschweigend eine veraltete Fassung.
//
// Live passiert (13.08.2026): `de.ts` bekam einen KI-Paragraphen und wuchs auf
// 18 Abschnitte, die 23 anderen Sprachen blieben bei 16 — darunter fehlte die
// Beschwerde-/Mediationsklausel, die nach der P2B-Verordnung (EU) 2019/1150
// zwingend ist. Ein fehlender Absatz im Rechtstext ist kein Schönheitsfehler.
//
// Zweitens: `web/content/legal/agb/` und `marketing/content/legal/agb/` sind
// bewusste KOPIEN (ADR-0016, der Docker-Kontext der Marketing-App enthält
// `web/` nicht). Für Mobile prüft das der CI-Job `mobile-konsistenz`; für die
// Rechtstexte gab es nichts Vergleichbares.
//
// Aufruf: node scripts/i18n/pruefe-rechtstexte.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WURZEL = new URL("../..", import.meta.url).pathname;
const QUELLE = "de"; // DE ist laut Kopfkommentar die Referenzfassung.

const AGB_ORTE = [
  "web/content/legal/agb",
  "marketing/content/legal/agb",
];

let fehler = 0;

function meld(text) {
  console.error(`  ✗ ${text}`);
  fehler += 1;
}

/** Überschriften und Stand aus einer LegalDoc-Datei lesen.
 *
 * Bewusst per Regex statt per Import: die Dateien hängen an
 * TypeScript-Pfad-Aliassen (`@/lib/app-url`), die ein blankes `node` nicht
 * auflöst. Geprüft wird die STRUKTUR, dafür genügt das. */
function struktur(pfad) {
  const roh = readFileSync(pfad, "utf8");
  const headings = [...roh.matchAll(/^\s*heading:\s*"([^"]+)"/gm)].map(
    (m) => m[1],
  );
  const stand = roh.match(/^\s*stand:\s*"([^"]+)"/m)?.[1] ?? "";
  return { headings, stand };
}

console.log("→ AGB: alle Sprachen gegen die Referenzfassung");

for (const ort of AGB_ORTE) {
  const verzeichnis = join(WURZEL, ort);
  let dateien;
  try {
    dateien = readdirSync(verzeichnis).filter(
      (d) => d.endsWith(".ts") && d !== "index.ts" && d !== "types.ts",
    );
  } catch {
    meld(`${ort} nicht lesbar`);
    continue;
  }

  const referenz = struktur(join(verzeichnis, `${QUELLE}.ts`));
  console.log(
    `  ${ort} — Referenz ${QUELLE}: ${referenz.headings.length} Abschnitte, „${referenz.stand}"`,
  );

  for (const datei of dateien.sort()) {
    const sprache = datei.replace(/\.ts$/, "");
    if (sprache === QUELLE) continue;
    const { headings, stand } = struktur(join(verzeichnis, datei));

    // NUR die Abschnittszahl vergleichen, nicht den `stand`: der ist in jeder
    // Sprache übersetzt („Last updated", „Seneste opdateret", …) und in jedem
    // Datumsformat geschrieben. Ein Textvergleich schlüge dort immer fehl und
    // wäre damit ein Alarm, den man abschaltet — also keiner.
    if (headings.length !== referenz.headings.length) {
      meld(
        `${ort}/${datei}: ${headings.length} Abschnitte, erwartet ${referenz.headings.length}` +
          ` — es fehlen ${referenz.headings.length - headings.length} (veraltete Übersetzung)`,
      );
    }
    if (!stand) {
      meld(`${ort}/${datei}: kein „stand" gesetzt`);
    }
  }
}

console.log("→ AGB: web/ und marketing/ inhaltlich identisch");

// Die Marketing-Kopie trägt zusätzlich slug/metaDescription/numbered/toc für
// ihren Renderer — verglichen werden deshalb nur Überschriften und Stand.
for (const datei of readdirSync(join(WURZEL, AGB_ORTE[0])).filter((d) =>
  d.endsWith(".ts"),
)) {
  const a = struktur(join(WURZEL, AGB_ORTE[0], datei));
  let b;
  try {
    b = struktur(join(WURZEL, AGB_ORTE[1], datei));
  } catch {
    meld(`${datei} fehlt in ${AGB_ORTE[1]}`);
    continue;
  }
  // Hier IST der Stand vergleichbar: es ist dieselbe Sprache, nur zwei Kopien.
  if (a.headings.join("|") !== b.headings.join("|")) {
    meld(`${datei}: Überschriften in web/ und marketing/ verschieden`);
  }
  if (a.stand !== b.stand) {
    meld(`${datei}: Stand verschieden (web „${a.stand}" / marketing „${b.stand}")`);
  }
}

if (fehler > 0) {
  console.error(
    `\n✗ ${fehler} Abweichung(en). Rechtstexte in allen Sprachen nachziehen,` +
      ` bevor sie ausgeliefert werden.`,
  );
  process.exit(1);
}
console.log("\n✓ Rechtstexte sind über alle Sprachen und Apps deckungsgleich.");
