#!/usr/bin/env node
// Prüft die zwei Übersetzungs-Fehlerklassen, die durch ALLE bestehenden Gates
// laufen — weil sie nicht „fehlt", sondern „ist da und ist falsch/tot" heißen.
//
// Die Gates unter scripts/i18n/ prüfen VOLLSTÄNDIGKEIT: ist der Schlüssel in
// allen 24 Dateien vorhanden, sind die Platzhalter heil, gibt es zu jedem
// Backend-Feld ein Etikett. Ein Schlüssel, der in der polnischen Datei den
// DEUTSCHEN Text trägt, ist für jede dieser Prüfungen einwandfrei: er ist
// vorhanden, strukturgleich und platzhaltertreu. Er ist nur nicht übersetzt.
//
// Beide Klassen sind am 24.08.2026 real aufgetreten (Commit 652bcad6):
//
//   A) 145 Schlüssel standen in ALLEN 22 Nicht-Deutsch-Sprachen wortgleich auf
//      Deutsch — Kalender, Objekte, Onboarding, Finanzen. Die englische,
//      polnische, maltesische Oberfläche zeigte deutschen Text. Kein Skript
//      hat es gemeldet; gefunden wurde es von Hand.
//
//   B) 142 Schlüssel im Namensraum `website.*` rief kein Code mehr auf, davon
//      ein 116 Schlüssel großer `editor.*`-Block einer verworfenen
//      Ausbaustufe. Toter Ballast, der bei jeder Sprachrunde mitübersetzt
//      wird — 142 × 24 = 3408 Werte, die niemand liest.
//
// Aufruf:  node scripts/i18n/uebersetzungs-luecken-pruefen.mjs
// Exit 1 bei jedem Befund, damit das Skript in die CI kann.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM PRÜFUNG A EINE ALLOWLIST BRAUCHT (und keine Heuristik)
//
// „Wert in der Fremdsprache == Wert in Deutsch" ist ein VERDACHT, kein Beweis.
// Es gibt eine große Klasse von Schlüsseln, die wortgleich stehen MÜSSEN:
// Eigennamen (Airbnb, Booking.com, myBestDays, DATEV), internationale Kürzel
// (IBAN, BIC / SWIFT), Platzhalter-Ketten ohne Text (`{property} · {date}`),
// Format-Masken (`XX00 0000 …`), Maßeinheiten (m², ft²) und Produktbegriffe,
// die der Bestand bewusst in jeder Sprache gleich führt („Stop-Sell").
//
// Drei Wege wurden verworfen:
//   * Musterliste („alles mit Großbuchstabe + Bindestrich bleibt") — genau
//     dieser Weg hat in `entwickler-namespace-pruefen.mjs` 154 Fehlalarme
//     erzeugt, weil er deutsche Komposita mitfängt (Hilfe-Center, Rate-Plan).
//   * Wortlisten der Marken — „Portal" ist slowakisch „Portál", „Website" ist
//     niederländisch „Website". Das ist nicht per Liste entscheidbar.
//   * Nur melden, was in ALLEN Sprachen gleich ist — fängt die echten Fälle,
//     lässt aber jede Marke stehen, weil die auch in allen Sprachen gleich ist.
//
// Deshalb: SCHWELLE + ALLOWLIST. Gemeldet wird nur, was in mindestens
// SCHWELLE_ANTEIL der Vergleichssprachen wortgleich ist (ein Schlüssel, der in
// 2 von 22 Sprachen zufällig gleich aussieht, ist meist echt so) UND nicht in
// der Allowlist steht. Die Allowlist ist eine Datei im Repo, die mitwächst:
// einmal geprüft und für richtig befunden, nie wieder gemeldet. Das Skript
// meldet damit NUR NEUE Vorkommen — die einzige Form, in der so eine Prüfung
// in einem lebenden Katalog brauchbar bleibt.
//
// Gegenprobe der Schwelle am realen Stand (24.08.2026): vor dem Fix meldete
// diese Prüfung alle 145 echten Fälle; nach dem Fix bleiben 65 Schlüssel über
// der Schwelle, und jeder einzelne davon ist legitim (Marken, Kürzel, Masken)
// oder gehört zum toten `website.editor.*`-Block, den Prüfung B ohnehin
// meldet. Genau diese 65 stehen als Startbestand in der Allowlist.
//
// ─────────────────────────────────────────────────────────────────────────────
// WARUM PRÜFUNG B FAIL-CLOSED ARBEITET (Wurzel 5)
//
// Ein falscher „verwaist"-Befund ist teurer als ein übersehener toter
// Schlüssel: wer ihn glaubt, löscht einen LEBENDEN Schlüssel, und die
// Oberfläche zeigt an der Stelle `MISSING_MESSAGE`. Deshalb gilt hier
// ausnahmslos: was nicht SICHER als unbenutzt bewiesen ist, gilt als BENUTZT.
//
// Der schwierige Teil sind dynamisch zusammengesetzte Schlüssel. Der Code ruft
// real 235-mal in der Form `t(`abschnitte.${a.hinweis}`)` auf — welcher
// Schlüssel das ist, steht in einem Array in einer anderen Datei. Dieses
// Skript löst solche Aufrufe nicht auf, sondern SPERRT ihren Präfix: jeder
// Schlüssel unter `abschnitte.` gilt als benutzt. Das ist bewusst grob. Der
// Preis ist, dass in gesperrten Präfixen echte Leichen unentdeckt bleiben;
// der Gewinn ist, dass kein lebender Schlüssel je gemeldet wird.
//
// Die Zahl der so nicht bewerteten Schlüssel ist die EHRLICHKEITSGRENZE des
// Skripts und wird bei jedem Lauf ausgegeben. Wer sie senken will, löst einen
// Präfix von Hand auf — nicht das Skript schärfer stellen.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const NACHRICHTEN = join(WURZEL, "web/messages");
const BASIS = "de";
const ALLOWLIST = join(
  dirname(fileURLToPath(import.meta.url)),
  "uebersetzungs-luecken-allowlist.json",
);

/** Anteil der Vergleichssprachen, ab dem „gleich wie Deutsch" ein Befund ist.
 *
 *  0.8 statt 1.0: der Fix-Commit 652bcad6 hat einzelne Sprachen früher
 *  übersetzt als andere (Polnisch war bei 61 Schlüsseln schon richtig, während
 *  21 andere Sprachen noch Deutsch zeigten). Eine Schwelle von 1.0 hätte
 *  diesen Zwischenstand komplett verschwiegen — genau die Lage, in der die
 *  Prüfung am nötigsten ist. Unter 0.8 kippt es in die andere Richtung: dann
 *  melden die romanischen und slawischen Sprachgruppen einander ihre echten
 *  Wortgleichheiten. */
const SCHWELLE_ANTEIL = 0.8;

/** Mindestzahl vergleichbarer Sprachen, damit der Anteil überhaupt etwas sagt.
 *
 *  Ohne diese Untergrenze meldet die Prüfung Unsinn: `website.editor.maxH`
 *  steht nur in de und en (die 22 anderen Sprachen haben den Block gar nicht),
 *  also ist der Anteil 1/1 = 100 % — ein „Befund" aus einer einzigen
 *  Vergleichssprache. Das ist keine Aussage über 22 Sprachen, sondern ein
 *  Nebenprodukt einer LÜCKE, und Lücken meldet
 *  `pruefe-uebersetzungen.mjs`. Bei weniger als der Hälfte der Sprachen wird
 *  hier deshalb nicht geurteilt. */
const MINDEST_VERGLEICHE = 12;

/** Verzeichnisse, in denen nach Aufrufen gesucht wird.
 *
 *  `web` ist die App, die `web/messages` lädt (web/i18n/request.ts). Die
 *  anderen Frontends haben EIGENE messages/-Verzeichnisse und teilen die
 *  Schlüssel nicht — geprüft am 24.08.2026: builder, admin und storybook
 *  benutzen next-intl überhaupt nicht (kein useTranslations/getTranslations),
 *  plattform, gastgeber und marketing laden je `../messages/` aus ihrem
 *  eigenen Ordner.
 *
 *  ABER: `web/messages` ist QUELLE für gespiegelte Kataloge. Zwei Skripte
 *  erzeugen daraus Dateien für andere Ziele:
 *    * scripts/i18n/ausstattung-plattform-sync.mjs  → plattform/lib/ausstattung
 *    * scripts/mobile/ausstattung-labels-sync.mjs   → beide Mobile-Apps
 *  Ein Schlüssel, der nur dort verbraucht wird, hat in `web` KEINE Aufrufstelle
 *  und wäre sonst ein Fehlalarm. Deshalb stehen die Spiegel-Ziele mit in der
 *  Suche, und die gespiegelten Namensräume zusätzlich als gesperrter Präfix. */
const SUCHORTE = ["web", "scripts/i18n", "scripts/mobile"];

/** Namensräume, die per Sync-Skript gespiegelt werden und deren Schlüssel
 *  deshalb nie direkt in einer Aufrufstelle stehen. Bewusst hier und nicht in
 *  der Aufruf-Erkennung: es ist eine Aussage über die Architektur, keine über
 *  den Code. */
const GESPIEGELTE_NAMENSRAEUME = [
  "amenities",
  "amenityGroups",
  "amenityCategories",
  "roomAmenities",
  "roomAmenityGroups",
  "eigeneAusstattung",
];

const DATEI_ENDUNGEN = [".ts", ".tsx", ".mjs", ".js", ".jsx"];
const UEBERSPRINGEN = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  "messages",
]);

/** Alle Blatt-Pfade eines Objekts, punktgetrennt — gleiches Muster wie in
 *  entwickler-namespace-pruefen.mjs. */
function pfade(obj, prefix = "") {
  const raus = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) raus.push(...pfade(v, p));
    else raus.push(p);
  }
  return raus;
}

function wert(obj, pfad) {
  return pfad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Alle Quelldateien unter einem Ort einsammeln. */
function quelldateien(ort) {
  const start = join(WURZEL, ort);
  if (!existsSync(start)) return [];
  const raus = [];
  const stapel = [start];
  while (stapel.length) {
    const jetzt = stapel.pop();
    for (const eintrag of readdirSync(jetzt, { withFileTypes: true })) {
      if (eintrag.name.startsWith(".") && eintrag.name !== ".") continue;
      const voll = join(jetzt, eintrag.name);
      if (eintrag.isDirectory()) {
        if (!UEBERSPRINGEN.has(eintrag.name)) stapel.push(voll);
      } else if (DATEI_ENDUNGEN.some((e) => eintrag.name.endsWith(e))) {
        if (statSync(voll).size < 4_000_000) raus.push(voll);
      }
    }
  }
  return raus;
}

// ─── Prüfung A ───────────────────────────────────────────────────────────────

function pruefungA(sprachen, basisDaten, allowlist) {
  const basisPfade = pfade(basisDaten).filter(
    (p) => typeof wert(basisDaten, p) === "string",
  );
  const gleich = new Map(); // pfad -> [sprachen]
  const vergleichbar = new Map(); // pfad -> anzahl

  for (const [sprache, daten] of sprachen) {
    for (const p of basisPfade) {
      const dt = wert(basisDaten, p);
      const uw = wert(daten, p);
      if (typeof uw !== "string") continue;
      vergleichbar.set(p, (vergleichbar.get(p) ?? 0) + 1);
      if (uw === dt) {
        if (!gleich.has(p)) gleich.set(p, []);
        gleich.get(p).push(sprache);
      }
    }
  }

  const befunde = [];
  let erlaubt = 0;
  let zuWenigVergleiche = 0;
  for (const [p, betroffene] of gleich) {
    const gesamt = vergleichbar.get(p) ?? 0;
    if (gesamt < MINDEST_VERGLEICHE) {
      zuWenigVergleiche++;
      continue;
    }
    if (betroffene.length / gesamt < SCHWELLE_ANTEIL) continue;
    if (allowlist.has(p)) {
      erlaubt++;
      continue;
    }
    befunde.push({
      pfad: p,
      text: wert(basisDaten, p),
      anzahl: betroffene.length,
      gesamt,
    });
  }
  befunde.sort((a, b) => a.pfad.localeCompare(b.pfad));
  return {
    befunde,
    erlaubt,
    zuWenigVergleiche,
    geprueft: basisPfade.length,
  };
}

// ─── Prüfung B ───────────────────────────────────────────────────────────────

/** Übersetzer-BINDUNGEN einer Datei: `const t = useTranslations("objects")`,
 *  `const tGemein = await getTranslations("common")`.
 *
 *  Der Variablenname wird MITGELESEN, statt jeden Funktionsaufruf mit
 *  String-Argument als Übersetzung zu deuten. Ohne diese Bindung matcht das
 *  Muster auch `fetch(...)`, `log(...)`, `new Date(...)` — beim ersten Versuch
 *  hat genau das 39 397 „gesperrte Präfixe" erzeugt und damit JEDEN Schlüssel
 *  als benutzt gewertet: die Prüfung war eine Attrappe, die immer grün war.
 *
 *  Erfasst werden auch namenlose Formen (`useTranslations("x")` ohne
 *  Zuweisung), damit deren Namensraum trotzdem bekannt ist. */
const BINDUNG_MUSTER =
  /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/g;

/** Namensraum-Aufrufe ohne Zuweisung — nur für die Namensraum-Liste. */
const NAMESPACE_MUSTER =
  /(?:useTranslations|getTranslations)\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/** Aufruf mit LITERALEM Schlüssel, gebunden an einen bekannten Übersetzer:
 *  t("a.b"), tGemein.rich('a.b'), t.has(`a.b`). Backticks nur OHNE ${…}. */
function literalMuster(namen) {
  return new RegExp(
    `\\b(${namen})(?:\\.(?:rich|has|markup))?\\(\\s*(?:"([^"\\n]+)"|'([^'\\n]+)'|\`([^\`\\n$]+)\`)`,
    "g",
  );
}

/** Aufruf mit ZUSAMMENGESETZTEM Schlüssel: t(`a.b.${x}`). Erfasst wird der
 *  statische Anfang bis zum ersten ${ — daraus wird ein gesperrter Präfix. */
function dynamischMuster(namen) {
  return new RegExp(
    `\\b(${namen})(?:\\.(?:rich|has|markup))?\\(\\s*\`([^\`\\n]*?)\\$\\{`,
    "g",
  );
}

/** Schlüssel-Fragmente in Datendateien: `hinweis: "reviewsHinweis"`.
 *
 *  Solche Werte setzt der Code später per Template zu einem Schlüssel zusammen
 *  (`t(\`abschnitte.${a.hinweis}\`)`) — als vollständiger Schlüssel stehen sie
 *  nirgends. Gesammelt werden sie deshalb als BLATTNAMEN und gegen das letzte
 *  Segment gehalten. Bewusst nur aus Dateien, die überhaupt einen dynamischen
 *  Übersetzer-Aufruf oder eine Konstanten-Tabelle enthalten: über alle 865
 *  Dateien gezogen wäre jedes englische Wort im Repo ein Fragment. */
const FRAGMENT_MUSTER = /["'`]([a-zA-Z][\w]{2,})["'`]/g;

/** JEDER String-Literal im Code, der wie ein Schlüsselpfad aussieht
 *  (`a.b`, `blockRequests.check.free`) — unabhängig davon, ob direkt hinter
 *  einer Klammer.
 *
 *  Ohne das entsteht ein FALSCHER „verwaist"-Befund, sobald der Schlüssel
 *  nicht als erstes Argument steht. Real gefunden in
 *  `sperrantrag-pruefung-dialog.tsx`: dort wählt ein Ternär INNERHALB des
 *  Aufrufs, über drei Zeilen mit Kommentar dazwischen —
 *      t(k.als_kuendigung ? "…terminationReady" : "…check.free")
 *  — und das an die Klammer gebundene Muster sieht keinen der beiden. Genau
 *  dieser Befund hätte jemanden dazu gebracht, einen lebenden Schlüssel zu
 *  löschen. Punktlose Strings bleiben ausgeschlossen, sonst gilt jedes Wort im
 *  Repo als Schlüssel. */
const PFADAEHNLICH_MUSTER =
  /["'`]([a-zA-Z][\w]*(?:\.[a-zA-Z_$][\w]*)+)["'`]/g;

function pruefungB(basisDaten) {
  const alleSchluessel = pfade(basisDaten);

  const literale = new Set();
  const praefixe = new Set(); // { praefix, namensraeume: Set }
  const namensraeume = new Set();
  const fragmente = new Set();
  const vollDynamisch = new Set(); // Namensräume mit t(`${x}`)

  let dateien = 0;
  let dynamischeStellen = 0;
  for (const ort of SUCHORTE) {
    for (const datei of quelldateien(ort)) {
      // Das Skript selbst zählt nicht als Aufrufstelle — sonst gilt jeder
      // Schlüssel, der hier als Beispiel im Kommentar steht, als benutzt.
      if (datei === fileURLToPath(import.meta.url)) continue;
      dateien++;
      const text = readFileSync(datei, "utf8");

      // 1. Welche Namensräume spannt diese Datei auf?
      const dateiNs = new Set();
      for (const m of text.matchAll(NAMESPACE_MUSTER)) {
        namensraeume.add(m[1]);
        dateiNs.add(m[1]);
      }

      // 1b. Jeder pfadähnliche String dieser Datei gilt als möglicher
      //     Schlüssel — auch außerhalb eines Aufrufs (Ternär, Konstante,
      //     Tabelle). Fail-closed gegen die Ternär-Falle oben.
      for (const m of text.matchAll(PFADAEHNLICH_MUSTER)) {
        literale.add(m[1]);
        for (const ns of dateiNs) literale.add(`${ns}.${m[1]}`);
      }

      // 2. Welche Variablen sind Übersetzer?
      const namen = new Set();
      for (const m of text.matchAll(BINDUNG_MUSTER)) namen.add(m[1]);
      if (namen.size === 0) {
        // Keine Bindung — dann ist diese Datei nur Fragment-Quelle.
        for (const m of text.matchAll(FRAGMENT_MUSTER)) fragmente.add(m[1]);
        continue;
      }
      const alternativen = [...namen]
        .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      // 3. Literale Aufrufe — der sichere Teil.
      for (const m of text.matchAll(literalMuster(alternativen))) {
        const s = m[2] ?? m[3] ?? m[4];
        if (s) {
          literale.add(s);
          for (const ns of dateiNs) literale.add(`${ns}.${s}`);
        }
      }

      // 4. Dynamische Aufrufe — der gesperrte Teil (fail-closed).
      for (const m of text.matchAll(dynamischMuster(alternativen))) {
        dynamischeStellen++;
        const roh = m[2].replace(/\.$/, "");
        if (roh === "") {
          // t(`${x}`) — der GANZE Schlüssel ist dynamisch. Alles unter den
          // Namensräumen dieser Datei kann gemeint sein.
          for (const ns of dateiNs) vollDynamisch.add(ns);
          continue;
        }
        praefixe.add(roh);
        for (const ns of dateiNs) praefixe.add(`${ns}.${roh}`);
      }

      for (const m of text.matchAll(FRAGMENT_MUSTER)) fragmente.add(m[1]);
    }
  }

  const benutzt = literale;

  // Gesperrte Präfixe: alles darunter gilt als benutzt.
  const gesperrt = new Set([...praefixe, ...vollDynamisch]);
  for (const ns of GESPIEGELTE_NAMENSRAEUME) gesperrt.add(ns);

  const verwaist = [];
  let nichtBewertbar = 0;
  for (const k of alleSchluessel) {
    if (benutzt.has(k)) continue;

    // Unter einem gesperrten Präfix? Dann nicht bewertbar (gilt als benutzt).
    //
    // Zwei Formen, und die zweite ist beim Bauen dieses Skripts einmal
    // durchgerutscht: Präfixe endeten nicht immer auf einem PUNKT. Der
    // Posteingang schreibt `t(`aiTone_${x}`)` und `t(`autoDay_${d}`)` — der
    // gesperrte Präfix heißt dort `inbox.aiTone_`, und ein reiner
    // Segment-Vergleich über Punkte sieht ihn nie. Ergebnis waren 100
    // „verwaiste" inbox-Schlüssel, die alle live benutzt sind. Deshalb wird
    // zusätzlich auf ZEICHEN-Präfix geprüft.
    const segmente = k.split(".");
    let unterSperre = false;
    for (let i = segmente.length - 1; i >= 1; i--) {
      if (gesperrt.has(segmente.slice(0, i).join("."))) {
        unterSperre = true;
        break;
      }
    }
    if (!unterSperre) {
      for (const g of gesperrt) {
        // Nur echte Teil-Präfixe (nicht auf `.` endend, sonst deckt es die
        // Schleife oben schon ab) und nicht der ganze Schlüssel selbst.
        if (g.length > 0 && g.length < k.length && k.startsWith(g)) {
          unterSperre = true;
          break;
        }
      }
    }
    if (unterSperre) {
      nichtBewertbar++;
      continue;
    }

    // Letztes Segment als Fragment irgendwo im Code? Dann könnte es per
    // Template zusammengesetzt werden — fail-closed, nicht bewertbar.
    if (fragmente.has(segmente.at(-1))) {
      nichtBewertbar++;
      continue;
    }

    verwaist.push(k);
  }

  verwaist.sort();
  return {
    verwaist,
    nichtBewertbar,
    gesamt: alleSchluessel.length,
    dateien,
    namensraeume: namensraeume.size,
    gesperrt: gesperrt.size,
    dynamischeStellen,
    literale: literale.size,
  };
}

// ─── Lauf ────────────────────────────────────────────────────────────────────

function laden(verzeichnis) {
  const dateien = readdirSync(verzeichnis).filter((f) => f.endsWith(".json"));
  const basisDatei = join(verzeichnis, `${BASIS}.json`);
  if (!existsSync(basisDatei)) {
    console.error(`FEHLER: ${basisDatei} fehlt.`);
    process.exit(2);
  }
  const basisDaten = JSON.parse(readFileSync(basisDatei, "utf8"));
  const sprachen = dateien
    .filter((f) => f !== `${BASIS}.json`)
    .sort()
    .map((f) => [
      f.replace(/\.json$/, ""),
      JSON.parse(readFileSync(join(verzeichnis, f), "utf8")),
    ]);
  return { basisDaten, sprachen };
}

function allowlistLaden() {
  if (!existsSync(ALLOWLIST)) return new Set();
  const roh = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  return new Set(roh.erlaubt ?? []);
}

// `--json` gibt beide Befundlisten VOLLSTÄNDIG und maschinenlesbar aus. Die
// Textausgabe kürzt lange Listen auf acht Einträge je Namensraum, was zum Lesen
// richtig, zum Nachprüfen aber falsch ist: beim Abgleich gegen die
// Stichprobenliste fehlten genau die abgeschnittenen Schlüssel.
// `NACHRICHTEN_VERZEICHNIS` erlaubt den Lauf gegen einen exportierten
// Altstand (git show → Ordner), ohne eine Datei im Repo anzufassen.
const alsJson = process.argv.includes("--json");
const verzeichnis = process.env.NACHRICHTEN_VERZEICHNIS ?? NACHRICHTEN;
const { basisDaten, sprachen } = laden(verzeichnis);
const allowlist = alsJson && process.env.OHNE_ALLOWLIST ? new Set() : allowlistLaden();

const a = pruefungA(sprachen, basisDaten, allowlist);
const bJson = pruefungB(basisDaten);

if (alsJson) {
  console.log(
    JSON.stringify(
      {
        sprachen: sprachen.length + 1,
        a: {
          befunde: a.befunde.map((x) => x.pfad),
          erlaubt: a.erlaubt,
          zuWenigVergleiche: a.zuWenigVergleiche,
        },
        b: {
          verwaist: bJson.verwaist,
          nichtBewertbar: bJson.nichtBewertbar,
          gesamt: bJson.gesamt,
        },
      },
      null,
      1,
    ),
  );
  process.exit(a.befunde.length + bJson.verwaist.length > 0 ? 1 : 0);
}

console.log(
  `── Übersetzungs-Lücken: ${sprachen.length + 1} Sprachen, Basis ${BASIS} ──`,
);
console.log(
  `\nA) Zielsprache trägt noch deutschen Text ` +
    `(Schwelle ${Math.round(SCHWELLE_ANTEIL * 100)} % der Sprachen)`,
);
for (const b of a.befunde) {
  console.error(
    `  ✗ ${b.pfad} — in ${b.anzahl}/${b.gesamt} Sprachen wortgleich: ` +
      JSON.stringify(b.text.length > 70 ? `${b.text.slice(0, 70)}…` : b.text),
  );
}
if (a.befunde.length === 0) {
  console.log(
    `  ✓ kein neuer Fall (${a.geprueft} Textschlüssel geprüft, ` +
      `${a.erlaubt} per Allowlist bekannt, ` +
      `${a.zuWenigVergleiche} mit zu wenigen Vergleichssprachen).`,
  );
} else {
  console.error(
    `\n  ${a.befunde.length} neue(r) Fall/Fälle. Entweder übersetzen — oder, ` +
      `wenn der Wert bewusst wortgleich bleibt (Marke, Kürzel, Maske), den ` +
      `Pfad in scripts/i18n/uebersetzungs-luecken-allowlist.json aufnehmen.`,
  );
}

const b = bJson;
console.log(`\nB) Schlüssel ohne Aufrufstelle im Code`);
console.log(
  `  ${b.dateien} Quelldateien, ${b.namensraeume} Namensräume, ` +
    `${b.literale} literale Aufrufe, ${b.dynamischeStellen} dynamische ` +
    `Aufrufstellen → ${b.gesperrt} gesperrte Präfixe.`,
);
if (b.verwaist.length) {
  const nachNamensraum = new Map();
  for (const k of b.verwaist) {
    const ns = k.split(".")[0];
    if (!nachNamensraum.has(ns)) nachNamensraum.set(ns, []);
    nachNamensraum.get(ns).push(k);
  }
  for (const [ns, keys] of [...nachNamensraum].sort()) {
    console.error(`  ✗ ${ns}: ${keys.length} verwaist`);
    for (const k of keys.slice(0, 8)) console.error(`      ${k}`);
    if (keys.length > 8) console.error(`      … ${keys.length - 8} weitere`);
  }
} else {
  console.log(`  ✓ kein verwaister Schlüssel.`);
}
console.log(
  `  Ehrlichkeitsgrenze: ${b.nichtBewertbar} von ${b.gesamt} Schlüsseln ` +
    `nicht bewertbar (dynamisch zusammengesetzt) — sie gelten als BENUTZT.`,
);

const befunde = a.befunde.length + b.verwaist.length;
if (befunde > 0) {
  console.error(`\n${befunde} Befund(e).`);
  process.exit(1);
}
console.log(`\n✓ Beide Prüfungen ohne Befund.`);
