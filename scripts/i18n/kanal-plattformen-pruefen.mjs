#!/usr/bin/env node
// Hält die Plattformliste der Partner-Kanäle an drei Stellen deckungsgleich:
//   apps/api/src/features/affiliates/kanaele.py  (Plattform-Literal)
//   partner/lib/kanaele.ts                       (PLATTFORMEN)
//   admin/lib/kanaele.ts                         (Schwesterdatei, byte-identisch)
//   marketing/lib/kanaele.ts                     (Schwesterdatei, Bewerbung auf der Marketing-Seite)
// Ein Wert, der nur im Backend steht, ist im Dashboard ein Kanal ohne Logo.
import { readFileSync } from "node:fs";

const lies = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const py = lies("apps/api/src/features/affiliates/kanaele.py");
const pyBlock = py.match(/Plattform = Literal\[([\s\S]*?)\]/)?.[1] ?? "";
const pyListe = [...pyBlock.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

const tsPartner = lies("partner/lib/kanaele.ts");
const tsAdmin = lies("admin/lib/kanaele.ts");
const tsMarketing = lies("marketing/lib/kanaele.ts");
const tsBlock = tsPartner.match(/export const PLATTFORMEN = \[([\s\S]*?)\] as const/)?.[1] ?? "";
const tsListe = [...tsBlock.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
const metaKeys = [...tsPartner.matchAll(/^\s{2}([a-z]+): \{ label:/gm)].map((m) => m[1]);

let fehler = 0;
const melde = (t) => { console.error(`✗ ${t}`); fehler += 1; };

if (pyListe.length === 0) melde("Python-Liste nicht gefunden");
if (tsListe.length === 0) melde("TS-Liste nicht gefunden");
if (JSON.stringify(pyListe) !== JSON.stringify(tsListe))
  melde(`Python ≠ TS: ${JSON.stringify(pyListe)} vs ${JSON.stringify(tsListe)}`);
if (JSON.stringify([...tsListe].sort()) !== JSON.stringify([...metaKeys].sort()))
  melde(`PLATTFORM_META deckt nicht alle Plattformen: ${JSON.stringify(metaKeys)}`);
if (tsPartner !== tsAdmin) melde("partner/lib/kanaele.ts ≠ admin/lib/kanaele.ts (Schwesterdatei)");
if (tsPartner !== tsMarketing) melde("partner/lib/kanaele.ts ≠ marketing/lib/kanaele.ts (Schwesterdatei)");

if (fehler) process.exit(1);
console.log(`✓ ${pyListe.length} Plattformen an drei Stellen deckungsgleich`);
