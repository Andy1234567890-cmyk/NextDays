// Länder für die Steuerzahler-Angaben (DAC7/PStTG).
//
// Umfang: die 27 EU-Mitgliedstaaten plus Norwegen, Island und Liechtenstein
// (EWR) sowie das Vereinigte Königreich und die Schweiz — dort haben Betriebe
// typischerweise Objekte, und die Meldepflicht bzw. vergleichbare Regeln
// greifen. Bewusst KEINE Weltliste: jedes zusätzliche Land bräuchte geprüfte
// Regeln zur Steuernummer, und die zu erfinden wäre falsch (Wurzel 4).
//
// Die Namen stehen hier auf Deutsch, weil das Frontend derzeit nur Deutsch
// spricht (gastgeber/messages/de.json). Kommt eine zweite Sprache, wandern sie
// in die Message-Dateien.

export interface Land {
  code: string;
  name: string;
  /** EU-Mitglied → DAC7 gilt unmittelbar. */
  eu: boolean;
}

export const LAENDER: readonly Land[] = [
  { code: "AT", name: "Österreich", eu: true },
  { code: "BE", name: "Belgien", eu: true },
  { code: "BG", name: "Bulgarien", eu: true },
  { code: "CH", name: "Schweiz", eu: false },
  { code: "CY", name: "Zypern", eu: true },
  { code: "CZ", name: "Tschechien", eu: true },
  { code: "DE", name: "Deutschland", eu: true },
  { code: "DK", name: "Dänemark", eu: true },
  { code: "EE", name: "Estland", eu: true },
  { code: "ES", name: "Spanien", eu: true },
  { code: "FI", name: "Finnland", eu: true },
  { code: "FR", name: "Frankreich", eu: true },
  { code: "GB", name: "Vereinigtes Königreich", eu: false },
  { code: "GR", name: "Griechenland", eu: true },
  { code: "HR", name: "Kroatien", eu: true },
  { code: "HU", name: "Ungarn", eu: true },
  { code: "IE", name: "Irland", eu: true },
  { code: "IS", name: "Island", eu: false },
  { code: "IT", name: "Italien", eu: true },
  { code: "LI", name: "Liechtenstein", eu: false },
  { code: "LT", name: "Litauen", eu: true },
  { code: "LU", name: "Luxemburg", eu: true },
  { code: "LV", name: "Lettland", eu: true },
  { code: "MT", name: "Malta", eu: true },
  { code: "NL", name: "Niederlande", eu: true },
  { code: "NO", name: "Norwegen", eu: false },
  { code: "PL", name: "Polen", eu: true },
  { code: "PT", name: "Portugal", eu: true },
  { code: "RO", name: "Rumänien", eu: true },
  { code: "SE", name: "Schweden", eu: true },
  { code: "SI", name: "Slowenien", eu: true },
  { code: "SK", name: "Slowakei", eu: true },
] as const;

const NACH_CODE = new Map(LAENDER.map((l) => [l.code, l]));

/** Ländername zum Code, oder der Code selbst, wenn er unbekannt ist —
 *  nie ein erfundener Name. */
export function landName(code: string): string {
  return NACH_CODE.get(code.toUpperCase())?.name ?? code.toUpperCase();
}
