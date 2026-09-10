// Sammelt das Produktwissen der Marketing-Seite als JSON für den RAG-Aufbau.
//
// WARUM HIER UND NICHT IN PYTHON: Die Quellen sind TypeScript-Module
// (`content/help/<sprache>/*.ts`, `content/funktionen.ts`) und JSON-
// Sprachdateien. Sie in Python zu parsen hieße, TypeScript mit regulären
// Ausdrücken zu lesen — genau die Sorte Parser, die bei der ersten
// verschachtelten Klammer bricht. Node importiert die Module stattdessen und
// bekommt die echten Objekte.
//
// AUSGABE: eine JSON-Datei mit einer flachen Liste von Wissensstücken. Der
// Python-Lauf (`scripts/produktwissen/aufbauen.py`) liest sie, bettet ein und
// schreibt in die Datenbank. Zwei Schritte statt einem, weil die Sprachen
// getrennt laufen und ein abgebrochener Embedding-Lauf die gesammelten Texte
// nicht verlieren soll.
//
// SCHNITTGRÖSSE: ein Hilfe-ARTIKEL ist ein Stück, nicht eine Kategorie und
// nicht ein Absatz. Ein Artikel hat einen Titel, eine eigene URL und
// beantwortet genau eine Frage — das ist die Einheit, die ein Chatbot
// zitieren können muss. Eine ganze Kategorie (bis 285 Zeilen) wäre zu grob:
// die Einbettung verwischt zwischen sechs Themen. Ein einzelner Absatz wäre
// zu fein: ihm fehlt der Zusammenhang, und die Antwort könnte nicht auf eine
// Seite verweisen.
//
// Aufruf (aus marketing/):
//   node scripts/produktwissen-sammeln.mjs                 # alle Sprachen
//   node scripts/produktwissen-sammeln.mjs --sprachen de,en
//   node scripts/produktwissen-sammeln.mjs --aus /tmp/wissen.json
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");

/** Text aus einem Body-Block. Die Blocktypen stehen in `content/help/types.ts`;
 *  neue Typen fallen hier durch und werden gezählt, nicht stillschweigend
 *  übergangen — ein Block ohne Text wäre Wissen, das nie in die Antwort kommt. */
function blockText(block, unbekannt) {
  if (typeof block === "string") return block;
  if (!block || typeof block !== "object") return "";
  if (typeof block.text === "string") return block.text;
  if (Array.isArray(block.items)) {
    return block.items
      .map((i) => (typeof i === "string" ? i : i?.text ?? ""))
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(block.rows)) {
    return block.rows
      .map((r) => (Array.isArray(r) ? r.join(" — ") : String(r ?? "")))
      .join("\n");
  }
  if (Array.isArray(block.steps)) {
    return block.steps
      .map((s, i) => `${i + 1}. ${typeof s === "string" ? s : s?.text ?? ""}`)
      .join("\n");
  }
  if (block.type) unbekannt.add(block.type);
  return "";
}

/** Markdown-Links auf den reinen Text zurückführen: „[Text](/pfad)" → „Text".
 *  Der Pfad gehört nicht in die Einbettung — er verwässert die Bedeutung und
 *  taucht in der Antwort ohnehin über das Feld `pfad` auf. */
function ohneLinks(text) {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function hash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
}

async function hilfeStuecke(sprache, unbekannt) {
  const ordner = path.join(WURZEL, "content", "help", sprache);
  let dateien;
  try {
    dateien = (await readdir(ordner)).filter(
      (d) => d.endsWith(".ts") && d !== "index.ts",
    );
  } catch {
    return [];
  }

  const stuecke = [];
  for (const datei of dateien.sort()) {
    const modul = await import(path.join(ordner, datei));
    for (const kategorie of Object.values(modul)) {
      if (!kategorie?.slug || !Array.isArray(kategorie.sections)) continue;
      const artikel = kategorie.sections.flatMap((s) => s.articles ?? []);
      for (const a of artikel) {
        const stueck = artikelStueck(kategorie, a, sprache, unbekannt);
        if (stueck) stuecke.push(stueck);
      }
    }
  }
  return stuecke;
}

/** Ein Artikel wird ein Wissensstück — oder null, wenn er keinen Text hat.
 *
 *  Eigene Funktion, weil die Schleife darüber sonst fünf Ebenen tief läuft
 *  (Datei → Kategorie → Sektion → Artikel → Block) und das Gate `max-depth`
 *  bricht. Die Verschachtelung war auch ohne Regel schwer zu lesen. */
function artikelStueck(kategorie, artikel, sprache, unbekannt) {
  const absaetze = (artikel.body ?? [])
    .map((b) => blockText(b, unbekannt))
    .filter(Boolean)
    .join("\n\n");
  // Der Titel steht MIT im Inhalt, nicht nur im Titelfeld: die Einbettung
  // sieht nur `inhalt`, und „Was ist der Kanalmanager?" trägt mehr Bedeutung
  // als der halbe Fließtext darunter.
  const inhalt = ohneLinks(
    [artikel.title, artikel.excerpt, absaetze].filter(Boolean).join("\n\n"),
  ).trim();
  if (!inhalt) return null;
  return {
    quelle: "hilfe",
    quelle_id: `${kategorie.slug}/${artikel.slug}`,
    abschnitt: 0,
    sprache,
    titel: `${kategorie.title} — ${artikel.title}`,
    inhalt,
    pfad: `/hilfe/${kategorie.slug}/${artikel.slug}`,
    inhalt_hash: hash(inhalt),
  };
}

/** Die Sprachdatei einer Sprache — oder null, wenn es sie nicht gibt.
 *
 *  EIN Helfer für beide Aufrufer: derselbe try/catch stand zweimal da und
 *  zählte in beiden Funktionen in die Komplexität. */
async function sprachdatei(sprache) {
  try {
    const roh = await import(
      path.join(WURZEL, "messages", `${sprache}.json`),
      { with: { type: "json" } }
    );
    return roh.default;
  } catch {
    return null;
  }
}

/** Funktionsseiten: Name, Stichwortzeile und die Reiter-Texte aus der
 *  Sprachdatei. Der Katalog (`content/funktionen.ts`) liefert nur die
 *  Struktur — die Texte stehen in `messages/<sprache>.json`. */
async function funktionsStuecke(sprache) {
  const katalog = await import(path.join(WURZEL, "content", "funktionen.ts"));
  const liste = katalog.FUNKTIONEN ?? katalog.default ?? [];
  const texte = await sprachdatei(sprache);
  if (!texte) return [];

  const stuecke = [];
  for (const f of liste) {
    const stueck = funktionsStueck(f, texte, sprache);
    if (stueck) stuecke.push(stueck);
  }
  return stuecke;
}

/** Eine Funktionsseite wird ein Wissensstück — oder null ohne Texte. */
function funktionsStueck(f, texte, sprache) {
  const gruppe = texte?.features?.gruppen?.[f.key];
  const seite = texte?.funktionen?.[f.key];
  if (!gruppe && !seite) return null;

  const reiterTexte = (f.reiter ?? [])
    .map((r) => seite?.reiter?.[r.key])
    .filter(Boolean)
    .map((r) => [r.titel, r.heading, r.text].filter(Boolean).join(" — "));

  const inhalt = [gruppe?.name, gruppe?.stichworte, seite?.heroText, ...reiterTexte]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (!inhalt) return null;

  return {
    quelle: "funktion",
    quelle_id: f.key,
    abschnitt: 0,
    sprache,
    titel: gruppe?.name ?? f.key,
    inhalt,
    pfad: `/funktionen/${f.slug}`,
    inhalt_hash: hash(inhalt),
  };
}

/** Erstes gesetztes Feld aus mehreren Namen.
 *
 *  Die FAQ-Einträge heißen je nach Alter des Schlüssels `q`/`frage`/`question`.
 *  Als Kette `a ?? b ?? c` zählt jede Alternative in die Komplexität; als
 *  Helfer steht sie einmal da. */
function feld(objekt, ...namen) {
  for (const name of namen) {
    const wert = objekt?.[name];
    if (typeof wert === "string" && wert.trim()) return wert;
  }
  return null;
}

/** Häufige Fragen der Startseite — sie sind wörtlich das, was Besucher fragen. */
async function faqStuecke(sprache) {
  const texte = await sprachdatei(sprache);
  if (!texte) return [];
  const faq = texte?.faq?.items ?? texte?.faq;
  if (!faq || typeof faq !== "object") return [];

  const stuecke = [];
  for (const [key, eintrag] of Object.entries(faq)) {
    const frage = feld(eintrag, "q", "frage", "question");
    const antwort = feld(eintrag, "a", "antwort", "answer");
    if (!frage || !antwort) continue;
    const inhalt = `${frage}\n\n${antwort}`.trim();
    stuecke.push({
      quelle: "faq",
      quelle_id: key,
      abschnitt: 0,
      sprache,
      titel: frage,
      inhalt,
      pfad: "/#faq",
      inhalt_hash: hash(inhalt),
    });
  }
  return stuecke;
}

async function main() {
  const argv = process.argv.slice(2);
  const wert = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };

  const alleSprachen = (await readdir(path.join(WURZEL, "content", "help")))
    .filter((d) => !d.includes("."))
    .sort();
  const sprachen = (wert("--sprachen") ?? alleSprachen.join(",")).split(",");
  const ziel = wert("--aus") ?? path.join(WURZEL, "..", "produktwissen.json");

  const unbekannt = new Set();
  const alle = [];
  for (const sprache of sprachen) {
    const h = await hilfeStuecke(sprache, unbekannt);
    const f = await funktionsStuecke(sprache);
    const q = await faqStuecke(sprache);
    alle.push(...h, ...f, ...q);
    console.log(
      `  ${sprache}: ${String(h.length).padStart(3)} Hilfe · ` +
        `${String(f.length).padStart(2)} Funktionen · ${String(q.length).padStart(2)} FAQ`,
    );
  }

  // Ein unbekannter Blocktyp heißt: dieser Text fehlt im Wissen, ohne dass es
  // jemand merkt. Laut melden statt still übergehen (Wurzel 5).
  if (unbekannt.size > 0) {
    console.error(
      `\nWARNUNG: unbekannte Blocktypen ohne Text: ${[...unbekannt].join(", ")}`,
    );
    console.error("Diese Inhalte fehlen im Produktwissen — blockText ergänzen.");
    process.exitCode = 1;
  }

  await writeFile(ziel, `${JSON.stringify(alle, null, 2)}\n`, "utf8");
  const zeichen = alle.reduce((s, x) => s + x.inhalt.length, 0);
  console.log(
    `\n${alle.length} Wissensstücke, ${zeichen.toLocaleString("de")} Zeichen → ${ziel}`,
  );
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
