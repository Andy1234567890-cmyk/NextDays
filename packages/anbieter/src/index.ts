// Anbieter-/Registerdaten der myNextDays ApS.
//
// EINZIGE QUELLE DER WAHRHEIT für Firmen-, Register- und Kontaktdaten in ALLEN
// Apps des Monorepos — keine verstreuten Kopien in Komponenten oder
// Rechtstexten. Lag bis 18.08.2026 in marketing/content/legal/anbieter.ts und
// damit nur einer App zur Verfügung; mit den Rechtstexten des myBestDays-
// Marktplatzes (plattform) brauchte sie eine zweite App, und zwei Kopien von
// Registerdaten sind zwei Wahrheiten. Alle
// Angaben sind am 30.07.2026 gegen die amtlichen Register geprüft:
//   · Firma, Adresse, Rechtsform, Telefon, Branche → cvrapi.dk (CVR 46615182)
//   · Adresse Hirtshalsvej 21, 9881 Bindslev       → Dataforsyningen/DAWA (aktiv)
//   · Direktion Jeanine + Torsten Ågaard           → CVR-Ledelse (direktører)
// Registeränderung (Direktion, Sitz, Momsregistrierung) → hier nachziehen und
// das Stand-Datum der betroffenen Dokumente hochsetzen.
//
// OFFEN — sobald die Momsregistrierung vorliegt: Die Umsatzsteuer-
// Identifikationsnummer DK46615182 wird vom EU-VIES-Dienst als NICHT gültig
// zurückgemeldet — geprüft am 30.07.2026 und erneut am 08.08.2026
// (Kontrollabfrage mit DK54562519/Lego A/S lieferte beide Male gültig, der
// Dienst funktioniert also). Plausibel, weil die Gesellschaft erst am
// 01.07.2026 gegründet wurde und die Momsregistrierung noch aussteht.
// `ustId` steht deshalb auf null. Sobald die Registrierung erteilt ist, hier
// auf "DK46615182" setzen UND `COMPANY_VAT_ID` in der Backend-Umgebung
// (Coolify-App `nextdays-api` + `apps/api/.env`) gleichlautend füllen — sonst
// zeigen Impressum und Mail-Fußzeile Unterschiedliches.
// § 7 der dänischen E-handelslov verlangt die Umsatzsteuer-Identifikationsnummer
// nur bei bestehender Momsregistrierung — liegt sie nicht vor, muss `ustId` auf
// null gesetzt werden (die Zeile entfällt dann automatisch), statt eine nicht
// existierende Nummer zu veröffentlichen.

// Kontaktkanäle: die Mail-Domäne ist bewusst .dk (dort liegt der Mailserver),
// die Website läuft unter der Hauptdomäne .com. Beides ist so gewollt.
export const ANBIETER = {
  firma: "myNextDays ApS",
  rechtsform: "Anpartsselskab (ApS) dänischen Rechts",
  strasse: "Hirtshalsvej 21",
  ort: "9881 Bindslev",
  land: "Dänemark",
  email: "info@mynextdays.dk",
  telefon: "+45 43 16 70 40",
  // E.164 für den tel:-Link — ohne Leerzeichen.
  telefonE164: "+4543167040",
  website: "www.mynextdays.com",
  websiteUrl: "https://www.mynextdays.com",
  // CVR-Nummer ist rein 8-stellig; das Präfix „DK" gehört ausschließlich an
  // die Umsatzsteuer-Identifikationsnummer (Momsnummer).
  cvr: "46615182",
  // null, solange keine Momsregistrierung vorliegt — dann entfällt die Zeile.
  // Erneut gegen VIES geprüft am 08.08.2026: DK46615182 → isValid=false
  // (Kontrollabfrage DK54562519/Lego A/S → isValid=true, der Dienst antwortet
  // also korrekt). Die Momsregistrierung steht weiterhin aus. Sobald sie
  // vorliegt: hier auf "DK46615182" setzen UND COMPANY_VAT_ID in der
  // Backend-Umgebung (Coolify + apps/api/.env) gleichlautend füllen.
  ustId: null as string | null,
  direktion: ["Jeanine Ågaard", "Torsten Ågaard"],
} as const;

/** Ein Satz mit der vollständigen Firmierung — für Rechtstexte. */
export const ANBIETER_SATZ =
  `${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, ` +
  `CVR-nr. ${ANBIETER.cvr}`;

/** Zuständige Datenschutz-Aufsichtsbehörde am Sitz des Verantwortlichen. */
export const AUFSICHTSBEHOERDE = {
  name: "Datatilsynet",
  strasse: "Carl Jacobsens Vej 35",
  ort: "2500 Valby",
  land: "Dänemark",
  email: "dt@datatilsynet.dk",
  website: "https://www.datatilsynet.dk",
} as const;

/** Gemeinsames Stand-Datum der Rechtsdokumente der Marketing-Site.
 *  Die Rechtstexte des Marktplatzes (plattform) tragen ihr eigenes, je Sprache
 *  formuliertes Stand-Datum — dort steht es in der jeweiligen Sprachfassung. */
export const RECHTSSTAND = "Stand: 6. August 2026";

/** Die Marke, unter der der Marktplatz für Gäste und Gastgeber auftritt.
 *  Betreiberin ist dieselbe Gesellschaft; myBestDays ist keine eigene
 *  juristische Person (Marken-Grenze myNextDays/myBestDays, CLAUDE.md). */
export const MARKTPLATZ_MARKE = "myBestDays";

/** Anschrift als eine Zeile — für Fließtext in Rechtsdokumenten. */
export const ANBIETER_ANSCHRIFT =
  `${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}`;

/** Koordinator für digitale Dienste (Artikel 49 der Verordnung (EU) 2022/2065)
 *  am Sitz der Gesellschaft. Am 18.08.2026 gegen die Liste der Europäischen
 *  Kommission geprüft (digital-strategy.ec.europa.eu/en/policies/dsa-dscs):
 *  für Dänemark ist die Digitaliseringsstyrelsen benannt. */
export const DSA_KOORDINATOR = {
  name: "Digitaliseringsstyrelsen",
  land: "Dänemark",
  website: "https://digst.dk/tilsyn/digitale-formidlingstjenester-dsa/",
} as const;

/** Zuständige Verbraucherschlichtungsstelle am Sitz (Dänemark).
 *  Am 18.08.2026 live gegen naevneneshus.dk geprüft: Anschrift Toldboden 2,
 *  8800 Viborg; die Stelle heißt inzwischen „Mæglingsteamet for
 *  Forbrugerklager og Forbrugerklagenævnet" (früher „Center for
 *  Klageløsning"). Die EU-Plattform für Online-Streitbeilegung ist durch die
 *  Verordnung (EU) 2024/3228 aufgehoben und außer Betrieb — sie darf NICHT
 *  mehr als Weg genannt oder verlinkt werden. */
export const VERBRAUCHERSCHLICHTUNG = {
  name: "Mæglingsteamet for Forbrugerklager og Forbrugerklagenævnet",
  traeger: "Nævnenes Hus",
  strasse: "Toldboden 2",
  ort: "8800 Viborg",
  land: "Dänemark",
  website: "https://naevneneshus.dk",
} as const;
