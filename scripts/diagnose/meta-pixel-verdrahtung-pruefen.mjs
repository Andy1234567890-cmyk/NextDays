// Prüft am QUELLTEXT, dass die Meta-Conversion-Events verdrahtet sind — und
// dass die drei behobenen Fehler nicht zurückkommen.
//
// Reines Node, KEIN Browser-Treiber: damit CI-fähig und ohne Playwright
// (ausdrückliche Anweisung vom 27.08.2026). Die Laufzeit-Seite prüft das
// Schwesterskript `meta-pixel-im-browser.js`, das in der geöffneten Seite läuft.
//
// Was hier NICHT geprüft werden kann: ob ein Treffer wirklich hinausgeht. Diese
// Datei sagt nur, dass der Code die Ereignisse meldet — nicht, dass Meta sie
// annimmt (das kann eine Kontoeinstellung verhindern, siehe die Sperre im
// Kopf von meta-pixel-im-browser.js).
//
// Aufruf:  node scripts/diagnose/meta-pixel-verdrahtung-pruefen.mjs

import { readFile } from "node:fs/promises";

const WURZEL = new URL("../../", import.meta.url);

let fehler = 0;
const pruefe = (name, bedingung, zusatz = "") => {
  if (!bedingung) fehler += 1;
  console.log(`  ${bedingung ? "OK  " : "FEHL"} ${name}${zusatz ? ` — ${zusatz}` : ""}`);
};

const lesen = (pfad) =>
  readFile(new URL(pfad, WURZEL), "utf8").catch(() => null);

/**
 * Entfernt Kommentare. PFLICHT vor jeder Suche nach Code-Mustern: die
 * Kommentare in lib/pixel.ts ZITIEREN die behobenen Fehler wortgenau
 * (`f.queue?.push(args)`, `noscript=1`), damit der nächste Leser sie erkennt.
 * Eine Suche über den Rohtext findet deshalb das Zitat statt des Codes — beim
 * ersten Lauf meldete diese Datei genau so „Rest-Parameter ist zurück" für
 * Code, der längst richtig war. Eine Prüfung, die ihre eigene Begründung als
 * Befund liest, ist wertlos.
 */
const ohneKommentare = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((z) => !z.trim().startsWith("//"))
    .join("\n");

console.log("\nMeta-Pixel: Verdrahtung im Quelltext\n");

// ---------------------------------------------------------------------------
console.log("== 1. Conversion-Events sind gemeldet ==");
// ---------------------------------------------------------------------------
// Jede Zeile: Anzeigename, Datei, das Meta-Standard-Event, das dort fallen muss.
// Ein neuer Conversion-Punkt gehört HIER hinein, nicht nur in die Komponente —
// sonst fällt sein stiller Rückbau niemandem auf.
const STELLEN = [
  ["Lead — Voranmeldung", "marketing/components/voranmeldung-popup.tsx", "Lead"],
  ["Contact — Kontaktformular", "marketing/components/kontakt/kontakt-formular.tsx", "Contact"],
  [
    "CompleteRegistration — Double-Opt-in",
    "marketing/app/newsletter/bestaetigen/page.tsx",
    "CompleteRegistration",
  ],
];

for (const [name, datei, ereignis] of STELLEN) {
  const inhalt = await lesen(datei);
  if (inhalt === null) {
    pruefe(name, false, `${datei} nicht lesbar`);
    continue;
  }
  const code = ohneKommentare(inhalt);
  const meldet = code.includes("pixelEreignisMelden");
  const nennt = code.includes(`pixelEreignisMelden("${ereignis}")`);
  pruefe(
    name,
    meldet && nennt,
    meldet ? (nennt ? "" : `ruft pixelEreignisMelden, aber nicht mit "${ereignis}"`) : "kein Aufruf",
  );
}

// ---------------------------------------------------------------------------
console.log("\n== 2. Die drei behobenen Fehler bleiben behoben ==");
// ---------------------------------------------------------------------------
const pixelRoh = await lesen("marketing/lib/pixel.ts");
const pixel = pixelRoh === null ? null : ohneKommentare(pixelRoh);
if (pixel === null) {
  pruefe("marketing/lib/pixel.ts lesbar", false);
} else {
  // (1) Das noscript-Zählbild war die Doppelzählung: es feuerte per JavaScript
  //     ZUSÄTZLICH zum regulären Treffer.
  pruefe(
    "kein noscript-Zählbild",
    !pixel.includes("noscript=1"),
    pixel.includes("noscript=1") ? "Doppelzählung ist zurück" : "",
  );

  // (2) Der Stub muss `arguments` schieben, nicht ein Array. Ein Rest-Parameter
  //     in der Stub-Signatur ist genau der Rückfall.
  pruefe(
    "Stub schiebt arguments, kein Array",
    pixel.includes("f.queue?.push(arguments)"),
    pixel.includes("f.queue?.push(args)") ? "Rest-Parameter ist zurück" : "",
  );
  pruefe("Metas `push = f` gesetzt", pixel.includes("f.push = f;"));

  // (3) Einwilligung: grant beim Start, revoke beim Widerruf. Ohne `revoke`
  //     räumte der Widerruf nur Cookies, und das nächste Ereignis legte sie
  //     sofort wieder an (Wurzel 1).
  pruefe('fbq("consent", "grant") beim Start', pixel.includes('"consent", "grant"'));
  pruefe('fbq("consent", "revoke") beim Widerruf', pixel.includes('"consent", "revoke"'));

  // Die Ereignis-Funktion ist der EINZIGE Weg nach draußen und fail-closed.
  pruefe("pixelEreignisMelden exportiert", pixel.includes("export function pixelEreignisMelden"));
  pruefe(
    "pixelEreignisMelden prüft die Einwilligung",
    /pixelEreignisMelden[\s\S]{0,600}istErlaubt\("marketing"\)/.test(pixel),
  );
}

// ---------------------------------------------------------------------------
console.log("\n== 3. Niemand ruft fbq direkt ==");
// ---------------------------------------------------------------------------
// `window.fbq` darf AUSSCHLIESSLICH in lib/pixel.ts vorkommen. Ein direkter
// Aufruf in einer Komponente umgeht die Einwilligungsprüfung — derselbe Fehler
// wie ein Skript ohne Zustimmung.
const KANDIDATEN = [
  "marketing/components/voranmeldung-popup.tsx",
  "marketing/components/kontakt/kontakt-formular.tsx",
  "marketing/app/newsletter/bestaetigen/page.tsx",
  "marketing/components/einwilligungs-dienste.tsx",
  "marketing/app/layout.tsx",
];
for (const datei of KANDIDATEN) {
  const code = ohneKommentare((await lesen(datei)) ?? "");
  pruefe(`${datei.replace("marketing/", "")}: kein window.fbq`, !code.includes("window.fbq"));
}

console.log(
  fehler === 0
    ? "\nAlle Prüfungen bestanden.\n"
    : `\n${fehler} Prüfung(en) fehlgeschlagen.\n`,
);
process.exit(fehler === 0 ? 0 : 1);
