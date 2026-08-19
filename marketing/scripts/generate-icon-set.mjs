// Erzeugt components/ui/icon-set.ts aus @iconify-json/ph.
//
// Warum: @iconify/react holt Icon-Daten zur LAUFZEIT von api.iconify.design —
// das ist ein Drittanbieter-Request (wie der Google-Fonts-Download, den diese
// App bewusst vermeidet) und die Icons erscheinen erst nach der Hydration.
// Stattdessen werden nur die tatsächlich verwendeten Pfade zur Bauzeit ins
// Repo generiert und serverseitig gerendert.
//
// Aufruf: node scripts/generate-icon-set.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// `content` gehört dazu, seit das Hilfe-Center hier liegt: seine Kategorie-Icons
// stehen als `icon: "ph:…"` in den Inhaltsdateien (content/help/<locale>/…), nicht
// im Komponenten-Code. Ohne diesen Pfad fehlten sie im Satz und jede
// Kategorie-Kachel hätte ein leeres SVG gerendert — sichtbar erst im Browser,
// weil ein fehlender Schlüssel nur `undefined` liefert und nicht wirft.
const ROOTS = ["components", "app", "content"];
const OUT = "components/ui/icon-set.ts";

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Die Zieldatei selbst NICHT mitlesen: sie enthält jeden Icon-Namen als
// Schlüssel und würde sich sonst selbst am Leben halten — ein einmal
// aufgenommenes Icon ließe sich nie wieder entfernen, auch wenn es keine
// Komponente mehr verwendet.
const sources = ROOTS.flatMap(walk).filter(
  (p) => /\.tsx?$/.test(p) && p !== OUT,
);
const used = new Set();
for (const file of sources) {
  for (const match of readFileSync(file, "utf8").matchAll(/"ph:([a-z0-9-]+)"/g)) {
    used.add(match[1]);
  }
}

const collection = JSON.parse(
  readFileSync("node_modules/@iconify-json/ph/icons.json", "utf8"),
);

const missing = [];
const entries = [...used].sort().map((name) => {
  const icon = collection.icons[name];
  if (!icon) {
    missing.push(name);
    return "";
  }
  return `  "ph:${name}": ${JSON.stringify(icon.body)},`;
});

if (missing.length) {
  console.error("Nicht in @iconify-json/ph gefunden:", missing.join(", "));
  process.exit(1);
}

writeFileSync(
  OUT,
  `// GENERIERT von scripts/generate-icon-set.mjs — nicht von Hand bearbeiten.
// Quelle: @iconify-json/ph ${collection.info?.version ?? ""} (Phosphor, MIT).
// Enthält nur die in components/, app/ und content/ verwendeten Icons.
export const ICON_VIEWBOX = "0 0 ${collection.width ?? 256} ${collection.height ?? 256}";

export const ICON_SET = {
${entries.join("\n")}
} as const;

export type IconName = keyof typeof ICON_SET;
`,
);

console.log(`${used.size} Icons → ${OUT}`);
