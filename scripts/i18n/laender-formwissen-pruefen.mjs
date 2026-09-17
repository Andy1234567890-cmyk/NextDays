#!/usr/bin/env node
// Meldet den RÜCKFALL in zwei Fehlerklassen, die beide dieselbe Wurzel haben:
// länder- oder sprachabhängiges Wissen wird fest verdrahtet statt durchgereicht.
//
// ─────────────────────────────────────────────────────────────────────────────
// KLASSE A — fest verdrahtete Sprache im Formatierungskontext
//
// `toLocaleDateString("de-DE")`, `Intl.NumberFormat("de")`,
// `Intl.DisplayNames(["de"])`, `localeCompare(x, "de")`. Das ist derselbe
// Fehler wie ein hartkodiertes „€", nur bei Datum, Zahl und Sortierung: in den
// 44 Nicht-DE-Sprachen zeigt es deutsche Formate. Ein Japaner sah
// „27. Juli 2026" statt „2026年7月27日", ein Inder „0,1 %" statt „0.1%".
//
// Gefunden am 10.09.2026: `gastgeber/lib/laender.ts` hielt `const SPRACHE =
// "de"` und speiste damit `Intl.DisplayNames` — alle Ländernamen erschienen in
// allen 45 Sprachen auf Deutsch. Dazu ein Dutzend `toLocaleString("de-DE")`,
// obwohl `lib/formatierung.ts` den richtigen Weg (`useFormatierung`) längst
// bereitstellte und in seinem eigenen Kopf genau diesen Fehler benannte.
//
// Ebenfalls Klasse A: ein Vorgabewert `sprache = "de"` in einer Signatur. Er
// ist tückischer als die feste Zeichenkette, weil jede Aufrufstelle korrekt
// aussieht — `zeitzoneLabel(id)` sortierte still nach deutschen Regeln.
//
// ─────────────────────────────────────────────────────────────────────────────
// KLASSE B — deutsches Beispiel neben einer Länderauswahl
//
// `placeholder="DE123456789"` NEBEN einem `<select>` der Länder, das nicht
// nachzieht. Ein dänischer Partner las ein deutsches Beispiel und tippte eine
// Nummer, die es in DK nicht gibt. Vier Formulare trugen das.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM DER VERDACHT NICHT IMMER DER BEFUND IST
//
// Eine feste Locale ist nicht immer falsch. Zwei Fälle stehen zu Recht:
//
//   1. MASCHINELLES Parsen, bei dem das Format die Schnittstelle IST — etwa
//      `Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })`, um
//      „GMT+01:00" zu zerlegen. Das Ergebnis sieht kein Nutzer; eine
//      nutzerabhängige Locale würde die Zerlegung brechen.
//   2. Die deutsche Sprachdatei selbst und Kommentare, die den Fehler
//      BESCHREIBEN (wie dieser hier).
//
// Fall 2 erkennt das Skript strukturell (Kommentarzeilen zählen nicht). Fall 1
// braucht eine bewusste Ausnahme: eine Zeile mit `// locale-fest:` und einem
// Grund dahinter. Das ist Absicht — wer die Ausnahme setzt, schreibt auf,
// warum sie richtig ist, statt eine Zahl in einer Baseline zu senken.
//
// ─────────────────────────────────────────────────────────────────────────────
// AUFRUF (vom Repo-Root):
//     node scripts/i18n/laender-formwissen-pruefen.mjs
// Exit 1 bei jedem Fund ohne begründete Ausnahme.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Geprüft werden die Frontends, die eine echte Sprachwahl haben. `web` hat sie
// ebenfalls, wird hier aber (noch) nicht geprüft: dort liegt ein umfangreicher
// Altbestand, den dieses Gate in einem Zug rot färben würde, ohne dass jemand
// ihn in derselben Änderung aufräumen kann. Sobald er abgetragen ist, gehört
// "web" in diese Liste.
const APPS = ["partner", "marketing", "packages"];

// VERWAISTE DATEIEN — geprüft wird, was ausgeliefert wird.
//
// Diese drei Dateien in `gastgeber` sind Reste einer Fehlplatzierung: das
// DAC7-Modul gehört ins PMS und liegt dort bereits (`web/lib/dac7.ts`,
// `web/components/dac7/`). Nachgewiesen am 10.09.2026 per Import-Suche —
// sie importieren nur einander, NICHTS im Baum importiert sie, keine Route
// rendert sie. Ihr Code läuft also nirgends.
//
// Sie stehen hier ausgenommen und NICHT etwa korrigiert, weil eine Übersetzung
// toten Codes Arbeit an einer Datei wäre, die gelöscht gehört — und gelöscht
// wird sie nur auf ausdrücklichen Auftrag (Projektregel). Wird das Modul
// entfernt oder wiederbelebt, verschwindet dieser Eintrag mit ihm; wird es
// wiederbelebt, muss es zuerst durch dieses Gate.
const VERWAIST = new Set([
]);

// Verzeichnisse, die nie Quellcode dieser Art enthalten.
const UEBERSPRINGEN = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "messages", // Sprachdateien: dort IST Deutsch der Inhalt, kein Code.
]);

// Die Ausnahme-Markierung. Steht sie in der Zeile selbst oder irgendwo im
// zusammenhängenden Kommentarblock DIREKT darüber, gilt der Fund als bewusst —
// der Text dahinter ist die Begründung. Der ganze Block zählt, weil eine
// ordentliche Begründung selten in eine Zeile passt.
const AUSNAHME = /\/\/\s*locale-fest:/;

// KLASSE A: feste Sprache in einer Formatierungs- oder Sortierfunktion.
// Bewusst eng auf die APIs begrenzt, die tatsächlich nutzersichtbar
// formatieren — eine beliebige Zeichenkette "de" irgendwo im Code ist kein
// Befund (z. B. ein Sprachschlüssel in einer Liste).
const KLASSE_A = [
  {
    name: 'toLocale*("de…")',
    muster:
      /\.toLocale(?:String|DateString|TimeString)\(\s*["'](?:de|en|fr|es|it|nl|da|sv)\b/,
  },
  {
    name: 'Intl.*("de…")',
    muster:
      /\bIntl\.(?:NumberFormat|DateTimeFormat|DisplayNames|Collator|RelativeTimeFormat|ListFormat|PluralRules)\(\s*\[?\s*["'](?:de|en|fr|es|it|nl|da|sv)\b/,
  },
  {
    name: 'localeCompare(…, "de…")',
    muster: /\.localeCompare\([^)]*["'](?:de|en|fr|es|it|nl|da|sv)["']\s*[,)]/,
  },
  {
    // Der stille Fall: die Signatur trägt die Sprache als Vorgabewert, jede
    // Aufrufstelle sieht dadurch korrekt aus. `zeitzoneLabel(id)` sortierte so
    // still nach deutschen Regeln, obwohl kein Aufruf falsch AUSSAH.
    //
    // Bewusst auf `sprache`/`lang` begrenzt und NICHT auf `locale`: der
    // Parameter `locale = "de-DE"` in `formatCurrency`/`currencySymbol`
    // (packages/currency, marketing/lib/currency.ts) ist eine bekannte,
    // absichtliche Stelle mit 44 Aufrufern allein in `gastgeber` — sie hier zu
    // melden, erzeugt einen Befund, den niemand in derselben Änderung
    // schließen kann, und ein Gate, das dauerhaft rot steht, wird abgeschaltet.
    // Dieser Altbestand gehört in eine eigene Änderung; siehe Bericht 10.09.2026.
    name: 'Vorgabewert sprache = "de"',
    muster:
      /\b(?:sprache|lang|language)\s*(?::\s*string\s*)?=\s*["'](?:de|en)[-a-zA-Z]*["']/,
  },
];

// KLASSE B: ein Beispielwert, der ein Länderkürzel fest voranstellt. Erkannt
// wird das MUSTER (zwei Großbuchstaben + mindestens sechs Ziffern) in einem
// Platzhalter — nicht die eine Zeichenkette „DE123456789", damit auch
// „AT123456789" oder „FR12345678901" auffallen.
const KLASSE_B = {
  name: "festes Länder-Beispiel im placeholder",
  muster: /placeholder\s*=\s*["'][A-Z]{2}[0-9X]{6,}/,
};

/** Alle .ts/.tsx-Dateien unterhalb eines Verzeichnisses. */
function dateien(wurzel) {
  const gefunden = [];
  const stapel = [wurzel];
  while (stapel.length > 0) {
    const ort = stapel.pop();
    let eintraege;
    try {
      eintraege = readdirSync(ort);
    } catch {
      continue; // Verzeichnis existiert nicht — kein Befund.
    }
    for (const eintrag of eintraege) {
      if (UEBERSPRINGEN.has(eintrag)) continue;
      const pfad = join(ort, eintrag);
      const info = statSync(pfad);
      if (info.isDirectory()) stapel.push(pfad);
      else if (/\.tsx?$/.test(eintrag)) gefunden.push(pfad);
    }
  }
  return gefunden;
}

/** Ist diese Zeile reiner Kommentar? Dann beschreibt sie den Fehler, statt ihn
 *  zu begehen — der halbe Grund, warum dieses Skript falschmeldungsarm ist. */
function istKommentar(zeile) {
  const t = zeile.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/** Trägt der zusammenhängende Kommentarblock direkt über Zeile `i` die
 *  Ausnahme-Markierung? Der Block endet an der ersten Nicht-Kommentarzeile. */
function istBegruendet(zeilen, i) {
  for (let k = i - 1; k >= 0; k -= 1) {
    if (!istKommentar(zeilen[k])) return false;
    if (AUSNAHME.test(zeilen[k])) return true;
  }
  return false;
}

const funde = [];

for (const app of APPS) {
  for (const pfad of dateien(app)) {
    if (VERWAIST.has(pfad)) continue;
    const zeilen = readFileSync(pfad, "utf8").split("\n");
    for (let i = 0; i < zeilen.length; i += 1) {
      const zeile = zeilen[i];
      if (istKommentar(zeile)) continue;
      if (AUSNAHME.test(zeile) || istBegruendet(zeilen, i)) continue;

      for (const regel of [...KLASSE_A, KLASSE_B]) {
        if (regel.muster.test(zeile)) {
          funde.push({
            pfad,
            zeile: i + 1,
            regel: regel.name,
            text: zeile.trim().slice(0, 120),
          });
          break; // Eine Zeile, ein Befund.
        }
      }
    }
  }
}

if (funde.length === 0) {
  console.log(
    `✓ Kein fest verdrahtetes Sprach-/Länderwissen in: ${APPS.join(", ")}`,
  );
  process.exit(0);
}

console.error(
  `\n✗ ${funde.length} Stelle(n) mit fest verdrahtetem Sprach-/Länderwissen:\n`,
);
for (const f of funde) {
  console.error(`  ${f.pfad}:${f.zeile}`);
  console.error(`    ${f.regel}`);
  console.error(`    ${f.text}\n`);
}
console.error(
  "Die Sprache kommt aus next-intl (useLocale/useFormatierung), das\n" +
    "Länder-Formwissen aus @nextdays/laender (landName, vatBeispielFuerLand).\n" +
    "Ist eine feste Locale hier RICHTIG (maschinelles Parsen, dessen Format die\n" +
    "Schnittstelle ist), dann `// locale-fest: <Grund>` in die Zeile davor.\n",
);
process.exit(1);
