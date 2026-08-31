#!/usr/bin/env node
// ============================================================================
// frontend-geheimnisse-pruefen.mjs — verhindert, dass ein Geheimnis im
// AUSLIEFERBAREN Frontend landet.
// ----------------------------------------------------------------------------
// WARUM ES DAS GIBT
//
// Alles, was ein Frontend-Bundle erreicht, ist ÖFFENTLICH — auch ohne dass es
// jemand im Repo bemerkt. Zwei Wege dorthin, und keiner davon macht Lärm:
//
//   1. Ein serverseitiges Geheimnis wird mit `NEXT_PUBLIC_`-Präfix gelesen.
//      Next.js ersetzt solche Zugriffe beim Build durch den LITERALEN Wert,
//      inlined ihn in das JavaScript des Browsers und sagt dazu nichts. Ein
//      `NEXT_PUBLIC_STRIPE_SECRET_KEY` funktioniert einwandfrei — er steht
//      danach in jedem geladenen Bundle.
//   2. Ein echter Schlüssel wird als Literal in eine Quelldatei geschrieben
//      (Feldtest, „nur kurz", vergessen) oder eine `.env.local` rutscht mit.
//
// GEFUNDEN AM 31.08.2026, beim Bau dieser Prüfung: `mobile-nextdays/lib/
// config.secrets.ts` war VERSIONIERT und trug den echten Supabase-anon-Key —
// obwohl die Datei in ihrer eigenen ersten Zeile „GITIGNORIERT — nicht
// committen" behauptet. Die Ursache war das App-Verdoppeln (ADR-0019):
// `mobile-bestdays/.gitignore` trägt die Regel `lib/config.secrets.ts`,
// `mobile-nextdays/.gitignore` trug sie nicht, also griff nichts. Die CI
// kopiert für beide Apps extra einen Platzhalter — die Absicht war klar, nur
// erzwungen hat sie niemand. Genau diese Lücke schließt dieses Skript.
//
// WAS ES PRÜFT — vier Klassen, jede mit eigener Begründung:
//
//   A  NEXT_PUBLIC_-Variablen mit verräterischem Namen (SECRET, SERVICE_ROLE,
//      PRIVATE, PASSWORD, WEBHOOK, CLIENT_SECRET, ACCESS_TOKEN …).
//      Ein Name ist kein Beweis, aber jeder Treffer verlangt eine Entscheidung
//      — deshalb die Allowlist, in der BEGRÜNDET steht, warum ein Wert
//      öffentlich sein darf.
//   B  Literale Geheimnisse in Quelldateien: Stripe-Secrets, private
//      Schlüsselblöcke, GitHub-/Slack-/AWS-Token. Erkannt wird die FORM, nicht
//      der Name — ein Schlüssel in einer Variable namens `foo` ist derselbe
//      Schaden.
//   C  Ein JWT mit `role: service_role` irgendwo im Frontend. Der schaltet RLS
//      ab (Wurzel 6): wer ihn hat, liest und schreibt jede Zeile jedes
//      Mandanten. Das ist der schlimmste Einzelfund, den es hier geben kann,
//      und er sieht einem anon-Key zum Verwechseln ähnlich — beide beginnen
//      mit `eyJ`. Deshalb wird die Nutzlast DEKODIERT und die Rolle gelesen,
//      statt am Präfix zu raten.
//   D  Versionierte Geheimnis-Dateien (.env.local, config.secrets.ts,
//      Keystores, .p8/.p12/serviceAccount.json). Die gehören nie ins Repo,
//      auch nicht mit Platzhaltern drin — der nächste Bearbeiter füllt sie.
//
// WAS ES BEWUSST NICHT TUT
//
//   * Es baut NICHT. `next build` auf dem Rechner des Nutzers ist verboten
//     (CLAUDE.md, Schaden dreimal belegt), also wird der Quellcode geprüft,
//     nicht das Bundle. Das ist die schwächere Messung und wird am Ende der
//     Ausgabe auch so benannt: eine Variable, die erst zur Build-Zeit aus
//     einer anderen Quelle entsteht, sieht dieses Skript nicht.
//   * Es prüft NICHT die Git-Historie. Ein Geheimnis, das früher drinstand und
//     wieder entfernt wurde, ist trotzdem kompromittiert — das ist ein Fall
//     für `git filter-repo` plus Rotation, nicht für ein Gate.
//
// Aufruf (vom Repo-Root):
//   node scripts/security/frontend-geheimnisse-pruefen.mjs
//   node scripts/security/frontend-geheimnisse-pruefen.mjs web marketing
//
// Exit 0 = sauber · Exit 1 = Befund (CI-fähig) · Exit 2 = Prüfung selbst kaputt.
// Rein lesend. Allowlist: scripts/security/frontend-geheimnisse-allowlist.json
// ============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WURZEL = process.cwd();

// Die auslieferbaren Oberflächen. Alles hier landet auf einem fremden Gerät —
// im Browser oder als App-Paket. `apps/api`/`apps/public-api` stehen NICHT
// drin: dort GEHÖREN Geheimnisse hin (aus der Umgebung), und sie zu melden
// würde die Prüfung mit Rauschen füllen, bis niemand mehr hinsieht.
const FRONTENDS = [
  "web",
  "marketing",
  "admin",
  "builder",
  "plattform",
  "gastgeber",
  "storybook",
  "mobile-nextdays",
  "mobile-bestdays",
];

// Fremdcode und Bauartefakte: dort steht viel, das wie ein Schlüssel aussieht,
// und nichts davon haben wir geschrieben.
const AUSGESCHLOSSEN = [
  "node_modules",
  ".next",
  "ios/Pods",
  "vendor",
  "android/build",
  "android/.gradle",
  "build",
  "dist",
  ".turbo",
  "coverage",
  "graphify-out",
];

const QUELL_ENDUNGEN = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".mdx", ".md", ".yml", ".yaml", ".env", ".sh", ".kt", ".swift",
];

// ---------------------------------------------------------------------------
// Klasse A — NEXT_PUBLIC_ mit verräterischem Namen.
// ---------------------------------------------------------------------------
const A_VERDACHT =
  /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|PASSWD|CREDENTIAL|WEBHOOK|ACCESS_TOKEN|REFRESH_TOKEN)[A-Z0-9_]*\b/g;

// ---------------------------------------------------------------------------
// Klasse B — literale Geheimnisse, an ihrer FORM erkannt.
//
// Die Muster sind absichtlich eng: `sk_live_` plus Mindestlänge trifft einen
// echten Stripe-Schlüssel, nicht das Wort „sk_live_…" in einer Dokumentation.
// Jede Lockerung hier kostet Vertrauen in das Gate — ein Skript, das dreimal
// falsch meldet, wird beim vierten Mal übersprungen.
// ---------------------------------------------------------------------------
const B_MUSTER = [
  { name: "Stripe-Secret-Key (live)", re: /\bsk_live_[A-Za-z0-9]{20,}/ },
  { name: "Stripe-Secret-Key (test)", re: /\bsk_test_[A-Za-z0-9]{20,}/ },
  { name: "Stripe-Restricted-Key", re: /\brk_(?:live|test)_[A-Za-z0-9]{20,}/ },
  { name: "Privater Schlüsselblock", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "GitHub-Token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/ },
  { name: "Slack-Token", re: /\bxox[abposr]-[A-Za-z0-9-]{12,}/ },
  { name: "AWS-Access-Key-ID", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google-Dienstkonto-Schlüssel", re: /"type"\s*:\s*"service_account"/ },
  { name: "Supabase-Secret-Key (neues Format)", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
];

// ---------------------------------------------------------------------------
// Klasse D — Dateien, die versioniert nichts zu suchen haben.
//
// `.env` ohne Endung fehlt hier ABSICHTLICH: manche Werkzeuge legen eine
// versionierte `.env` mit reinen Standardwerten an. Was zählt, sind die
// Varianten, in die echte Werte wandern (.env.local/.production/.live) — und
// falls in einer harmlosen `.env` doch ein Schlüssel steht, fängt ihn Klasse B.
// ---------------------------------------------------------------------------
const D_DATEIEN = [
  { name: "lokale .env mit echten Werten", re: /(^|\/)\.env\.(local|production|prod|live)$/ },
  { name: "lokale Secrets-Datei", re: /(^|\/)config\.secrets\.(ts|js|json)$/ },
  { name: "Android-Keystore", re: /\.(jks|keystore)$/ },
  { name: "Apple-Signierschlüssel", re: /\.(p8|p12|mobileprovision)$/ },
  { name: "Google-Dienstkonto", re: /(^|\/)(serviceAccount|service-account|google-services)\.json$/ },
];

// `.example`/`.sample`/`.template` sind die VORLAGEN — sie sollen im Repo
// stehen. Enthalten sie echte Werte, fängt das Klasse B, nicht D.
const D_AUSNAHME = /\.(example|sample|template|dist)(\.|$)/;

function allowlistLaden() {
  const p = join(WURZEL, "scripts/security/frontend-geheimnisse-allowlist.json");
  if (!existsSync(p)) return { variablen: {}, fundstellen: {} };
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return { variablen: j.variablen ?? {}, fundstellen: j.fundstellen ?? {} };
  } catch (e) {
    // Kein stilles Weiterlaufen mit leerer Allowlist: dann prüfte das Gate
    // plötzlich strenger als gedacht, oder — schlimmer — jemand „reparierte"
    // es durch Aufweichen. Lieber laut kaputt (Wurzel 5).
    console.error(`Allowlist unlesbar (${p}): ${e.message}`);
    process.exit(2);
  }
}

/** Alle versionierten Dateien — git ist die Wahrheit darüber, was ausgeliefert wird. */
function gitDateien(bereiche) {
  const out = execFileSync("git", ["ls-files", "-z", "--", ...bereiche], {
    cwd: WURZEL,
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.toString("utf8").split("\0").filter(Boolean);
}

function ausgeschlossen(pfad) {
  const teile = pfad.split("/");
  return AUSGESCHLOSSEN.some((a) =>
    a.includes("/") ? pfad.includes(a) : teile.includes(a),
  );
}

/**
 * Rolle aus einem JWT lesen (Klasse C).
 *
 * Nur die Nutzlast wird base64url-dekodiert; die Signatur bleibt ungeprüft,
 * weil sie hier nichts beweisen muss — es geht darum, WAS der Schlüssel kann,
 * nicht ob er noch gültig ist. Ein service_role-Token ist auch abgelaufen ein
 * Grund zur Rotation.
 */
function jwtRolle(token) {
  const teile = token.split(".");
  if (teile.length < 2) return null;
  try {
    const roh = Buffer.from(
      teile[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const j = JSON.parse(roh);
    return typeof j.role === "string" ? j.role : null;
  } catch {
    return null; // Kein JWT, nur eine lange base64-ähnliche Zeichenkette.
  }
}

const { variablen: ERLAUBT_VAR, fundstellen: ERLAUBT_FUND } = allowlistLaden();

const bereiche = process.argv.slice(2).length
  ? process.argv.slice(2)
  : FRONTENDS.filter((d) => existsSync(join(WURZEL, d)));

const befunde = [];
let geprueft = 0;

for (const datei of gitDateien(bereiche)) {
  if (ausgeschlossen(datei)) continue;

  // --- Klasse D: allein die EXISTENZ im Repo ist der Befund. ---
  for (const d of D_DATEIEN) {
    if (d.re.test(datei) && !D_AUSNAHME.test(datei) && !ERLAUBT_FUND[datei]) {
      befunde.push({
        klasse: "D",
        datei,
        zeile: 0,
        was: d.name,
        detail: "versioniert — gehört in .gitignore, nicht ins Repo",
      });
    }
  }

  if (!QUELL_ENDUNGEN.some((e) => datei.endsWith(e))) continue;

  let inhalt;
  try {
    inhalt = readFileSync(join(WURZEL, datei), "utf8");
  } catch {
    continue; // Symlink, gelöscht, unlesbar — nichts zu prüfen.
  }
  if (inhalt.includes("\0")) continue; // binär
  geprueft += 1;

  const zeilen = inhalt.split("\n");
  for (let i = 0; i < zeilen.length; i += 1) {
    const zeile = zeilen[i];
    const nr = i + 1;

    // Eine Zeile, die die Allowlist mit Grund nennt, wird übersprungen.
    if (ERLAUBT_FUND[`${datei}:${nr}`]) continue;

    // --- Klasse A ---
    for (const treffer of zeile.matchAll(A_VERDACHT)) {
      const name = treffer[0];
      if (ERLAUBT_VAR[name]) continue;
      befunde.push({
        klasse: "A",
        datei,
        zeile: nr,
        was: name,
        detail:
          "NEXT_PUBLIC_ wird beim Build in das Browser-Bundle inlined — "
          + "der Wert ist damit öffentlich",
      });
    }

    // --- Klasse B ---
    for (const m of B_MUSTER) {
      if (m.re.test(zeile)) {
        befunde.push({
          klasse: "B",
          datei,
          zeile: nr,
          was: m.name,
          detail: "literales Geheimnis im Quellcode",
        });
      }
    }

    // --- Klasse C: JWT-Rolle dekodieren, nicht am Präfix raten. ---
    const jwts = zeile.matchAll(
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?/g,
    );
    for (const treffer of jwts) {
      const rolle = jwtRolle(treffer[0]);
      if (rolle === "service_role") {
        befunde.push({
          klasse: "C",
          datei,
          zeile: nr,
          was: "JWT mit role=service_role",
          detail:
            "service_role UMGEHT RLS (Wurzel 6): liest und schreibt jede Zeile "
            + "JEDES Mandanten. Sofort rotieren.",
        });
      } else if (rolle === "anon") {
        // Der anon-Key ist per Design client-sichtbar (RLS schützt die Daten).
        // Im Repo will ihn CLAUDE.md trotzdem nicht als echten Wert — aber das
        // ist eine Ordnungsfrage, kein Leck. Deshalb ein HINWEIS, der das Gate
        // nicht bricht: ein Gate, das an Ordnungsfragen scheitert, wird
        // umgangen und fängt dann auch das Echte nicht mehr.
        befunde.push({
          klasse: "hinweis",
          datei,
          zeile: nr,
          was: "JWT mit role=anon",
          detail:
            "per Design öffentlich (RLS schützt), laut CLAUDE.md aber kein "
            + "echter Wert im Repo — Platzhalter nutzen",
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------
const harte = befunde.filter((b) => b.klasse !== "hinweis");
const hinweise = befunde.filter((b) => b.klasse === "hinweis");

const KLASSENTEXT = {
  A: "NEXT_PUBLIC_ mit Geheimnis-Namen",
  B: "literales Geheimnis im Quellcode",
  C: "service_role-Schlüssel im Frontend",
  D: "versionierte Geheimnis-Datei",
};

console.log(
  `Frontend-Geheimnisse: ${geprueft} versionierte Quelldateien in `
  + `${bereiche.length} Bereich(en) geprüft.`,
);

if (hinweise.length) {
  console.log(`\nHinweise (brechen NICHT ab) — ${hinweise.length}:`);
  for (const h of hinweise) {
    console.log(`  ${h.datei}:${h.zeile}  ${h.was}`);
    console.log(`      ${h.detail}`);
  }
}

if (!harte.length) {
  console.log("\n✓ Kein Geheimnis im auslieferbaren Frontend.");
  console.log(
    "  Grenze dieser Messung: geprüft wird der QUELLCODE, nicht das gebaute\n"
    + "  Bundle (lokale next-builds sind verboten). Eine Variable, die erst zur\n"
    + "  Build-Zeit aus einer anderen Quelle entsteht, sieht sie nicht.",
  );
  process.exit(0);
}

// Nach Klasse gruppiert, C zuerst — das ist der Fund, der alles andere schlägt.
console.error(`\n✗ ${harte.length} Befund(e):`);
for (const k of ["C", "B", "D", "A"]) {
  const gruppe = harte.filter((b) => b.klasse === k);
  if (!gruppe.length) continue;
  console.error(`\n[${k}] ${KLASSENTEXT[k]} — ${gruppe.length}:`);
  for (const b of gruppe) {
    console.error(`  ${b.zeile ? `${b.datei}:${b.zeile}` : b.datei}`);
    console.error(`      ${b.was} — ${b.detail}`);
  }
}

console.error(
  "\nWas jetzt zu tun ist:\n"
  + "  [C] Schlüssel SOFORT rotieren (Supabase → Settings → API), dann aus dem\n"
  + "      Code entfernen. Er war öffentlich, sobald er gebaut wurde.\n"
  + "  [B] Wert rotieren, aus dem Code entfernen, über die Umgebung lesen.\n"
  + "      Steckt er in der Historie: git filter-repo/BFG.\n"
  + "  [D] Datei in .gitignore aufnehmen UND aus dem Index nehmen:\n"
  + "      git rm --cached <datei>   (die lokale Datei bleibt liegen)\n"
  + "  [A] Wert serverseitig lesen (ohne NEXT_PUBLIC_) und über eine Route bzw.\n"
  + "      Server-Action ausliefern. Ist er wirklich öffentlich, mit BEGRÜNDUNG\n"
  + "      in scripts/security/frontend-geheimnisse-allowlist.json eintragen.",
);
process.exit(1);
