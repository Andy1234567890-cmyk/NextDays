// Live-Prüfung des Einwilligungs-Dialogs — im echten Browser, nicht am
// Quelltext.
//
// WARUM ES DAS BRAUCHT: Alles hier ist mit tsc und ESLint unsichtbar. Beide
// waren grün, während (gemessen im August 2026) eine Kategorie ganz fehlte,
// eine Seite DOPPELT gezählt wurde, nach einem Widerruf mit erneuter Zustimmung
// gar nicht mehr gemessen wurde und `_GRECAPTCHA` beim Widerruf liegen blieb —
// die Klasse Fehler, bei der die Zahlen plausibel aussehen und niemand sie
// anzweifelt.
//
// Geprüft wird:
//   1. Fünf Einträge in der linken Spalte (Übersicht + vier Kategorien).
//   2. Vor jeder Entscheidung KEIN Drittanbieter-Request (Art. 5 Abs. 3
//      ePrivacy).
//   3. „Notwendige" hat KEINEN Schalter (§ 25 Abs. 2 TDDDG: einwilligungsfrei,
//      ein Schalter dafür wäre eine Attrappe), jede andere Kategorie genau einen.
//   4. Granularität: „nur Marketing" lädt den Meta-Pixel und WEDER GA NOCH
//      reCAPTCHA. Das ist die Vorgabe der Orientierungshilfe (OH Telemedien
//      2021, S. 14): in die unterschiedlichen Zwecke muss separat eingewilligt
//      ODER abgelehnt werden können.
//   5. Widerruf pflegt den Gegenzustand: `_fbp` verschwindet.
//   6. Keine fehlenden Übersetzungen (MISSING_MESSAGE) in irgendeiner Ansicht.
//
// AUFRUF (die App muss laufen; ohne gesetzte Schlüssel erscheinen die
// Kategorien trotzdem, melden aber „nicht eingerichtet"):
//   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX \
//   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<schluessel> bunx next dev -p 3399
//   node scripts/diagnose/einwilligung-e2e.mjs
//
// Playwright liegt nicht im Repo; `bun add playwright` in einem Wegwerf-Ordner
// genügt. Läuft von Hand vor einem Deploy, nicht in jedem CI-Durchgang.
import { chromium } from "playwright";
const B = "http://localhost:3399";
const b = await chromium.launch();
const ctx = await b.newContext({ locale: "de-DE", viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  const weg = () => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
  new MutationObserver(weg).observe(document.documentElement, { childList: true, subtree: true });
});
const p = await ctx.newPage();
const netz = [];
p.on("request", (r) => {
  const u = r.url();
  if (/googletagmanager|google-analytics|google\.com\/recaptcha|connect\.facebook\.net|facebook\.com\/tr|snap\.licdn\.com/.test(u)) netz.push(u);
});
const fehler = new Set();
p.on("console", (m) => { if (m.text().includes("MISSING_MESSAGE")) fehler.add(m.text().match(/`([^`]+)`/)?.[1] ?? "?"); });
const klick = (m) => p.evaluate((mm) => {
  document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
  const re = new RegExp(mm, "i");
  const el = [...document.querySelectorAll("button")].find(
    (x) => re.test(x.textContent ?? "") || re.test(x.getAttribute("aria-label") ?? ""));
  if (!el) throw new Error("nicht gefunden: " + mm);
  el.click();
}, m);
const melde = (s, ok, t) => { console.log(`${ok ? "OK    " : "FEHLER"} ${s}${t ? " — " + t : ""}`); if (!ok) process.exitCode = 1; };

await p.goto(B, { waitUntil: "networkidle" });
const d = p.locator('[role="dialog"]');

// 1) Vier Punkte + Notwendig = fünf Einträge, kein Google/Meta vorab.
const punkte = await d.locator("ul > li > button").allInnerTexts();
melde("fünf Einträge in der linken Spalte", punkte.length === 5, punkte.join(" | "));
melde("vor Einwilligung kein Drittanbieter-Request", netz.length === 0, netz.join(" "));

// 2) Schalter je Kategorie prüfen: Notwendig hat keinen.
for (const [name, erwartet] of [["Notwendige", 0], ["Funktionale", 1], ["Analytische", 1], ["Marketing", 1]]) {
  await klick(name);
  await p.waitForTimeout(200);
  const n = await d.getByRole("switch").count();
  melde(`${name}: ${erwartet === 0 ? "kein" : "ein"} Schalter`, n === erwartet, `${n}`);
}

// 3) Nur Marketing erlauben.
await klick("Marketing");
await p.waitForTimeout(200);
await d.getByRole("switch").first().click();
await klick("Einstellungen bestätigen");
await p.waitForTimeout(2500);
const g = await p.evaluate(() => JSON.parse(localStorage.getItem("nd_consent") ?? "{}"));
melde("nur Marketing erlaubt", g.auswahl?.marketing === true && g.auswahl?.analytisch === false && g.auswahl?.funktional === false, JSON.stringify(g.auswahl));
melde("Meta-Pixel geladen", netz.some((u) => u.includes("connect.facebook.net")), netz.filter(u=>u.includes("facebook")).length + " Requests");
melde("GA NICHT geladen", !netz.some((u) => u.includes("gtag/js")), netz.filter(u=>u.includes("gtag")).join(" "));
melde("reCAPTCHA NICHT geladen", !netz.some((u) => u.includes("recaptcha")));

// 4) Widerruf: Marketing aus -> _fbp weg.
await p.evaluate(() => { document.cookie = "_fbp=test; path=/"; });
await klick("Cookie-Einstellungen");
await p.waitForTimeout(400);
await klick("Marketing");
await p.waitForTimeout(200);
await d.getByRole("switch").first().click();
await klick("Einstellungen bestätigen");
await p.waitForTimeout(1500);
const rest = (await ctx.cookies()).filter((c) => c.name === "_fbp").map((c) => c.name);
melde("_fbp nach Widerruf weg", rest.length === 0, rest.join(","));

// 6) Metas Snippet vollständig: Skript UND das /tr-Zählbild — beide erst nach
// der Einwilligung. Das `<noscript><img>` aus Metas Vorlage darf NICHT im HTML
// stehen: es lädt, sobald JavaScript aus ist, und dann ist die Einwilligung im
// localStorage nicht lesbar. Deshalb legt lib/pixel.ts das Bild per Skript an.
const html = await p.content();
melde("kein <noscript>-Pixel im HTML", !/noscript[^>]*>\s*<img[^>]*facebook/i.test(html));
const tr = netz.filter((u) => u.includes("facebook.com/tr"));
melde("Meta-Zählbild angefordert", tr.length >= 1, tr[0]?.slice(0, 80) ?? "keiner");
melde("Zählbild nach Widerruf aus dem DOM", (await p.locator("#nd-meta-pixel-bild").count()) === 0);

melde("keine fehlenden Texte", fehler.size === 0, [...fehler].join(", "));
await b.close();
