#!/usr/bin/env node
// Welcher Betrieb steckt in einer Sitzung? — messen statt raten.
//
// ANLASS (29.08.2026): Im Onboarding eines frischen Betriebs erschienen die 18
// Objekte eines FREMDEN Betriebs. Vier Erklärungen wurden gebaut und wieder
// verworfen (Backend-Scope, Next-Cache, Modul-State, DB-Policy). Die Wahrheit
// war eine einzige Messung, die niemand gemacht hatte:
//
//     Token mit tenant_id = AirSmil  →  GET /properties  →  total = 18
//     Token mit tenant_id = UI-Test  →  GET /properties  →  total =  1
//
// Das Backend war korrekt. Der Browser schickte das Token eines anderen
// Betriebs. Dieses Skript macht genau diese Messung wiederholbar — damit die
// Frage „liegt es am Server oder an der Sitzung?" nie wieder geraten wird.
//
// NUTZUNG
//   node scripts/diagnose/sitzung-pruefen.mjs --token "<JWT>"
//       Zerlegt EIN Token und fragt damit das Backend. Der übliche Fall: den
//       Wert von `nd_access` aus DevTools → Application → Cookies kopieren.
//
//   node scripts/diagnose/sitzung-pruefen.mjs --tenant <uuid> [--tenant <uuid>]
//       Baut Testtokens aus `apps/api/.env` (SUPABASE_JWT_SECRET) und misst,
//       was das Backend je Betrieb ausliefert. Das ist der Gegentest, der
//       Server und Sitzung auseinanderhält.
//
//   node scripts/diagnose/sitzung-pruefen.mjs --alle
//       Alle Betriebe der Live-DB durchmessen (braucht SSH zum DB-Server).
//
// NUR LESEND. Es werden ausschließlich GET-Aufrufe gemacht; nichts wird
// geschrieben, nichts angelegt, nichts verändert.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WURZEL = resolve(import.meta.dirname, "../..");

const args = process.argv.slice(2);
const hole = (name) => {
  const werte = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) werte.push(args[i + 1]);
  }
  return werte;
};
const hatFlag = (name) => args.includes(name);

/* ------------------------------------------------------------------ */
/* Token lesen (ohne Signaturprüfung — es geht um die BEHAUPTUNG)      */
/* ------------------------------------------------------------------ */

function tokenZerlegen(token) {
  const teil = token.split(".")[1];
  if (!teil) return null;
  try {
    const json = Buffer.from(teil.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const c = JSON.parse(json);
    const exp = typeof c.exp === "number" ? c.exp : null;
    const jetzt = Math.floor(Date.now() / 1000);
    return {
      userId: c.sub ?? null,
      email: c.email ?? null,
      tenantId: c.app_metadata?.tenant_id || null,
      rolle: c.app_metadata?.role ?? null,
      aal: c.aal ?? null,
      restSekunden: exp !== null ? exp - jetzt : null,
      abgelaufen: exp !== null ? exp <= jetzt : false,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Testtoken bauen (nur lokal, aus dem Secret der eigenen .env)        */
/* ------------------------------------------------------------------ */

function secretLesen() {
  const pfad = resolve(WURZEL, "apps/api/.env");
  let inhalt;
  try {
    inhalt = readFileSync(pfad, "utf8");
  } catch {
    throw new Error(`apps/api/.env nicht lesbar (${pfad}) — ohne Secret keine Testtokens.`);
  }
  for (const zeile of inhalt.split("\n")) {
    if (zeile.startsWith("SUPABASE_JWT_SECRET=")) {
      return zeile.slice("SUPABASE_JWT_SECRET=".length).trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("SUPABASE_JWT_SECRET steht nicht in apps/api/.env.");
}

const b64 = (o) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");

function testToken(secret, tenantId, { rolle = "admin", gueltigSek = 300 } = {}) {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64({ alg: "HS256", typ: "JWT" });
  const rumpf = b64({
    // Eine feste, offensichtlich künstliche sub: dieses Token gehört keinem
    // echten Nutzer und soll auch in keinem Log so aussehen.
    sub: "00000000-0000-4000-8000-0000000d1a90",
    aud: "authenticated",
    role: "authenticated",
    email: "sitzung-pruefen@diagnose.local",
    app_metadata: tenantId ? { tenant_id: tenantId, role: rolle } : { role: rolle },
    aal: "aal2",
    iat: jetzt,
    exp: jetzt + gueltigSek,
  });
  const sig = createHmac("sha256", secret).update(`${kopf}.${rumpf}`).digest("base64url");
  return `${kopf}.${rumpf}.${sig}`;
}

/* ------------------------------------------------------------------ */
/* Messen                                                              */
/* ------------------------------------------------------------------ */

async function messen(token) {
  const kopf = { Authorization: `Bearer ${token}` };
  const ergebnis = {};

  for (const [name, pfad] of [
    ["session", "/api/v1/auth/me"],
    ["properties", "/api/v1/properties"],
    // Der Onboarding-Fortschritt gehoert dazu, weil er eine ANDERE Frage
    // beantwortet als „wie viele Objekte gibt es": naemlich, wie viele davon
    // ECHT sind und ob ein Portal wirklich autorisiert hat. Am 29.08.2026
    // liefen beide Zahlen auseinander (1 Objekt laut /properties, 0 echte) —
    // genau das war der Fehler, und ohne diese Zeile sieht man ihn nicht.
    ["onboarding", "/api/v1/dashboard/onboarding"],
  ]) {
    try {
      const r = await fetch(`${API}${pfad}`, { headers: kopf, cache: "no-store" });
      const text = await r.text();
      let daten = null;
      try {
        daten = JSON.parse(text);
      } catch {
        daten = text.slice(0, 200);
      }
      ergebnis[name] = { status: r.status, daten };
    } catch (e) {
      ergebnis[name] = { status: 0, daten: `nicht erreichbar: ${e.message}` };
    }
  }

  const p = ergebnis.properties?.daten;
  const items = Array.isArray(p?.items) ? p.items : [];
  const betriebe = [...new Set(items.map((i) => i.tenant_id).filter(Boolean))];
  return { ...ergebnis, total: p?.total ?? null, betriebe };
}

const kurz = (v) => (v ? String(v).slice(0, 8) : "—");

function ausgeben(titel, ident, mess) {
  console.log(`\n━━ ${titel}`);
  if (ident) {
    console.log(
      `   Token behauptet : tenant=${kurz(ident.tenantId)} user=${kurz(ident.userId)} ` +
        `rolle=${ident.rolle ?? "—"} aal=${ident.aal ?? "—"} ` +
        (ident.abgelaufen ? "ABGELAUFEN" : `rest=${ident.restSekunden ?? "—"}s`),
    );
    if (ident.email) console.log(`   E-Mail          : ${ident.email}`);
  }
  console.log(`   /auth/me        : HTTP ${mess.session.status}`);
  console.log(`   /properties     : HTTP ${mess.properties.status}  total=${mess.total ?? "—"}`);

  // Fortschritt danebenstellen: `total` zaehlt ALLE Zeilen, `object_count` nur
  // die echten. Weichen sie ab, steht ein Geruest in der Liste — der Zustand,
  // in dem die Oberflaeche „1 Objekt uebernommen" behauptete, ohne dass etwas
  // uebernommen war.
  const ob = mess.onboarding?.daten;
  if (ob && typeof ob === "object") {
    console.log(
      `   Onboarding      : echte Objekte=${ob.object_count ?? "—"}` +
        `  Portal verbunden=${ob.channels_done ?? "—"}`,
    );
    if (typeof ob.object_count === "number" && mess.total !== null) {
      const geruest = mess.total - ob.object_count;
      if (geruest > 0) {
        console.log(
          `   ⓘ ${geruest} Geruest-Objekt(e) in der Liste — angelegt beim Klick ` +
            `auf „verbinden", noch ohne Portal-Daten.`,
        );
      }
    }
  }
  if (mess.betriebe.length) {
    console.log(`   Betriebe darin  : ${mess.betriebe.map(kurz).join(", ")}`);
  }

  // DER Befund: liefert der Server Objekte eines ANDEREN Betriebs als dem im
  // Token? Wäre das je wahr, ist es ein echtes Backend-Leck und nicht mehr
  // eine Frage der Sitzung. Am 29.08.2026 war es gemessen NICHT so.
  if (ident?.tenantId) {
    const fremd = mess.betriebe.filter((b) => b !== ident.tenantId);
    if (fremd.length) {
      console.log(`   ⛔ MANDANTENBRUCH: fremde Betriebe in der Antwort: ${fremd.map(kurz).join(", ")}`);
      return false;
    }
  }
  if (mess.properties.status === 200) console.log("   ✓ Antwort enthält nur den eigenen Betrieb");
  return true;
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`API: ${API}`);
  let sauber = true;

  const tokens = hole("--token");
  if (tokens.length) {
    for (const t of tokens) {
      const ident = tokenZerlegen(t);
      if (!ident) {
        console.log("\n⛔ Token nicht dekodierbar (kein JWT?).");
        sauber = false;
        continue;
      }
      sauber = ausgeben("Übergebenes Token", ident, await messen(t)) && sauber;
    }
    process.exit(sauber ? 0 : 1);
  }

  let tenants = hole("--tenant");

  if (hatFlag("--alle")) {
    // Betriebe aus der Live-DB holen. Rein lesend (SELECT), und bewusst mit
    // Namen, damit die Ausgabe lesbar bleibt.
    const sql =
      "select t.id, t.name, (select count(*) from public.properties p where p.tenant_id = t.id) from public.tenants t order by t.created_at desc;";
    const roh = execFileSync(
      "ssh",
      [
        "-o",
        "ConnectTimeout=8",
        "root@65.21.144.136",
        `docker exec db-cdqxi7d0w34sxzr4wr8jy8um psql -U supabase_admin -d postgres -t -A -F'|' -c "${sql}"`,
      ],
      { encoding: "utf8" },
    );
    const zeilen = roh.trim().split("\n").filter(Boolean);
    console.log(`\n${zeilen.length} Betriebe in der Live-DB:`);
    for (const z of zeilen) {
      const [id, name, anzahl] = z.split("|");
      console.log(`   ${kurz(id)}  ${anzahl.padStart(3)} Objekte  ${name}`);
    }
    tenants = zeilen.map((z) => z.split("|")[0]);
  }

  if (!tenants.length) {
    console.log(
      "\nNichts zu messen. Nutzung:\n" +
        "  --token <JWT>      ein konkretes Sitzungs-Token prüfen\n" +
        "  --tenant <uuid>    ein Testtoken für diesen Betrieb bauen und messen\n" +
        "  --alle             alle Betriebe der Live-DB durchmessen",
    );
    process.exit(2);
  }

  const secret = secretLesen();
  for (const tid of tenants) {
    const t = testToken(secret, tid);
    sauber = ausgeben(`Testtoken für Betrieb ${kurz(tid)}`, tokenZerlegen(t), await messen(t)) && sauber;
  }

  // Gegenprobe: ein Token OHNE Betrieb muss fail-closed abgelehnt werden. Käme
  // hier je eine 200 mit Objekten, wäre der Scope umgehbar.
  const ohne = testToken(secret, null);
  const m = await messen(ohne);
  console.log(`\n━━ Gegenprobe: Token OHNE tenant_id`);
  console.log(`   /properties     : HTTP ${m.properties.status}  total=${m.total ?? "—"}`);
  if (m.properties.status === 200) {
    console.log("   ⛔ Ein Token ohne Betrieb bekommt Daten — der Scope ist umgehbar.");
    sauber = false;
  } else {
    console.log("   ✓ fail-closed abgelehnt");
  }

  console.log(
    sauber
      ? "\n✓ Kein Mandantenbruch messbar: jedes Token sieht genau seinen Betrieb."
      : "\n⛔ Befund siehe oben.",
  );
  process.exit(sauber ? 0 : 1);
}

main().catch((e) => {
  console.error("Fehlgeschlagen:", e.message);
  process.exit(2);
});
