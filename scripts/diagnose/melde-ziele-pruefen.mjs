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
// WAS GEPRUEFT WIRD
// -----------------
// Jeder String-Wert von `ziel_pfad=` in `apps/api/src` (ohne Tests) wird auf
// eine Route unter `web/app` abgebildet. Dynamische Teile (`{task_id}`) passen
// auf ein `[segment]`-Verzeichnis. Nicht geprueft werden `None` und die
// Durchreiche `ziel_pfad=ziel_pfad` — dort steht der Wert woanders.
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

const gefunden = ziele();
const fehlend = [];
for (const [pfad, quelle] of gefunden) {
  if (!routeVorhanden(pfad)) fehlend.push(`${pfad}   (${quelle})`);
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
