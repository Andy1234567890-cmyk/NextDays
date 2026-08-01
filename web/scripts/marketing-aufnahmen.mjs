// Nimmt echte Screenshots der App für die Marketing-Seite auf.
//
// Die Bilder zeigen den Demo-Bestand aus `scripts/demo/seed_demo.py` — belegte
// Kalender, Buchungen über alle Kanäle, echte Objektfotos. Deshalb sind es
// „Live-Fotos" und keine nachgebauten Attrappen.
//
// Bewusst NICHT im Bild: Browser-Tabs, Adresszeile, echte Postfächer. Der
// Fensterrahmen ist ein Gestaltungselement der Marketing-Seite, nicht ein
// abfotografiertes Chrome-Fenster mit „localhost:3000".
//
// Voraussetzungen: FastAPI (Port 8000) und das Dashboard (Port 3000) laufen,
// der Demo-Bestand ist geseedet.
//
// Aufruf (aus web/):
//   node scripts/marketing-aufnahmen.mjs --passwort '<DEMO_PASSWORT>'
//   node scripts/marketing-aufnahmen.mjs --passwort '…' --sprachen de,en --nur belegungsplan
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import sharp from "sharp";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HIER, "..", "..");
const ZIEL = path.join(REPO, "marketing", "public", "marketing", "app");

const BASIS = process.env.DEMO_BASIS_URL ?? "http://localhost:3000";
const LOCALE_COOKIE = "nd_locale";

// Retina: die Marketing-Seite zeigt die Bilder auf halber Breite, damit sie auf
// jedem Display scharf bleiben.
const VIEWPORT = { width: 1600, height: 1000 };
const SKALIERUNG = 2;

const KONTEN = {
  nordlicht: "merle.ahrens@mynextdays.com",
  seeblick: "jonas.reimers@mynextdays.com",
};

// Der Belegungsplan lädt Buchungen und Tagesdaten nachgelagert. Ein Auslöser
// direkt nach dem Rendern erwischt ein leeres Raster („0 %", überall „–") —
// technisch korrekt und als Verkaufsbild wertlos. Darum auf eine Kennzahl > 0
// warten statt auf eine feste Zeit.
async function warteAufBelegung(seite, sekunden = 60) {
  const kennzahl = seite.getByText(/\d+\s*%/).first();
  for (let versuch = 0; versuch < sekunden; versuch += 1) {
    const text = await kennzahl.textContent().catch(() => null);
    if (text && !/^0\s*%$/.test(text.trim())) {
      await seite.waitForTimeout(2_000); // Balken zu Ende zeichnen lassen
      return;
    }
    await seite.waitForTimeout(1_000);
  }
  throw new Error("Belegungsplan zeigt nach der Wartezeit weiter 0 % — keine Daten?");
}

// Eine Aufnahme = eine Route plus optionale Vorbereitung (Filter setzen, auf
// Inhalte warten). `warten` bekommt die Seite und darf klicken/tippen.
const AUFNAHMEN = [
  {
    name: "belegungsplan",
    konto: "nordlicht",
    pfad: "/kalender",
    warten: async (seite) => {
      await seite.getByText("Strandhaus Dünenblick").first().waitFor({ timeout: 60_000 });
      await warteAufBelegung(seite);
    },
  },
  {
    name: "belegungsplan-hotel",
    konto: "seeblick",
    pfad: "/kalender",
    warten: async (seite) => {
      await seite.getByText("Doppelzimmer 201").first().waitFor({ timeout: 60_000 });
      // 12 Zimmer mit 595 Buchungen brauchen spuerbar laenger als 8 Ferienobjekte.
      await warteAufBelegung(seite, 120);
    },
  },
  {
    name: "objekte",
    konto: "nordlicht",
    pfad: "/objekte",
    warten: async (seite) => {
      await seite.getByText("Finca Son Mirabó").first().waitFor({ timeout: 90_000 });
      await seite.waitForTimeout(2_000); // Objektfotos fertig laden lassen
    },
  },
  {
    name: "reservierungen",
    konto: "nordlicht",
    pfad: "/reservierungen",
    warten: async (seite) => {
      // Die Liste startet mit „Laedt ..."; erst mit einer echten Zeile ist sie da.
      await seite.locator("table tbody tr").nth(2).waitFor({ timeout: 90_000 });
      await seite.waitForTimeout(2_000);
    },
  },
  {
    name: "dashboard",
    konto: "nordlicht",
    pfad: "/",
    // Der Einrichtungs-Hinweis f\u00fcr Stripe-Auszahlungen geh\u00f6rt zum Konto des
    // Demo-Betriebs, nicht zum Produkt \u2014 er w\u00fcrde im Verkaufsbild wie ein
    // Fehler wirken. Nur DIESE Karte wird ausgeblendet, an den Kennzahlen
    // darunter \u00e4ndert sich nichts.
    ausblenden: ["Zahlungen noch nicht"],
    warten: async (seite) => {
      await seite.getByText(/\u20ac/).first().waitFor({ timeout: 90_000 });
      await seite.waitForTimeout(3_000);
    },
  },
  {
    name: "kanaele",
    konto: "nordlicht",
    pfad: "/channels",
    // Die Route braucht im Dev-Server deutlich länger als die übrigen
    // (~50 s bis zur ersten Antwort) — mit dem Standardlimit läuft sie in einen
    // Timeout, obwohl die Seite danach normal rendert.
    zeitlimit: 180_000,
    warten: async (seite) => seite.waitForTimeout(4_000),
  },
  {
    name: "dynamic-pricing",
    konto: "nordlicht",
    pfad: "/dynamic-pricing",
    warten: async (seite) => seite.waitForTimeout(2_500),
  },
  {
    name: "mobil-kalender",
    konto: "nordlicht",
    pfad: "/kalender",
    viewport: { width: 430, height: 932 },
    warten: async (seite) => warteAufBelegung(seite),
  },
];

function argument(name, standard) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : standard;
}

async function anmelden(browser, email, passwort) {
  const kontext = await browser.newContext({ viewport: VIEWPORT });
  // Der Dev-Server teilt sich die Maschine mit allem anderen, was gerade läuft;
  // die 30-Sekunden-Voreinstellung von Playwright reicht dann für einen simplen
  // Klick nicht aus.
  kontext.setDefaultTimeout(120_000);
  const seite = await kontext.newPage();
  // Großzügiges Limit: der Dev-Server kompiliert Routen beim ersten Aufruf.
  await seite.goto(`${BASIS}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  // Erst nach der Hydration tippen: das Formular ist controlled, und ein vor
  // der Hydration gesetzter DOM-Wert wird von React wieder auf "" gezogen —
  // das Formular schickt dann eine leere E-Mail ab.
  const feldEmail = seite.locator('input[type="email"]');
  const feldPasswort = seite.locator('input[type="password"]');
  await feldEmail.waitFor({ state: "visible" });
  await seite.waitForTimeout(2_500);
  await feldEmail.fill(email);
  await feldPasswort.fill(passwort);
  if ((await feldEmail.inputValue()) !== email) {
    throw new Error("Login-Formular übernimmt die Eingabe nicht — Hydration abwarten.");
  }
  await seite.locator('button[type="submit"]').click();
  await seite.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 90_000 });
  const zustand = await kontext.storageState();
  await kontext.close();
  return zustand;
}

async function anmeldenMitWiederholung(browser, email, passwort) {
  // Zwei Versuche mit Pause: das Auth-Ratelimit ist 10 Anmeldungen pro Minute
  // und IP, und der Dev-Server antwortet unter Last schwankend. Ein
  // Fehlschlag hier würde sonst die ganze Matrix verwerfen.
  for (const versuch of [1, 2, 3]) {
    try {
      return await anmelden(browser, email, passwort);
    } catch (fehler) {
      console.warn(`  ! Anmeldung ${email}, Versuch ${versuch}: ${fehler.message.split("\n")[0]}`);
      if (versuch === 3) throw fehler;
      await new Promise((fertig) => setTimeout(fertig, 20_000));
    }
  }
  return null;
}

async function aufnehmen(browser, zustand, aufnahme, sprache, thema) {
  const kontext = await browser.newContext({
    storageState: zustand,
    viewport: aufnahme.viewport ?? VIEWPORT,
    deviceScaleFactor: SKALIERUNG,
    locale: sprache,
    colorScheme: thema,
    // Ein System, das „Bewegung reduzieren" meldet, friert Animationen ein —
    // sonst erwischt der Auslöser halb eingeblendete Balken.
    reducedMotion: "reduce",
  });
  kontext.setDefaultTimeout(120_000);
  await kontext.addCookies([
    { name: LOCALE_COOKIE, value: sprache, url: BASIS },
  ]);
  await kontext.addInitScript((gewaehlt) => {
    // next-themes liest den Schlüssel beim ersten Render; ohne ihn gewinnt
    // „system" und das Bild hätte das Thema des Rechners, nicht das gewünschte.
    window.localStorage.setItem("theme", gewaehlt);
    // Andys Mikrofon-Abfrage legt sich sonst über die rechte untere Ecke.
    // „denied" blendet die Karte vollständig aus (lib/voice-consent.ts).
    window.localStorage.setItem("nd_voice_consent", "denied");
  }, thema);

  const seite = await kontext.newPage();
  // Nicht auf "networkidle" warten: die App hält Realtime-Verbindungen offen,
  // der Zustand tritt nie ein. Was fertig sein muss, sagt `warten` konkret.
  await seite.goto(`${BASIS}${aufnahme.pfad}`, {
    waitUntil: "domcontentloaded",
    timeout: aufnahme.zeitlimit ?? 180_000,
  });
  await aufnahme.warten?.(seite);

  for (const text of aufnahme.ausblenden ?? []) {
    await seite.evaluate((gesucht) => {
      // Kleinster Container, der den Text enthält — so verschwindet die Karte,
      // nicht der halbe Seitenbaum darüber.
      const treffer = Array.from(document.querySelectorAll("div, section, aside"))
        .filter((el) => el.textContent?.includes(gesucht))
        .sort((a, b) => a.textContent.length - b.textContent.length);
      if (treffer.length > 0) {
        const rahmen = treffer[0].closest("[class*='border']");
        (rahmen ?? treffer[0]).style.setProperty("display", "none");
      }
    }, text);
  }

  // Die Dev-Overlay-Plakette von Next.js („N · 1 Issue") liegt unten links über
  // dem Profil und landete so mitten im Verkaufsbild. Sie gehört zum Dev-Server,
  // nicht zur App — vor dem Auslösen entfernen.
  await seite.evaluate(() => {
    for (const el of document.querySelectorAll(
      "nextjs-portal, [data-nextjs-toast], #__next-build-watcher",
    )) {
      el.remove();
    }
  });

  // Als WebP ablegen statt als PNG: die Objektliste zeigt acht Fotos
  // nebeneinander, das komprimiert PNG schlecht (2,6 MB gegen 0,6 MB bei
  // sichtbar gleicher Schaerfe). Die Bilder liegen im Repo — jede Aufnahmerunde
  // wuerde sonst rund 20 MB Historie anlegen.
  const rohdaten = await seite.screenshot({ animations: "disabled" });
  const datei = path.join(ZIEL, `${aufnahme.name}-${thema}-${sprache}@2x.webp`);
  await sharp(rohdaten).webp({ quality: 92 }).toFile(datei);
  await kontext.close();
  return datei;
}

async function main() {
  const passwort = argument("passwort") ?? process.env.DEMO_PASSWORT;
  if (!passwort) {
    console.error(
      "Passwort der Demo-Logins fehlt: --passwort '…' oder DEMO_PASSWORT setzen.\n" +
      "Es wird beim Lauf von scripts/demo/seed_demo.py ausgegeben.",
    );
    process.exit(1);
  }
  const sprachen = (argument("sprachen", "de,en")).split(",").map((s) => s.trim());
  const themen = (argument("themen", "light,dark")).split(",").map((s) => s.trim());
  const nur = argument("nur");

  await mkdir(ZIEL, { recursive: true });

  // Kein Playwright-eigener Chromium-Download: das installierte Google Chrome
  // reicht und hält die Werkzeugkette schlank.
  const browser = await chromium.launch({ channel: "chrome" });
  const zustaende = {};
  const geschrieben = [];
  const fehlend = [];

  try {
    for (const [konto, email] of Object.entries(KONTEN)) {
      zustaende[konto] = await anmeldenMitWiederholung(browser, email, passwort);
      console.log(`angemeldet: ${email}`);
    }

    for (const aufnahme of AUFNAHMEN) {
      if (nur && aufnahme.name !== nur) continue;
      for (const sprache of sprachen) {
        for (const thema of themen) {
          // Ein zweiter Versuch je Bild: der Dev-Server ist unter Last
          // unterschiedlich schnell, und ein einzelner Ausrutscher soll nicht
          // die ganze Matrix (bis zu 32 Aufnahmen) verwerfen.
          let datei = null;
          for (const versuch of [1, 2]) {
            try {
              datei = await aufnehmen(
                browser, zustaende[aufnahme.konto], aufnahme, sprache, thema,
              );
              break;
            } catch (fehler) {
              console.warn(
                `  ! ${aufnahme.name}-${thema}-${sprache}: Versuch ${versuch} ` +
                `fehlgeschlagen (${fehler.message.split("\n")[0]})`,
              );
            }
          }
          if (!datei) {
            fehlend.push(`${aufnahme.name}-${thema}-${sprache}`);
            continue;
          }
          geschrieben.push(path.relative(REPO, datei));
          console.log(`  ${path.relative(REPO, datei)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  // Verzeichnis-Index für die Marketing-Seite: was WIRKLICH auf der Platte
  // liegt, nicht was dieser Lauf vorhatte. Die Komponente wählt daraus die
  // beste vorhandene Variante — so bleibt die Seite heil, auch wenn eine
  // Sprach-/Theme-Kombination (noch) fehlt, statt ein 404-Bild zu zeigen.
  const vorhanden = (await readdir(ZIEL))
    .filter((datei) => datei.endsWith("@2x.webp"))
    .sort();
  await writeFile(
    path.join(REPO, "marketing", "lib", "app-aufnahmen.json"),
    `${JSON.stringify(vorhanden, null, 2)}\n`,
    "utf8",
  );
  console.log(`\n${geschrieben.length} Aufnahmen in ${path.relative(REPO, ZIEL)}`);
  if (fehlend.length > 0) {
    // Fehlende Bilder laut benennen: ein stilles Loch fällt erst auf der
    // Website auf.
    console.error(`FEHLEND (${fehlend.length}): ${fehlend.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
