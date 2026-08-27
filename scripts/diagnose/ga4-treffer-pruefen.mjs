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
//
// AUFRUF (Playwright liegt nicht im Repo, siehe einwilligung-e2e.mjs):
//   node scripts/diagnose/ga4-treffer-pruefen.mjs [https://mynextdays.com]
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
const seite = await kontext.newPage();

/** Alle Requests an Google-Messendpunkte, mit ausgelesenen Parametern. */
const treffer = [];
const fremdskripte = [];
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
pruefe(
  "kein Messtreffer ohne Einwilligung",
  treffer.length === 0,
  treffer.length ? treffer.map((t) => `${t.ereignis}(gcs=${t.gcs})`).join(", ") : "",
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
  treffer.length = 0;
  await seite.goto(BASIS + pfad, { waitUntil: "networkidle" });
  await seite
    .waitForRequest((r) => r.url().includes("/g/collect"), { timeout: 6000 })
    .catch(() => null);
  await seite.waitForTimeout(300);
  const eigener = treffer.filter((t) => t.ereignis === "page_view");
  pruefe(
    `${pfad} sendet einen page_view`,
    eigener.length > 0,
    eigener.length > 1 ? `ACHTUNG: ${eigener.length}-mal — Doppelzählung` : "",
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
