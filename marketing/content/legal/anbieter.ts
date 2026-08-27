// Anbieter-/Registerdaten der myNextDays ApS.
//
// EINZIGE QUELLE DER WAHRHEIT für Firmen-, Register- und Kontaktdaten in dieser
// App — keine verstreuten Kopien in Komponenten oder Rechtstexten. Alle
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
  // Technisches Postfach für Entwickler-, Störungs- und Sicherheitsmeldungen
  // (Kontaktseite, 0414). Bewusst getrennt von `email`: `info@` ist die im
  // Impressum und in der Datenschutzerklärung veröffentlichte Adresse und muss
  // dort auch stehen bleiben — eine Störungsmeldung gehört aber nicht in den
  // kaufmännischen Posteingang. Dieselbe Aufteilung führt die API in
  // CONTACT_RECIPIENT_GENERAL / CONTACT_RECIPIENT_TECHNICAL; wer hier etwas
  // ändert, ändert es dort mit.
  emailTechnik: "developer@mynextdays.dk",
  telefon: "+45 93 90 39 91",
  // E.164 für den tel:-Link — ohne Leerzeichen.
  telefonE164: "+4593903991",
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
  // Öffentliche Profile — nur was es wirklich gibt. Kein YouTube-Eintrag,
  // solange es keinen Kanal gibt: ein Symbol, das auf „#" zeigt, ist ein
  // toter Link im Footer jeder Seite.
  social: {
    linkedin: "https://www.linkedin.com/company/mynextdays",
    instagram: "https://www.instagram.com/mynextdays/",
    facebook: "https://www.facebook.com/mynextdays.dk",
  },
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

/**
 * Gemeinsames Stand-Datum aller Rechtsdokumente dieser App — als ISO-Datum,
 * NICHT als fertiger Satz.
 *
 * Warum: Die deutsche Fassung `"Stand: 6. August 2026"` stand in 58 der 120
 * Sprachdateien und erschien damit auf jeder polnischen, dänischen und
 * ungarischen Rechtsseite auf DEUTSCH (live geprüft 24.08.2026, u. a. alle 24
 * Impressum- und alle 24 Cookie-Seiten). Der naheliegende Ausweg — den Satz in
 * jede der 120 Dateien übersetzt hineinschreiben — hat den nächsten Fehler
 * schon eingebaut: ändert sich das Datum, muss es 120-mal nachgezogen werden,
 * und die erste vergessene Datei behauptet einen falschen Stand.
 *
 * Deshalb liegt hier nur noch das DATUM. Beschriftung und Schreibweise macht
 * der Renderer (`components/legal/legal-document.tsx`) aus der Sprache des
 * Besuchers: `Intl.DateTimeFormat` für das Datum, der Übersetzungsschlüssel
 * `legal.stand` für den Satz darum.
 *
 * Format bewusst `YYYY-MM-DD`: `new Date("2026-08-06")` ist damit in jeder
 * Zeitzone derselbe Tag (UTC-Mitternacht) — ein Datum wie `"6.8.2026"` wird je
 * nach Umgebung anders oder gar nicht gelesen.
 */
// 26.08.2026: Datenschutzerklärung und Cookie-Richtlinie haben die
// Reichweitenmessung (Google Analytics 4) aufgenommen — eine materielle
// Änderung in allen 24 Fassungen. Wer den Inhalt einer Rechtsseite ändert und
// dieses Datum stehen lässt, liefert eine Seite aus, die „Stand: 6. August
// 2026" behauptet: eine überholte Zusicherung, die aussieht, als wäre sie
// geprüft.
export const RECHTSSTAND_ISO = "2026-08-26";

/**
 * @deprecated Der fertige deutsche Satz. KEINE Sprachdatei zeigt mehr darauf —
 * die 96 Fassungen von Datenschutz, Impressum, Cookie-Richtlinie und
 * Auftragsverarbeitung setzen `standIso: RECHTSSTAND_ISO`.
 *
 * Steht trotzdem noch hier, weil die 24 AGB-Fassungen ihren Stand als
 * übersetztes Literal tragen und dabei ein ANDERES Datum nennen: `agb/de.ts`
 * den 13. August 2026, die 23 Übersetzungen den 30. Juli 2026. Die AGB hat
 * damit einen eigenen — und in sich widersprüchlichen — Stand, der nicht
 * stillschweigend auf RECHTSSTAND_ISO gezogen werden darf. Erst wenn geklärt
 * ist, welches Datum gilt, bekommt die AGB ihr eigenes `AGB_STAND_ISO`; dann
 * entfallen diese Konstante UND `stand?: string` in `types.ts` samt dem
 * Rückfall-Zweig in `components/legal/legal-document.tsx`.
 */
export const RECHTSSTAND = "Stand: 6. August 2026";
