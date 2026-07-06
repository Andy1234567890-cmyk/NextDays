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
