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

// Kleinunternehmer-/USt-Befreiungsregelung je Land. Der Begriff ist national
// (DE §19 UStG, FR franchise en base, IT regime forfettario …) — daher pro Land
// die passende Bezeichnung, sonst neutraler Fallback. `hinweis` erklärt kurz.
type KleinunternehmerLabel = {
  label: string; // Checkbox-Text
  hinweis: string; // kurze Erläuterung darunter
};

const KLEINUNTERNEHMER_FALLBACK: KleinunternehmerLabel = {
  label: "Von der Umsatzsteuer befreit — keine USt-ID nötig",
  hinweis: "Aktivieren, wenn dein Unternehmen keine Umsatzsteuer ausweist.",
};

const KLEINUNTERNEHMER_NACH_LAND: Readonly<
  Record<string, KleinunternehmerLabel>
> = {
  DE: {
    label: "Kleinunternehmer (§19 UStG) — keine USt-ID nötig",
    hinweis: "Befreiung von der Umsatzsteuer nach der Kleinunternehmerregelung.",
  },
  AT: {
    label: "Kleinunternehmer (§6 Abs. 1 Z 27 UStG) — keine USt-ID nötig",
    hinweis: "Österreichische Kleinunternehmerregelung.",
  },
  CH: {
    label: "Von der MWST befreit — keine MWST-Nummer nötig",
    hinweis: "Unter der Umsatzgrenze für die MWST-Pflicht.",
  },
  FR: {
    label: "Franchise en base de TVA — keine USt-ID nötig",
    hinweis: "Französische Kleinunternehmer-/Auto-entrepreneur-Regelung.",
  },
  IT: {
    label: "Regime forfettario — keine USt-ID nötig",
    hinweis: "Italienisches Pauschalsystem für Kleinunternehmen.",
  },
  ES: {
    label: "Von der Umsatzsteuer befreit — keine USt-ID nötig",
    hinweis: "Befreiung von der spanischen IVA.",
  },
  NL: {
    label: "Kleineondernemersregeling (KOR) — keine USt-ID nötig",
    hinweis: "Niederländische Kleinunternehmerregelung.",
  },
  BE: {
    label: "Franchise/Vrijstelling kleine ondernemingen — keine USt-ID nötig",
    hinweis: "Belgische Befreiung für Kleinunternehmen.",
  },
  PL: {
    label: "Zwolnienie z VAT — keine USt-ID nötig",
    hinweis: "Polnische Umsatzsteuerbefreiung für Kleinunternehmen.",
  },
  PT: {
    label: "Regime de isenção (art. 53.º CIVA) — keine USt-ID nötig",
    hinweis: "Portugiesische Befreiungsregelung.",
  },
};

// Kleinunternehmer-/Befreiungs-Label für ein Land (Fallback, falls nicht gelistet).
export function kleinunternehmerLabelFuerLand(
  code: string,
): KleinunternehmerLabel {
  return KLEINUNTERNEHMER_NACH_LAND[code] ?? KLEINUNTERNEHMER_FALLBACK;
}
