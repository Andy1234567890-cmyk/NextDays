#!/usr/bin/env node
// Sucht die Fehlerklasse, die in der Nachprüfung vom 27.08.2026 DREIMAL zuschlug:
// dieselbe Zuordnung/Logik in mehreren Kopien, von denen nur eine gepflegt wurde.
//
// Die drei Fälle:
//   B1  `menueBeschriften` stand in `rahmen.tsx` UND, abgeschrieben, in
//       `abschnitts-editor.tsx`. Der Nachschlag für die Theme-Unterpunkte kam
//       nur in die erste — im Editor stand weiter „site-layout · farben · text".
//   C2  Die Einstellungen zeichneten ihre eigene Navigation neben die
//       Menüspalte. Sechs Punkte doppelt, sobald die Spalte endlich rendern
//       durfte. Bei SEO war es dieselbe Sache (C3), dort schon behoben.
//   Nr.2 Der Token-Abruf stand VIERMAL da. Nur die Kopfzeile hatte den
//       `.catch` gelernt; die drei anderen hingen bei einem Netzfehler für
//       immer auf „wird vorbereitet".
//
// Warum ein Skript und kein Kommentar: eine Kopie entsteht nicht beim Schreiben,
// sondern beim NÄCHSTEN Bearbeiten — wer die eine Stelle findet, hört auf zu
// suchen. Das hier findet die andere.
//
// Aufruf: node scripts/diagnose/baukasten-doppel-kopien-pruefen.mjs
// Exit 1, wenn eine Kopie zurück ist.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WURZELN = ["web/components/website", "builder/components", "builder/lib", "packages/baukasten-stil/src"];

/** Muster, die je Bereich nur EINMAL vorkommen dürfen, mit dem Ort der
 *  Wahrheit. `muster` ist ein RegExp, `erlaubt` die Dateien, in denen es stehen
 *  DARF (die zentrale Definition und ihre Aufrufer). */
const REGELN = [
  {
    name: "Geräte-Breitenbereiche (Media-Query-Grenzen)",
    // Die drei Bereiche gehören in die Stil-Kaskade; Editor und Renderer lesen
    // sie dort. Eine zweite Tabelle liefe beim nächsten Breakpoint auseinander.
    muster: /GERAETE_BEREICHE\s*[:=]/,
    erlaubt: ["packages/baukasten-stil/src/index.ts"],
    hinweis:
      "Die Bereiche stehen in `@nextdays/baukasten-stil` (GERAETE_BEREICHE). Importieren, nicht abschreiben (Etappe 2, 05.09.2026).",
  },
  {
    name: "Stil-Kaskade (Layout-/Abstands-CSS aus settings)",
    // Wer `layout_richtung` selbst in `flex-direction` übersetzt, baut die
    // zweite Kaskade — ohne Tablet/Mobil. Werte LESEN darf der Editor
    // (Ausrichtungsleiste, Inspektor); CSS daraus macht nur das Paket.
    muster: /(flexDirection|\["flex-direction"\]|"flex-direction")\s*[:=]\s*"(row|column)"/,
    erlaubt: ["packages/baukasten-stil/src/index.ts"],
    hinweis:
      "CSS aus `settings` erzeugt ausschließlich `@nextdays/baukasten-stil` (rahmenStil/layoutStil/stilCss). Der Editor liest Werte über darstellungFuer/herkunft.",
  },
  {
    name: "Menü-Beschriftung (Namensraum-Kette)",
    // Die Kette selbst — sie gehört ausschließlich in `menueBeschriftung`.
    muster: /for \(const ns of \[\s*"menue",/,
    erlaubt: ["web/components/website/reiter.ts"],
    hinweis:
      "Die Kette gehört in `menueBeschriftung` (reiter.ts). Aufrufer rufen sie auf, statt sie abzuschreiben (B1).",
  },
  {
    name: "Zuordnung Theme-Unterpunkt → i18n-Schlüssel",
    muster: /"site-layout":\s*"?design\./,
    erlaubt: ["web/components/website/reiter.ts"],
    hinweis:
      "Die sieben Paare stehen in `MENUE_I18N_SCHLUESSEL`. Eine zweite Liste läuft beim nächsten Umbenennen auseinander (B1, C4-Nebenbefund).",
  },
  {
    name: "Vorschau-Token ohne .catch",
    // Ein `.then(` auf einen Token-Abruf, dem kein `.catch` folgt.
    muster: /create(?:DraftToken|TemplatePreviewToken)\([^)]*\)\s*\.then\((?![\s\S]{0,900}?\.catch\()/,
    erlaubt: ["web/components/website/use-vorschau-token.ts"],
    hinweis:
      "Der Abruf gehört in `useVorschauToken`. Ohne `.catch` bleibt der Ladezustand bei einem Netzfehler für immer stehen (Wurzel 5, Nachprüfung Befund 2).",
  },
  {
    name: "Zweite Navigation neben der Menüspalte",
    // Ein `<nav>`, das die Unterpunkt-Tabellen selbst durchläuft.
    muster: /(?:EINSTELLUNGEN_UNTERPUNKTE|SEO_UNTERPUNKTE)\.map\(/,
    erlaubt: ["web/components/website/reiter.ts"],
    hinweis:
      "Die Unterpunkte zeigt die MENÜSPALTE (REITER_MENUE). Eine eigene Liste daneben steht doppelt (C2/C3).",
  },
];

function dateien(wurzel) {
  const out = [];
  (function lauf(d) {
    let e;
    try {
      e = readdirSync(d);
    } catch {
      return;
    }
    for (const n of e) {
      if (n === "node_modules" || n.startsWith(".")) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) lauf(p);
      else if (/\.tsx?$/.test(n)) out.push(p);
    }
  })(wurzel);
  return out;
}

const alle = WURZELN.flatMap(dateien);
let fehler = 0;

for (const regel of REGELN) {
  const treffer = alle.filter((f) => regel.muster.test(readFileSync(f, "utf8")));
  const unerlaubt = treffer.filter((f) => !regel.erlaubt.includes(f));
  if (unerlaubt.length === 0) {
    console.log(`✓ ${regel.name}`);
    continue;
  }
  fehler += unerlaubt.length;
  console.error(`\n✗ ${regel.name} — ${unerlaubt.length} Kopie(n):`);
  for (const f of unerlaubt) console.error(`    ${f}`);
  console.error(`  ${regel.hinweis}`);
}

if (fehler > 0) {
  console.error(
    `\n${fehler} Kopie(n) gefunden. Eine Logik, die an zwei Stellen steht, wird an einer gepflegt.`,
  );
  process.exit(1);
}
console.log("\nKeine doppelten Definitionen im Baukasten.");
