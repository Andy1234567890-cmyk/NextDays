#!/usr/bin/env node
// Prüft die Übersetzungsdateien einer App gegen die Basissprache.
//
// Zweck: Eine Sprache darf erst in LOCALES, wenn ihre Datei wirklich
// vollständig ist. Ohne diese Prüfung entsteht genau die Attrappe, die wir
// abschaffen — eine wählbare Sprache, die dann doch Deutsch anzeigt.
//
// Geprüft wird dreierlei:
//  1. Fehlende Keys (Nutzer sähe Deutsch)
//  2. Überzählige Keys (Übersetzer hat etwas erfunden, das es nicht gibt)
//  3. Platzhalter-Treue: {name}, {pct} müssen identisch übernommen sein —
//     ein verlorener Platzhalter bricht die Oberfläche zur Laufzeit.
//  3b. Dokumentmarken-Treue: [%GESAMTBETRAG%] & Co. dürfen NICHT übersetzt
//     werden — sie sind Schaltstellen, die `placeholderSystem.ts` gegen die
//     deutschen Namen ersetzt. Eine übersetzte Marke steht roh in der Rechnung
//     beim Kunden (live in ro.json gefunden, 25.08.2026).
//
// Aufruf: node scripts/i18n/pruefe-uebersetzungen.mjs gastgeber
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const app = process.argv[2];
if (!app) {
  console.error("Aufruf: pruefe-uebersetzungen.mjs <app>   (z. B. gastgeber)");
  process.exit(2);
}

const BASIS = "de";
const verzeichnis = join(process.cwd(), app, "messages");

function flach(objekt, praefix = "") {
  const raus = {};
  for (const [schluessel, wert] of Object.entries(objekt)) {
    const pfad = praefix ? `${praefix}.${schluessel}` : schluessel;
    if (wert && typeof wert === "object" && !Array.isArray(wert)) {
      Object.assign(raus, flach(wert, pfad));
    } else {
      raus[pfad] = wert;
    }
  }
  return raus;
}

// ICU-Pluralkategorien. Sie sind KEINE Platzhalter, sondern Grammatik: Deutsch
// hat zwei Formen, Slowakisch vier, Arabisch sechs. Eine Übersetzung MUSS hier
// abweichen dürfen — sonst meldet die Prüfung korrekte Arbeit als Fehler.
const PLURAL_KATEGORIEN = new Set([
  "zero", "one", "two", "few", "many", "other",
  "plural", "select", "selectordinal",
]);

// Die ZWEITE Platzhalter-Form: `[%GESAMTBETRAG%]`, `[%VOLLEANREDE%]` & Co. in
// den Rechnungs- und Dokumenttexten. Sie sehen aus wie Text, sind aber
// Schaltstellen — `web/utils/placeholderSystem.ts` ersetzt sie per Regex gegen
// genau DIESE, deutschen Namen. Eine übersetzte Marke wird nie ersetzt und
// steht roh in der Rechnung beim Kunden.
//
// Genau das lag live in `ro.json` (gefunden 25.08.2026, vorbestehend):
// `[%FORMULA_ADRESARE%]` statt `[%VOLLEANREDE%]`, dazu `[%SUMA_TOTALA%]`,
// `[%NUMAR_FACTURA%]`, `[%TERMEN_PLATA%]`, `[%DATA_FACTURII%]`,
// `[%PERSOANA_CONTACT%]`. Ein rumänischer Betrieb hätte seine Rechnungen mit
// diesen Markierungen im Text verschickt. Die bestehende Prüfung sah es nicht:
// sie kennt nur die `{name}`-Form.
//
// Diese Marken werden deshalb NICHT übersetzt — der umgebende Satz schon.
function dokumentMarken(text) {
  return new Set(String(text).match(/\[%[A-Z0-9_]+%\]/g) ?? []);
}

function platzhalter(text) {
  // Echte Variablen haben genau zwei Formen:
  //   {name}            — einfache Einsetzung
  //   {name, plural, …} — ICU-Auswahl, Variable steht vor dem Komma
  // Ein Zweig-INHALT wie „{Keine Objekte}" ist keine Variable. Ihn mitzuzählen
  // erzeugte Fehlalarm bei jeder Sprache, deren Wörter anders anfangen als die
  // deutschen (kyrillisch matcht \w nicht) — die Meldung hing dann an der
  // Zielsprache statt am Fehler.
  const gefunden = [...String(text).matchAll(/\{\s*(\w+)\s*(?:\}|,)/g)].map(
    (treffer) => treffer[1],
  );
  return new Set(
    gefunden.filter(
      (name) => !PLURAL_KATEGORIEN.has(name) && !/^\d+$/.test(name),
    ),
  );
}

const basis = flach(
  JSON.parse(readFileSync(join(verzeichnis, `${BASIS}.json`), "utf8")),
);
const basisKeys = Object.keys(basis);

const dateien = readdirSync(verzeichnis)
  .filter((name) => name.endsWith(".json") && name !== `${BASIS}.json`)
  .sort();

let fehlerhaft = 0;

for (const datei of dateien) {
  const sprache = datei.replace(/\.json$/, "");

  // Kaputtes JSON darf die Prüfung nicht abbrechen: Läuft der Check parallel
  // zu einem schreibenden Übersetzungslauf, erwischt er zwangsläufig mal eine
  // halb geschriebene Datei. Das ist ein Befund für diese eine Sprache, kein
  // Grund, die anderen 44 ungeprüft zu lassen.
  let roh;
  try {
    roh = JSON.parse(readFileSync(join(verzeichnis, datei), "utf8"));
  } catch (fehler) {
    console.log(`✗ ${sprache.padEnd(8)} JSON kaputt oder unvollständig: ${fehler.message}`);
    fehlerhaft += 1;
    continue;
  }
  const uebersetzt = flach(roh);

  const fehlen = basisKeys.filter((k) => !(k in uebersetzt));
  const ueberzaehlig = Object.keys(uebersetzt).filter((k) => !(k in basis));

  // Unübersetzt = Wert identisch zur Basissprache. Bei Eigennamen („WLAN",
  // „Sauna") ist das korrekt, deshalb nur als Hinweis, nicht als Fehler.
  const gleich = basisKeys.filter(
    (k) => k in uebersetzt && uebersetzt[k] === basis[k],
  );

  const kaputt = basisKeys
    .filter((k) => k in uebersetzt)
    .filter((k) => {
      const a = platzhalter(basis[k]);
      const b = platzhalter(uebersetzt[k]);
      return a.size !== b.size || [...a].some((n) => !b.has(n));
    });

  // Dokumentmarken müssen WORTGLEICH übernommen sein — anders als der Satz
  // drumherum. Eigene Liste statt gemeinsam mit `kaputt`, damit die Meldung
  // sagt, WELCHE Art Platzhalter fehlt: die eine ist ein Übersetzungsfehler,
  // die andere eine kaputte Rechnung.
  const marken = basisKeys
    .filter((k) => k in uebersetzt)
    .filter((k) => {
      const a = dokumentMarken(basis[k]);
      const b = dokumentMarken(uebersetzt[k]);
      return a.size !== b.size || [...a].some((n) => !b.has(n));
    });

  // Häufigster realer Fehler: Der Übersetzer weicht auf Englisch aus, statt in
  // die Zielsprache zu übersetzen. Fällt sonst niemandem auf, weil die Datei
  // vollständig aussieht. Heuristik über typische englische Funktionswörter.
  // Einzelne englische Wörter sind harmlos (Lehnwörter wie „Listing", „Check-in"
  // stehen auch im deutschen Original). Verdächtig wird es erst bei MEHREREN
  // englischen Funktionswörtern im selben Satz — dann ist der ganze Text
  // unübersetzt geblieben.
  const ENGLISCHE_FUNKTIONSWOERTER =
    /\b(the|your|from|with|via|that|this|are|were|will|would|should|please|only|also|use|if|and|been|being|those|these)\b/gi;

  const englisch =
    sprache.startsWith("en")
      ? []
      : basisKeys
          .filter((k) => k in uebersetzt && typeof uebersetzt[k] === "string")
          .filter((k) => {
            // Nur prüfen, wenn der Text sich vom Deutschen unterscheidet —
            // sonst ist es schlicht ein noch nicht übersetzter Key.
            if (uebersetzt[k] === basis[k]) return false;
            const treffer = String(uebersetzt[k]).match(ENGLISCHE_FUNKTIONSWOERTER);
            return treffer !== null && new Set(treffer.map((w) => w.toLowerCase())).size >= 3;
          });

  const ok =
    fehlen.length === 0 &&
    ueberzaehlig.length === 0 &&
    kaputt.length === 0 &&
    marken.length === 0 &&
    englisch.length === 0;
  if (!ok) fehlerhaft += 1;

  const anteilGleich = Math.round((gleich.length / basisKeys.length) * 100);
  console.log(
    `${ok ? "✓" : "✗"} ${sprache.padEnd(8)} ${String(Object.keys(uebersetzt).length).padStart(4)}/${basisKeys.length} Keys` +
      (fehlen.length ? `  fehlend: ${fehlen.length}` : "") +
      (ueberzaehlig.length ? `  überzählig: ${ueberzaehlig.length}` : "") +
      (kaputt.length ? `  PLATZHALTER KAPUTT: ${kaputt.length}` : "") +
      (marken.length ? `  DOKUMENTMARKE ÜBERSETZT: ${marken.length}` : "") +
      (englisch.length ? `  ENGLISCH statt Zielsprache: ${englisch.length}` : "") +
      `  unübersetzt: ${anteilGleich}%`,
  );

  for (const k of fehlen.slice(0, 3)) console.log(`      fehlt: ${k}`);
  for (const k of englisch.slice(0, 3)) {
    console.log(`      englisch: ${k} = ${uebersetzt[k]}`);
  }
  for (const k of kaputt.slice(0, 3)) {
    console.log(`      Platzhalter: ${k}`);
    console.log(`        de: ${basis[k]}`);
    console.log(`        ${sprache}: ${uebersetzt[k]}`);
  }
  for (const k of marken.slice(0, 3)) {
    // Marken einzeln zeigen, nicht den ganzen Text: die Meldung soll sagen,
    // welche Schaltstelle nicht mehr greift, nicht den Rechnungstext abdrucken.
    console.log(
      `      Dokumentmarke: ${k}` +
        `  de=${[...dokumentMarken(basis[k])].join(" ")}` +
        `  ${sprache}=${[...dokumentMarken(uebersetzt[k])].join(" ")}`,
    );
  }
}

console.log(
  `\n${dateien.length} Sprachdatei(en), ${basisKeys.length} Keys je Sprache, ${fehlerhaft} fehlerhaft.`,
);
process.exit(fehlerhaft > 0 ? 1 : 0);
