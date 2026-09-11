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

/** EIN Stück, das myNextDays als Ganzes beschreibt.
 *
 *  WARUM ES DAS BRAUCHT: Auf „kannst du mir das tool erklären" fand die Suche
 *  am 11.09.2026 drei Entwickler-Artikel und den Website-Baukasten — und der
 *  Bot erklärte prompt den Baukasten. Jede EINZELNE Funktionsseite beschreibt
 *  ihren Bereich gut, aber keine beschreibt das Produkt; der Überblick lag
 *  nur in einem FAQ-Eintrag („Was ist myNextDays genau?"), den diese
 *  Frageform nicht trifft.
 *
 *  Der Text wird NICHT neu geschrieben, sondern aus den elf Bereichsnamen und
 *  ihren Stichworten zusammengesetzt. Eine handgeschriebene Produktübersicht
 *  wäre eine zwölfte Stelle, die bei jeder neuen Funktion nachgezogen werden
 *  müsste — und die als erste veraltet (Wurzel 4). */
function ueberblickStueck(liste, texte, sprache) {
  const zeilen = liste
    .map((f) => {
      const g = texte?.features?.gruppen?.[f.key];
      const name = feld(g ?? {}, "title", "name");
      if (!name) return null;
      const was = feld(g ?? {}, "items", "stichworte");
      return was ? `${name}: ${was}` : name;
    })
    .filter(Boolean);
  if (zeilen.length < 3) return null;

  const kopf = feld(texte?.faq?.was ?? {}, "a", "antwort", "answer");
  const inhalt = [
    "myNextDays im Überblick",
    kopf,
    "Diese Bereiche gehören dazu:",
    ...zeilen,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    quelle: "funktion",
    quelle_id: "ueberblick",
    abschnitt: 0,
    sprache,
    titel: "myNextDays im Überblick",
    inhalt,
    pfad: "/funktionen",
    inhalt_hash: hash(inhalt),
  };
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

  const ueberblick = ueberblickStueck(liste, texte, sprache);
  if (ueberblick) stuecke.push(ueberblick);

  return stuecke;
}

/** Die Nutzen-/Block-Kacheln einer Funktionsseite als Text.
 *
 *  Sie liegen als Objekt mit den Schlüsseln `a`, `b`, `c` … — eine Liste
 *  wäre in den 24 Sprachdateien schwerer zu pflegen. Für uns zählt nur der
 *  Text, nicht die Position. */
function kachelTexte(kacheln) {
  return Object.values(kacheln ?? {})
    .filter((k) => k && typeof k === "object")
    .map((k) => [feld(k, "titel"), feld(k, "text")].filter(Boolean).join(" — "))
    .filter(Boolean);
}

/** Die Reiter einer Funktionsseite als je eine Textzeile. */
function reiterZeilen(reiter, seite) {
  return (reiter ?? [])
    .map((r) => seite?.reiter?.[r.key])
    .filter(Boolean)
    .map((r) =>
      [
        feld(r, "titel"),
        feld(r, "heading"),
        feld(r, "text"),
        Object.values(r?.punkte ?? {}).filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" — "),
    );
}

/** Der Fließtext einer Funktionsseite: Überschrift, Einleitung, Kacheln,
 *  Reiter — in der Reihenfolge, in der ein Leser sie auf der Seite sieht. */
function funktionsInhalt(name, gruppe, seite, reiterTexte) {
  return [
    name,
    feld(gruppe ?? {}, "items", "stichworte"),
    feld(seite ?? {}, "headline", "heroText"),
    feld(seite ?? {}, "sub"),
    ...kachelTexte(seite?.nutzen),
    ...kachelTexte(seite?.block),
    ...reiterTexte,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/** Eine Funktionsseite wird ein Wissensstück — oder null ohne Texte.
 *
 *  DIE FELDNAMEN SIND GEMESSEN, NICHT GERATEN. Bis zum 11.09.2026 las diese
 *  Funktion `gruppe.name`, `gruppe.stichworte` und `seite.heroText` — drei
 *  Namen, die es in `messages/*.json` nicht gibt. Ergebnis: alle ELF
 *  Funktionsseiten landeten mit dem rohen Schlüssel als Titel in der
 *  Datenbank („preise", „pms", „gaeste"), und ihr Inhalt bestand nur aus den
 *  Reitern — Überschrift, Einleitung und Stichworte fehlten.
 *
 *  Das war beides gleichzeitig sichtbar: der Bot zeigte „preise" als Quelle
 *  neben zwei lesbaren Titeln, und auf „kannst du mir das tool erklären"
 *  antwortete er über den Website-Baukasten — weil genau der Teil fehlte, der
 *  sagt, worum es auf der Seite überhaupt geht. */
function funktionsStueck(f, texte, sprache) {
  const gruppe = texte?.features?.gruppen?.[f.key];
  const seite = texte?.funktionen?.[f.key];
  if (!gruppe && !seite) return null;

  const reiterTexte = reiterZeilen(f.reiter, seite);

  const name = feld(gruppe ?? {}, "title", "name");
  // Ohne lesbaren Namen gar kein Stück — siehe `titel` unten.
  if (!name) return null;

  const inhalt = funktionsInhalt(name, gruppe, seite, reiterTexte);
  if (!inhalt) return null;

  return {
    quelle: "funktion",
    quelle_id: f.key,
    abschnitt: 0,
    sprache,
    // Ohne lesbaren Namen KEIN Stück: ein Quellenhinweis „preise" unter einer
    // Antwort ist für den Besucher wertlos und verrät nur unsere Schlüssel.
    // Lieber eine Quelle weniger als eine unverständliche (Wurzel 4).
    titel: name,
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

/** Alle Frage-Antwort-Blöcke der Seite, nicht nur der auf der Startseite.
 *
 *  Gemessen am 10.09.2026: es gibt VIER Blöcke — `faq` (Startseite, 12),
 *  `preise.faq` (12), `kontakt.faq` (12) und `partner.faq` (20). Die ersten
 *  Fassung dieses Sammlers las nur `faq` und suchte dort nach `q`/`a`; die
 *  echten Feldnamen sind `frage`/`antwort`. Ergebnis: 44 von 56
 *  Frage-Antwort-Paaren fehlten im Wissen — ausgerechnet die zu Preisen,
 *  Kontakt und Partnerprogramm, also genau das, was Interessenten fragen.
 *
 *  Der Pfad je Block ist wichtig: eine Antwort ohne Sprungziel kann der
 *  Besucher nicht nachlesen. */
const FAQ_BLOECKE = [
  { pfad_key: "faq", pfad: "/#faq" },
  { pfad_key: "preise.faq", pfad: "/preise#faq" },
  { pfad_key: "kontakt.faq", pfad: "/kontakt#faq" },
  { pfad_key: "partner.faq", pfad: "/partner#faq" },
];

/** Wert eines Punktpfads („preise.faq") aus einem verschachtelten Objekt. */
function unterObjekt(objekt, punktpfad) {
  return punktpfad.split(".").reduce((o, k) => o?.[k], objekt);
}

async function faqStuecke(sprache) {
  const texte = await sprachdatei(sprache);
  if (!texte) return [];

  const stuecke = [];
  for (const block of FAQ_BLOECKE) {
    const roh = unterObjekt(texte, block.pfad_key);
    const faq = roh?.items ?? roh;
    if (!faq || typeof faq !== "object") continue;

    for (const [key, eintrag] of Object.entries(faq)) {
      const frage = feld(eintrag, "q", "frage", "question");
      const antwort = feld(eintrag, "a", "antwort", "answer");
      if (!frage || !antwort) continue;
      const inhalt = `${frage}\n\n${antwort}`.trim();
      stuecke.push({
        quelle: "faq",
        // Der Block gehört in die Kennung: `preis` gibt es in `faq` UND in
        // `preise.faq`, sonst überschreibt der zweite den ersten.
        quelle_id: `${block.pfad_key}.${key}`,
        abschnitt: 0,
        sprache,
        titel: frage,
        inhalt,
        pfad: block.pfad,
        inhalt_hash: hash(inhalt),
      });
    }
  }
  return stuecke;
}

/** Die Entwickler-Dokumentation: Open API, Webhooks, Scopes.
 *
 *  Eigene Quelle, weil sie weder Hilfe-Artikel noch Funktionsseite ist. Ohne
 *  sie antwortete der Bot auf „Gibt es eine API?" mit „weiß ich nicht" —
 *  während die Seite /entwickler eine vollständige Referenz trägt. */
async function entwicklerStuecke(sprache) {
  const texte = await sprachdatei(sprache);
  const entwickler = texte?.entwickler;
  if (!entwickler || typeof entwickler !== "object") return [];

  const stuecke = [];
  for (const [key, block] of Object.entries(entwickler)) {
    if (!block || typeof block !== "object") continue;
    // Jeder Abschnitt der Doku wird ein Stück: Titel plus alle Textfelder
    // darunter. Die Endpunktliste selbst bleibt draußen — sie ist
    // sprachneutraler Vertrag (siehe `content/api/referenz.ts`) und in einer
    // Bedeutungssuche wertlos.
    const werte = Object.values(block).filter((v) => typeof v === "string");
    if (werte.length < 2) continue;
    const inhalt = werte.join("\n\n").trim();
    if (inhalt.length < 80) continue;

    // OHNE ÜBERSCHRIFT KEIN STÜCK. Der Filter oben nimmt jeden Block mit zwei
    // Zeichenketten — und traf damit auch reine Oberflächen-Beschriftungen:
    // `sidebar` („Springen zu …", „Auf dieser Seite") und `referenz`
    // („Pfad-Parameter", „Anfrage-Körper"). Beide landeten als Wissensstücke
    // in der Datenbank, mit dem rohen Schlüssel als Titel, und konnten dem
    // Bot als Quelle untergeschoben werden, ohne eine Frage zu beantworten.
    // Eine Überschrift ist das verlässliche Unterscheidungsmerkmal: ein
    // echter Doku-Abschnitt hat eine, eine Label-Sammlung nicht.
    const ueberschrift = feld(block, "heading", "titel", "title");
    if (!ueberschrift) continue;

    stuecke.push({
      quelle: "funktion",
      quelle_id: `entwickler.${key}`,
      abschnitt: 0,
      sprache,
      titel: `Entwickler — ${ueberschrift}`,
      inhalt,
      pfad: "/entwickler",
      inhalt_hash: hash(inhalt),
    });
  }
  return stuecke;
}

/** Die Rechtsdokumente: Datenschutz, Impressum, AGB, AVV, Cookies.
 *
 *  WARUM SIE INS WISSEN GEHÖREN: „Ist die Software DSGVO-konform?", „Wo
 *  stehen die Server?", „Gibt es einen AV-Vertrag?" sind Fragen, die vor dem
 *  Kauf kommen und heute im Support landen. Die Antwort steht bereits
 *  geschrieben — in 24 Sprachen, juristisch geprüft.
 *
 *  EIN ABSCHNITT = EIN STÜCK, nicht ein Dokument: die Datenschutzerklärung
 *  hat über 20 Abschnitte und wäre als Ganzes weit über der Einbettungsgrenze
 *  von 8000 Zeichen. Der Abschnitt ist auch die Einheit, auf die der
 *  Ankerlink zeigt.
 *
 *  Gelesen wird aus den ORDNERN, nicht über `content/legal/laden.ts`: dessen
 *  Loader ist auf `Record<Locale, …>` getippt und für den Browser gebaut. Ein
 *  fehlendes Dokument fällt hier still durch — das ist richtig, denn nicht
 *  jede Sprache hat jedes Dokument, und ein Abbruch würde den ganzen Lauf
 *  kosten. */
const RECHTSDOKUMENTE = [
  { ordner: "datenschutz", pfad: "/datenschutz" },
  { ordner: "impressum", pfad: "/impressum" },
  { ordner: "cookies", pfad: "/cookie-richtlinie" },
  { ordner: "avv", pfad: "/auftragsverarbeitung" },
  { ordner: "agb", pfad: "/agb" },
];

/** Text eines Rechtsabschnitts — Absätze, Listen, Unterpunkte, Angabenblöcke. */
function abschnittText(abschnitt) {
  const teile = [abschnitt.heading];
  teile.push(...(abschnitt.paragraphs ?? []));
  teile.push(...(abschnitt.list ?? []));
  for (const z of abschnitt.zeilen ?? []) {
    teile.push(`${z.label}: ${(z.werte ?? []).join(", ")}`);
  }
  for (const u of abschnitt.unterpunkte ?? []) {
    if (u.titel) teile.push(u.titel);
    teile.push(...(u.paragraphs ?? []));
    teile.push(...(u.list ?? []));
  }
  return teile.filter(Boolean).join("\n\n").trim();
}

async function rechtsStuecke(sprache) {
  const stuecke = [];
  for (const dok of RECHTSDOKUMENTE) {
    let modul;
    try {
      modul = await import(
        path.join(WURZEL, "content", "legal", dok.ordner, `${sprache}.ts`)
      );
    } catch {
      continue;
    }
    const inhalt = Object.values(modul).find(
      (v) => v && typeof v === "object" && Array.isArray(v.sections),
    );
    if (!inhalt) continue;

    inhalt.sections.forEach((abschnitt, i) => {
      const text = abschnittText(abschnitt);
      // Sehr kurze Abschnitte (eine Überschrift, ein Halbsatz) tragen keine
      // Bedeutung und verwässern nur die Suche.
      if (text.length < 120) return;
      stuecke.push({
        quelle: "legal",
        quelle_id: dok.ordner,
        abschnitt: i,
        sprache,
        titel: `${inhalt.title ?? dok.ordner} — ${abschnitt.heading}`,
        // Der Deckel schützt vor stiller Kürzung durch das Modell; ein
        // Abschnitt über 8000 Zeichen ist ohnehin ein Gliederungsfehler.
        inhalt: text.slice(0, 7900),
        pfad: dok.pfad,
        inhalt_hash: hash(text.slice(0, 7900)),
      });
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
    const e = await entwicklerStuecke(sprache);
    const r = await rechtsStuecke(sprache);
    alle.push(...h, ...f, ...q, ...e, ...r);
    console.log(
      `  ${sprache}: ${String(h.length).padStart(3)} Hilfe · ` +
        `${String(f.length).padStart(2)} Funktionen · ` +
        `${String(q.length).padStart(2)} FAQ · ` +
        `${String(e.length).padStart(2)} Entwickler · ` +
        `${String(r.length).padStart(3)} Recht`,
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
