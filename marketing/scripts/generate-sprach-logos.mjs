// Erzeugt components/entwickler/sprach-logos.ts aus @iconify-json/logos.
//
// Warum eine EIGENE Datei und nicht der Phosphor-Satz: Phosphor hat keine
// Marken-Logos, und die Logos haben je eigene viewBox und eigene Farben —
// `components/ui/icon.tsx` rendert dagegen einen gemeinsamen viewBox mit
// `currentColor`. Zwei Sätze mit zwei Regeln, deshalb zwei Dateien.
//
// Die Logos bleiben MEHRFARBIG. Ein eingefärbtes Node-Logo ist nicht mehr das
// Node-Logo; für Marken gilt dasselbe wie für die Portal-Logos im PMS: echt
// oder gar nicht.
//
// Aufruf: node scripts/generate-sprach-logos.mjs
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "components/entwickler/sprach-logos.ts";

// Sprach-Id (siehe lib/api-codebeispiele.ts) → Icon-Name im Logos-Satz.
// `bash-icon` statt `bash`: die Variante ohne Wortmarke, wie sie ReadMe neben
// „Shell" setzt.
const ZUORDNUNG = {
  shell: "bash-icon",
  node: "nodejs-icon",
  python: "python",
  php: "php",
  ruby: "ruby",
};

const satz = JSON.parse(
  readFileSync("node_modules/@iconify-json/logos/icons.json", "utf8"),
);

const eintraege = Object.entries(ZUORDNUNG).map(([id, name]) => {
  const icon = satz.icons[name];
  if (!icon) {
    console.error(`Nicht in @iconify-json/logos gefunden: ${name}`);
    process.exit(1);
  }
  // Iconify liefert Breite/Höhe je Icon; fehlt sie, gilt die des Satzes.
  const w = icon.width ?? satz.width ?? 24;
  const h = icon.height ?? satz.height ?? 24;
  return `  ${id}: {\n    viewBox: "0 0 ${w} ${h}",\n    body: ${JSON.stringify(icon.body)},\n  },`;
});

writeFileSync(
  OUT,
  `// GENERIERT von scripts/generate-sprach-logos.mjs — nicht von Hand bearbeiten.
// Quelle: @iconify-json/logos ${satz.info?.version ?? ""} (Marken-Logos der
// jeweiligen Projekte, unverändert und mehrfarbig).
export type SprachLogo = { viewBox: string; body: string };

export const SPRACH_LOGOS: Record<string, SprachLogo> = {
${eintraege.join("\n")}
};
`,
);

console.log(`${eintraege.length} Logos → ${OUT}`);
