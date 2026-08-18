#!/usr/bin/env node
// Prüft den myBestDays-Marktplatz (plattform, :3100) auf echten Mobil-Fehlern:
//
//   1. WAAGERECHTER ÜBERLAUF — `documentElement.scrollWidth > innerWidth`.
//      Das ist der Fehler, der sich nicht wegdiskutieren lässt: die Seite
//      lässt sich seitlich schieben, Inhalt steht außerhalb. Live gefunden am
//      18.08.2026: der „Suchen"-Knopf der Desktop-Leiste war 502 px breit bei
//      500 px Viewport.
//   2. TOUCH-ZIELE unter 44 px (nur Warnung, kein Fehlschlag) — sichtbare
//      Knöpfe/Links, die mit dem Daumen nicht sicher zu treffen sind.
//
// Warum ein Skript und nicht „im Browser nachsehen": beides ist eine Zahl, und
// eine Zahl gehört gemessen. Von Hand prüft niemand 14 Routen × 3 Breiten.
//
// Aufruf:
//   node scripts/mobile/ueberlauf-pruefen.mjs
//   node scripts/mobile/ueberlauf-pruefen.mjs --url http://localhost:3100
//   node scripts/mobile/ueberlauf-pruefen.mjs --cookie "nd_access=<TOKEN>"
//   node scripts/mobile/ueberlauf-pruefen.mjs --breiten 390
//
// Der Cookie ist der Weg zu den geschützten Seiten (/konto, /buchungen,
// /nachrichten, /merkzettel, /bewertungen, /aufenthalt): ohne ihn leiten sie
// auf /anmelden um, und die Prüfung sagt nichts über sie aus — sie werden dann
// ausdrücklich als ÜBERSPRUNGEN gemeldet und nicht als „grün".
//
// Exit 0 = kein Überlauf. Exit 1 = Überlauf gefunden. Exit 2 = Setup-Problem.

import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "../..");

// playwright-core liegt als Abhängigkeit von `web` im Workspace. Der Chromium
// kommt aus dem ms-playwright-Cache des Rechners; hier wird KEIN Browser
// nachgeladen (das wäre ein 150-MB-Download in einem Prüfskript).
let chromium;
try {
  const require = createRequire(path.join(WURZEL, "web", "package.json"));
  ({ chromium } = require("playwright-core"));
} catch (fehler) {
  console.error(
    "playwright-core nicht auflösbar. In web/ installieren:\n  bun install\n",
    fehler.message,
  );
  process.exit(2);
}

function argWert(name, standard) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

const BASIS = argWert("url", process.env.PLATTFORM_URL ?? "http://localhost:3100");
const COOKIE = argWert("cookie", process.env.PLATTFORM_COOKIE ?? "");
const BREITEN = argWert("breiten", "360,390,414")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter((w) => Number.isFinite(w) && w > 0);

// Höhe pro Breite: die üblichen Geräteverhältnisse, damit `dvh`-Layouts
// realistisch gemessen werden.
const HOEHE = { 360: 640, 390: 844, 414: 896 };

/** Im Browser laufender Prüfer. Muss eigenständig sein (kein Closure). */
function messen() {
  const vw = window.innerWidth;
  const scrollW = document.documentElement.scrollWidth;

  // Ein Element zählt nur, wenn es NICHT in einem waagerechten Scroll-Container
  // liegt: Karten-Bänder und Chip-Reihen sollen breiter als der Bildschirm sein,
  // das ist ihre Aufgabe.
  function inBand(el) {
    let p = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (
        (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
        p.scrollWidth > p.clientWidth + 2
      ) {
        return true;
      }
      p = p.parentElement;
    }
    return false;
  }

  function pfad(el) {
    const teile = [];
    let cur = el;
    for (let i = 0; cur && i < 4; i++) {
      const kl = (cur.className || "").toString().split(/\s+/).slice(0, 3).join(".");
      teile.unshift(cur.tagName.toLowerCase() + (kl ? `.${kl}` : ""));
      cur = cur.parentElement;
    }
    return teile.join(" > ");
  }

  const ueberlauf = [];
  const kleineZiele = [];
  const KLICKBAR = "a[href],button,input,select,textarea,[role=button]";

  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if ((r.right > vw + 2 || r.left < -2) && !inBand(el)) {
      ueberlauf.push({
        pfad: pfad(el),
        links: Math.round(r.left),
        rechts: Math.round(r.right),
        breite: Math.round(r.width),
      });
    }
  }

  for (const el of document.querySelectorAll(KLICKBAR)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    // Links MITTEN IM FLIESSTEXT (display:inline) sind keine Knöpfe — die kann
    // man nicht auf 44 px aufblasen, ohne die Zeilenhöhe zu zerstören. Sie
    // würden die Warnliste fluten und die echten Fälle verdecken.
    if (cs.display === "inline") continue;
    // Ein Eingabefeld in einem großen <label> ist über das Label antippbar;
    // maßgeblich ist dann die Höhe des Labels, nicht die des Feldes.
    const label = el.closest("label");
    if (label && label.getBoundingClientRect().height >= 44) continue;
    if (r.height < 40 || r.width < 40) {
      kleineZiele.push({
        pfad: pfad(el),
        h: Math.round(r.height),
        b: Math.round(r.width),
      });
    }
  }

  // Nur die äußersten Überläufe melden: ein zu breiter Kasten reißt alle seine
  // Kinder mit, das wären sonst 500 Zeilen für EINEN Fehler.
  const gefiltert = ueberlauf.filter(
    (o, i) => !ueberlauf.some((a, j) => j !== i && o.pfad.startsWith(a.pfad + " >")),
  );

  return {
    vw,
    scrollW,
    ueberlaufSeite: scrollW > vw + 1,
    elemente: gefiltert.slice(0, 12),
    kleineZiele: kleineZiele.slice(0, 12),
    kleineZieleGesamt: kleineZiele.length,
  };
}

/** Browser starten, ohne etwas herunterzuladen.
 *
 *  Reihenfolge: (1) der Chromium, den playwright-core selbst erwartet;
 *  (2) das lokal installierte Google Chrome (`channel: "chrome"`);
 *  (3) ein vorhandener ms-playwright-Cache mit ABWEICHENDER Build-Nummer.
 *  Grund für (3): der Cache des Rechners hängt an der Playwright-Version. Steht
 *  dort Build 1234, während playwright-core 1228 erwartet, bricht (1) ab — der
 *  Browser ist aber da und tut es. `npx playwright install` (150 MB) ist für ein
 *  Prüfskript keine Antwort. */
async function browserStarten() {
  const versuche = [
    { name: "playwright-chromium", opt: { headless: true } },
    { name: "installiertes Chrome", opt: { headless: true, channel: "chrome" } },
  ];

  const cache = path.join(
    process.env.HOME ?? "",
    "Library/Caches/ms-playwright",
  );
  if (fs.existsSync(cache)) {
    for (const eintrag of fs.readdirSync(cache)) {
      if (!eintrag.startsWith("chromium-")) continue;
      for (const rel of [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
      ]) {
        const exe = path.join(cache, eintrag, rel);
        if (fs.existsSync(exe)) {
          versuche.push({
            name: `Cache ${eintrag}`,
            opt: { headless: true, executablePath: exe },
          });
        }
      }
    }
  }

  const fehler = [];
  for (const v of versuche) {
    try {
      const b = await chromium.launch(v.opt);
      console.log(`Browser: ${v.name}`);
      return b;
    } catch (e) {
      fehler.push(`${v.name}: ${e.message.split("\n")[0]}`);
    }
  }
  console.error("Kein Browser startbar:\n  " + fehler.join("\n  "));
  process.exit(2);
}

async function main() {
  // Ein Inserat aus dem Bestand holen, damit die Detailseite echt geprüft wird
  // (eine erfundene ID gibt 404 und die Prüfung wäre wertlos).
  const browser = await browserStarten();
  const seiteVorab = await browser.newContext().then((c) => c.newPage());
  let inseratId = null;
  try {
    await seiteVorab.goto(BASIS, { waitUntil: "domcontentloaded", timeout: 30000 });
    inseratId = await seiteVorab.evaluate(() => {
      const a = document.querySelector('a[href^="/inserat/"]');
      return a ? a.getAttribute("href").split("/").pop() : null;
    });
  } catch (fehler) {
    console.error(`Startseite unter ${BASIS} nicht erreichbar: ${fehler.message}`);
    await browser.close();
    process.exit(2);
  }
  await seiteVorab.context().close();

  const ROUTEN = [
    { pfad: "/", name: "Startseite" },
    inseratId
      ? { pfad: `/inserat/${inseratId}`, name: "Inserat" }
      : { pfad: null, name: "Inserat (kein Objekt im Bestand)" },
    { pfad: "/anmelden", name: "Anmelden" },
    { pfad: "/rechtliches", name: "Rechtliches (Verzeichnis)" },
    { pfad: "/rechtliches/datenschutz", name: "Rechtstext" },
    { pfad: "/checkout/abgeschlossen", name: "Zahlung abgeschlossen" },
    { pfad: "/konto", name: "Konto", geschuetzt: true },
    { pfad: "/buchungen", name: "Buchungen", geschuetzt: true },
    { pfad: "/nachrichten", name: "Nachrichten", geschuetzt: true },
    { pfad: "/merkzettel", name: "Merkzettel", geschuetzt: true },
    { pfad: "/bewertungen", name: "Bewertungen", geschuetzt: true },
  ];

  const cookies = [];
  if (COOKIE) {
    const url = new URL(BASIS);
    for (const teil of COOKIE.split(";")) {
      const [name, ...rest] = teil.trim().split("=");
      if (!name || rest.length === 0) continue;
      cookies.push({
        name,
        value: rest.join("="),
        domain: url.hostname,
        path: "/",
      });
    }
  }

  let fehlerZahl = 0;
  let uebersprungen = 0;
  let warnungen = 0;

  for (const breite of BREITEN) {
    const hoehe = HOEHE[breite] ?? 800;
    const kontext = await browser.newContext({
      viewport: { width: breite, height: hoehe },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    if (cookies.length > 0) await kontext.addCookies(cookies);
    const seite = await kontext.newPage();

    console.log(`\n=== ${breite} × ${hoehe} ===`);

    for (const route of ROUTEN) {
      if (!route.pfad) {
        console.log(`  ~ ${route.name} — ÜBERSPRUNGEN`);
        uebersprungen++;
        continue;
      }
      const ziel = `${BASIS}${route.pfad}`;
      try {
        await seite.goto(ziel, { waitUntil: "networkidle", timeout: 30000 });
      } catch {
        // networkidle scheitert bei offenen WebSockets (Realtime) — dann reicht
        // domcontentloaded plus eine kurze Ruhephase.
        await seite.goto(ziel, { waitUntil: "domcontentloaded", timeout: 30000 });
        await seite.waitForTimeout(1500);
      }
      await seite.waitForTimeout(600);

      const gelandet = new URL(seite.url()).pathname;
      if (route.geschuetzt && gelandet.startsWith("/anmelden")) {
        console.log(
          `  ~ ${route.name} — ÜBERSPRUNGEN (nicht angemeldet, --cookie fehlt)`,
        );
        uebersprungen++;
        continue;
      }

      const e = await seite.evaluate(messen);
      if (e.ueberlaufSeite || e.elemente.length > 0) {
        fehlerZahl++;
        console.log(
          `  ✗ ${route.name} (${route.pfad}) — scrollWidth ${e.scrollW} > ${e.vw}`,
        );
        for (const o of e.elemente) {
          console.log(
            `      ${o.pfad}  [links ${o.links}, rechts ${o.rechts}, breit ${o.breite}]`,
          );
        }
      } else {
        console.log(`  ✓ ${route.name} (${route.pfad})`);
      }

      if (e.kleineZieleGesamt > 0) {
        warnungen += e.kleineZieleGesamt;
        console.log(
          `      ! ${e.kleineZieleGesamt} Touch-Ziel(e) unter 40 px (Warnung):`,
        );
        for (const z of e.kleineZiele) {
          console.log(`        ${z.pfad}  ${z.b}×${z.h}`);
        }
      }
    }

    await kontext.close();
  }

  await browser.close();

  console.log(
    `\nErgebnis: ${fehlerZahl} Route(n) mit Überlauf, ${uebersprungen} übersprungen, ${warnungen} Touch-Warnung(en).`,
  );
  if (uebersprungen > 0) {
    console.log(
      "Übersprungene Routen sind NICHT geprüft — mit --cookie \"nd_access=<TOKEN>\" nachholen.",
    );
  }
  process.exit(fehlerZahl > 0 ? 1 : 0);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(2);
});
