// Zentrale Länderliste für Registrierung + Onboarding (Firmendaten).
// Start-Markt: DACH zuerst, dann alle EU-Länder. Währung pro Land (ISO 4217).
// Modell ist länderneutral (tenants.country = ISO-3166-1 alpha-2) — weltweit
// erweiterbar; hier bewusst auf DACH+EU+CH begrenzt (siehe Onboarding-Plan).

export type Land = {
  code: string; // ISO-3166-1 alpha-2 — Label kommt aus i18n (countries.<code>)
  currency: string; // ISO-4217
};

// DACH bewusst zuerst (häufigste Kunden), danach übrige EU alphabetisch.
// Die Anzeigenamen liegen in den Sprachdateien (Namespace "countries"); hier nur
// Code + Währung + Reihenfolge.
export const LAENDER: readonly Land[] = [
  { code: "DE", currency: "EUR" },
  { code: "AT", currency: "EUR" },
  { code: "CH", currency: "CHF" },
  // übrige EU
  { code: "BE", currency: "EUR" },
  { code: "BG", currency: "BGN" },
  { code: "HR", currency: "EUR" },
  { code: "CY", currency: "EUR" },
  { code: "CZ", currency: "CZK" },
  { code: "DK", currency: "DKK" },
  { code: "EE", currency: "EUR" },
  { code: "FI", currency: "EUR" },
  { code: "FR", currency: "EUR" },
  { code: "GR", currency: "EUR" },
  { code: "HU", currency: "HUF" },
  { code: "IE", currency: "EUR" },
  { code: "IT", currency: "EUR" },
  { code: "LV", currency: "EUR" },
  { code: "LT", currency: "EUR" },
  { code: "LU", currency: "EUR" },
  { code: "MT", currency: "EUR" },
  { code: "NL", currency: "EUR" },
  { code: "PL", currency: "PLN" },
  { code: "PT", currency: "EUR" },
  { code: "RO", currency: "RON" },
  { code: "SK", currency: "EUR" },
  { code: "SI", currency: "EUR" },
  { code: "ES", currency: "EUR" },
  { code: "SE", currency: "SEK" },
];

// Währung zum Ländercode aus der Stammdaten-Liste. Wurzel 4: bei unbekanntem
// Code KEIN erfundenes EUR — leer zurückgeben, der Aufrufer muss fail-closed
// eine echte Länderwahl erzwingen (die 27 EU-Länder haben nicht alle den Euro).
export function currencyForCountry(code: string): string {
  return LAENDER.find((l) => l.code === code)?.currency ?? "";
}

// Haupt-IANA-Zeitzone je Land (DACH+EU+CH). Channex verlangt eine Zeitzone an
// der Property; für diese Märkte ist eine Hauptzeitzone pro Land eindeutig genug.
const TIMEZONE_NACH_LAND: Readonly<Record<string, string>> = {
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  CH: "Europe/Zurich",
  BE: "Europe/Brussels",
  BG: "Europe/Sofia",
  HR: "Europe/Zagreb",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DK: "Europe/Copenhagen",
  EE: "Europe/Tallinn",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GR: "Europe/Athens",
  HU: "Europe/Budapest",
  IE: "Europe/Dublin",
  IT: "Europe/Rome",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  MT: "Europe/Malta",
  NL: "Europe/Amsterdam",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  RO: "Europe/Bucharest",
  SK: "Europe/Bratislava",
  SI: "Europe/Ljubljana",
  ES: "Europe/Madrid",
  SE: "Europe/Stockholm",
};

export function timezoneForCountry(code: string): string {
  return TIMEZONE_NACH_LAND[code] ?? "Europe/Berlin";
}

// Rechtsformen je Land (ISO-3166-1 alpha-2). Pro Markt die gängigen Formen,
// jeweils mit "Andere" als Auffang. Länder ohne eigenen Eintrag fallen auf
// RECHTSFORMEN_FALLBACK zurück (generische, sprachneutrale Kategorien).
export const RECHTSFORMEN_FALLBACK: readonly string[] = [
  "Einzelunternehmen",
  "Personengesellschaft",
  "Kapitalgesellschaft",
  "Andere",
];

const RECHTSFORMEN_NACH_LAND: Readonly<Record<string, readonly string[]>> = {
  // DACH
  DE: [
    "Einzelunternehmen",
    "GbR",
    "GmbH",
    "UG (haftungsbeschränkt)",
    "GmbH & Co. KG",
    "OHG",
    "KG",
    "e.K.",
    "AG",
    "Andere",
  ],
  AT: [
    "Einzelunternehmen",
    "OG",
    "KG",
    "GmbH",
    "GmbH & Co KG",
    "AG",
    "Andere",
  ],
  CH: ["Einzelunternehmen", "Kollektivgesellschaft", "GmbH", "AG", "Andere"],
  // EU
  BE: ["Eenmanszaak / Indépendant", "VOF / SNC", "BV / SRL", "NV / SA", "Andere"],
  BG: ["ET", "OOD", "EOOD", "AD", "Andere"],
  HR: ["Obrt", "j.d.o.o.", "d.o.o.", "d.d.", "Andere"],
  CY: ["Sole Trader", "Partnership", "Ltd", "Plc", "Andere"],
  CZ: ["OSVČ", "v.o.s.", "s.r.o.", "a.s.", "Andere"],
  DK: ["Enkeltmandsvirksomhed", "I/S", "ApS", "A/S", "Andere"],
  EE: ["FIE", "OÜ", "AS", "Andere"],
  FI: ["Toiminimi", "Ay / Ky", "Oy", "Oyj", "Andere"],
  FR: ["Auto-entrepreneur", "EI", "EURL", "SARL", "SAS / SASU", "SA", "Andere"],
  GR: ["Atomiki", "O.E. / E.E.", "EPE", "IKE", "AE", "Andere"],
  HU: ["Egyéni vállalkozó", "Bt.", "Kft.", "Zrt. / Nyrt.", "Andere"],
  IE: ["Sole Trader", "Partnership", "Ltd", "PLC", "Andere"],
  IT: ["Ditta individuale", "S.n.c.", "S.a.s.", "S.r.l.", "S.p.A.", "Andere"],
  LV: ["IK", "SIA", "AS", "Andere"],
  LT: ["IĮ", "MB", "UAB", "AB", "Andere"],
  LU: ["Entreprise individuelle", "SARL", "SA", "Andere"],
  MT: ["Sole Trader", "Partnership", "Ltd", "Plc", "Andere"],
  NL: ["Eenmanszaak", "VOF", "BV", "NV", "Andere"],
  PL: ["JDG", "sp.j.", "sp. z o.o.", "S.A.", "Andere"],
  PT: ["ENI", "Lda.", "S.A.", "Andere"],
  RO: ["PFA", "SRL", "SA", "Andere"],
  SK: ["Živnosť", "v.o.s.", "s.r.o.", "a.s.", "Andere"],
  SI: ["s.p.", "d.o.o.", "d.d.", "Andere"],
  ES: ["Autónomo", "S.C.", "S.L.", "S.A.", "Andere"],
  SE: ["Enskild firma", "HB / KB", "AB", "Andere"],
};

// Rechtsformen für ein Land (Fallback, falls Land nicht gelistet).
export function rechtsformenFuerLand(code: string): readonly string[] {
  return RECHTSFORMEN_NACH_LAND[code] ?? RECHTSFORMEN_FALLBACK;
}

// Generische (übersetzbare) Rechtsform-Begriffe. Landesspezifische Eigennamen
// (GmbH, SARL, S.r.l. …) bleiben in jeder Sprache gleich und werden NICHT
// übersetzt — nur diese generischen Labels haben einen i18n-Key (legalForms.*).
const UEBERSETZBARE_RECHTSFORMEN = new Set<string>([
  "Einzelunternehmen",
  "Personengesellschaft",
  "Kapitalgesellschaft",
  "Andere",
  "Sole Trader",
  "Partnership",
]);

// Übersetztes Anzeige-Label für eine Rechtsform. Der gespeicherte Wert bleibt
// unverändert (Eigenname/Originalstring); nur generische Begriffe werden über
// den übergebenen Übersetzer (Namespace "legalForms") lokalisiert.
export function rechtsformLabel(
  form: string,
  t: (key: string) => string,
): string {
  return UEBERSETZBARE_RECHTSFORMEN.has(form) ? t(form) : form;
}

// Kleinunternehmer-/USt-Befreiungsregelung je Land. Der NAME des Regimes ist ein
// nationaler Eigenbegriff (verifiziert an offiziellen Steuerbehörden: DE/AT BMF,
// FR Legifrance, IT/PT/PL/SK/SI/HR/HU/GR/LU nat. Finanzverwaltungen, CH ESTV) und
// bleibt in JEDER UI-Sprache gleich. Der UMGEBENDE Text (Checkbox + Hinweis)
// kommt aus dem i18n-System (Namespace "exemption") in der UI-Sprache.
// `scheme: null` = Land ohne benannten Eigennamen (nur Umsatzschwelle) → generi-
// scher übersetzter Text. ES = kein nationales Regime (`exists: false`).
type Befreiung = {
  scheme: string | null; // nationaler Eigenname des Regimes (unübersetzt) oder null
  exists: boolean; // false = kein Regime → Checkbox ausblenden
};

const BEFREIUNG_NACH_LAND: Readonly<Record<string, Befreiung>> = {
  // DACH
  DE: { scheme: "§ 19 UStG", exists: true },
  AT: { scheme: "§ 6 Abs. 1 Z 27 UStG", exists: true },
  CH: { scheme: "Art. 10 Abs. 2 MWSTG", exists: true },
  // EU mit benanntem nationalem Regime
  FR: { scheme: "Franchise en base de TVA", exists: true },
  IT: { scheme: "Regime forfettario", exists: true },
  NL: { scheme: "Kleineondernemersregeling (KOR)", exists: true },
  BE: { scheme: "Vrijstellingsregeling (art. 56bis)", exists: true },
  PL: { scheme: "Zwolnienie podmiotowe z VAT", exists: true },
  PT: { scheme: "Regime de isenção (art. 53.º CIVA)", exists: true },
  HU: { scheme: "Alanyi adómentesség", exists: true },
  HR: { scheme: "Oslobođenje za male porezne obveznike", exists: true },
  GR: { scheme: "Απαλλαγή ΦΠΑ μικρών επιχειρήσεων", exists: true },
  SI: { scheme: "Oprostitev DDV (člen 94 ZDDV-1)", exists: true },
  SK: { scheme: "Oslobodenie pre malý podnik (§ 68e–68g)", exists: true },
  LT: { scheme: "Smulkiojo verslo schema", exists: true },
  LU: { scheme: "Régime de franchise (art. 57 TVA)", exists: true },
  RO: { scheme: "Scutire pentru întreprinderile mici (art. 310)", exists: true },
  MT: { scheme: "Article 11 (small undertakings)", exists: true },
  // EU ohne Eigennamen — nur Umsatzschwelle (scheme: null → generischer Text)
  DK: { scheme: null, exists: true },
  SE: { scheme: null, exists: true },
  FI: { scheme: null, exists: true },
  EE: { scheme: null, exists: true },
  LV: { scheme: null, exists: true },
  CZ: { scheme: null, exists: true },
  BG: { scheme: null, exists: true },
  CY: { scheme: null, exists: true },
  IE: { scheme: null, exists: true },
  // EU OHNE nationales Befreiungsregime
  ES: { scheme: null, exists: false },
};

// Befreiungs-Fakten für ein Land (Fallback = generisch, vorhanden).
export function befreiungFuerLand(code: string): Befreiung {
  return BEFREIUNG_NACH_LAND[code] ?? { scheme: null, exists: true };
}

// Beispiel-USt-IdNr. je Land (Platzhalter). Strukturen verifiziert anhand der
// offiziellen EU-Kommission VIES-Strukturtabelle (ec.europa.eu/taxation_customs/
// vies) bzw. für CH der ESTV/admin.ch (UID/MWST-Format). Legende der VIES-Tabelle:
// 9 = Ziffer, X = Buchstabe oder Ziffer, L = Buchstabe.
// Hinweis: Griechenland nutzt das Präfix "EL" (nicht "GR").
const VAT_BEISPIEL_NACH_LAND: Readonly<Record<string, string>> = {
  DE: "DE123456789", // 9 Ziffern
  AT: "ATU12345678", // U + 8 Ziffern
  CH: "CHE-123.456.789 MWST", // ESTV UID/MWST (Nicht-EU)
  BE: "BE0123456789", // 10 Ziffern (führende 0/1)
  BG: "BG123456789", // 9 oder 10 Ziffern
  HR: "HR12345678901", // 11 Ziffern
  CY: "CY12345678L", // 8 Ziffern + 1 Buchstabe
  CZ: "CZ12345678", // 8, 9 oder 10 Ziffern
  DK: "DK12345678", // 8 Ziffern
  EE: "EE123456789", // 9 Ziffern
  FI: "FI12345678", // 8 Ziffern
  FR: "FRXX123456789", // 2 Prüfzeichen + 9 Ziffern (SIREN)
  GR: "EL123456789", // Präfix EL, 9 Ziffern
  HU: "HU12345678", // 8 Ziffern
  IE: "IE1234567L", // 7 Zeichen + 1–2 Buchstaben
  IT: "IT12345678901", // 11 Ziffern
  LV: "LV12345678901", // 11 Ziffern
  LT: "LT123456789", // 9 oder 12 Ziffern
  LU: "LU12345678", // 8 Ziffern
  MT: "MT12345678", // 8 Ziffern
  NL: "NL123456789B01", // 9 Ziffern + B + 2 Ziffern
  PL: "PL1234567890", // 10 Ziffern
  PT: "PT123456789", // 9 Ziffern
  RO: "RO123456789", // 2–10 Ziffern
  SK: "SK1234567890", // 10 Ziffern
  SI: "SI12345678", // 8 Ziffern
  ES: "ESX1234567X", // Zeichen + 7 Ziffern + Zeichen
  SE: "SE123456789012", // 12 Ziffern
};

// Platzhalter-Beispiel für die USt-IdNr. eines Landes.
export function vatBeispielFuerLand(code: string): string {
  return VAT_BEISPIEL_NACH_LAND[code] ?? `${code}123456789`;
}

// Länder, in denen das Handelsregister von einem GERICHT geführt wird und ein
// Betrieb deshalb ein „Registergericht" angeben kann.
//
// In der EU führt das Register je Land ein Gericht, eine Handelskammer oder eine
// Behörde (EU-Justizportal, „Business registers in EU countries"). Nur im
// ersten Fall existiert ein Registergericht. Dänemark etwa hat ausschließlich
// die zentrale CVR-Nummer der Erhvervsstyrelsen — dort nach einem
// Registergericht zu fragen, ist eine Frage ohne Antwort, und der Nutzer sucht
// den Fehler bei sich (genau so gemeldet für AirSmil, DK).
//
// Bewusst eine ALLOWLIST (Wurzel 5, fail-closed): ein Land, dessen System hier
// nicht belegt ist, bekommt das Feld NICHT. Ein zu viel gezeigtes Feld verlangt
// eine Angabe, die es nicht gibt; ein zu wenig gezeigtes ist ein optionales
// Feld weniger — die harmlosere Richtung.
const REGISTERGERICHT_LAENDER: ReadonlySet<string> = new Set([
  "DE", // Amtsgericht als Registergericht (HRA/HRB)
  "AT", // Firmenbuchgericht (Landes-/Handelsgericht)
  "PL", // Krajowy Rejestr Sądowy, geführt von den Bezirksgerichten
  "HU", // Firmengericht (cégbíróság)
  "CZ", // Handelsregister bei den Kreisgerichten
  "SK", // Obchodný register bei den Bezirksgerichten
  "SI", // Registergericht (sodni register)
  "HR", // Handelsgericht (trgovački sud)
  "BG", // historisch gerichtlich geführt, Angabe weiterhin üblich
  "LU", // Registre de commerce et des sociétés, gerichtlich verankert
  "BE", // Kruispuntbank/BCE über die Unternehmensgerichte
]);

/** Führt dieses Land ein gerichtliches Handelsregister? */
export function hatRegistergericht(code: string): boolean {
  return REGISTERGERICHT_LAENDER.has(code.toUpperCase());
}

// ---------------------------------------------------------------------------
// Länderabhängige STEUER-/RECHTSFELDER (Wurzel: „Land statt Sprache")
//
// Welche Felder eine Firmendaten-Maske zeigt, entscheidet der FIRMENSITZ, nicht
// die UI-Sprache. Dasselbe Prinzip steht in `lib/laender-funktionen.ts`
// (DATEV-Ländergate) — hier für die Feldebene.
//
// Anlass (10.09.2026): Ein dänischer Betrieb, der die Oberfläche auf Deutsch
// gestellt hat, sah unter /konto ein Feld „Steuernummer". In Dänemark gibt es
// die nicht: CVR = SE = TIN, und die USt-IdNr. ist dieselbe Zahl mit „DK"
// davor (live: vat_id 'DK44179377', tax_number null). Ein Feld, das der
// Betrieb in seinem Land gar nicht befüllen KANN, sieht aus wie eine Lücke in
// seinen Stammdaten — er sucht den Fehler bei sich.
// ---------------------------------------------------------------------------

// Länder, in denen es KEINE separate Steuernummer neben der USt-IdNr. gibt.
//
// Der Unterschied, um den es geht:
//   DE: Steuernummer 12/345/67890 (Finanzamt) UND USt-IdNr. DE123456789 —
//       zwei verschiedene Nummernkreise, zwei Behörden, beide eintragbar.
//   DK: CVR 44179377 → USt-IdNr. DK44179377 — dieselbe Zahl mit Präfix.
//       Ein zweites Feld hätte schlicht keinen Inhalt.
//
// Bewusst eine DENYLIST, nicht die sonst übliche Allowlist — hier zeigt die
// Allowlist in die SCHÄDLICHE Richtung. Ein Land, das in einer Allowlist
// fehlte, verlöre das Feld und könnte seine echte Steuernummer nirgends mehr
// eintragen: stiller Datenverlust, den niemand als Bug meldet. Ein Land, das
// in dieser Denylist fehlt, behält ein Feld, das es vielleicht nicht braucht —
// das ist die harmlose Richtung (Wurzel 5, fail-closed auf die Datenhaltung).
//
// Aufnahme NUR mit Beleg, dass die USt-IdNr. buchstäblich die nationale
// Unternehmensnummer mit vorangestelltem Länderkürzel ist. Nicht belegte
// Länder bleiben draußen — auch die, bei denen es plausibel wäre (SE, NL, LU,
// MT, SI, PT, CY, BE …); sie behalten das Feld, bis jemand die Behördenquelle
// nachträgt.
//
// Ausdrücklich NICHT hier, weil dort wirklich zwei Nummern existieren
// (Recherche 10.09.2026, gegengeprüft):
//   EE — Registrikood (8 Ziffern) ≠ KMKR-Nummer („EE" + 9 Ziffern):
//        verschiedene Länge, also nicht dieselbe Zahl mit Präfix.
//   IE — Tax Reference Number neben der VAT-Nummer.
//   FR — SIRET (14 Ziffern), auf Rechnungen erwartet, neben der TVA-Nummer.
//   HU — Adószám (11 Ziffern); die USt-IdNr. sind nur deren erste 8 Stellen,
//        aus der USt-IdNr. also NICHT rückrechenbar.
const OHNE_SEPARATE_STEUERNUMMER: ReadonlySet<string> = new Set([
  // CVR = SE-nummer = TIN; die USt-IdNr. ist „DK" + dieselben acht Ziffern.
  // Belegt durch die amtliche DAC7-Vorlage der Skattestyrelsen und live in
  // den Stammdaten des Beta-Betriebs (vat_id 'DK44179377', tax_number null).
  // Quelle: https://erhvervsstyrelsen.dk/cvr
  "DK",
  // Y-tunnus (Business ID) ist die einzige Nummer; die USt-IdNr. ist „FI" +
  // dieselben Ziffern ohne den Bindestrich. Quelle: Verohallinto/PRH,
  // ytj.fi („ALV-numero muodostetaan Y-tunnuksesta").
  "FI",
  // ΑΦΜ ist die einzige Nummer; die USt-IdNr. ist „EL" + derselbe ΑΦΜ.
  // Quelle: AADE (Unabhängige Behörde für Staatseinnahmen).
  "GR",
]);

// Italien ist bewusst NICHT in der Liste, obwohl es dort halb zuträfe: bei
// GESELLSCHAFTEN sind Codice fiscale und Partita IVA dieselbe 11-stellige
// Zahl, bei EINZELUNTERNEHMERN ist der Codice fiscale eine eigene,
// 16-stellige persönliche Kennung neben der 11-stelligen Partita IVA. Die
// Antwort hängt also an der Rechtsform, nicht am Land. Solange diese Maske
// das nicht sauber unterscheidet, zeigt sie für IT BEIDE Felder — ein Feld zu
// viel ist harmlos, ein fehlendes Pflichtfeld nicht (Wurzel 5).

/**
 * Gibt es in diesem Land eine separate Steuernummer NEBEN der USt-IdNr.?
 *
 * Unbekanntes/leeres Land → `true`: solange wir es nicht besser wissen, bleibt
 * das Feld stehen. Ein geratenes „nein" nähme einem Betrieb ein Feld weg, das
 * er braucht (Wurzel 4: kein erfundener Fallback in die schädliche Richtung).
 */
export function hatSeparateSteuernummer(
  code: string | null | undefined,
): boolean {
  if (!code) return true;
  return !OHNE_SEPARATE_STEUERNUMMER.has(code.toUpperCase());
}

// Bezeichnung der Verwaltungsebene unterhalb des Staates — und zugleich die
// Entscheidung, OB die Firmenanschrift dieses Landes eine solche Zeile kennt.
// Der Wert ist ein i18n-Schlüssel im Namensraum `regionLabel`: der Begriff wird
// in der UI-Sprache angezeigt, ausgewählt wird er aber vom LAND.
//
// Warum es die Liste gibt: das Feld hieß in ALLEN 24 Sprachen „Bundesland /
// Region" mit dem Platzhalter „z. B. Bayern" (da.json: „f.eks. Bayern"). Ein
// dänischer Betrieb las also ein deutsches Beispiel für eine Verwaltungsebene,
// die in seiner Anschrift gar nicht vorkommt.
//
// Zwei Quellen, bewusst kombiniert:
//  1. Googles Adress-Metadaten „libaddressinput" (chromium-i18n.appspot.com/
//     ssl-address/data/<CC>, Grundlage von Chrome-Autofill und der
//     Google-Places-Adressen, die diese Maske selbst befüllt): trägt der
//     `fmt`-String eine `%S`-Komponente, gehört die Ebene in die ANSCHRIFT.
//     Abgefragt am 10.09.2026 → EE, IE, IT, LV, LT, RO, ES.
//  2. Stripe verlangt `address.state` für DE/AT/CH beim Connected Account,
//     und der gespeicherte Wert (`companyState`) geht genau dorthin. Diese
//     drei stehen deshalb mit ihrem eigenen Begriff hier, obwohl sie kein `%S`
//     haben — das Bundesland gehört nicht in die deutsche Postanschrift, wohl
//     aber in die Stammdaten des Betriebs.
//
// Bewusst eine ALLOWLIST: ein nicht gelistetes Land bekommt das Feld NICHT.
// Für Dänemark ist das die richtige Antwort (Kommunalreform 2007: nur fünf
// Regionen und Kommunen, keine davon Teil einer Firmenanschrift). Ein Land,
// dessen Ebene jemand belegt, wird hier ergänzt — mit Begriff und Quelle.
//
// Die Begriffe folgen den belegten Recherchestände vom 10.09.2026:
//   EE = Kreis (maakond, 15) — NICHT „Bezirk", das ist linnaosa (Stadtteil)
//   IE = Grafschaft (county, 26 traditionelle; die Reform 2014 auf 31 local
//        authorities betrifft die ADRESSE nicht)
//   IT = Provinz (provincia inkl. Metropolitanstädte, 111; 2-stelliges Kürzel
//        hinter dem Ort)
//   ES = Provinz (provincia, 52 inkl. Ceuta/Melilla laut INE) — NICHT die
//        autonome Gemeinschaft
// Für Länder ohne eigenen belegten Begriff wäre der neutrale Schlüssel
// `region` richtig — „Bundesland" ist ausschließlich DE/AT, „Kanton" CH.
const REGION_LABEL_NACH_LAND: Readonly<Record<string, string>> = {
  // Stripe-Pflichtfeld `address.state` (Quelle 2)
  DE: "state", // Bundesland (16)
  AT: "state", // Bundesland (9)
  CH: "canton", // Kanton (26)
  // Teil der Postanschrift laut libaddressinput (Quelle 1)
  EE: "county", // maakond (15)
  IE: "county", // county (26 traditionelle)
  IT: "province", // provincia (111, Kürzel hinter dem Ort)
  LV: "region", // novads
  LT: "county", // apskritis
  RO: "county", // județ
  ES: "province", // provincia (52)
};

/**
 * i18n-Schlüssel (Namensraum `regionLabel`) für die Regionsbezeichnung eines
 * Landes — oder `null`, wenn die Firmenanschrift dort keine solche Ebene kennt.
 *
 * `null` heißt: Feld ausblenden. Ein leeres „Bundesland" in einer dänischen
 * Anschrift ist keine Lücke, die der Betrieb schließen könnte — er sucht den
 * Fehler dann bei sich.
 */
export function regionLabelKeyFuerLand(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return REGION_LABEL_NACH_LAND[code.toUpperCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Bezeichnung der Umsatzsteuer-Identifikationsnummer je Land.
//
// Hierher verschoben aus `packages/ui/src/countries.ts` (10.09.2026): das Paket
// `@nextdays/ui` ist als „i18n-frei, props-rein" dokumentiert und darf kein
// länderfachliches Wissen und keine deutschen Beschriftungen tragen. Genau das
// tat `countries.ts` aber — deutsche Ländernamen plus deutsche Steuer-Labels.
// Laenderfachliches Wissen gehört in diese Datei, die Anzeige in die
// Sprachdateien.
//
// Die ID selbst ist EU-weit harmonisiert, nur ihr nationaler NAME unterscheidet
// sich. Wo kein eigener Name belegt ist, steht der neutrale EU-Begriff — das
// ist kein erfundener Ersatzwert, sondern die sachlich richtige Bezeichnung
// (Wurzel 4).
const VAT_ID_LABELS: Readonly<Record<string, string>> = {
  DE: "USt-IdNr.",
  AT: "UID-Nr.",
  CH: "MWST-Nr. (UID)",
};

/** Landesspezifische Bezeichnung der USt-IdNr.; sonst der neutrale EU-Begriff. */
export function vatIdLabel(country: string | undefined | null): string {
  return VAT_ID_LABELS[(country || "").toUpperCase()] ?? "VAT ID";
}
