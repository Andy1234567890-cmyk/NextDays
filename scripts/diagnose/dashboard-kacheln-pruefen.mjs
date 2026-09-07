#!/usr/bin/env node
// Hält den Kachel-Katalog der Startseite über die ganze Kette gleich.
//
// Eine Kachel-ID steht an DREI Stellen, und keine davon prüft die anderen:
//   1. API — `KachelId` (Literal in dashboard_layout/schemas.py): was der
//      Server in einem Layout ANNIMMT. Fehlt hier eine ID, weist er jedes
//      Layout mit dieser Kachel per 422 ab — der Nutzer zieht eine Kachel und
//      „Speichern fehlgeschlagen" erscheint, ohne dass er etwas falsch machte.
//   2. web — `KACHEL_IDS` + `KATALOG` (lib/dashboard-katalog.ts): was das
//      Raster kennt. Eine ID nur hier ist ein Layout, das nie gespeichert wird.
//   3. web — das `switch` in components/dashboard/kachel-inhalt.tsx: was
//      wirklich gerendert wird. Eine ID ohne `case` wäre eine leere Fläche
//      (TypeScript fängt das über `never`, aber nur, wenn tsc läuft).
// Dazu je Sprachdatei der Titel-Schlüssel `reservations.<titelKey>`, den der
// Katalog für Griff, Ansagen und die Leiste der ausgeblendeten Kacheln nutzt.
//
// Aufruf: node scripts/diagnose/dashboard-kacheln-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (...p) => readFileSync(join(wurzel, ...p), "utf8");

const fehler = [];

/** Vergleicht zwei Wertlisten mengengleich und meldet beide Richtungen. */
function pruefe(was, soll, ist) {
  const fehlend = soll.filter((w) => !ist.includes(w));
  const zusatz = ist.filter((w) => !soll.includes(w));
  if (fehlend.length) fehler.push(`${was}: fehlt ${fehlend.join(", ")}`);
  if (zusatz.length) fehler.push(`${was}: unbekannt ${zusatz.join(", ")}`);
}

function dubletten(was, liste) {
  const doppelt = liste.filter((w, i) => liste.indexOf(w) !== i);
  if (doppelt.length) fehler.push(`${was}: doppelt ${[...new Set(doppelt)].join(", ")}`);
}

// --- 1) API: KachelId-Literal ------------------------------------------------
function backendIds() {
  const quelle = lies("apps", "api", "src", "features", "dashboard_layout", "schemas.py");
  const block = quelle.split("KachelId = Literal[")[1]?.split("]")[0];
  if (!block) throw new Error("KachelId-Literal in schemas.py nicht gefunden");
  // Kommentarzeilen ausblenden, damit ein `"kpi:…"` in einem Kommentar nicht
  // als ID zählt.
  const ohneKommentare = block
    .split("\n")
    .filter((z) => !z.trim().startsWith("#"))
    .join("\n");
  return [...ohneKommentare.matchAll(/"([a-z_]+:[a-z_:]+)"/g)].map((m) => m[1]);
}

// --- 2) web: KACHEL_IDS und KATALOG -----------------------------------------
function katalogIds() {
  const quelle = lies("web", "lib", "dashboard-katalog.ts");
  const idsBlock = quelle.split("export const KACHEL_IDS = [")[1]?.split("] as const;")[0];
  if (!idsBlock) throw new Error("KACHEL_IDS in dashboard-katalog.ts nicht gefunden");
  const ids = [...idsBlock.matchAll(/"([a-z_]+:[a-z_:]+)"/g)].map((m) => m[1]);

  const katalogBlock = quelle.split("export const KATALOG: readonly KachelDefinition[] = [")[1];
  if (!katalogBlock) throw new Error("KATALOG in dashboard-katalog.ts nicht gefunden");
  const eintraege = [
    ...katalogBlock.matchAll(/id:\s*"([a-z_]+:[a-z_:]+)",[\s\S]*?titelKey:\s*"([\w.]+)",/g),
  ].map((m) => ({ id: m[1], titelKey: m[2] }));
  return { ids, eintraege };
}

// --- 3) web: das switch, das wirklich rendert -------------------------------
function rendererIds() {
  const quelle = lies("web", "components", "dashboard", "kachel-inhalt.tsx");
  const block = quelle.split("export function KachelInhalt(")[1];
  if (!block) throw new Error("KachelInhalt in kachel-inhalt.tsx nicht gefunden");
  return [...new Set([...block.matchAll(/case "([a-z_]+:[a-z_:]+)":/g)].map((m) => m[1]))];
}

const backend = backendIds();
const { ids: katalog, eintraege } = katalogIds();
const renderer = rendererIds();

dubletten("Backend KachelId", backend);
dubletten("web KACHEL_IDS", katalog);
pruefe("web/lib/dashboard-katalog.ts KACHEL_IDS ↔ Backend KachelId", backend, katalog);
pruefe("web/lib/dashboard-katalog.ts KATALOG ↔ KACHEL_IDS", katalog, eintraege.map((e) => e.id));
pruefe("web/components/dashboard/kachel-inhalt.tsx switch", backend, renderer);

// Titel-Schlüssel je Sprache: ein fehlender Schlüssel wirft in next-intl zur
// Laufzeit (MISSING_MESSAGE) — der Anpassen-Modus wäre dann unbenutzbar.
const nachrichten = join(wurzel, "web", "messages");
for (const datei of readdirSync(nachrichten).filter((n) => n.endsWith(".json"))) {
  const res = JSON.parse(readFileSync(join(nachrichten, datei), "utf8")).reservations ?? {};
  const fehlend = [];
  for (const e of eintraege) {
    const wert = e.titelKey.split(".").reduce((o, k) => (o ? o[k] : undefined), res);
    if (typeof wert !== "string" || !wert) fehlend.push(e.titelKey);
  }
  if (fehlend.length) {
    fehler.push(`web/messages/${datei} reservations: fehlt ${fehlend.join(", ")}`);
  }
}

for (const z of fehler) console.error(z);
if (fehler.length) {
  console.error(`\n${fehler.length} Abweichung(en). Backend-IDs: ${backend.join(", ")}`);
  process.exit(1);
}
console.log(
  `✓ Kachel-Katalog deckungsgleich (${backend.length} Kacheln) über Backend-Literal,` +
    " web-Katalog, Renderer und alle Sprachdateien.",
);
