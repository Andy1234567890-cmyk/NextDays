// Sammelt alle im Monorepo benutzten Iconify-Icons in ein lokales Bündel.
//
// WARUM ES DAS BRAUCHT:
// `@iconify/react` lädt jedes Icon zur Laufzeit von `api.iconify.design`. Das
// ist eine Abhängigkeit von einem fremden Dienst für 1.900 Icon-Verwendungen in
// sieben Anwendungen. Live gesehen (18.08.2026): ein Browser-Plugin blockierte
// die Domain, und nach einem Sprachwechsel — `router.refresh()` montiert alle
// Icons neu und sie fordern ihre Daten erneut an — war die Oberfläche komplett
// icon-los. Nur leere Kreise, kein Fehler, keine Meldung.
//
// WARUM NICHT DIE GANZEN SAMMLUNGEN EINBINDEN:
// `@iconify-json/fluent-emoji` allein ist 99 MB, `solar` 9,9 MB, `logos` 7,1 MB
// — zusammen über 125 MB für 792 tatsächlich benutzte Icons. Dieses Skript
// nimmt genau die benutzten und schreibt sie in eine TypeScript-Datei.
//
// WARUM EIN GENERAT UND KEIN LAUFZEIT-LADER:
// Ein Lader müsste die Icons kennen, bevor die erste Komponente rendert. Ein
// eingecheckter Datensatz ist beim ersten Rendern da, kostet keine Anfrage und
// ist im Build reproduzierbar.
//
// Aufruf:  bun run --cwd packages/icons sammeln
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, "../../..");

// Die Anwendungen, die das Buendel NUTZEN. `mobile-*` fehlen bewusst: React
// Native nutzt kein Iconify.
//
// NICHT dabei: marketing, builder, storybook. Sie bauen mit isoliertem
// Docker-Kontext (Coolify `base_directory` = die App selbst) und koennen ein
// Workspace-Paket nicht aufloesen — `bun install --frozen-lockfile` bricht ab
// (live erlebt, 18.08.2026). Sie holen ihre Icons weiter vom Dienst; zusammen
// sind es 187 Verwendungen, und keine in einer Ansicht mit Sprachwechsel.
// Ihr Build-Modell dafuer umzustellen waere eine groessere Aenderung als der
// Nutzen.
const APPS = [
  "web",
  "plattform",
  "admin",
  "gastgeber",
  "packages/ui",
];

/** Alle Icon-Namen aus dem Quellcode lesen.
 *
 * Zwei Muster, weil Icons auf zwei Wegen entstehen: als Literal im JSX
 * (`icon="ph:bell"`) und als Wert in einer Konstante oder Zuordnungstabelle
 * (`{ status: "ph:check" }`). Nur das erste Muster zu lesen liesse die
 * dynamisch gesetzten Icons fehlen — und genau die fallen erst im Betrieb auf.
 */
function namenSammeln() {
  const treffer = new Set();
  const muster =
    /"(ph|lucide|solar|svg-spinners|logos|fluent-emoji|simple-icons|mdi|tabler|carbon):([a-z0-9-]+)"/g;
  for (const app of APPS) {
    const pfad = join(WURZEL, app);
    if (!existsSync(pfad)) continue;
    const dateien = execFileSync(
      "find",
      [
        pfad,
        "-type", "f",
        "(", "-name", "*.tsx", "-o", "-name", "*.ts", ")",
        "-not", "-path", "*/node_modules/*",
        "-not", "-path", "*/.next/*",
        "-not", "-path", "*/dist/*",
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    )
      .split("\n")
      .filter(Boolean);
    for (const datei of dateien) {
      const inhalt = readFileSync(datei, "utf8");
      for (const m of inhalt.matchAll(muster)) treffer.add(`${m[1]}:${m[2]}`);
    }
  }
  return [...treffer].sort();
}

const namen = namenSammeln();
console.log(`${namen.length} Icons im Quellcode gefunden`);

// Nach Sammlung gruppieren — jede Sammlung liegt als eigene JSON-Datei.
const nachPraefix = new Map();
for (const name of namen) {
  const [praefix, icon] = name.split(":");
  if (!nachPraefix.has(praefix)) nachPraefix.set(praefix, []);
  nachPraefix.get(praefix).push(icon);
}

const gebuendelt = {};
const fehlend = [];

for (const [praefix, icons] of [...nachPraefix].sort()) {
  const quelle = join(
    WURZEL,
    "node_modules/@iconify/json/json",
    `${praefix}.json`,
  );
  if (!existsSync(quelle)) {
    fehlend.push(`${praefix}: Sammlung nicht installiert (${quelle})`);
    continue;
  }
  const daten = JSON.parse(readFileSync(quelle, "utf8"));
  const teil = {
    prefix: daten.prefix,
    width: daten.width,
    height: daten.height,
    icons: {},
  };
  for (const icon of icons) {
    // Aliase auflösen: manche Namen zeigen auf ein anderes Icon derselben
    // Sammlung. Ohne diesen Schritt fehlte das Icon still.
    const alias = daten.aliases?.[icon];
    const schluessel = alias?.parent ?? icon;
    const eintrag = daten.icons[schluessel];
    if (!eintrag) {
      fehlend.push(`${praefix}:${icon}`);
      continue;
    }
    teil.icons[icon] = alias
      ? { ...eintrag, ...alias, parent: undefined }
      : eintrag;
  }
  gebuendelt[praefix] = teil;
  console.log(`  ${praefix}: ${Object.keys(teil.icons).length}/${icons.length}`);
}

// Fail-closed (Wurzel 4/5): ein fehlendes Icon wird NICHT stillschweigend
// übergangen. Sonst wäre der Fehler genau derselbe wie vorher — ein leerer
// Platzhalter, den niemand als Bug erkennt.
if (fehlend.length) {
  console.error(`\n${fehlend.length} Icons NICHT gefunden:`);
  for (const f of fehlend) console.error(`  ${f}`);
  process.exit(1);
}

const kopf = `// ERZEUGT von scripts/sammeln.mjs — NICHT von Hand bearbeiten.
//
// Alle im Monorepo benutzten Iconify-Icons als lokaler Datensatz. Wird von
// \`icons-registrieren()\` in @iconify/react geladen, damit zur Laufzeit KEINE
// Anfrage an api.iconify.design geht.
//
// Neues Icon im Code verwendet? \`bun run --cwd packages/icons sammeln\` und die
// erzeugte Datei mit committen. Das Skript bricht ab, wenn ein Name in keiner
// Sammlung existiert — ein Tippfehler wird damit im Build sichtbar und nicht
// erst als leerer Platz in der Oberfläche.
`;

const ziel = join(HIER, "../src/gebuendelt.ts");
writeFileSync(
  ziel,
  `${kopf}\nexport const SAMMLUNGEN = ${JSON.stringify(gebuendelt, null, 0)} as const;\n`,
  "utf8",
);

const groesse = (readFileSync(ziel, "utf8").length / 1024).toFixed(0);
console.log(`\ngeschrieben: src/gebuendelt.ts (${groesse} KB)`);

// Gegenprobe: ist das Erzeugnis vollständig und nicht bloss geschrieben?
// Ohne sie waere ein leeres Buendel ein stiller Erfolg — und die Oberflaeche
// haette wieder keine Icons, diesmal ohne fremden Dienst als Ausrede.
const kontrolle = readFileSync(ziel, "utf8");
const gezaehlt = Object.values(gebuendelt).reduce(
  (s, x) => s + Object.keys(x.icons).length,
  0,
);
if (gezaehlt !== namen.length) {
  console.error(
    `\nUNVOLLSTAENDIG: ${gezaehlt} gebuendelt, ${namen.length} erwartet`,
  );
  process.exit(1);
}
if (!kontrolle.includes('"body"')) {
  console.error("\nUNBRAUCHBAR: kein einziger SVG-Koerper im Erzeugnis");
  process.exit(1);
}
console.log(`geprueft: ${gezaehlt} Icons, alle mit Koerper`);
