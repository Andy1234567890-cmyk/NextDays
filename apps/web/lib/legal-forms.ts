// Rechtsform-Katalog je EU-Land → Stripe business_type (individual|company|
// non_profit). Der Backend-Mapper (buchhaltung/stripe_legal_form.py) ist die
// verbindliche Quelle für die konkrete company.structure; hier geht es nur
// darum, dem Nutzer die landesüblichen Rechtsformen zur Auswahl zu geben und
// daraus den groben Kontotyp (accountType) abzuleiten. Die `key`-Werte werden
// 1:1 als legal_form ans Backend geschickt und dort erkannt.

export type StripeAccountType = "individual" | "company" | "non_profit";

export interface LegalForm {
  key: string; // an Backend übergeben (legal_form)
  label: string; // Anzeige
  type: StripeAccountType;
}

// Länderspezifische Rechtsformen. Reihenfolge: häufigste zuerst. Die Keys
// entsprechen den im Backend-Mapper erkannten Formen.
const FORMS_BY_COUNTRY: Record<string, LegalForm[]> = {
  DE: [
    { key: "Einzelunternehmen", label: "Einzelunternehmen", type: "individual" },
    { key: "Freiberufler", label: "Freiberufler / Freelancer", type: "individual" },
    { key: "e.K.", label: "e.K. (eingetragener Kaufmann)", type: "individual" },
    { key: "GmbH", label: "GmbH", type: "company" },
    { key: "UG", label: "UG (haftungsbeschränkt)", type: "company" },
    { key: "AG", label: "AG", type: "company" },
    { key: "GbR", label: "GbR", type: "company" },
    { key: "OHG", label: "OHG", type: "company" },
    { key: "KG", label: "KG", type: "company" },
    { key: "GmbH & Co. KG", label: "GmbH & Co. KG", type: "company" },
    { key: "e.V.", label: "e.V. (Verein)", type: "non_profit" },
    { key: "gGmbH", label: "gGmbH (gemeinnützig)", type: "non_profit" },
  ],
  AT: [
    { key: "Einzelunternehmen", label: "Einzelunternehmen", type: "individual" },
    { key: "GmbH", label: "GmbH", type: "company" },
    { key: "AG", label: "AG", type: "company" },
    { key: "OG", label: "OG", type: "company" },
    { key: "KG", label: "KG", type: "company" },
    { key: "Verein", label: "Verein", type: "non_profit" },
  ],
  FR: [
    { key: "Entreprise individuelle", label: "Entreprise individuelle", type: "individual" },
    { key: "Auto-entrepreneur", label: "Micro-entrepreneur", type: "individual" },
    { key: "SARL", label: "SARL", type: "company" },
    { key: "SAS", label: "SAS", type: "company" },
    { key: "SASU", label: "SASU", type: "company" },
    { key: "EURL", label: "EURL", type: "company" },
    { key: "SA", label: "SA", type: "company" },
    { key: "SCI", label: "SCI", type: "company" },
    { key: "Association", label: "Association", type: "non_profit" },
  ],
  ES: [
    { key: "Autónomo", label: "Autónomo", type: "individual" },
    { key: "SL", label: "Sociedad Limitada (SL)", type: "company" },
    { key: "SA", label: "Sociedad Anónima (SA)", type: "company" },
    { key: "Asociación", label: "Asociación", type: "non_profit" },
  ],
  IT: [
    { key: "Ditta individuale", label: "Ditta individuale", type: "individual" },
    { key: "SRL", label: "SRL", type: "company" },
    { key: "SPA", label: "SpA", type: "company" },
    { key: "SNC", label: "SNC", type: "company" },
    { key: "SAS", label: "SAS", type: "company" },
    { key: "Associazione", label: "Associazione", type: "non_profit" },
  ],
  NL: [
    { key: "Eenmanszaak", label: "Eenmanszaak", type: "individual" },
    { key: "ZZP", label: "ZZP'er", type: "individual" },
    { key: "BV", label: "BV", type: "company" },
    { key: "NV", label: "NV", type: "company" },
    { key: "VOF", label: "VOF", type: "company" },
    { key: "Stichting", label: "Stichting", type: "non_profit" },
    { key: "Vereniging", label: "Vereniging", type: "non_profit" },
  ],
  BE: [
    { key: "Eenmanszaak", label: "Eenmanszaak / Entreprise individuelle", type: "individual" },
    { key: "SRL", label: "SRL / BV", type: "company" },
    { key: "SA", label: "SA / NV", type: "company" },
    { key: "VZW", label: "VZW / ASBL", type: "non_profit" },
  ],
  LU: [
    { key: "Entreprise individuelle", label: "Entreprise individuelle", type: "individual" },
    { key: "SARL", label: "SARL", type: "company" },
    { key: "SA", label: "SA", type: "company" },
    { key: "ASBL", label: "ASBL", type: "non_profit" },
  ],
  IE: [
    { key: "Sole trader", label: "Sole trader", type: "individual" },
    { key: "Ltd", label: "Private Limited (Ltd)", type: "company" },
    { key: "PLC", label: "PLC", type: "company" },
    { key: "Charity", label: "Charity", type: "non_profit" },
  ],
  PT: [
    { key: "ENI", label: "Empresário em nome individual", type: "individual" },
    { key: "Lda", label: "Lda", type: "company" },
    { key: "SA", label: "SA", type: "company" },
    { key: "Associação", label: "Associação", type: "non_profit" },
  ],
  DK: [
    { key: "Enkeltmandsvirksomhed", label: "Enkeltmandsvirksomhed", type: "individual" },
    { key: "ApS", label: "ApS", type: "company" },
    { key: "A/S", label: "A/S", type: "company" },
    { key: "Forening", label: "Forening", type: "non_profit" },
  ],
  SE: [
    { key: "Enskild firma", label: "Enskild firma", type: "individual" },
    { key: "AB", label: "Aktiebolag (AB)", type: "company" },
    { key: "HB", label: "Handelsbolag (HB)", type: "company" },
    { key: "Ideell förening", label: "Ideell förening", type: "non_profit" },
  ],
  FI: [
    { key: "Toiminimi", label: "Toiminimi", type: "individual" },
    { key: "Oy", label: "Oy", type: "company" },
    { key: "Oyj", label: "Oyj", type: "company" },
    { key: "Yhdistys", label: "Yhdistys", type: "non_profit" },
  ],
  EE: [
    { key: "FIE", label: "FIE", type: "individual" },
    { key: "OÜ", label: "OÜ", type: "company" },
    { key: "AS", label: "AS", type: "company" },
    { key: "MTÜ", label: "MTÜ", type: "non_profit" },
  ],
  LV: [
    { key: "Individuālais komersants", label: "Individuālais komersants", type: "individual" },
    { key: "SIA", label: "SIA", type: "company" },
    { key: "AS", label: "AS", type: "company" },
    { key: "Biedrība", label: "Biedrība", type: "non_profit" },
  ],
  LT: [
    { key: "Individuali veikla", label: "Individuali veikla", type: "individual" },
    { key: "UAB", label: "UAB", type: "company" },
    { key: "AB", label: "AB", type: "company" },
    { key: "Asociacija", label: "Asociacija", type: "non_profit" },
  ],
  PL: [
    { key: "Jednoosobowa działalność gospodarcza", label: "Jednoosobowa działalność gospodarcza", type: "individual" },
    { key: "sp. z o.o.", label: "sp. z o.o.", type: "company" },
    { key: "S.A.", label: "S.A.", type: "company" },
    { key: "Fundacja", label: "Fundacja", type: "non_profit" },
  ],
  CZ: [
    { key: "OSVČ", label: "OSVČ (živnostník)", type: "individual" },
    { key: "s.r.o.", label: "s.r.o.", type: "company" },
    { key: "a.s.", label: "a.s.", type: "company" },
    { key: "Spolek", label: "Spolek", type: "non_profit" },
  ],
  SK: [
    { key: "SZČO", label: "SZČO (živnostník)", type: "individual" },
    { key: "s.r.o.", label: "s.r.o.", type: "company" },
    { key: "a.s.", label: "a.s.", type: "company" },
    { key: "Občianske združenie", label: "Občianske združenie", type: "non_profit" },
  ],
  HU: [
    { key: "Egyéni vállalkozó", label: "Egyéni vállalkozó", type: "individual" },
    { key: "Kft", label: "Kft", type: "company" },
    { key: "Zrt", label: "Zrt", type: "company" },
    { key: "Egyesület", label: "Egyesület", type: "non_profit" },
  ],
  RO: [
    { key: "PFA", label: "PFA", type: "individual" },
    { key: "SRL (Romania)", label: "SRL", type: "company" },
    { key: "SA", label: "SA", type: "company" },
    { key: "Asociație", label: "Asociație", type: "non_profit" },
  ],
  BG: [
    { key: "ET", label: "ЕТ (Едноличен търговец)", type: "individual" },
    { key: "OOD", label: "ООД", type: "company" },
    { key: "EOOD", label: "ЕООД", type: "company" },
    { key: "AD", label: "АД", type: "company" },
    { key: "Сдружение", label: "Сдружение", type: "non_profit" },
  ],
  SI: [
    { key: "Samostojni podjetnik", label: "Samostojni podjetnik (s.p.)", type: "individual" },
    { key: "d.o.o.", label: "d.o.o.", type: "company" },
    { key: "d.d.", label: "d.d.", type: "company" },
    { key: "Društvo", label: "Društvo", type: "non_profit" },
  ],
  HR: [
    { key: "Obrt", label: "Obrt", type: "individual" },
    { key: "d.o.o.", label: "d.o.o.", type: "company" },
    { key: "j.d.o.o.", label: "j.d.o.o.", type: "company" },
    { key: "d.d.", label: "d.d.", type: "company" },
    { key: "Udruga", label: "Udruga", type: "non_profit" },
  ],
  GR: [
    { key: "Ατομική επιχείρηση", label: "Ατομική επιχείρηση", type: "individual" },
    { key: "SA", label: "Α.Ε.", type: "company" },
    { key: "Σωματείο", label: "Σωματείο", type: "non_profit" },
  ],
  CY: [
    { key: "Sole trader", label: "Sole trader", type: "individual" },
    { key: "Ltd", label: "Ltd", type: "company" },
    { key: "Σωματείο", label: "Association", type: "non_profit" },
  ],
  MT: [
    { key: "Sole trader", label: "Sole trader", type: "individual" },
    { key: "Ltd", label: "Ltd", type: "company" },
    { key: "Association", label: "Association", type: "non_profit" },
  ],
};

// Fallback für Länder ohne eigene Liste: generische EU-Formen.
const GENERIC: LegalForm[] = [
  { key: "Einzelunternehmen", label: "Einzelunternehmen / Sole trader", type: "individual" },
  { key: "Freiberufler", label: "Freelancer", type: "individual" },
  { key: "company", label: "Firma / Company", type: "company" },
  { key: "Verein", label: "Verein / Non-Profit", type: "non_profit" },
];

export function legalFormsForCountry(country: string): LegalForm[] {
  return FORMS_BY_COUNTRY[country?.toUpperCase()] ?? GENERIC;
}

export function accountTypeForLegalForm(
  country: string,
  legalFormKey: string,
): StripeAccountType {
  const form = legalFormsForCountry(country).find((f) => f.key === legalFormKey);
  return form?.type ?? "individual";
}
