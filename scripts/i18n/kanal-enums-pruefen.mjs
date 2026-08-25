#!/usr/bin/env node
// Hält die Kanal-Enums der Frontends am Backend-Contract.
//
// Der Grund: `ReservationChannel` und `AvailabilitySource` sind in jedem
// Frontend eine handgepflegte KOPIE der Pydantic-Enums. Kommt hinten ein Wert
// dazu (so geschehen mit `ota_other` für Expedia/Agoda, Migration 0222/0253),
// merkt es niemand — `tsc` prüft nur gegen die Kopie, und die UI kippt erst,
// wenn die erste echte Buchung dieses Kanals hereinkommt: fehlendes
// i18n-Label (MISSING_MESSAGE), stiller Farb-Fallback auf einen FREMDEN Kanal
// (Expedia-Buchung sah aus wie myBestDays) und ein Filter, der die Buchung
// nicht findet.
//
// Geprüft wird deshalb fünffach, entlang der ganzen Kette DB → API → UI:
//   1. das Pydantic-Enum kennt jeden Wert des DB-Enums (aus den Migrationen),
//   2. die Union je Frontend deckt die Backend-Werte ab,
//   3. das Kanal-Meta-Mapping kennt jeden Wert (Farbe/Logo),
//   4. jede web-Sprachdatei hat calendar.channel.<wert>,
//   5. der SERVERSEITIGE Mail-Katalog hat kanal.<wert> in allen 24 Sprachen.
//
// Schritt 5 kam am 25.08.2026 dazu. `website` (eigenes Buchungsformular) stand
// in DB, Pydantic, allen Unions und allen Sprachdateien — nur nicht in
// `core/mail_texte.py`. Der Backstop dort gab für den unbekannten Schlüssel
// `None` zurück, und `"{gast} · {kanal}".format(kanal=None)` machte daraus das
// Wort „None": „Otto · None" ging so in Glocke UND Postfach. Eine Mail erreicht
// keinen Message-Katalog mehr — was dort fehlt, fällt erst dem Empfänger auf.
//
// Schritt 1 ist der Anfang der Kette: `availability_source` trug in der DB seit
// Migration 0119 den Wert 'ical' (iCal-Import), den das Pydantic-Enum nicht
// kannte — eine einzige iCal-Sperre hätte die Kalender-Antwort an der
// Validierung zerlegt.
//
// Gehört ins i18n-Qualitätsgate und in CI.
// Aufruf: node scripts/i18n/kanal-enums-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (...p) => readFileSync(join(wurzel, ...p), "utf8");

/** Werte eines Python-StrEnum („name = "wert"") aus der Klasse <name> lesen. */
function pythonEnum(datei, klasse) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(`class ${klasse}(StrEnum):`)[1]?.split("\n\n")[0];
  if (!block) throw new Error(`${klasse} in ${datei} nicht gefunden`);
  return [...block.matchAll(/^\s+\w+ = "([\w]+)"$/gm)].map((m) => m[1]);
}

/** Werte einer TypeScript-String-Union `export type <name> = "a" | "b";`. */
function tsUnion(datei, name) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(`export type ${name} =`)[1]?.split(";")[0];
  if (!block) throw new Error(`${name} in ${datei} nicht gefunden`);
  return [...block.matchAll(/"([\w]+)"/g)].map((m) => m[1]);
}

/** Schlüssel eines Record-Literals `<name>... = { a: …, b: … }`. */
function recordKeys(datei, name) {
  const quelle = lies(...datei.split("/"));
  const block = quelle.split(name)[1]?.split("\n};")[0];
  if (!block) throw new Error(`${name} in ${datei} nicht gefunden`);
  return [...block.matchAll(/^ {2}(\w+): [{[]/gm)].map((m) => m[1]);
}

/**
 * Werte eines Postgres-Enums aus ALLEN Migrationen sammeln: `create type … as
 * enum (…)` plus jedes spätere `alter type … add value`. Bewusst gegen die
 * versionierten Dateien und nicht gegen die Live-DB — die Prüfung muss ohne
 * Netz in CI laufen und gilt für den Stand, der ausgeliefert wird.
 */
function sqlEnum(typ) {
  const ordner = join(wurzel, "supabase", "migrations");
  const werte = [];
  for (const datei of readdirSync(ordner).filter((n) => n.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(ordner, datei), "utf8");
    const erzeugt = new RegExp(
      `create type public\\.${typ} as enum\\s*\\(([^)]*)\\)`,
      "i",
    ).exec(sql);
    if (erzeugt) werte.push(...[...erzeugt[1].matchAll(/'([\w]+)'/g)].map((m) => m[1]));
    const ergaenzt = new RegExp(
      `alter type public\\.${typ} add value(?: if not exists)? '([\\w]+)'`,
      "gi",
    );
    werte.push(...[...sql.matchAll(ergaenzt)].map((m) => m[1]));
  }
  if (!werte.length) throw new Error(`Enum ${typ} in den Migrationen nicht gefunden`);
  return [...new Set(werte)];
}

const kanaele = pythonEnum(
  "apps/api/src/features/reservations/schemas.py",
  "ReservationChannel",
);
const quellen = pythonEnum(
  "apps/api/src/features/calendar/schemas.py",
  "AvailabilitySource",
);

const fehler = [];
const pruefe = (was, soll, ist) => {
  const fehlt = soll.filter((v) => !ist.includes(v));
  if (fehlt.length) fehler.push(`✗ ${was}: fehlt ${fehlt.join(", ")}`);
};

// 1 — DB-Enum (Migrationen) ↔ Pydantic. Umgekehrt wird NICHT geprüft: ein
// Pydantic-Wert ohne DB-Pendant fällt beim ersten Schreiben sofort auf
// (22P02), ein DB-Wert ohne Pydantic-Pendant erst beim Lesen — irgendwann.
pruefe("apps/api reservations ReservationChannel", sqlEnum("reservation_channel"), kanaele);
pruefe("apps/api calendar AvailabilitySource", sqlEnum("availability_source"), quellen);

// 2 + 3 — Unions und Kanal-Metas der Frontends.
pruefe("web/lib/reservations.ts ReservationChannel", kanaele,
  tsUnion("web/lib/reservations.ts", "ReservationChannel"));
pruefe("web/lib/calendar.ts AvailabilitySource", quellen,
  tsUnion("web/lib/calendar.ts", "AvailabilitySource"));
pruefe("web/lib/calendar-channels.ts CHANNEL_META", quellen,
  recordKeys("web/lib/calendar-channels.ts", "CHANNEL_META"));
pruefe("mobile-nextdays/lib/reservations.ts ReservationChannel", kanaele,
  tsUnion("mobile-nextdays/lib/reservations.ts", "ReservationChannel"));
pruefe("mobile-nextdays/lib/dashboard.ts ReservationChannel", kanaele,
  tsUnion("mobile-nextdays/lib/dashboard.ts", "ReservationChannel"));
pruefe("mobile-nextdays/lib/calendar.ts AvailabilitySource", quellen,
  tsUnion("mobile-nextdays/lib/calendar.ts", "AvailabilitySource"));

// 4 — Übersetzung je Sprache. Ein fehlender Key wirft in next-intl zur
// Laufzeit (MISSING_MESSAGE), also muss er in ALLEN Dateien stehen.
const nachrichten = join(wurzel, "web", "messages");
for (const datei of readdirSync(nachrichten).filter((n) => n.endsWith(".json"))) {
  const kanal = JSON.parse(readFileSync(join(nachrichten, datei), "utf8"))
    .calendar?.channel ?? {};
  pruefe(`web/messages/${datei} calendar.channel`, quellen, Object.keys(kanal));
}

// 5 — Der serverseitige Mail-Katalog. Er ist die einzige Stelle der Kette, die
// das Haus verlässt: fehlt ein Kanal hier, steht der Mangel im Postfach eines
// Kunden, nicht in einer Konsole. Geprüft wird jeder Kanal in JEDER Sprache.
const mailTexte = lies("apps", "api", "src", "core", "mail_texte.py");
const mailSprachen = [
  ...new Set(
    [...mailTexte.matchAll(/^\s*"([a-z]{2})": "/gm)].map((m) => m[1]),
  ),
].sort();
for (const kanal of kanaele) {
  const block = mailTexte.split(`"kanal.${kanal}": {`)[1]?.split("\n    },")[0];
  if (block === undefined) {
    fehler.push(`✗ apps/api core/mail_texte.py: fehlt kanal.${kanal}`);
    continue;
  }
  const drin = [...block.matchAll(/"([a-z]{2})":/g)].map((m) => m[1]);
  pruefe(`apps/api core/mail_texte.py kanal.${kanal}`, mailSprachen, drin);
}

for (const z of fehler) console.error(z);
if (fehler.length) {
  console.error(
    `\n${fehler.length} Abweichung(en). Backend-Kanäle: ${kanaele.join(", ")}` +
      ` · Kalender-Quellen: ${quellen.join(", ")}`,
  );
  process.exit(1);
}
console.log(
  `✓ Kanal-Enums deckungsgleich (${quellen.length} Quellen, ${kanaele.length}` +
    " Kanäle) in web, mobile-nextdays, allen Sprachdateien und dem" +
    ` Mail-Katalog (${mailSprachen.length} Sprachen).`,
);
