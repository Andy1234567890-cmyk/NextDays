// Zentrale Länderliste für Registrierung + Onboarding (Firmendaten).
// Start-Markt: DACH zuerst, dann alle EU-Länder. Währung pro Land (ISO 4217).
// Modell ist länderneutral (tenants.country = ISO-3166-1 alpha-2) — weltweit
// erweiterbar; hier bewusst auf DACH+EU+CH begrenzt (siehe Onboarding-Plan).

export type Land = {
  code: string; // ISO-3166-1 alpha-2
  label: string;
  currency: string; // ISO-4217
};

// DACH bewusst zuerst (häufigste Kunden), danach übrige EU alphabetisch.
export const LAENDER: readonly Land[] = [
  { code: "DE", label: "Deutschland", currency: "EUR" },
  { code: "AT", label: "Österreich", currency: "EUR" },
  { code: "CH", label: "Schweiz", currency: "CHF" },
  // übrige EU
  { code: "BE", label: "Belgien", currency: "EUR" },
  { code: "BG", label: "Bulgarien", currency: "BGN" },
  { code: "HR", label: "Kroatien", currency: "EUR" },
  { code: "CY", label: "Zypern", currency: "EUR" },
  { code: "CZ", label: "Tschechien", currency: "CZK" },
  { code: "DK", label: "Dänemark", currency: "DKK" },
  { code: "EE", label: "Estland", currency: "EUR" },
  { code: "FI", label: "Finnland", currency: "EUR" },
  { code: "FR", label: "Frankreich", currency: "EUR" },
  { code: "GR", label: "Griechenland", currency: "EUR" },
  { code: "HU", label: "Ungarn", currency: "HUF" },
  { code: "IE", label: "Irland", currency: "EUR" },
  { code: "IT", label: "Italien", currency: "EUR" },
  { code: "LV", label: "Lettland", currency: "EUR" },
  { code: "LT", label: "Litauen", currency: "EUR" },
  { code: "LU", label: "Luxemburg", currency: "EUR" },
  { code: "MT", label: "Malta", currency: "EUR" },
  { code: "NL", label: "Niederlande", currency: "EUR" },
  { code: "PL", label: "Polen", currency: "PLN" },
  { code: "PT", label: "Portugal", currency: "EUR" },
  { code: "RO", label: "Rumänien", currency: "RON" },
  { code: "SK", label: "Slowakei", currency: "EUR" },
  { code: "SI", label: "Slowenien", currency: "EUR" },
  { code: "ES", label: "Spanien", currency: "EUR" },
  { code: "SE", label: "Schweden", currency: "SEK" },
];

export function currencyForCountry(code: string): string {
  return LAENDER.find((l) => l.code === code)?.currency ?? "EUR";
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

// Kleinunternehmer-/USt-Befreiungsregelung je Land. Der Begriff ist national und
// wurde anhand offizieller Steuerbehörden verifiziert (DE/AT BMF, FR Legifrance,
// IT/PT/PL/SK/SI/HR/HU/GR/LU nationale Finanzverwaltungen, CH ESTV). Mehrere
// Länder (DK, EE, FI, IE, LV, SE, CY, CZ, BG) haben KEINEN Eigennamen, nur eine
// Umsatzschwelle → dort der korrekte beschreibende Begriff. ES hat KEIN
// nationales Regime (`exists: false`) — die EU-Franchise ist für Inlandsumsätze
// nicht umgesetzt; dort wird keine Befreiungs-Checkbox angeboten.
type KleinunternehmerLabel = {
  label: string; // Checkbox-Text
  hinweis: string; // kurze Erläuterung darunter
  exists?: boolean; // false = kein nationales Befreiungsregime → Checkbox ausblenden
};

const KLEINUNTERNEHMER_FALLBACK: KleinunternehmerLabel = {
  label: "Von der Umsatzsteuer befreit — keine USt-ID nötig",
  hinweis: "Aktivieren, wenn dein Unternehmen keine Umsatzsteuer ausweist.",
};

const KLEINUNTERNEHMER_NACH_LAND: Readonly<
  Record<string, KleinunternehmerLabel>
> = {
  // DACH
  DE: {
    label: "Kleinunternehmer (§ 19 UStG) — keine USt-ID nötig",
    hinweis: "Befreiung nach der Kleinunternehmerregelung.",
  },
  AT: {
    label: "Kleinunternehmer (§ 6 Abs. 1 Z 27 UStG) — keine USt-ID nötig",
    hinweis: "Österreichische Kleinunternehmerregelung.",
  },
  CH: {
    label: "Von der MWST-Pflicht befreit — keine MWST-Nummer nötig",
    hinweis:
      "Befreiung von der Steuerpflicht (Art. 10 Abs. 2 MWSTG), unter der Umsatzgrenze.",
  },
  // EU mit benanntem nationalem Regime
  FR: {
    label: "Franchise en base de TVA — keine USt-ID nötig",
    hinweis: "Französische Kleinunternehmerregelung (Art. 293 B CGI).",
  },
  IT: {
    label: "Regime forfettario — keine USt-ID nötig",
    hinweis: "Italienisches Pauschalsystem (L. 190/2014).",
  },
  NL: {
    label: "Kleineondernemersregeling (KOR) — keine USt-ID nötig",
    hinweis: "Niederländische Kleinunternehmerregelung (Art. 25 OB 1968).",
  },
  BE: {
    label: "Vrijstellingsregeling / Franchise (art. 56bis) — keine USt-ID nötig",
    hinweis: "Belgische Befreiung für Kleinunternehmen.",
  },
  PL: {
    label: "Zwolnienie podmiotowe z VAT — keine USt-ID nötig",
    hinweis: "Polnische Umsatzsteuerbefreiung (Art. 113 ustawy o VAT).",
  },
  PT: {
    label: "Regime de isenção (art. 53.º CIVA) — keine USt-ID nötig",
    hinweis: "Portugiesische Befreiungsregelung.",
  },
  HU: {
    label: "Alanyi adómentesség — keine USt-ID nötig",
    hinweis: "Ungarische subjektive Steuerbefreiung (Áfa tv.).",
  },
  HR: {
    label:
      "Oslobođenje za male porezne obveznike — keine USt-ID nötig",
    hinweis: "Kroatische Befreiung für Kleinunternehmen.",
  },
  GR: {
    label: "Απαλλαγή ΦΠΑ μικρών επιχειρήσεων — keine USt-ID nötig",
    hinweis: "Griechische Befreiung für Kleinunternehmen (Art. 44α–44γ).",
  },
  SI: {
    label: "Oprostitev DDV za male davčne zavezance — keine USt-ID nötig",
    hinweis: "Slowenische Befreiung (člen 94 ZDDV-1).",
  },
  SK: {
    label: "Oslobodenie od dane pre malý podnik — keine USt-ID nötig",
    hinweis: "Slowakische Kleinunternehmer-Sonderregelung (§ 68e–68g).",
  },
  LT: {
    label: "Smulkiojo verslo schema (atleidimas nuo PVM) — keine USt-ID nötig",
    hinweis: "Litauische Kleinunternehmer-Regelung.",
  },
  LU: {
    label: "Régime de franchise des petites entreprises — keine USt-ID nötig",
    hinweis: "Luxemburgische Kleinunternehmer-Befreiung (Art. 57 TVA).",
  },
  RO: {
    label:
      "Regimul special de scutire pentru întreprinderile mici — keine USt-ID nötig",
    hinweis: "Rumänische Kleinunternehmer-Befreiung (Art. 310 Cod fiscal).",
  },
  MT: {
    label: "Article 11 (small undertakings) — keine USt-ID nötig",
    hinweis: "Maltesische Befreiung für Kleinunternehmen (Art. 11 VAT Act).",
  },
  // EU ohne Eigennamen — nur Umsatzschwelle (beschreibender Begriff)
  DK: {
    label: "Momsfritagelse (under registreringsgrænsen) — keine USt-ID nötig",
    hinweis: "Dänemark: unter der Registrierungsgrenze keine Mehrwertsteuer.",
  },
  SE: {
    label: "Momsbefrielse (liten omsättning) — keine USt-ID nötig",
    hinweis: "Schweden: Befreiung bei geringem Umsatz.",
  },
  FI: {
    label: "Arvonlisäveroton vähäinen toiminta — keine USt-ID nötig",
    hinweis: "Finnland: umsatzsteuerfreie geringfügige Tätigkeit.",
  },
  EE: {
    label: "Käibemaksuvabastus (alla piirmäära) — keine USt-ID nötig",
    hinweis: "Estland: unter der Umsatzgrenze keine Umsatzsteuer.",
  },
  LV: {
    label: "Atbrīvojums no PVN (zem sliekšņa) — keine USt-ID nötig",
    hinweis: "Lettland: unter der Schwelle keine Umsatzsteuer.",
  },
  CZ: {
    label: "Osvobození od DPH (neplátce) — keine USt-ID nötig",
    hinweis: "Tschechien: unter der Umsatzgrenze Nicht-Zahler.",
  },
  BG: {
    label: "Освобождаване от ДДС (под прага) — keine USt-ID nötig",
    hinweis: "Bulgarien: unter der Registrierungsschwelle keine Umsatzsteuer.",
  },
  CY: {
    label: "VAT exemption for small undertakings — keine USt-ID nötig",
    hinweis: "Zypern: Befreiung unter der Registrierungsgrenze.",
  },
  IE: {
    label: "Below the VAT registration threshold — keine USt-ID nötig",
    hinweis: "Irland: unter der Registrierungsgrenze keine USt-Registrierung.",
  },
  // EU OHNE nationales Befreiungsregime
  ES: {
    label: "",
    hinweis: "",
    exists: false,
  },
};

// Kleinunternehmer-/Befreiungs-Label für ein Land (Fallback, falls nicht gelistet).
export function kleinunternehmerLabelFuerLand(
  code: string,
): KleinunternehmerLabel {
  const eintrag = KLEINUNTERNEHMER_NACH_LAND[code];
  if (eintrag) return eintrag;
  return KLEINUNTERNEHMER_FALLBACK;
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
