#!/usr/bin/env node
// Hält die Provisionssätze aus den Sprachdateien heraus.
//
// DAS PROBLEM, das diese Prüfung schließt:
// Der Provisionssatz (extern, Marktplatz) und der Monatsdeckel sind Zahlen der
// ABRECHNUNG. Sie liegen als benannte Konstanten im subscriptions-Slice
// (`COMMISSION_RATE_STANDARD`, `MARKETPLACE_FEE_BPS_STANDARD`,
// `COMMISSION_CAP_EUR`) und kommen über `/subscriptions/public/pricing` ins
// Frontend. Parallel dazu standen sie als „0,5 %", „8 %" und „250 €" im
// Fließtext von 48 Sprachdateien und in zwei Komponenten fest verdrahtet.
//
// Das ist die Fehlerklasse, die niemand als Bug erkennt: bei einer
// Satzänderung im Backend hätte auf DERSELBEN Karte die neue Zahl als
// Überschrift über einem Absatz mit der alten gestanden — in 24 Sprachen, und
// weder `tsc` noch ESLint noch ein Test hätte gemuckt, weil ein String, der
// „8 %" enthält, für sie ein String wie jeder andere ist. Genau diese
// Unsichtbarkeit prüft dieses Skript nach.
//
// WAS GEPRÜFT WIRD (je Sprachdatei, alle 24 je App):
//   1. Jeder betroffene Key EXISTIERT — ein stumm verschwundener Key ist
//      derselbe Schaden wie eine falsche Zahl (MISSING_MESSAGE in der UI).
//   2. Er enthält KEINE literale Prozentzahl mehr (`8 %`, `0,5%`, `0.5 %`).
//   3. Er enthält den erwarteten ICU-Platzhalter (`{satz}` bzw. `{betrag}`) —
//      sonst ist die Zahl schlicht verschwunden statt ersetzt, und der Text
//      behauptet nichts mehr.
//   4. Kein Währungssymbol im Deckel-Text (€/$/£) — der Betrag kommt mit
//      SEINER Währung über `formatCurrency` (Wurzel 4, 27 EU-Länder).
//
// Ergänzend prüft `apps/api/.../tests/test_public_pricing.py`, dass der
// beworbene Satz dem DB-Default entspricht. Beide zusammen decken die Kette
// ab: die Zahl stimmt (pytest) UND sie existiert nur einmal (dieses Skript).
//
// Gehört ins i18n-Qualitätsgate und in CI.
// Aufruf: node scripts/i18n/provisionssaetze-pruefen.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WURZEL = new URL("../..", import.meta.url).pathname;

/**
 * Die überwachten Keys, je App.
 *
 * `platzhalter`: der ICU-Platzhalter, der die Zahl liefert.
 * `waehrung`: true, wenn der Wert ein BETRAG ist (dann zusätzlich auf ein
 * hartes Währungssymbol prüfen).
 *
 * Neue Textstelle, die einen Satz oder den Deckel nennt? Sie gehört HIER
 * hinein — nicht als weitere Kopie der Zahl in 24 Dateien.
 */
const UEBERWACHT = [
  {
    app: "marketing",
    keys: [
      // Preisseite, Abschnitt „Provisionen" — direkt unter der Live-Zahl.
      { pfad: "preise.provisionen.portaleText", platzhalter: "satz" },
      { pfad: "preise.provisionen.marktplatzText", platzhalter: "satz" },
      // Der Monatsdeckel trägt seine Währung mit.
      {
        pfad: "preise.provisionen.deckel",
        platzhalter: "betrag",
        waehrung: true,
      },
      // Startseiten-Teaser.
      { pfad: "preise.teaser.provision", platzhalter: "portale" },
      // Die drei kundenwirksamsten Stellen — FAQ und Funktionsliste, wo ein
      // Interessent liest, BEVOR er die Preisseite überhaupt öffnet. Sie
      // stellen unseren Satz dem der Portale gegenüber und dürfen deshalb die
      // FREMDEN 15–18 % literal nennen: `flexibel` schaltet von
      // `PROZENT_LITERAL` auf `EIGENER_SATZ_LITERAL` um (Begründung dort).
      //
      // Gerendert werden sie über `lib/provisionstexte.ts` (Server holt den
      // Satz) plus `lib/gruppen-stichworte.ts` (setzt ihn an allen sechs
      // Render-Stellen der Stichwortzeile gleich ein).
      { pfad: "faq.direkt.antwort", platzhalter: "satz", flexibel: true },
      {
        pfad: "features.gruppen.direkt.items",
        platzhalter: "satz",
        flexibel: true,
      },
      {
        pfad: "funktionen.direkt.block.eins.punkte.c",
        platzhalter: "satz",
        flexibel: true,
      },
      // Die Ersatzwörter, die bei nicht abrufbarer Preisliste an die Stelle des
      // Satzes treten. Sie werden hier NUR auf Existenz geprüft
      // (`nurVorhanden`): fehlt eines, zeigt die Seite in dieser Sprache einen
      // rohen Schlüssel statt eines Satzes. Eine Prozentzahl darf in ihnen
      // ohnehin nicht stehen — sie sind wertfreie Wendungen („deutlich
      // weniger"), und die Zahlenprüfung greift auch für sie.
      { pfad: "faq.direkt.satzUnbekannt", nurVorhanden: true },
      { pfad: "features.gruppen.direkt.satzUnbekannt", nurVorhanden: true },
      { pfad: "funktionen.rahmen.satzUnbekannt", nurVorhanden: true },
    ],
  },
  {
    app: "web",
    keys: [
      { pfad: "account.commissions.cardOtherChannels", platzhalter: "satz" },
      { pfad: "account.commissions.monthsChannels", platzhalter: "satz" },
      { pfad: "account.commissions.monthsEmpty", platzhalter: "satz" },
      { pfad: "marketingSite.bookingValue", platzhalter: "satz" },
      {
        pfad: "account.tariff.commissionExternalCap",
        platzhalter: "betrag",
        waehrung: true,
      },
    ],
  },
];

/**
 * Eine literale Prozentzahl: eine Ziffernfolge (optional mit Dezimalkomma oder
 * -punkt) vor einem Prozentzeichen, mit oder ohne Leerraum dazwischen.
 *
 * BEWUSST NICHT auf „0,5"/„8" allein geprüft: eine nackte Zahl kann in einem
 * Provisionstext legitim vorkommen (Fristen, Anzahlen). Was hier verboten ist,
 * ist die Zahl AM Prozentzeichen — genau die Form, die den Satz behauptet.
 * Ein „%" ohne Zahl davor (Platzhalter-Fassung „{satz} Provision") bleibt
 * erlaubt, weil dort keine Zahl steht.
 */
const PROZENT_LITERAL = /\d+(?:[.,]\d+)?\s*%/;

/**
 * UNSERE Sätze, als eigenständige Prozentangabe — die schärfere Prüfung für
 * Texte, die AUCH eine fremde Provision nennen dürfen.
 *
 * DAS PROBLEM, das diese zweite Regel löst:
 * Drei Textstellen (FAQ-Antwort, Stichwortzeile „Direktbuchung", Häkchen-Chip
 * auf der Funktionsseite) stellen unseren Satz dem der Portale GEGENÜBER:
 * „{satz} statt 15–18 % OTA-Provision". Die 15–18 % sind Airbnbs und
 * Booking.coms Zahlen — sie stehen in keiner unserer Konstanten, kommen nicht
 * aus `/subscriptions/public/pricing` und gehören als Text in die
 * Sprachdateien. `PROZENT_LITERAL` würde sie als Verstoß melden und damit
 * genau die Formulierung verbieten, die das Argument trägt.
 *
 * Unterschieden wird deshalb nicht „Prozentzahl ja/nein", sondern WELCHE Zahl:
 * verboten ist eine Prozentangabe, deren Zahl einem unserer Sätze GLEICH ist
 * (0,5 / 0.5 / 8), und zwar nur als eigenständige Angabe — die Zahl darf nicht
 * Teil einer längeren Ziffernfolge oder eines Bereichs sein. Deshalb die
 * Grenzen links und rechts:
 *   • links `(?<![\d.,–—-])` — verhindert Treffer in „18 %" (die 8 dort steht
 *     hinter einer 1) und in „15–18 %" (die 8 hinter dem Bereichsstrich).
 *   • rechts `(?![\d.,])` — verhindert Treffer in „0,55 %" oder „8,5 %".
 *
 * Ein Rückfall auf unseren Satz fliegt damit auf, eine fremde Provision nicht.
 * Wechselt unser Satz im Backend (z. B. 0,5 % → 0,4 %), muss diese Liste
 * mitwachsen — sie beschreibt, welche Zahlen NICHT im Text stehen dürfen, und
 * ist bewusst eng, damit sie keine fremden Zahlen mitverbietet.
 *
 * `flexibel: true` an einem Key schaltet auf diese Regel um.
 */
const EIGENER_SATZ_LITERAL =
  /(?<![\d.,–—-])(?:0[.,]5|8)\s*%(?![\d.,])/;

/** Hartes Währungssymbol — im Deckel-Text ein Wurzel-4-Verstoß. */
const WAEHRUNGSSYMBOL = /[€$£¥]/;

/** Wert an einem punktgetrennten Pfad, oder `undefined`. */
function lies(objekt, pfad) {
  return pfad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), objekt);
}

let fehler = 0;
let geprueft = 0;

for (const { app, keys } of UEBERWACHT) {
  const ordner = join(WURZEL, app, "messages");
  const dateien = readdirSync(ordner).filter((f) => f.endsWith(".json"));
  if (dateien.length === 0) {
    console.error(`✗ ${app}: keine Sprachdateien in ${ordner}`);
    process.exit(2);
  }

  for (const datei of dateien) {
    const sprache = datei.replace(/\.json$/, "");
    const inhalt = JSON.parse(readFileSync(join(ordner, datei), "utf8"));

    for (const {
      pfad,
      platzhalter,
      waehrung,
      flexibel,
      nurVorhanden,
    } of keys) {
      const wert = lies(inhalt, pfad);
      geprueft += 1;

      if (typeof wert !== "string") {
        console.error(`✗ ${app}/${sprache}: ${pfad} fehlt oder ist kein Text`);
        fehler += 1;
        continue;
      }
      // `flexibel` = der Text darf eine FREMDE Provision nennen (15–18 % der
      // Portale), nur nicht unseren eigenen Satz. Sonst gilt: keine
      // Prozentzahl überhaupt.
      const regel = flexibel ? EIGENER_SATZ_LITERAL : PROZENT_LITERAL;
      const treffer = wert.match(regel);
      if (treffer) {
        console.error(
          `✗ ${app}/${sprache}: ${pfad} enthält die harte Zahl „${treffer[0].trim()}" — ` +
            (flexibel
              ? "das ist UNSER Provisionssatz und kommt aus " +
                `/subscriptions/public/pricing; im Text steht {${platzhalter}}. ` +
                "Fremde Portalprovisionen (15–18 %) dürfen hier literal stehen, " +
                "unsere nicht."
              : "der Satz kommt aus /subscriptions/public/pricing, im Text " +
                `steht {${platzhalter}}`),
        );
        fehler += 1;
      }
      // Ersatzwort-Keys tragen keinen Platzhalter — sie SIND der Ersatz.
      if (nurVorhanden) continue;
      if (!wert.includes(`{${platzhalter}}`)) {
        console.error(
          `✗ ${app}/${sprache}: ${pfad} hat keinen Platzhalter {${platzhalter}} — ` +
            "ohne ihn nennt der Text die Zahl gar nicht mehr",
        );
        fehler += 1;
      }
      if (waehrung && WAEHRUNGSSYMBOL.test(wert)) {
        console.error(
          `✗ ${app}/${sprache}: ${pfad} enthält ein festes Währungssymbol — ` +
            "der Betrag kommt mit seiner Währung über formatCurrency (27 EU-Länder)",
        );
        fehler += 1;
      }
    }
  }
}

if (fehler > 0) {
  console.error(
    `\n${fehler} Verstoß/Verstöße. Der Provisionssatz und der Monatsdeckel ` +
      "dürfen nur EINMAL existieren: als Live-Wert aus " +
      "/subscriptions/public/pricing. Im Text steht ein ICU-Platzhalter, den " +
      "die Komponente aus derselben Antwort füllt, aus der sie die Überschrift " +
      "nimmt.",
  );
  process.exit(1);
}
console.log(
  `✓ ${geprueft} Textstellen ohne harte Provisionszahl (Platzhalter gesetzt, ` +
    "Keys vollständig).",
);
