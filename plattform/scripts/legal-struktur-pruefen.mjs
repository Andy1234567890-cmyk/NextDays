// Prueft, dass jede Sprachfassung eines Rechtsdokuments dieselbe Struktur hat
// wie die deutsche Quellfassung: gleiche Abschnitts-IDs (sonst brechen die
// Deep-Links quer ueber die Sprachen), gleiche Anzahl Absaetze, Listenpunkte,
// Unterabschnitte und Definitionen (sonst fehlt in einer Sprache stillschweigend
// Inhalt). Exit 1 bei Abweichung.
//   bun scripts/legal-struktur-pruefen.mjs
import { readdirSync } from "node:fs";
const base = "content/legal";
const docs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
let fehler = 0;
for (const d of docs) {
  const locs = readdirSync(`${base}/${d}`).filter(f => f.endsWith(".ts")).map(f => f.slice(0, -3));
  const sig = (o) => ({
    intro: o.intro?.length ?? 0,
    sections: o.sections.map(s => ({
      id: s.id,
      p: s.paragraphs?.length ?? 0,
      l: s.list?.length ?? 0,
      sub: s.subsections?.map(x => x.id).join(",") ?? "",
      def: s.definitions?.length ?? 0,
    })),
  });
  const ref = sig((await import(`../${base}/${d}/de.ts`)).doc);
  for (const l of locs) {
    if (l === "de") continue;
    const cur = sig((await import(`../${base}/${d}/${l}.ts`)).doc);
    const a = JSON.stringify(ref), b = JSON.stringify(cur);
    if (a !== b) { fehler++; console.log(`ABWEICHUNG ${d}/${l}`); }
  }
}
console.log(fehler === 0 ? "ALLE STRUKTURGLEICH" : `${fehler} Abweichungen`);
if (fehler > 0) process.exit(1);
