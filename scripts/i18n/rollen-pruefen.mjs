#!/usr/bin/env node
// Hält die Nutzerrollen an allen Stellen der Kette deckungsgleich.
//
// Anlass: `shift_lead` (Migration 0540) kam als sechste Rolle dazu. Eine Rolle
// steht an SIEBEN Stellen — DB-Enum, Pydantic `UserRole`, Capability-Matrix,
// Frontend-Unions (web, mobile-nextdays, mobile-owner), Rollen-Labels in allen
// Sprachdateien. Fehlt sie an einer, ist der Fehler stumm: das Backend liefert
// die Rolle, `tsc` prüft nur gegen die Kopie, und die Oberfläche zeigt
// MISSING_MESSAGE oder — schlimmer — fail-closed einen Logout (Mobile-Router).
//
// Geprüft wird:
//   1. jeder Wert des DB-Enums (alle `add value` + `create type`) ist im
//      Pydantic-Enum UserRole,
//   2. jede Rolle hat einen Eintrag in ROLE_CAPABILITIES (permissions.py) und
//      ROLE_DEFAULT_PERMISSIONS (granular_permissions.py),
//   3. die Unions in web/lib/account.ts, web/lib/api.ts und den Mobile-
//      AuthContexts decken alle Rollen ab,
//   4. jede web-Sprachdatei hat account.roles.<rolle> und nav.roles.<camel>.
//
// Aufruf: node scripts/i18n/rollen-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (...p) => readFileSync(join(wurzel, ...p), "utf8");

// 1) DB-Enum
const dbRollen = new Set();
for (const datei of readdirSync(join(wurzel, "supabase", "migrations"))) {
  if (!datei.endsWith(".sql")) continue;
  const sql = lies("supabase", "migrations", datei);
  const typ = /create type public\.user_role as enum \(([^)]*)\)/i.exec(sql);
  if (typ) for (const m of typ[1].matchAll(/'(\w+)'/g)) dbRollen.add(m[1]);
  for (const m of sql.matchAll(/alter type public\.user_role add value(?: if not exists)? '(\w+)'/gi)) {
    dbRollen.add(m[1]);
  }
}

// 2) Pydantic + Matrizen
const schemas = lies("apps", "api", "src", "features", "auth", "schemas.py");
const block = schemas.split("class UserRole(StrEnum):")[1]?.split("\n\n\n")[0] ?? "";
const pyRollen = new Set([...block.matchAll(/^\s+\w+ = "(\w+)"/gm)].map((m) => m[1]));
const perms = lies("apps", "api", "src", "features", "auth", "permissions.py");
const capBlock = perms.split("ROLE_CAPABILITIES: dict[UserRole, frozenset[Capability]] = {")[1]?.split("}")[0] ?? "";
const capRollen = new Set([...capBlock.matchAll(/UserRole\.(\w+):/g)].map((m) => m[1]));
const gran = lies("apps", "api", "src", "features", "auth", "granular_permissions.py");
const granBlock = gran.split("ROLE_DEFAULT_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {")[1]?.split("}")[0] ?? "";
const granRollen = new Set([...granBlock.matchAll(/UserRole\.(\w+):/g)].map((m) => m[1]));

// 3) Unions
function union(datei, marker) {
  const quelle = lies(...datei.split("/"));
  const zeile = quelle.split(marker)[1]?.split(";")[0] ?? "";
  return new Set([...zeile.matchAll(/"(\w+)"/g)].map((m) => m[1]).filter((w) => w !== "null"));
}
const unions = {
  "web/lib/account.ts": union("web/lib/account.ts", "export type UserRole ="),
  "web/lib/api.ts": union("web/lib/api.ts", "  role:"),
  "mobile-nextdays/contexts/AuthContext.tsx": union("mobile-nextdays/contexts/AuthContext.tsx", "export type Role ="),
  "mobile-owner/contexts/AuthContext.tsx": union("mobile-owner/contexts/AuthContext.tsx", "export type Role ="),
};

// 4) Labels
const camel = (s) => s.replace(/_(\w)/g, (_, c) => c.toUpperCase());
const sprachen = readdirSync(join(wurzel, "web", "messages")).filter((f) => f.endsWith(".json"));

let fehler = 0;
const melde = (text) => {
  fehler += 1;
  console.error(`✗ ${text}`);
};

for (const r of dbRollen) {
  if (!pyRollen.has(r)) melde(`UserRole (schemas.py) kennt '${r}' nicht`);
  if (!capRollen.has(r)) melde(`ROLE_CAPABILITIES kennt '${r}' nicht`);
  if (!granRollen.has(r)) melde(`ROLE_DEFAULT_PERMISSIONS kennt '${r}' nicht`);
  for (const [datei, werte] of Object.entries(unions)) {
    if (!werte.has(r)) melde(`${datei}: Union ohne '${r}'`);
  }
  for (const sp of sprachen) {
    const json = JSON.parse(lies("web", "messages", sp));
    if (!json.account?.roles?.[r]) melde(`web/messages/${sp}: account.roles.${r} fehlt`);
    if (!json.nav?.roles?.[camel(r)]) melde(`web/messages/${sp}: nav.roles.${camel(r)} fehlt`);
  }
}
for (const r of pyRollen) if (!dbRollen.has(r)) melde(`Pydantic-Rolle '${r}' fehlt im DB-Enum`);

if (fehler) {
  console.error(`\n${fehler} Abweichung(en) in der Rollen-Kette (DB: ${[...dbRollen].join(", ")}).`);
  process.exit(1);
}
console.log(`✓ Rollen-Kette deckungsgleich: ${[...dbRollen].join(", ")} (${sprachen.length} Sprachen).`);
