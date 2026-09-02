#!/usr/bin/env node
// Hält die Provisionsarten (earn/reversal/adjustment/override/bonus/lifetime/booking_share) an allen Stellen
// deckungsgleich: DB-CHECK (letzte Migration, die ihn setzt), Pydantic-Literal,
// Frontend-Unions (partner/admin), Übersetzungen `provisionen.art.*` in allen
// Partner-Sprachdateien, Gutschrift-Bezeichnungen. Muster: kanal-enums-pruefen.mjs.
import { readFileSync, readdirSync } from "node:fs";

const lies = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const liste = (s) => [...s.matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
const gleich = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
let fehler = 0;
const melde = (t) => { console.error(`✗ ${t}`); fehler += 1; };

// DB: letzte Migration mit dem kind-CHECK gewinnt.
const migDir = new URL("../../supabase/migrations/", import.meta.url);
const migs = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
let db = [];
for (const f of migs) {
  const m = readFileSync(new URL(f, migDir), "utf8").match(/kind\s+(?:text not null )?check \(kind in \(([^)]*)\)\)|affiliate_commissions_kind_check\s+check \(kind in \(([^)]*)\)\)/);
  if (m) db = liste(m[1] ?? m[2]);
}
const py = liste(lies("apps/api/src/features/affiliates/schemas.py").match(/ProvisionsArt = Literal\[([^\]]*)\]/)[1]);
const pyTuple = liste(lies("apps/api/src/features/affiliates/schemas.py").match(/PROVISIONSARTEN[^=]*= \(([^)]*)\)/)[1]);
const partnerTs = liste(lies("partner/lib/partner.ts").match(/export type ProvisionsArt =\s*([^;]*);/)[1]);
const adminTs = liste(lies("admin/lib/partner.ts").match(/kind: ((?:"[a-z_]+"(?: \| )?)+);/)[1]);
const gutschrift = Object.keys(JSON.parse(lies("apps/api/src/features/affiliates/auszahlung.py").match(/_ART = (\{[\s\S]*?\})/)[1].replace(/,\s*\}/, "}").replace(/'/g, '"')));

if (!db.length) melde("DB-CHECK nicht gefunden");
for (const [name, werte] of [["Pydantic Literal", py], ["PROVISIONSARTEN", pyTuple], ["partner/lib/partner.ts", partnerTs], ["admin/lib/partner.ts", adminTs], ["Gutschrift _ART", gutschrift]]) {
  if (!gleich(db, werte)) melde(`${name} ≠ DB: ${JSON.stringify(werte)} vs ${JSON.stringify(db)}`);
}
for (const f of readdirSync(new URL("../../partner/messages/", import.meta.url)).filter((f) => f.endsWith(".json"))) {
  const art = JSON.parse(lies(`partner/messages/${f}`)).provisionen?.art ?? {};
  if (!gleich(db, Object.keys(art))) melde(`partner/messages/${f}: provisionen.art hat ${JSON.stringify(Object.keys(art))}`);
}
const adminLabel = [...lies("admin/app/(backoffice)/partner/[id]/page.tsx").match(/const KIND_LABEL[^{]*\{([\s\S]*?)\};/)[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
if (!gleich(db, adminLabel)) melde(`admin KIND_LABEL ≠ DB: ${JSON.stringify(adminLabel)}`);

if (fehler) process.exit(1);
console.log(`✓ Provisionsarten ${JSON.stringify(db)} an DB, Pydantic, partner, admin, Gutschrift und ${readdirSync(new URL("../../partner/messages/", import.meta.url)).length} Sprachdateien deckungsgleich`);
