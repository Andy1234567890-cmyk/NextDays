#!/usr/bin/env node
// Nimmt die Oberflaeche als HTML-Schnappschuss auf — die Grundlage der
// interaktiven Produkt-Tour auf der Marketing-Seite.
//
// WARUM HTML UND NICHT SCREENSHOTS:
// Gemessen an Storylane (docs/ANALYSE-storylane-produkt-demo.md): sie behalten
// echtes DOM, und genau deshalb haengen ihre Tour-Schritte an CSS-Selektoren
// statt an Pixel-Koordinaten. Ein Bild waere einfacher aufzunehmen und danach
// dauerhaft teurer: Hotspots muessten nach jeder UI-Aenderung neu vermessen
// werden, Text liesse sich nicht markieren, nicht durchsuchen, nicht
// indexieren, und die Skalierung wuerde unscharf.
//
// WAS DIESER JOB ANDERS MACHT ALS STORYLANE (Fallstricke aus der Analyse):
//  1. Assets als DATEIEN daneben, nicht als base64 inline. Storylane braucht
//     Selbstgenuegsamkeit, weil sie fremde Apps filmen; wir hosten selbst.
//     Bei ihnen kostet das 62,6 MB fuer 15 Seiten (eine Seite 23,7 MB bei nur
//     3074 DOM-Knoten) — base64 traegt +33 % gegenueber der Binaerdatei, und
//     dasselbe Logo liegt in jeder Seite erneut drin.
//  2. EIN Lauf nimmt ALLE Seiten auf. Bei Storylane stammen die Seiten eines
//     Rundgangs aus verschiedenen Sitzungen — die Seitenleiste springt beim
//     Klicken, weil zwei Snapshots unterschiedliche Zustaende zeigen.
//  3. Maskierung ist ein Gate, keine Option: der Job schlaegt FEHL, wenn nach
//     dem Ersetzen noch etwas wie eine E-Mail oder Telefonnummer im DOM steht.
//     Storylanes Snapshots enthalten dauerhaft oeffentlich echte Gastnamen,
//     Adressen und Buchungsbetraege.
//  4. Fremd-Widgets werden entfernt. Bei Storylane kleben Google-Translate und
//     die Zendesk-Bubble im Klon und sehen aus wie Teil des Produkts.
//
// AUFRUF
//   node scripts/tour/aufnehmen.mjs \
//     --basis https://app.mynextdays.com \
//     --login merle.ahrens@mynextdays.com --passwort '<GEHEIM>' \
//     --ziel /tmp/tour
//
// Das Passwort kommt als Argument oder aus TOUR_PASSWORT — NIE in den Code
// (CLAUDE.md: keine Credentials in Repo-Dateien).
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// --- Die fuenf Kernseiten des Rundgangs ------------------------------------
// Reihenfolge = Erzaehlreihenfolge: erst der Ueberblick, dann das Werkzeug,
// mit dem der Vermieter taeglich arbeitet, dann die Kanaele als Versprechen.
const SEITEN = [
  { key: "dashboard", pfad: "/", name: "Startseite" },
  { key: "kalender", pfad: "/kalender", name: "Belegungsplan" },
  { key: "posteingang", pfad: "/posteingang", name: "Posteingang" },
  { key: "objekte", pfad: "/objekte", name: "Objekte" },
  { key: "kanaele", pfad: "/kanalmanager", name: "Kanalmanager" },
];

// Aufnahmebreite. 1440 statt Storylanes 1905: kleinere Dateien, und der
// Player skaliert auf Laptop-Breiten hoch statt herunter — Hochskalieren von
// echtem DOM ist verlustfrei, das ist der Vorteil gegenueber Bildern.
const BREITE = 1440;
const HOEHE = 900;

// Fremde Einbettungen, die im Snapshot wie Teil des Produkts aussehen wuerden.
const FREMD_SELEKTOREN = [
  "#goog-gt-tt", ".goog-te-banner-frame", ".skiptranslate",
  "iframe[src*='zendesk']", "iframe[src*='intercom']", "#launcher",
  "[data-testid='realtime-debug-panel']", ".RealtimeDebugPanel",
];

// --- Maskierung -----------------------------------------------------------
// Nordlicht/Seeblick sind Fotomodell-Tenants, aber ein Snapshot friert ALLES
// ein, was im DOM steht — auch `title`-Attribute und aria-Labels.
const ERSATZ_NAMEN = [
  "Anna Berg", "Lukas Meyer", "Sofia Nagy", "Camille Roux", "Maja Novak",
  "Elena Ricci", "Ida Virtanen", "Mateo Silva", "Nora Lind", "Jonas Weber",
];
const MASKE_MAIL = "gast@example.com";
const MASKE_TEL = "+00 000 000000";

function arg(name, standard = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

const BASIS = arg("basis", "https://app.mynextdays.com").replace(/\/$/, "");
const LOGIN = arg("login");
const PASSWORT = arg("passwort", process.env.TOUR_PASSWORT);
const ZIEL = arg("ziel", "/tmp/tour");
const TOUR_ID = arg("tour", "pms-rundgang");

if (!LOGIN || !PASSWORT) {
  console.error(
    "Fehlt: --login und --passwort (oder TOUR_PASSWORT).\n" +
      "Das Demo-Konto ist der Aufnahmezugang, nicht ein Produktionskonto.",
  );
  process.exit(2);
}

/** Serialisiert die aktuelle Seite: CSS ausrollen, Assets sammeln, JS raus. */
async function serialisieren(page) {
  return page.evaluate(
    ({ fremd, namen, maskeMail, maskeTel }) => {
      // --- 1. Fremdes entfernen -------------------------------------------
      for (const sel of fremd) {
        document.querySelectorAll(sel).forEach((n) => n.remove());
      }
      // Skripte komplett: der Snapshot ist Markup, keine Anwendung. Damit
      // braucht der Player auch kein `allow-scripts` im Sandbox-Attribut.
      document.querySelectorAll("script, noscript").forEach((n) => n.remove());
      document.querySelectorAll("link[rel='canonical']").forEach((n) => n.remove());

      // --- 2. Maskierung --------------------------------------------------
      // Textknoten UND Attribute, sonst bleibt die echte Adresse im `title`.
      const mailRe = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
      const telRe = /\+\d[\d\s()/-]{7,}\d/g;
      let n = 0;
      const naechsterName = () => namen[n++ % namen.length];

      const lauf = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      );
      const knoten = [];
      while (lauf.nextNode()) knoten.push(lauf.currentNode);

      for (const k of knoten) {
        if (k.nodeType === Node.TEXT_NODE) {
          if (mailRe.test(k.nodeValue)) {
            k.nodeValue = k.nodeValue.replace(mailRe, maskeMail);
          }
          if (telRe.test(k.nodeValue)) {
            k.nodeValue = k.nodeValue.replace(telRe, maskeTel);
          }
        } else if (k.attributes) {
          for (const a of [...k.attributes]) {
            if (!a.value) continue;
            let v = a.value;
            if (mailRe.test(v)) v = v.replace(mailRe, maskeMail);
            if (telRe.test(v)) v = v.replace(telRe, maskeTel);
            if (v !== a.value) k.setAttribute(a.name, v);
          }
        }
      }
      // Gastnamen: die Anwendung kennzeichnet sie selbst — ohne Marker waere
      // jede Ersetzung geraten (und wuerde Objektnamen mittreffen).
      document.querySelectorAll("[data-gastname]").forEach((el) => {
        el.textContent = naechsterName();
      });

      // --- 3. Stylesheets ausrollen ---------------------------------------
      // `cssRules` faellt bei fremden Stylesheets in eine SecurityError; alles
      // Eigene ist gleiche Herkunft, deshalb greifbar. Tailwind erzeugt EINE
      // grosse Datei, CSS-in-JS mehrere <style>-Bloecke — beide landen hier.
      const teile = [];
      for (const sheet of document.styleSheets) {
        try {
          const regeln = [...sheet.cssRules].map((r) => r.cssText).join("\n");
          if (regeln) teile.push(regeln);
        } catch {
          // Nicht lesbar (fremde Herkunft) — die URL behalten, damit der
          // Snapshot nicht still ohne diese Stile dasteht.
          if (sheet.href) teile.push(`/* extern, nicht inlinebar: ${sheet.href} */`);
        }
      }

      // --- 4. Assets einsammeln (Pfade, nicht Inhalte) --------------------
      const assets = new Set();
      document.querySelectorAll("img[src]").forEach((i) => {
        if (i.src && !i.src.startsWith("data:")) assets.add(i.src);
      });
      const css = teile.join("\n");
      for (const m of css.matchAll(/url\((["']?)(https?:\/\/[^)"']+)\1\)/g)) {
        assets.add(m[2]);
      }

      return {
        html: document.documentElement.outerHTML,
        css,
        assets: [...assets],
        titel: document.title,
        breite: document.documentElement.scrollWidth,
        hoehe: document.documentElement.scrollHeight,
      };
    },
    {
      fremd: FREMD_SELEKTOREN,
      namen: ERSATZ_NAMEN,
      maskeMail: MASKE_MAIL,
      maskeTel: MASKE_TEL,
    },
  );
}

/** Fail-closed: findet der Job noch echte Daten, bricht er ab. */
function maskierungPruefen(html, seiteKey) {
  const mail = /[\w.+-]+@(?!example\.com)[\w-]+\.[\w.]{2,}/g;
  const tel = /\+(?!00 000)\d[\d\s()/-]{7,}\d/g;
  const gefunden = [
    ...new Set([...(html.match(mail) || []), ...(html.match(tel) || [])]),
  ];
  if (gefunden.length) {
    throw new Error(
      `Maskierung unvollstaendig auf "${seiteKey}": ${gefunden.slice(0, 5).join(", ")}` +
        `${gefunden.length > 5 ? ` (+${gefunden.length - 5})` : ""}\n` +
        "Ein Snapshot friert diese Daten dauerhaft oeffentlich ein. Abbruch.",
    );
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const kontext = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    locale: "de-DE",
    // Feste Zone: sonst tragen Snapshots die Zone des CI-Runners und zeigen
    // andere Uhrzeiten als die Anwendung im Betrieb (siehe admin/lib/datum.ts).
    timezoneId: "Europe/Copenhagen",
    reducedMotion: "reduce",
  });
  const page = await kontext.newPage();
  const ergebnis = { id: TOUR_ID, captureWidth: BREITE, minWidth: 900, pages: [] };

  try {
    // --- Anmelden ---------------------------------------------------------
    await page.goto(`${BASIS}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.fill("input[type='email'], input[name='email']", LOGIN);
    await page.fill("input[type='password'], input[name='password']", PASSWORT);
    await page.click("button[type='submit']");
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });
    console.log("angemeldet als", LOGIN);

    await mkdir(path.join(ZIEL, TOUR_ID), { recursive: true });

    for (const seite of SEITEN) {
      const url = `${BASIS}${seite.pfad}`;
      console.log(`\n→ ${seite.key} (${url})`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      // Nachladende Inhalte: die Oberflaeche holt Zahlen und Listen nach dem
      // ersten Rendern. Ohne diese Ruhe zeigt der Snapshot Skelett-Platzhalter.
      await page.waitForTimeout(3500);

      const roh = await serialisieren(page);
      // Stile als EINE Datei je Seite; der Player laedt sie per <link>.
      const cssName = `${seite.key}.css`;
      const html = roh.html.replace(
        "</head>",
        `<link rel="stylesheet" href="./${cssName}">\n</head>`,
      );
      maskierungPruefen(html, seite.key);

      await writeFile(path.join(ZIEL, TOUR_ID, `${seite.key}.html`), html, "utf8");
      await writeFile(path.join(ZIEL, TOUR_ID, cssName), roh.css, "utf8");

      ergebnis.pages.push({
        key: seite.key,
        name: seite.name,
        file: `${seite.key}.html`,
        css: cssName,
        sourceUrl: seite.pfad,
        capturedAt: new Date().toISOString().slice(0, 10),
        dimensions: { width: roh.breite, height: roh.hoehe },
        htmlHash: createHash("sha256").update(html).digest("hex").slice(0, 12),
        assets: roh.assets.length,
      });
      console.log(
        `   ${(html.length / 1024).toFixed(0)} KB HTML · ` +
          `${(roh.css.length / 1024).toFixed(0)} KB CSS · ${roh.assets.length} Assets`,
      );
    }

    await writeFile(
      path.join(ZIEL, TOUR_ID, "tour.json"),
      JSON.stringify(ergebnis, null, 2),
      "utf8",
    );
    console.log(`\nFertig: ${ZIEL}/${TOUR_ID} (${ergebnis.pages.length} Seiten)`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("\nFEHLGESCHLAGEN:", e.message);
  process.exit(1);
});
