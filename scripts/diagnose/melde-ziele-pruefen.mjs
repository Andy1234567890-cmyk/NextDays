#!/usr/bin/env node
// Prueft, dass jedes Sprungziel einer Benachrichtigung im Dashboard eine Route hat.
//
// WARUM ES DIESES SKRIPT GIBT
// ---------------------------
// Der Benachrichtigungs-Dispatcher schreibt einen Pfad in `ziel_pfad`; daraus
// wird der Knopf „In myNextDays ansehen" in der Mail und das Ziel der Glocke.
// Ob es diesen Pfad im Dashboard wirklich gibt, prueft nichts — und zweimal gab
// es ihn nicht:
//
//   * 11.08.2026 — `/aufgaben/<id>` fuehrte in ein 404.
//   * 24.08.2026 — `/posteingang/<thread>` fuehrte in ein 404. Gemeldet von
//     einem echten Gast-Thread (Andreas Knudsen, Booking.com).
//
// Beide Male war die Mail schon raus. Eine verschickte Mail ist unwiderruflich:
// die Adresse darin ist ein Versprechen, das nur die Route einloesen kann.
//
//   * 09.09.2026 — dieselbe Klasse, andere Oberflaeche: JEDES `/portal/*`-Ziel
//     kam in der Eigentuemer-App ins Leere. Ihre Sprungtabelle war aus der
//     PMS-App kopiert und trug deren URL-Schema (`mynextdays://`) samt Routen,
//     die es dort nicht gibt. Das Skript blieb gruen, weil es NUR `web/app`
//     ansah — und der Schaden lag in der App.
//
// WAS GEPRUEFT WIRD
// -----------------
// Jeder String-Wert von `ziel_pfad=` in `apps/api/src` (ohne Tests) wird auf
// eine Route unter `web/app` abgebildet. Dynamische Teile (`{task_id}`) passen
// auf ein `[segment]`-Verzeichnis. Nicht geprueft werden `None` und die
// Durchreiche `ziel_pfad=ziel_pfad` — dort steht der Wert woanders.
//
// ZUSAETZLICH fuer `/portal/*`: Diese Ziele gehen an Eigentuemer, und die
// lesen sie in der Eigentuemer-APP. Geprueft wird deshalb die ganze Kette —
// Serverziel → `zielAlsDeepLink` (mobile-owner/lib/push.ts) → `linking.config`
// (mobile-owner/App.tsx). Faellt ein Glied aus, tut der Tap auf die Meldung
// nichts, und niemand sieht einen Fehler.
//
// Aufruf: node scripts/diagnose/melde-ziele-pruefen.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = join(wurzel, "web", "app");

/** Alle .py-Dateien unter apps/api/src, ohne Testverzeichnisse. */
function pythonDateien(verzeichnis) {
  const raus = [];
  for (const name of readdirSync(verzeichnis)) {
    if (name === "tests" || name === "__pycache__") continue;
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) raus.push(...pythonDateien(pfad));
    else if (name.endsWith(".py")) raus.push(pfad);
  }
  return raus;
}

/** Die Pfad-Literale hinter `ziel_pfad=`. */
function ziele() {
  const treffer = new Map(); // pfad -> Datei:Zeile
  for (const datei of pythonDateien(join(wurzel, "apps", "api", "src"))) {
    const zeilen = readFileSync(datei, "utf8").split("\n");
    zeilen.forEach((zeile, i) => {
      const m = /ziel_pfad\s*=\s*f?"([^"]+)"/.exec(zeile);
      if (!m) return;
      const rel = datei.slice(wurzel.length + 1);
      if (!treffer.has(m[1])) treffer.set(m[1], `${rel}:${i + 1}`);
    });
  }
  return treffer;
}

/** Gibt es unter `web/app` eine Route fuer diesen Pfad?
 *
 *  Route-Gruppen `(dashboard)` zaehlen nicht als Segment — sie stehen im
 *  Dateisystem, nicht in der Adresse. Ein `{platzhalter}` passt auf genau ein
 *  `[segment]`-Verzeichnis; `[...rest]` faengt den Rest.
 */
function routeVorhanden(pfad) {
  const teile = pfad.split("/").filter(Boolean);

  function suche(verzeichnis, index) {
    if (index === teile.length) {
      return readdirSync(verzeichnis).some(
        (n) => n === "page.tsx" || n === "page.jsx" || n === "route.ts",
      );
    }
    const teil = teile[index];
    const dynamisch = teil.startsWith("{");
    for (const name of readdirSync(verzeichnis)) {
      const kind = join(verzeichnis, name);
      if (!statSync(kind).isDirectory()) continue;
      // Route-Gruppe: ueberspringen, ohne einen Teil zu verbrauchen.
      if (name.startsWith("(") && name.endsWith(")")) {
        if (suche(kind, index)) return true;
        continue;
      }
      if (name.startsWith("[...")) return true;
      const passt = dynamisch
        ? name.startsWith("[") && name.endsWith("]")
        : name === teil || (name.startsWith("[") && name.endsWith("]"));
      if (passt && suche(kind, index + 1)) return true;
    }
    return false;
  }

  return suche(APP, 0);
}

/** Kennt die Eigentuemer-App dieses `/portal/*`-Ziel — und zwar ganz?
 *
 *  Zwei Glieder, beide noetig: `zielAlsDeepLink` muss einen Link bauen, und
 *  dessen Pfad muss in `linking.config` stehen. Beim Fehler vom 09.09.2026
 *  fehlte einmal das erste (`aufgaben` nicht abgebildet) und einmal das
 *  zweite (Screen `Aufgaben` ohne Linking-Pfad) — jedes fuer sich reicht,
 *  damit der Tap ins Leere laeuft.
 */
function appZielVorhanden(pfad) {
  const push = readFileSync(
    join(wurzel, "mobile-owner", "lib", "push.ts"),
    "utf8",
  );
  const appTsx = readFileSync(join(wurzel, "mobile-owner", "App.tsx"), "utf8");
  const bereich = pfad.split("/").filter(Boolean)[1] ?? "";

  // Glied 1: bildet `zielAlsDeepLink` diesen Bereich ab?
  const abgebildet = bereich
    ? new RegExp(`bereich === "${bereich}"`).test(push)
    : /if \(!bereich\)/.test(push);
  if (!abgebildet) return "kein Fall in zielAlsDeepLink";

  // Glied 2: steht das Sprungziel in linking.config?
  const ziele_ = [...push.matchAll(/mynextdaysowner:\/\/([a-z]+)/g)].map(
    (m) => m[1],
  );
  for (const z of new Set(ziele_)) {
    if (!new RegExp(`"${z}(/:|")`).test(appTsx)) {
      return `Linking-Pfad "${z}" fehlt in App.tsx`;
    }
  }
  return null;
}

/** Alle `/portal/...`-Literale im Backend — unabhaengig von der Zuweisung.
 *
 *  `ziele()` oben findet nur `ziel_pfad="..."`. `/portal/aufgaben` steht aber
 *  als Ternaer (`ziel = "/portal/aufgaben" if rolle == "owner" else ...`,
 *  ereignisse.py:185) und wurde deshalb NICHT geprueft — die erste Fassung
 *  dieser Pruefung blieb gruen, obwohl genau dieses Ziel in der App ins Leere
 *  lief. Ein Pruefskript, das den gesuchten Fehler nicht sieht, ist eine
 *  Attrappe (nachgemessen 09.09.2026, Gegenprobe mit entferntem Fall).
 */
function portalZiele() {
  const treffer = new Map();
  for (const datei of pythonDateien(join(wurzel, "apps", "api", "src"))) {
    const zeilen = readFileSync(datei, "utf8").split("\n");
    zeilen.forEach((zeile, i) => {
      for (const m of zeile.matchAll(/"(\/portal(?:\/[a-z_]+)*)"/g)) {
        const rel = datei.slice(wurzel.length + 1);
        if (!treffer.has(m[1])) treffer.set(m[1], `${rel}:${i + 1}`);
      }
    });
  }
  return treffer;
}

const gefunden = ziele();
const fehlend = [];
const appFehlend = [];
for (const [pfad, quelle] of portalZiele()) {
  const mangel = appZielVorhanden(pfad);
  if (mangel) appFehlend.push(`${pfad}   (${quelle}) — ${mangel}`);
}
for (const [pfad, quelle] of gefunden) {
  if (!routeVorhanden(pfad)) fehlend.push(`${pfad}   (${quelle})`);
}

for (const z of appFehlend) console.error("  OHNE APP-ZIEL " + z);
if (appFehlend.length) {
  console.error(
    `\n${appFehlend.length} Eigentuemer-Ziel(e) erreichen die App nicht.` +
      " Der Tap auf die Meldung tut nichts, ohne dass ein Fehler sichtbar wird.",
  );
  process.exit(1);
}

for (const z of fehlend) console.error("  OHNE ROUTE " + z);
if (fehlend.length) {
  console.error(
    `\n${fehlend.length} Sprungziel(e) ohne Seite im Dashboard. Jede davon ist` +
      " ein 404 in einer bereits verschickten Mail.",
  );
  process.exit(1);
}
console.log(
  `✓ Alle ${gefunden.size} Sprungziele der Benachrichtigungen haben eine Route.`,
);
