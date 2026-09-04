#!/usr/bin/env node
// Findet die drei Intl-Fehlerklassen, die weder `tsc` noch ESLint sehen und die
// erst als roter Konsolenfehler im Browser auftauchen (Anlass: 04.09.2026, der
// Dienstplan warf alle drei gleichzeitig):
//
//  1. INVALID_KEY      — ein Schlüssel mit "." IN einer Ebene. next-intl drückt
//                        Verschachtelung selbst über "." aus und verweigert die
//                        ganze Nachrichtendatei, sobald ein Schlüssel einen
//                        Punkt enthält. Entstand durch einen flachen
//                        Übersetzungslauf, der "a.b" als Schlüsselnamen schrieb.
//  2. MISSING_MESSAGE  — `t("x.y")` zeigt auf einen Schlüssel, den es nicht gibt.
//                        Geprüft werden nur STATISCHE Schlüssel und solche mit
//                        genau einem eingesetzten Segment (`t(`a.${x}`)`) — dort
//                        wird geprüft, ob der ELTERN-Knoten existiert.
//  3. FORMATTING_ERROR — `t("x")` ohne Werte, obwohl der Text Platzhalter
//                        erwartet. Das rendert nicht den Text, sondern den
//                        Schlüsselnamen — sichtbar erst im Browser.
//
// ICU-Zweignamen sind KEINE Platzhalter: in `{n, plural, one {…} other {…}}`
// ist `one` ein Zweig, kein Wert. Genau diese Verwechslung hat am 03.09.2026
// 1588 fertige Übersetzungen mit deutschem Text überschrieben — deshalb parst
// dieses Skript ICU und greppt nicht.
//
// Aufruf: node scripts/i18n/intl-laufzeitfehler-pruefen.mjs [app …]
//         (ohne Argument: alle Apps mit messages/de.json)

import fs from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(import.meta.dirname, "../..");
const APPS = ["web", "plattform", "gastgeber", "builder", "admin", "marketing", "partner"];

/** Platzhalternamen eines ICU-Textes — ohne Plural-/Select-Zweignamen. */
function platzhalter(text) {
  const namen = new Set();
  const stapel = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // '' escapt in ICU ein literales Zeichen: {'{'} ist kein Platzhalter.
    if (ch === "'" && text[i + 1] === "'") {
      i += 2;
      continue;
    }
    if (ch === "'") {
      const ende = text.indexOf("'", i + 1);
      i = ende === -1 ? text.length : ende + 1;
      continue;
    }
    if (ch === "{") {
      const rest = text.slice(i + 1);
      const treffer = /^([^},\s]*)\s*(,?)/.exec(rest);
      const name = treffer[1];
      const hatKomma = treffer[2] === ",";
      if (hatKomma) {
        if (name) namen.add(name);
        stapel.push("arg");
      } else if (stapel.at(-1) === "arg") {
        stapel.push("zweig"); // {one}/{other}: Zweigname, kein Wert
      } else {
        if (name) namen.add(name);
        stapel.push("simpel");
      }
      i += 1;
      continue;
    }
    if (ch === "}") {
      stapel.pop();
      i += 1;
      continue;
    }
    i += 1;
  }
  return namen;
}

function* quelldateien(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* quelldateien(p);
    else if (/\.(tsx|ts)$/.test(e.name)) yield p;
  }
}

/** Übersetzer-Variablen einer Datei → ihr Namespace.
 *
 * Beide Formen zählen: `useTranslations` (Client) und `getTranslations`
 * (Server, auch destrukturiert aus `Promise.all([...])`). Ohne
 * `getTranslations` hielt eine frühere Fassung den Namespace für leer und
 * meldete 1191 Fehlalarme.
 *
 * Nur was eindeutig zuzuordnen ist, kommt in die Map. Kommt `t` als
 * Funktionsparameter herein, ist der Namespace hier nicht entscheidbar — die
 * Variable fehlt dann in der Map und ihre Aufrufe werden übersprungen. Ein
 * geratener Namespace produziert Fehlalarme, und ein Prüfskript mit
 * Fehlalarmen wird nicht gelesen.
 */
function uebersetzerNamespaces(src) {
  const map = new Map();
  const call = /(?:use|get)Translations(?:<[^>]*>)?\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/;

  const merke = (name, ns, ab) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push({ ab, ns });
  };

  // a) const t = useTranslations("x") / await getTranslations("x")
  const einzeln =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?((?:use|get)Translations(?:<[^>]*>)?\([^)]*\))/g;
  for (const m of src.matchAll(einzeln)) {
    const treffer = call.exec(m[2]);
    if (treffer) merke(m[1], treffer[1] ?? treffer[2] ?? "", m.index);
  }

  // b) const [t, tr] = await Promise.all([getTranslations("a"), getTranslations("b")])
  const mehrere = /(?:const|let|var)\s*\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\s*\[([\s\S]*?)\]\s*\)/g;
  for (const m of src.matchAll(mehrere)) {
    const namen = m[1].split(",").map((x) => x.trim()).filter(Boolean);
    const aufrufe = [
      ...m[2].matchAll(/(?:use|get)Translations(?:<[^>]*>)?\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g),
    ];
    if (namen.length !== aufrufe.length) continue; // nicht eindeutig → nichts raten
    namen.forEach((name, i) => merke(name, aufrufe[i][1] ?? aufrufe[i][2] ?? "", m.index));
  }

  // c) Variablen, die IRGENDWO in dieser Datei als Parameter hereinkommen
  //    (`t: ReturnType<typeof useTranslations>`), wieder entfernen: ihr
  //    Namespace steht beim Aufrufer, nicht hier. `statement-editor.tsx` hat
  //    beides — ein `useTranslations("ownerStatements")` oben und mehrere
  //    Unterkomponenten mit `t` als Prop. Ohne diesen Schritt wurden deren
  //    Aufrufe gegen den falschen Namespace geprüft: 30 Fehlalarme.
  for (const m of src.matchAll(/(\w+)\s*:\s*(?:Awaited<)?ReturnType<\s*typeof\s+(?:use|get)Translations/g)) {
    map.delete(m[1]);
  }
  return map;
}

let befunde = 0;
const apps = process.argv.slice(2).length ? process.argv.slice(2) : APPS;

for (const app of apps) {
  const msgDir = path.join(WURZEL, app, "messages");
  if (!fs.existsSync(path.join(msgDir, "de.json"))) continue;

  // --- 1. Punkt-Schlüssel in JEDER Sprache ---------------------------------
  for (const datei of fs.readdirSync(msgDir).filter((f) => f.endsWith(".json"))) {
    const suche = (o, pfad) => {
      for (const [k, v] of Object.entries(o)) {
        if (k.includes(".")) {
          console.log(`✗ ${app}/messages/${datei}: Schlüssel mit Punkt — ${pfad}${k}`);
          befunde += 1;
        }
        if (v && typeof v === "object" && !Array.isArray(v)) suche(v, `${pfad}${k}.`);
      }
    };
    suche(JSON.parse(fs.readFileSync(path.join(msgDir, datei), "utf8")), "");
  }

  // --- 2./3. Aufrufe gegen de.json ----------------------------------------
  const de = JSON.parse(fs.readFileSync(path.join(msgDir, "de.json"), "utf8"));
  const knoten = (pfad) => {
    let c = de;
    for (const seg of pfad.split(".")) {
      if (c === undefined || c === null || typeof c !== "object") return undefined;
      c = c[seg];
    }
    return c;
  };

  for (const rel of ["components", "app", "lib", "src"]) {
    for (const datei of quelldateien(path.join(WURZEL, app, rel))) {
      const rohSrc = fs.readFileSync(datei, "utf8");
      // Kommentare ausblenden (Länge erhalten, damit Zeilennummern stimmen):
      // ein Kommentar, der ein t(`…`)-Muster ERWÄHNT, ist kein Aufruf. In
      // `portal-statistiken.tsx` warnte genau so ein Kommentar davor, den
      // Aufruf blind zu machen — und wurde selbst als Befund gemeldet.
      const src = rohSrc
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
      const kurz = path.relative(WURZEL, datei);
      const nsMap = uebersetzerNamespaces(src);
      if (nsMap.size === 0) continue;
      // Längste zuerst und rechts abgegrenzt (`(?![\\w$])`): sonst matcht
      // der Name "t" auch in "tKalender" und prüft gegen den falschen
      // Namespace.
      const namen = [...nsMap.keys()].sort((a, b) => b.length - a.length).join("|");
      const zeileVon = (i) => src.slice(0, i).split("\n").length;
      const melde = (text) => {
        console.log(`\u2717 ${kurz}${text}`);
        befunde += 1;
      };
      /** Der Namespace, der an DIESER Stelle gilt: die letzte Deklaration davor.
       *  Eine Datei kann mehrere haben (`objects.sync` oben,
       *  `objects.sync.airbnbPull` in einer Unterkomponente) — nur die letzte
       *  zu nehmen ergab 12 Fehlalarme in `property-sync.tsx`. */
      const nsAn = (name, index) => {
        const eintraege = nsMap.get(name) ?? [];
        let ns = null;
        for (const e of eintraege) {
          if (e.ab < index) ns = e.ns;
        }
        return ns;
      };
      const pfad = (ns, key) => [ns, key].filter(Boolean).join(".");

      // t("a.b") ohne Werte-Objekt
      for (const m of src.matchAll(
        new RegExp(`\\b(${namen})(?![\\w$])(?:\\.rich)?\\(\\s*"([^"{}$<>]+)"\\s*\\)`, "g"),
      )) {
        const ns = nsAn(m[1], m.index);
        if (ns === null) continue;
        const voll = pfad(ns, m[2]);
        const wert = knoten(voll);
        if (wert === undefined) {
          melde(`:${zeileVon(m.index)}: ${m[1]}("${m[2]}") \u2014 kein Eintrag ${voll}`);
          continue;
        }
        if (typeof wert !== "string") continue;
        const ph = platzhalter(wert);
        if (ph.size > 0) {
          melde(
            `:${zeileVon(m.index)}: ${m[1]}("${m[2]}") ohne Werte \u2014 Text braucht ` +
              `{${[...ph].join(", ")}}`,
          );
        }
      }

      // t("a.b", {…}) — nur Existenz prüfen
      for (const m of src.matchAll(
        new RegExp(`\\b(${namen})(?![\\w$])(?:\\.rich)?\\(\\s*"([^"{}$<>]+)"\\s*,`, "g"),
      )) {
        const ns = nsAn(m[1], m.index);
        if (ns === null) continue;
        const voll = pfad(ns, m[2]);
        if (knoten(voll) === undefined) {
          melde(`:${zeileVon(m.index)}: ${m[1]}("${m[2]}", \u2026) \u2014 kein Eintrag ${voll}`);
        }
      }

      // t(`a.b.${x}`) und t(`kind_${x}`): das FESTE Präfix muss zu etwas führen.
      // Endet es auf ".", ist der Elternknoten ein Objekt; sonst ist es ein
      // Namens-Präfix (`kind_travel_agent`) und mindestens ein Schlüssel muss
      // damit beginnen. Beides zu verwechseln ergab 9 Fehlalarme.
      for (const m of src.matchAll(
        new RegExp(`\\b(${namen})(?![\\w$])(?:\\.rich)?\\(\\s*\`([^\`]*)\\$\\{`, "g"),
      )) {
        const ns = nsAn(m[1], m.index);
        if (ns === null || !m[2]) continue;
        const roh = m[2];
        // Steht im festen Teil selbst noch ein Ausdruck (`t(`${ns}.${x}`)`,
        // `t(`scope${gross}${rest}`)`), ist der Pfad statisch nicht bestimmbar.
        // Solche Stellen werden übersprungen, nicht geraten.
        if (roh.includes("$") || roh.includes("{")) continue;
        const zeile = zeileVon(m.index);
        if (roh.endsWith(".")) {
          const voll = pfad(ns, roh.slice(0, -1));
          const eltern = knoten(voll);
          if (eltern === undefined) {
            melde(`:${zeile}: ${m[1]}(\`${roh}\${\u2026}\`) \u2014 kein Knoten ${voll}`);
          } else if (typeof eltern !== "object") {
            melde(`:${zeile}: ${m[1]}(\`${roh}\${\u2026}\`) \u2014 ${voll} ist ein Text`);
          }
          continue;
        }
        // Namens-Präfix: der Elternpfad ist alles bis zum letzten Punkt.
        const letzter = roh.lastIndexOf(".");
        const elternPfad = letzter === -1 ? ns : pfad(ns, roh.slice(0, letzter));
        const rest = letzter === -1 ? roh : roh.slice(letzter + 1);
        const eltern = elternPfad ? knoten(elternPfad) : de;
        if (eltern === undefined || typeof eltern !== "object") {
          melde(`:${zeile}: ${m[1]}(\`${roh}\${\u2026}\`) \u2014 kein Knoten ${elternPfad}`);
          continue;
        }
        if (!Object.keys(eltern).some((k) => k.startsWith(rest))) {
          melde(
            `:${zeile}: ${m[1]}(\`${roh}\${\u2026}\`) \u2014 kein Schlüssel unter ` +
              `${elternPfad || "(Wurzel)"} beginnt mit "${rest}"`,
          );
        }
      }
    }
  }
}

if (befunde === 0) {
  console.log("✓ keine Intl-Laufzeitfehler (Punkt-Schlüssel, fehlende Keys, fehlende Werte).");
  process.exit(0);
}
console.log(`\n${befunde} Befund(e). Jeder davon ist im Browser ein roter Konsolenfehler.`);
process.exit(1);
