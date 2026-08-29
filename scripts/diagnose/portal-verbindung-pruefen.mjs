#!/usr/bin/env node
// Stimmt unser Bild der Portal-Verbindungen mit der Wirklichkeit überein?
//
// ANLASS (29.08.2026): Im frischen Testkonto stand
//
//     „Keine Bestätigung von Airbnb erhalten. Das passiert vor allem, wenn in
//      deinem Airbnb-Konto bereits eine andere Software verbunden ist …"
//
// obwohl NIEMAND je auf „verbinden" geklickt hatte. Airbnb hatte nichts
// abgelehnt — es war nie gefragt worden. Gleichzeitig zeigte das Serverlog:
//
//     GET channels/b93f2620… → 404 resource_not_found
//     channex_oauth_kanal_verschwunden
//
// Der Kanal existierte bei Channex gar nicht mehr, unsere DB kannte ihn noch,
// und die Kontozeile trug ihn sogar mit `is_active=true` weiter. Drei
// verschiedene Bilder derselben Lage — keines davon abzulesen, ohne von Hand
// in DB und Channex zu schauen.
//
// Dieses Skript stellt die drei Ebenen NEBENEINANDER, und der Vergleich ist
// der Befund:
//
//   1. `channex_channel_connection` — was wir über die Verbindung glauben
//   2. `ota_account`                — was wir über das Konto glauben
//   3. Channex (`GET /channels/:id`)— was es dort wirklich gibt
//
// NUTZUNG
//   node scripts/diagnose/portal-verbindung-pruefen.mjs                (alle)
//   node scripts/diagnose/portal-verbindung-pruefen.mjs --tenant <uuid>
//   node scripts/diagnose/portal-verbindung-pruefen.mjs --ohne-channex (nur DB)
//
// NUR LESEND — gegen die DB ausschließlich SELECT, gegen Channex ausschließlich
// GET (Regel „Channex: NUR lesen"). Exit 1, sobald ein Widerspruch steht.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WURZEL = resolve(import.meta.dirname, "../..");
const SSH = "root@65.21.144.136";
const CONTAINER = "db-cdqxi7d0w34sxzr4wr8jy8um";

const args = process.argv.slice(2);
const argWert = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ohneChannex = args.includes("--ohne-channex");
const nurTenant = argWert("--tenant");

/* ------------------------------------------------------------------ */

function sql(query) {
  const roh = execFileSync(
    "ssh",
    [
      "-o",
      "ConnectTimeout=10",
      SSH,
      `docker exec ${CONTAINER} psql -U supabase_admin -d postgres -t -A -F'|' -c "${query.replace(/"/g, '\\"')}"`,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  return roh
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((z) => z.split("|"));
}

/** Channex-Schlüssel aus der Umgebung des Servers — NICHT aus dem Repo. */
function channexSchluessel() {
  const pfad = resolve(WURZEL, "apps/api/.env");
  try {
    for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
      if (zeile.startsWith("CHANNEX_API_KEY=")) {
        return zeile.slice("CHANNEX_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* kein .env — dann eben ohne Channex-Gegenprobe */
  }
  return null;
}

async function channexKanal(schluessel, id) {
  try {
    const r = await fetch(`https://app.channex.io/api/v1/channels/${id}`, {
      headers: { "user-api-key": schluessel },
    });
    if (r.status === 404) return { status: 404 };
    if (!r.ok) return { status: r.status };
    const d = await r.json();
    const attrs = d?.data?.attributes ?? {};
    const settings = attrs.settings;
    return {
      status: 200,
      is_active: attrs.is_active,
      // Drei ZUSTÄNDE, nicht zwei — genau die Unterscheidung, an der die
      // Fehlmeldung hing: `settings` fehlt ganz (Channex hat den Kanal nie
      // angefasst) ist etwas anderes als `settings` leer (angekommen, aber
      // ohne Tokens).
      settings: settings === null || settings === undefined ? "FEHLT" : Object.keys(settings).length === 0 ? "LEER" : "GEFUELLT",
      hat_tokens: !!settings?.tokens,
      token_invalid: settings?.token_invalid ?? null,
    };
  } catch (e) {
    return { status: 0, fehler: e.message };
  }
}

const kurz = (v) => (v && v !== "" ? String(v).slice(0, 8) : "—");

/* ------------------------------------------------------------------ */

async function main() {
  const wo = nurTenant ? `where c.tenant_id = '${nurTenant}'` : "";

  const verbindungen = sql(`
    select c.tenant_id, t.name, c.property_id, c.ota_portal_code,
           coalesce(c.channex_channel_id,''), c.is_active,
           coalesce(c.oauth_versuch_at::text,''), coalesce(left(c.last_error,50),'')
    from public.channex_channel_connection c
    join public.tenants t on t.id = c.tenant_id
    ${wo}
    order by t.name`);

  const konten = sql(`
    select a.tenant_id, a.ota_portal_code, coalesce(a.channex_channel_id,''),
           a.is_active, coalesce(a.connected_at::text,''), a.token_invalid,
           coalesce(a.ota_hotel_id,'')
    from public.ota_account a
    ${nurTenant ? `where a.tenant_id = '${nurTenant}'` : ""}`);

  const schluessel = ohneChannex ? null : channexSchluessel();
  if (!ohneChannex && !schluessel) {
    console.log("⚠ CHANNEX_API_KEY nicht gefunden — Gegenprobe entfällt.\n");
  }

  console.log(`${verbindungen.length} Verbindungen, ${konten.length} Konten\n`);

  let befunde = 0;

  for (const [tenant, name, prop, portal, kanal, aktiv, versuch, fehler] of verbindungen) {
    console.log(`━━ ${name} · ${portal} · Objekt ${kurz(prop)}`);
    console.log(
      `   Verbindung : kanal=${kurz(kanal) || "—"} aktiv=${aktiv} ` +
        `versuch=${versuch ? "ja" : "NEIN"}`,
    );
    if (fehler) console.log(`   Fehler     : ${fehler}`);

    const konto = konten.find((k) => k[0] === tenant && k[1] === portal);
    if (konto) {
      const [, , kKanal, kAktiv, kConnected, kTokenUngueltig, kHost] = konto;
      console.log(
        `   Konto      : kanal=${kurz(kKanal) || "—"} aktiv=${kAktiv} ` +
          `bestaetigt=${kConnected ? kConnected.slice(0, 16) : "NIE"} ` +
          `token_ungueltig=${kTokenUngueltig}`,
      );

      // Widerspruch 1: Verbindung geschlossen, Konto zeigt noch auf den Kanal.
      // Genau dieser Zustand stand am 29.08.2026 in der Live-DB.
      if (!kanal && kKanal) {
        console.log(
          "   ⛔ Die Verbindung wurde geschlossen, das Konto zeigt aber noch " +
            "auf den Kanal — der Gegenzustand fehlt (Wurzel 1).",
        );
        befunde++;
      }
      // Widerspruch 2: Konto gilt als aktiv, ohne JEDEN Beleg einer
      // Verbindung.
      //
      // NUR fuer OAuth-Portale an `connected_at` messen. Booking.com und die
      // uebrigen kennen kein OAuth: dort gibt der Betrieb seine Hotel-ID ein,
      // es gibt keine Bestaetigung, die einen Zeitpunkt setzen koennte —
      // `connected_at` bleibt dort dauerhaft leer und ist KEIN Befund. Der
      // erste Entwurf dieses Skripts meldete deshalb 18 gesunde
      // Booking-Konten von AirSmil als kaputt (live gemessen: alle mit
      // echter ota_hotel_id, alle in Betrieb). Ein Pruefskript, das Gesundes
      // anschwaerzt, macht die naechste echte Meldung wertlos.
      const istOauthPortal = portal === "AirBNB";
      const beleg = istOauthPortal ? kConnected : kHost;
      if (kAktiv === "t" && !beleg) {
        console.log(
          istOauthPortal
            ? "   ⛔ Konto aktiv, aber nie vom Portal bestaetigt " +
                "(connected_at fehlt) — sieht wie verbunden aus, ist es nicht."
            : "   ⛔ Konto aktiv, aber ohne Portal-Kennung (ota_hotel_id " +
                "fehlt) — es kann nichts uebertragen.",
        );
        befunde++;
      }
    } else {
      console.log("   Konto      : —");
    }

    if (schluessel && kanal) {
      const c = await channexKanal(schluessel, kanal);
      if (c.status === 404) {
        console.log("   Channex    : ⛔ 404 — dieser Kanal existiert dort NICHT MEHR");
        befunde++;
      } else if (c.status === 200) {
        console.log(
          `   Channex    : aktiv=${c.is_active} settings=${c.settings} ` +
            `tokens=${c.hat_tokens} token_invalid=${c.token_invalid}`,
        );
        // Widerspruch 3: wir halten die Verbindung fuer aktiv, Channex nicht.
        // Tokens gibt es NUR bei OAuth-Portalen. Ein Booking-Kanal hat nie
        // welche und ist trotzdem in Ordnung — dort steckt die Berechtigung in
        // der Hotel-ID.
        if (portal === "AirBNB" && aktiv === "t" && !c.hat_tokens) {
          console.log(
            "   ⛔ Wir fuehren die Verbindung als aktiv, bei Channex fehlen " +
              "aber die Tokens — sie ist nicht autorisiert.",
          );
          befunde++;
        }
        // Der Fall, der die falsche Meldung ausloeste.
        if (c.settings === "FEHLT" && !versuch) {
          console.log(
            "   ⓘ settings fehlt UND kein Versuch protokolliert: hier hat " +
              "schlicht niemand verbunden. KEINE Ablehnung durch das Portal.",
          );
        }
      } else {
        console.log(`   Channex    : HTTP ${c.status}${c.fehler ? " " + c.fehler : ""}`);
      }
    }
    console.log("");
  }

  // ── Karteileichen: Geruest-Properties, die bei Channex stehen geblieben sind
  //
  // Das Geruest („Airbnb-Uebernahme laeuft") ist technisch unvermeidbar:
  // Channex verlangt fuer den Autorisierungslink mindestens eine Property
  // (live gemessen: `properties: []` → 422 „should have at least 1 item(s)").
  // Vermeidbar ist nur, dass sich davon MEHRERE ansammeln — genau das stand am
  // 29.08.2026 im Channex-UI (zwei Properties fuer EIN Objekt), und der Kunde
  // raeumte sie von Hand auf.
  const geruesteDb = sql(`
    select t.name, p.id, count(m.id) filter (where m.deleted_at is null) as offen,
           count(m.id) filter (where m.deleted_at is not null) as geschlossen
    from public.properties p
    join public.tenants t on t.id = p.tenant_id
    left join public.channex_property_map m on m.property_id = p.id
    where p.title = 'Airbnb-Übernahme läuft' and p.airbnb_listing_id is null
    ${nurTenant ? `and p.tenant_id = '${nurTenant}'` : ""}
    group by t.name, p.id`);

  if (geruesteDb.length) {
    console.log("━━ Geruest-Objekte (Airbnb-Uebernahme laeuft)");
    for (const [name, pid, offen, geschlossen] of geruesteDb) {
      console.log(
        `   ${name} · ${kurz(pid)} : ${offen} offene, ${geschlossen} geschlossene Registrierung(en)`,
      );
      if (Number(geschlossen) > 0) {
        console.log(
          "   ⓘ Geschlossene Registrierungen zeigen auf Channex-Properties, " +
            "die dort stehen geblieben sein koennen (Karteileichen).",
        );
      }
    }
    console.log("");
  }

  // Gegenprobe bei Channex selbst: wie viele Properties tragen diesen Titel?
  if (schluessel) {
    try {
      const r = await fetch(
        "https://app.channex.io/api/v1/properties?pagination[limit]=100",
        { headers: { "user-api-key": schluessel } },
      );
      if (r.ok) {
        const d = await r.json();
        const geruesteLive = (d?.data ?? []).filter(
          (e) => e?.attributes?.title === "Airbnb-Übernahme läuft",
        );
        console.log(
          `━━ Bei Channex: ${geruesteLive.length} Property(s) mit dem Geruest-Titel`,
        );
        for (const g of geruesteLive) console.log(`   ${kurz(g.id)}`);
        // Mehr als eine je Geruest-Objekt ist der Befund. Genau eine ist der
        // Normalzustand waehrend einer laufenden Uebernahme.
        if (geruesteLive.length > geruesteDb.length) {
          console.log(
            `   ⛔ ${geruesteLive.length - geruesteDb.length} Karteileiche(n): ` +
              "mehr Geruest-Properties bei Channex als Geruest-Objekte bei uns.",
          );
          befunde++;
        }
        console.log("");
      }
    } catch {
      /* Channex nicht erreichbar — die DB-Sicht oben steht trotzdem */
    }
  }

  console.log(
    befunde === 0
      ? "✓ Kein Widerspruch: DB, Konto und Channex erzaehlen dieselbe Geschichte."
      : `⛔ ${befunde} Widerspruch/Widersprueche — siehe oben.`,
  );
  process.exit(befunde === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fehlgeschlagen:", e.message);
  process.exit(2);
});
