// Erzeugt content/legal/index.ts: die Loader-Map Dokument × Sprache.
// Von Hand wären das 27 × 24 = 648 Zeilen, die bei jedem neuen Rechtstext
// nachgepflegt werden müssten — genau die Stelle, an der man eine Sprache
// vergisst. Nach dem Anlegen eines neuen Slugs oder einer neuen Sprachfassung:
//   bun scripts/legal-loader-generieren.mjs
//
// Die Map enthält NUR Sprachfassungen, die wirklich als Datei existieren. Ein
// Rechtstext, den es (noch) nicht auf Lettisch gibt, wird auf Lettisch nicht
// angeboten — statt eine deutsche Fassung unter lettischer Überschrift zu
// zeigen (das wäre eine Falschaussage, Wurzel 4). Die Seiten lesen die
// vorhandenen Sprachen aus LEGAL_DOC_LOCALES.
//
// `--streng` bricht ab, wenn nicht jedes Dokument in allen 24 Amtssprachen
// vorliegt — das ist der Zustand, den das Qualitätsgate vor dem Deploy fordert.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const streng = process.argv.includes("--streng");

// Slugs und Locales werden aus den TS-Quellen gelesen, damit es genau EINE
// Wahrheit gibt (kein zweites Array hier im Generator).
function arrayLesen(datei, konstante) {
  const quelle = readFileSync(join(wurzel, datei), "utf8");
  const block = quelle.match(
    new RegExp(`export const ${konstante} = \\[([\\s\\S]*?)\\] as const;`),
  );
  if (!block) throw new Error(`${konstante} nicht in ${datei} gefunden`);
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const slugs = arrayLesen("content/legal/dokumente.ts", "LEGAL_DOCUMENT_SLUGS");
const locales = arrayLesen("content/legal/locales.ts", "LEGAL_LOCALES");

const vorhanden = new Map(
  slugs.map((slug) => [
    slug,
    locales.filter((locale) =>
      existsSync(join(wurzel, "content/legal", slug, `${locale}.ts`)),
    ),
  ]),
);

const fehlend = slugs.flatMap((slug) =>
  locales
    .filter((l) => !vorhanden.get(slug).includes(l))
    .map((l) => `${slug}/${l}.ts`),
);

const ohneDefault = slugs.filter((slug) => !vorhanden.get(slug).includes("de"));
if (ohneDefault.length > 0) {
  console.error(
    "Ohne deutsche Quellfassung (Pflicht):\n" + ohneDefault.join("\n"),
  );
  process.exit(1);
}

const eintraege = slugs
  .map((slug) => {
    const zeilen = vorhanden
      .get(slug)
      .map((locale) => `    ${locale}: () => import("./${slug}/${locale}"),`)
      .join("\n");
    return `  "${slug}": {\n${zeilen}\n  },`;
  })
  .join("\n");

const inhalt = `// ERZEUGT von scripts/legal-loader-generieren.mjs — nicht von Hand ändern.
// Loader-Map Dokument × Sprache, lazy, damit nur der angefragte Text geladen
// wird. Enthält ausschließlich Sprachfassungen, die als Datei existieren:
// LEGAL_DOC_LOCALES sagt je Dokument, welche das sind. Die Seiten bieten nur
// diese zur Auswahl an — eine fehlende Übersetzung wird NICHT still durch die
// deutsche Fassung ersetzt.
import type { LegalDocumentSlug } from "./dokumente";
import type { LegalLocale } from "./locales";
import type { LegalDoc } from "./types";

type Loader = () => Promise<{ doc: LegalDoc }>;

const LOADERS: Record<LegalDocumentSlug, Partial<Record<LegalLocale, Loader>>> = {
${eintraege}
};

// Je Dokument die Sprachen, in denen es vorliegt — in der Reihenfolge von
// LEGAL_LOCALES. Enthält immer mindestens "de" (der Generator erzwingt das).
export const LEGAL_DOC_LOCALES: Record<LegalDocumentSlug, LegalLocale[]> =
  Object.fromEntries(
    (Object.keys(LOADERS) as LegalDocumentSlug[]).map((slug) => [
      slug,
      Object.keys(LOADERS[slug]) as LegalLocale[],
    ]),
  ) as Record<LegalDocumentSlug, LegalLocale[]>;

export function hasLegalDoc(
  slug: LegalDocumentSlug,
  locale: LegalLocale,
): boolean {
  return LOADERS[slug][locale] !== undefined;
}

/** Lädt einen Rechtstext. Wirft, wenn es die Sprachfassung nicht gibt — die
 *  Aufrufer prüfen vorher mit hasLegalDoc und antworten sonst mit 404. */
export async function loadLegalDoc(
  slug: LegalDocumentSlug,
  locale: LegalLocale,
): Promise<LegalDoc> {
  const loader = LOADERS[slug][locale];
  if (!loader) {
    throw new Error(\`Rechtstext \${slug} liegt nicht auf \${locale} vor\`);
  }
  return (await loader()).doc;
}
`;

writeFileSync(join(wurzel, "content/legal/index.ts"), inhalt);

const gesamt = slugs.length * locales.length;
console.log(
  `content/legal/index.ts erzeugt: ${gesamt - fehlend.length}/${gesamt} Sprachfassungen ` +
    `(${slugs.length} Dokumente × ${locales.length} Sprachen)`,
);

if (fehlend.length > 0) {
  console.log(`Es fehlen ${fehlend.length} Fassungen.`);
  if (streng) {
    console.error(fehlend.join("\n"));
    process.exit(1);
  }
}
