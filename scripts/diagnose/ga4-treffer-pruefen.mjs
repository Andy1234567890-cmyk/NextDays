// Prüft, ob GA4 nach der Einwilligung WIRKLICH einen Messtreffer sendet.
//
// WARUM ES DAS BRAUCHT: Am 27.08.2026 wurde dreimal hintereinander die falsche
// Ursache für „keine Treffer" gefunden — CSP, leere Mess-ID, Zeitpunkt des
// ersten page_view. Jedes Mal, weil `window.dataLayer` VOLLSTÄNDIG aussah: das
// Einreihen der Befehle funktionierte, nur das Abholen nicht. Der eigentliche
// Fehler war ein Rest-Parameter statt `arguments` im gtag-Stub, wodurch gtag.js
// jeden Befehl in seinen Legacy-Zweig schob und in einem leeren try/catch
// verwarf — ohne eine Zeile in der Konsole.
//
// Die Lehre steht hier als Code: Beweis ist AUSSCHLIESSLICH ein echter Request
// an `google-analytics.com/g/collect`. Nicht der Inhalt der dataLayer, und auch
// nicht der Google Tag Assistant — der verbindet sich beim Seitenaufbau und
// sieht ein erst nach dem Einwilligungsklick nachgeladenes Tag
// systembedingt nicht (Google dokumentiert das selbst als Ursache für
// „keine Treffer": „Das Google-Tag-Skript wird geladen, nachdem Tag Assistant
// versucht, sich zu verbinden").
//
// WIE gemessen wird, ist dabei so entscheidend wie WAS — Lehre vom 27.08.2026,
// als eine Prüfung mit `seite.on("request")` einen Fehler MELDETE, den es nicht
// gab: „jede per Klick geöffnete Seite, die der Besucher binnen 5 Sekunden
// verlässt, wird nicht gezählt". Der Grund war die Messung, nicht die Seite.
// GA4 hält Ereignisse bis zu fünf Sekunden in einer Warteschlange und leert sie
// beim `pagehide` per `navigator.sendBeacon` — und genau diesen Beacon erfasst
// Playwright nicht mehr, weil die Seite dabei schon verschwindet
// (microsoft/playwright#26660). Vier Messreihen sahen deshalb einen Verlust,
// den es nicht gab.
// Dieses Skript hängt sich stattdessen IN DER SEITE an `sendBeacon`, `fetch`
// und `XMLHttpRequest` und protokolliert nach `localStorage`. Der überlebt die
// Navigation, also ist auch der Treffer sichtbar, den erst das Verlassen der
// Seite auslöst. Wer diese Prüfung auf `seite.on("request")` zurückbaut, baut
// den Fehlalarm von oben wieder ein.
//
// Geprüft wird:
//   1. VOR der Einwilligung: kein TREFFER und kein COOKIE. Das Tag selbst darf
//      laden (Einwilligungsmodus), der Meta-Pixel nicht.
//   2. NACH der Einwilligung: mindestens ein `/g/collect` mit `en=page_view`.
//   3. Der Einwilligungsstand im Treffer (`gcs`): G111 heißt „analytics
//      erlaubt", G100 heißt „alles verweigert" — Letzteres wäre ein Treffer,
//      der zwar rausgeht, aber ohne Zustimmung gezählt würde.
//   4. Jeder dataLayer-Eintrag ist `[object Arguments]`, nie `[object Array]`.
//      Das ist die Regressionsprobe für genau den Bug von oben.
//   5. Beim Widerruf: `gcs` fällt zurück und `_ga` verschwindet.
//   6. JEDE der geprüften Unterseiten sendet GENAU EINEN page_view — nicht null
//      (dann zählt nur die Einstiegsseite) und nicht zwei (Doppelzählung).
//   7. Google ANTWORTET auf den Treffer mit 204. Ein Request, der rausgeht,
//      ist nur der halbe Beweis; gtag.js liest die Antwort nie und wiederholt
//      nichts, ein abgelehnter Treffer wäre also lautlos verloren.
//   8. Der Treffer trägt die SPRACHE, und ein Sprachwechsel zählt. Ohne
//      Sprachpräfix in der URL sind die 24 Fassungen sonst nicht
//      unterscheidbar (siehe lib/analytics.ts).
//   9. Ein KURZBESUCH zählt: eine per Klick geöffnete Seite, die sofort wieder
//      verlassen wird, muss ihren Treffer beim `pagehide` noch absetzen.
//
// AUFRUF (Playwright liegt nicht im Repo, siehe einwilligung-e2e.mjs):
//   node scripts/diagnose/ga4-treffer-pruefen.mjs [https://www.mynextdays.com]
//
// MIT www AUFRUFEN: der Apex leitet seit dem 03.09.2026 per 308 auf www um
// (marketing/next.config.ts). Ein Lauf gegen den Apex misst die
// Weiterleitung statt der Seite.
import { chromium } from "playwright";

const BASIS = process.argv[2] ?? "http://localhost:3001";
const SPEICHER_SCHLUESSEL = "nd_consent";
const EINWILLIGUNG_FASSUNG = 2;

let fehler = 0;
const pruefe = (name, bedingung, zusatz = "") => {
  const zeichen = bedingung ? "OK  " : "FEHL";
  if (!bedingung) fehler += 1;
  console.log(`  ${zeichen} ${name}${zusatz ? ` — ${zusatz}` : ""}`);
};

const browser = await chromium.launch();
const kontext = await browser.newContext({ locale: "de-DE" });

/** Schlüssel, unter dem der In-Seite-Hook sein Protokoll ablegt. */
const PROTOKOLL_SCHLUESSEL = "__ga4_pruefung";

// Der Hook läuft VOR jedem Seitenskript und überlebt jede Navigation, weil sein
// Protokoll im localStorage liegt (siehe Kopfkommentar: `seite.on("request")`
// verpasst den Beacon beim Verlassen der Seite).
await kontext.addInitScript((schluessel) => {
  const merken = (url, methode) => {
    try {
      const text = String(url);
      if (!text.includes("/g/collect") && !text.includes("google-analytics.com/collect")) return;
      const p = new URL(text, location.href).searchParams;
      const liste = JSON.parse(localStorage.getItem(schluessel) ?? "[]");
      liste.push({ ereignis: p.get("en"), gcs: p.get("gcs"), dp: p.get("dp"), sprache: p.get("ep.sprache"), methode });
      localStorage.setItem(schluessel, JSON.stringify(liste));
    } catch {
      // Das Protokoll darf den Hauptpfad NIE kippen — es misst ihn nur.
    }
  };
  const beaconOrig = navigator.sendBeacon?.bind(navigator);
  if (beaconOrig) {
    navigator.sendBeacon = (url, daten) => {
      merken(url, "beacon");
      return beaconOrig(url, daten);
    };
  }
  const fetchOrig = window.fetch.bind(window);
  window.fetch = (eingabe, init) => {
    merken(typeof eingabe === "string" ? eingabe : eingabe?.url, init?.method ?? "fetch");
    return fetchOrig(eingabe, init);
  };
  const openOrig = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(methode, url, ...rest) {
    merken(url, methode);
    return openOrig.call(this, methode, url, ...rest);
  };
}, PROTOKOLL_SCHLUESSEL);

const seite = await kontext.newPage();

/** Liest das In-Seite-Protokoll aus und leert es. */
const protokollHolen = async (ziel = seite) => {
  const eintraege = await ziel.evaluate((schluessel) => {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "[]");
    localStorage.removeItem(schluessel);
    return roh;
  }, PROTOKOLL_SCHLUESSEL);
  return eintraege;
};

/** Alle Requests an Google-Messendpunkte, mit ausgelesenen Parametern. */
const treffer = [];
const fremdskripte = [];
/** Antwortstatus je Treffer — nur so ist belegt, dass Google ihn ANNIMMT. */
const antworten = [];
seite.on("request", (r) => {
  const url = r.url();
  if (url.includes("/g/collect") || url.includes("google-analytics.com/collect")) {
    const p = new URL(url).searchParams;
    treffer.push({ ereignis: p.get("en"), gcs: p.get("gcs"), url });
  }
  if (
    url.includes("googletagmanager.com") ||
    url.includes("google-analytics.com") ||
    url.includes("connect.facebook.net") ||
    url.includes("facebook.com/tr")
  ) {
    fremdskripte.push(url.slice(0, 80));
  }
});
seite.on("response", (r) => {
  if (r.url().includes("/g/collect")) antworten.push(r.status());
});

console.log(`\n== 1. Vor der Einwilligung (${BASIS}) ==`);
await seite.goto(BASIS, { waitUntil: "networkidle" });
await seite.waitForTimeout(2000);
// WAS HIER GEPRÜFT WIRD, HAT SICH AM 27.08.2026 GEÄNDERT — mit der Umstellung
// auf den Einwilligungsmodus („Advanced Consent Mode",
// components/google-tag.tsx) LÄDT das Tag bewusst vor der Einwilligung. Die
// frühere Prüfung „kein Request an Google" schlug daher zu Recht fehl und wäre
// falsch, wenn sie bliebe.
//
// Entscheidend ist seither nicht, OB das Tag lädt, sondern was es tut:
//   · KEIN Messtreffer (`/g/collect`) — auch kein „cookieloser Ping", den
//     Google für diesen Modus beschreibt
//   · KEIN Cookie
//   · der Meta-Pixel lädt weiterhin GAR NICHT — er hat keinen
//     Einwilligungsmodus, ohne Zustimmung darf er nicht existieren
const vorherProtokoll = await protokollHolen();
pruefe(
  "kein Messtreffer ohne Einwilligung",
  treffer.length === 0 && vorherProtokoll.length === 0,
  treffer.length || vorherProtokoll.length
    ? [
        ...treffer.map((t) => `${t.ereignis}(gcs=${t.gcs})`),
        ...vorherProtokoll.map((t) => `${t.ereignis}@${t.methode}`),
      ].join(", ")
    : "",
);
const cookiesVorher = await seite.evaluate(() =>
  document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_fbp"),
);
pruefe(
  "kein Mess-/Werbe-Cookie ohne Einwilligung",
  cookiesVorher.length === 0,
  cookiesVorher.join(", "),
);
pruefe(
  "Meta-Pixel lädt nicht ohne Einwilligung",
  fremdskripte.filter((u) => u.includes("facebook")).length === 0,
  fremdskripte.filter((u) => u.includes("facebook")).join(", "),
);

console.log("\n== 2. Nach erteilter Einwilligung ==");
await seite.evaluate(
  ([schluessel, fassung]) => {
    window.localStorage.setItem(
      schluessel,
      JSON.stringify({
        fassung,
        zeitpunkt: new Date().toISOString(),
        auswahl: { funktional: true, analytisch: true, marketing: false },
      }),
    );
  },
  [SPEICHER_SCHLUESSEL, EINWILLIGUNG_FASSUNG],
);
treffer.length = 0;
await seite.reload({ waitUntil: "networkidle" });
// gtag.js braucht einen Moment, um die Warteschlange abzuarbeiten und den
// Treffer abzuschicken. Kein fester Schlaf: auf den Request warten.
await seite
  .waitForRequest((r) => r.url().includes("/g/collect"), { timeout: 8000 })
  .catch(() => null);
await seite.waitForTimeout(500);

pruefe("mindestens ein /g/collect", treffer.length > 0);
const seitenaufruf = treffer.find((t) => t.ereignis === "page_view");
pruefe(
  "darunter ein page_view",
  Boolean(seitenaufruf),
  treffer.length ? `gesehen: ${treffer.map((t) => t.ereignis).join(", ")}` : "keiner",
);
if (seitenaufruf) {
  // gcs=G1xy: x = ad_storage, y = analytics_storage. G111 = beide erlaubt,
  // G101 = nur analytics, G100 = beide verweigert.
  pruefe(
    "Einwilligungsstand im Treffer erlaubt Statistik",
    seitenaufruf.gcs === "G101" || seitenaufruf.gcs === "G111",
    `gcs=${seitenaufruf.gcs}`,
  );
}

// Google muss den Treffer ANNEHMEN — 204 ist die Erfolgsantwort von
// /g/collect. Das ist eine eigene Prüfung, weil gtag.js die Antwort nie liest
// und nichts wiederholt: ein abgelehnter Treffer wäre lautlos verloren,
// während „der Request ging raus" grün bliebe.
//
// Nicht-204 heißt NICHT automatisch „kaputt" — erst nachmessen, dann handeln.
// Am 27.08.2026 meldete ein Chrome-Erweiterungs-Netzwerkmonitor für denselben
// Request reproduzierbar 503, während Playwright 204 mit vollständigen
// Google-Headern sah (`server: Golfe2`, `access-control-allow-origin`). Der
// Monitor lag falsch, nicht die Seite.
pruefe(
  "Google antwortet mit 204",
  antworten.length > 0 && antworten.every((s) => s === 204),
  antworten.length ? `Status: ${antworten.join(", ")}` : "keine Antwort erfasst",
);

// Die Sprache MUSS im Treffer stehen, sonst sind die 24 Fassungen in der
// Auswertung nicht unterscheidbar — die URL trägt keine.
const nachEinwilligung = await protokollHolen();
const mitSprache = nachEinwilligung.filter((t) => t.ereignis === "page_view" && t.sprache);
pruefe(
  "page_view trägt den Sprachparameter",
  mitSprache.length > 0,
  mitSprache.length
    ? `sprache=${mitSprache[0].sprache}`
    : `keiner von ${nachEinwilligung.length} Einträgen hat ep.sprache`,
);

// Mehrere Seiten prüfen, nicht nur die Einstiegsseite.
//
// WARUM: Die erste Fassung dieses Skripts prüfte NUR die Startseite und gab
// „alle Prüfungen bestanden" zurück, während `/preise`, `/funktionen`,
// `/kontakt` und `/ueber-uns` keinen einzigen Treffer sendeten (27.08.2026,
// Ursache war ein useRef-Guard in einwilligungs-dienste.tsx). Ein Zähler, der
// nur auf einer Seite geprüft wird, ist nicht geprüft: der Fehler „nur die
// Einstiegsseite zählt" sieht auf genau dieser Seite fehlerfrei aus.
console.log("\n== 3. Folgeseiten ==");
const UNTERSEITEN = ["/preise", "/funktionen", "/kontakt", "/ueber-uns"];
for (const pfad of UNTERSEITEN) {
  await protokollHolen();
  await seite.goto(BASIS + pfad, { waitUntil: "networkidle" });
  await seite
    .waitForRequest((r) => r.url().includes("/g/collect"), { timeout: 6000 })
    .catch(() => null);
  await seite.waitForTimeout(300);
  const eigene = (await protokollHolen()).filter((t) => t.ereignis === "page_view");
  pruefe(
    `${pfad} sendet einen page_view`,
    eigene.length === 1,
    eigene.length > 1 ? `ACHTUNG: ${eigene.length}-mal — Doppelzählung` : "",
  );
}

console.log("\n== 3b. Kurzbesuch: sofort weitergeklickt ==");
// GA4 hält Ereignisse bis zu fünf Sekunden in einer Warteschlange und leert sie
// beim `pagehide` per sendBeacon. Diese Prüfung deckt genau den Fall ab, in dem
// jemand eine Seite anklickt und sofort weitergeht — für eine Marketing-Seite
// ist das die Ausstiegsseite JEDES Besuchs. Sie ist der Grund für den
// In-Seite-Hook: mit `seite.on("request")` gemessen sähe sie einen Verlust, den
// es nicht gibt (siehe Kopfkommentar).
await seite.goto(BASIS + "/", { waitUntil: "networkidle" });
await seite.waitForTimeout(2500);
await protokollHolen();
const kurzZiel = "/preise";
const verweis = await seite.$(`a[href="${kurzZiel}"]`);
if (!verweis) {
  pruefe(`Kurzbesuch ${kurzZiel}`, false, "kein Link im DOM — Prüfung nicht durchgeführt");
} else {
  await verweis.click();
  // Warten, bis der `page_view` EINGEREIHT ist — nicht eine feste Zeitspanne.
  // Eine feste Wartezeit misst zwei Dinge gleichzeitig: wie schnell React den
  // Effekt ausführt und ob GA4 seine Warteschlange beim Verlassen leert. Mit
  // 300 ms fiel diese Prüfung deshalb mal grün und mal rot aus, ohne dass sich
  // etwas geändert hatte — ein flatterndes Gate ist schlimmer als keines, weil
  // man sein Rot irgendwann wegklickt.
  // Was React noch nicht gemeldet hat, kann GA4 nicht senden; das wäre ein
  // ANDERER Fehler. Geprüft wird hier nur die Warteschlange.
  const eingereiht = await seite
    .waitForFunction(
      (ziel) =>
        (window.dataLayer ?? []).some((eintrag) => {
          const teile = Array.from(eintrag);
          return (
            teile[0] === "event" && teile[1] === "page_view" && teile[2]?.page_path === ziel
          );
        }),
      kurzZiel,
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!eingereiht) {
    pruefe(
      `Kurzbesuch ${kurzZiel} wird gezählt`,
      false,
      "der page_view wurde nie eingereiht — der Zähler meldet die Seite gar nicht",
    );
  } else {
    // Sofort weg, ohne weitere Wartezeit: der Treffer steht jetzt garantiert in
    // GA4s Warteschlange und noch nicht im Netz. Vollnavigation wie bei einem
    // echten Besucher — sie löst `pagehide` aus, bei dem gtag.js die
    // Warteschlange per sendBeacon leert.
    await seite.goto(BASIS + "/kontakt", { waitUntil: "domcontentloaded" });
    await seite.waitForTimeout(1200);
    const kurz = (await protokollHolen()).filter(
      (t) => t.ereignis === "page_view" && t.dp === kurzZiel,
    );
    pruefe(
      `Kurzbesuch ${kurzZiel} wird gezählt`,
      kurz.length > 0,
      kurz.length ? `per ${kurz[0].methode}` : "Treffer blieb in der Warteschlange",
    );
  }
}

console.log("\n== 3c. Sprachwechsel ==");
// Diese App hat KEIN Sprachpräfix in der URL — der Wechsel setzt das
// nd_locale-Cookie und ruft `router.refresh()`, der Pfad bleibt gleich. Ohne
// die Sprache in Effekt-Abhängigkeit und Zähl-Schlüssel ist er unsichtbar
// (gemessen am 27.08.2026: Wechsel de → el auf /preise sendete NICHTS).
//
// Gemessen wird über den ECHTEN Umschalter, nicht über Cookie setzen +
// `reload()`. Ein Reload ist eine Vollnavigation — dabei zählt die Seite
// ohnehin neu, die Prüfung wäre grün und der Fehler bliebe drin. Genau das
// unterscheidet diesen Test von einer Attrappe.
await seite.goto(BASIS + "/preise", { waitUntil: "networkidle" });
await seite.waitForTimeout(2500);
const spracheVorher = await seite.evaluate(() => document.documentElement.lang);
await protokollHolen();
const umschalter = await seite.$('[data-testid="sprach-umschalter"]');
if (umschalter) await umschalter.click();
await seite.waitForTimeout(800);
// Die Einwilligungsleiste trägt EBENFALLS `role="dialog"`. Sie ist an dieser
// Stelle zu, weil die Zustimmung oben im localStorage steht — aber verlassen
// wird sich darauf nicht: steht mehr als ein Dialog offen, bricht die Prüfung
// laut ab, statt still in den falschen zu greifen (Wurzel 5). Ohne diesen
// Zähler klickte die Probe am 27.08.2026 in den Cookie-Dialog und meldete
// „Sprache unverändert" — ein Fehlalarm, der wie ein Befund aussah.
const dialoge = await seite.$$('[role="dialog"]');
const andereWahl =
  dialoge.length === 1
    ? await seite.$('[role="dialog"] li button:not([aria-current="true"])')
    : null;
if (dialoge.length > 1) {
  pruefe(
    "Sprachwechsel zählt",
    false,
    `${dialoge.length} Dialoge offen — Auswahl nicht eindeutig, Prüfung NICHT durchgeführt`,
  );
} else if (!andereWahl) {
  pruefe(
    "Sprachwechsel zählt",
    false,
    "Sprachumschalter nicht bedienbar — Prüfung NICHT durchgeführt, nicht bestanden",
  );
} else {
  await andereWahl.click();
  // `router.refresh()` rendert serverseitig neu; kein Ladeereignis, auf das man
  // warten könnte — deshalb feste Wartezeit über der 5-Sekunden-Warteschlange.
  await seite.waitForTimeout(6000);
  const spracheNachher = await seite.evaluate(() => document.documentElement.lang);
  const nachWechsel = (await protokollHolen()).filter((t) => t.ereignis === "page_view");
  pruefe(
    `Sprachwechsel ${spracheVorher} → ${spracheNachher} zählt`,
    spracheNachher !== spracheVorher && nachWechsel.length > 0,
    nachWechsel.length
      ? `sprache=${nachWechsel.map((t) => t.sprache ?? "(keine)").join(", ")}`
      : "kein Treffer — die Sprachfassungen sind in der Auswertung nicht unterscheidbar",
  );
  pruefe(
    "der Treffer trägt die NEUE Sprache",
    nachWechsel.some((t) => t.sprache === spracheNachher),
    nachWechsel.map((t) => t.sprache ?? "(keine)").join(", "),
  );
}

console.log("\n== 4. Regressionsprobe: dataLayer-Einträge sind Arguments ==");
const formen = await seite.evaluate(() =>
  (window.dataLayer ?? []).map((e) => Object.prototype.toString.call(e)),
);
const arrays = formen.filter((f) => f === "[object Array]").length;
pruefe(
  "kein Eintrag ist ein echtes Array",
  arrays === 0,
  arrays ? `${arrays} von ${formen.length} sind [object Array] — der gtag-Stub schiebt kein arguments` : `${formen.length} Einträge geprüft`,
);

console.log("\n== 5. Widerruf ==");
await seite.evaluate(
  ([schluessel, fassung]) => {
    window.localStorage.setItem(
      schluessel,
      JSON.stringify({
        fassung,
        zeitpunkt: new Date().toISOString(),
        auswahl: { funktional: false, analytisch: false, marketing: false },
      }),
    );
    window.dispatchEvent(new CustomEvent("nd:einwilligung"));
  },
  [SPEICHER_SCHLUESSEL, EINWILLIGUNG_FASSUNG],
);
await seite.waitForTimeout(1200);
const gaCookies = await seite.evaluate(() =>
  document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n === "_ga" || n.startsWith("_ga_")),
);
pruefe("_ga-Cookies gelöscht", gaCookies.length === 0, gaCookies.join(", "));

await browser.close();

console.log(
  fehler === 0
    ? "\nAlle Prüfungen bestanden.\n"
    : `\n${fehler} Prüfung(en) fehlgeschlagen.\n`,
);
process.exit(fehler === 0 ? 0 : 1);
